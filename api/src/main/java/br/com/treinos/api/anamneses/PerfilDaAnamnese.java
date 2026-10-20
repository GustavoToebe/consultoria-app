package br.com.treinos.api.anamneses;

import br.com.plataforma.comum.web.BadRequestException;
import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.alunos.Aluno;
import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.alunos.AlunoService;
import br.com.treinos.api.alunos.dto.AlunoDtos.Endereco;
import br.com.treinos.api.auth.Usuario;
import br.com.treinos.api.auth.UsuarioRepository;
import br.com.treinos.api.equipe.AcessoAtual;
import br.com.treinos.api.execucao.RegistroPeso;
import br.com.treinos.api.execucao.RegistroPesoRepository;
import br.com.treinos.api.questionarios.DestinoNoPerfil;
import br.com.treinos.api.questionarios.TipoPergunta;
import br.com.treinos.api.web.Formatos;
import br.com.treinos.api.web.NaoEncontradoException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Respostas da anamnese alimentando o cadastro do aluno, sem recadastro (fase C, 19/10). Cada pergunta pode ter um
 * {@link DestinoNoPerfil}; no envio, na mesma transação: campo vazio é preenchido (e fica registrado como origem), valor
 * igual não muda nada e valor diferente vira uma alteração PENDENTE que a equipe aplica ou descarta. Nada é apagado em
 * silêncio e o histórico de pesos nunca é sobrescrito sem alguém da equipe aplicar. Nome e e-mail nunca mudam por aqui
 * (o e-mail é o login). Valores são dado sensível (CPF, endereço e telefone também): nada daqui vai a log, a exceção nem à
 * auditoria (resumos fixos).
 *
 * <p>Destinos e comparação (tudo normalizado antes de comparar): {@code OBJETIVO} e {@code CPF} (texto; o CPF por
 * {@code Formatos.cpf}); {@code TELEFONE} ({@code Formatos.telefone}, guardado no {@code Usuario} do aluno, que quem
 * responde sempre tem); {@code ENDERECO} (campo a campo: sem espaços nas pontas, CEP formatado, UF maiúscula; cadastro
 * "vazio" = os sete campos nulos; aplicar substitui os sete). Um CPF que já é de outro aluno da consultoria não preenche
 * sozinho: vira PENDENTE (o aluno não fica sabendo) e, ao aplicar, a equipe recebe 409 {@code ALUNO_CPF_EM_USO}.
 *
 * <p>Ordem de travas: no envio, a anamnese (já travada pelo {@link AnamneseService}), depois o aluno e, no telefone, o
 * usuário dele; ao aplicar ou descartar, o aluno (só ao aplicar), o usuário (só no telefone) e depois a pendência, lida já
 * com a trava para nunca agir sobre um estado velho. O envio só cria pendências de uma anamnese ainda não enviada, e
 * aplicar só mexe nas de uma já enviada: as duas ordens nunca disputam as mesmas linhas.
 */
@Component
public class PerfilDaAnamnese {

    private final AnamnesePendenciaRepository pendencias;
    private final AlunoRepository alunos;
    private final RegistroPesoRepository pesos;
    private final UsuarioRepository usuarios;
    private final JsonMapper json;

    public PerfilDaAnamnese(AnamnesePendenciaRepository pendencias, AlunoRepository alunos, RegistroPesoRepository pesos,
                            UsuarioRepository usuarios, JsonMapper json) {
        this.pendencias = pendencias;
        this.alunos = alunos;
        this.pesos = pesos;
        this.usuarios = usuarios;
        this.json = json;
    }

    /**
     * Aplica as respostas com destino (já validadas e sem as escondidas por condição). Devolve se algum campo vazio foi
     * preenchido, para a auditoria. Só roda uma vez por anamnese: o reenvio da já enviada nem chega aqui, e a restrição
     * única (anamnese, destino) é a rede.
     *
     * @param hoje data do envio no horário de Brasília (a do peso quando o questionário não indica a data da pesagem)
     * @param registradoPor quem envia (o usuário do aluno), gravado no peso preenchido
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public boolean aplicarNoEnvio(Anamnese a, JsonNode modelo, JsonNode respostas, UUID registradoPor, LocalDate hoje) {
        boolean preencheu = false;
        Instant agora = Instant.now();
        for (var secao : modelo.path("secoes")) {
            for (var p : secao.path("perguntas")) {
                DestinoNoPerfil destino = destino(p);
                JsonNode resposta = respostas.path(p.path("id").asString());
                if (destino == null || resposta.isMissingNode() || resposta.isNull()) {
                    continue;
                }
                String perguntaId = p.path("id").asString();
                Resultado r = switch (destino) {
                    case OBJETIVO -> objetivoNoEnvio(a.getAlunoId(), resposta);
                    case PESO -> pesoNoEnvio(a.getAlunoId(), resposta, dataDaPesagem(p, respostas, hoje), registradoPor);
                    case CPF -> cpfNoEnvio(a.getAlunoId(), resposta);
                    case TELEFONE -> telefoneNoEnvio(a.getAlunoId(), resposta);
                    case ENDERECO -> enderecoNoEnvio(a.getAlunoId(), resposta);
                };
                if (r.situacao() == Resultado.Situacao.PREENCHIDO) {
                    pendencias.save(AnamnesePendencia.automatica(a.getId(), a.getAlunoId(), destino, perguntaId, r.valor(), agora));
                    preencheu = true;
                } else if (r.situacao() == Resultado.Situacao.DIFERENTE) {
                    pendencias.save(new AnamnesePendencia(a.getId(), a.getAlunoId(), destino, perguntaId, r.valor(), agora));
                }
            }
        }
        pendencias.flush();
        return preencheu;
    }

    /** Pendências da anamnese, na ordem em que nasceram. */
    @Transactional(readOnly = true)
    public List<AnamnesePendencia> daAnamnese(UUID anamneseId) {
        return pendencias.findByAnamneseIdOrderByCriadaEmAsc(anamneseId);
    }

    /** Abertas por anamnese do aluno (só as que têm alguma). */
    @Transactional(readOnly = true)
    public Map<UUID, Long> abertasPorAnamnese(UUID alunoId) {
        Map<UUID, Long> contagem = new HashMap<>();
        for (Object[] linha : pendencias.abertasPorAnamnese(alunoId)) {
            contagem.put((UUID) linha[0], (Long) linha[1]);
        }
        return contagem;
    }

    /**
     * O que o cadastro tem hoje para comparar com o proposto (só das abertas; resolvida = nulo). Mesmo formato do
     * {@code valor}: {@code {"texto"}} (objetivo, CPF, telefone), {@code {"pesoKg", "data"}} ou {@code {"endereco": {...}}};
     * campo vazio = nulo.
     */
    @Transactional(readOnly = true)
    public JsonNode valorAtual(AnamnesePendencia p) {
        if (p.getSituacao() != AnamnesePendencia.Situacao.PENDENTE) {
            return null;
        }
        return switch (p.getDestino()) {
            case OBJETIVO -> alunos.findById(p.getAlunoId()).map(Aluno::getObjetivo).filter(t -> !t.isBlank())
                    .map(PerfilDaAnamnese::texto).map(this::paraJson).orElse(null);
            case PESO -> {
                LocalDate data = LocalDate.parse(json.readTree(p.getValor()).path("data").asString());
                yield pesos.findByAlunoIdAndData(p.getAlunoId(), data).map(r -> paraJson(peso(r.getPesoKg(), data))).orElse(null);
            }
            case CPF -> alunos.findById(p.getAlunoId()).map(Aluno::getCpf).filter(t -> !t.isBlank())
                    .map(PerfilDaAnamnese::texto).map(this::paraJson).orElse(null);
            case TELEFONE -> alunos.findById(p.getAlunoId()).map(Aluno::getUsuarioId).flatMap(usuarios::findById)
                    .map(Usuario::getTelefone).filter(t -> !t.isBlank()).map(PerfilDaAnamnese::texto).map(this::paraJson).orElse(null);
            case ENDERECO -> alunos.findById(p.getAlunoId()).map(Aluno::endereco).map(this::enderecoEmJson).orElse(null);
        };
    }

    /**
     * Aplica a alteração proposta ao cadastro. Exige, além do que a rota pede, a permissão do campo (a de quem o edita na
     * ficha). Aplicar a já aplicada responde sem mudar nada; a descartada não volta (409).
     *
     * @return se mudou alguma coisa (para auditar uma vez só)
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public boolean aplicar(Anamnese a, UUID pendenciaId, UUID usuarioId) {
        Aluno aluno = alunos.buscarParaAlterar(a.getAlunoId()).orElseThrow(() -> new NaoEncontradoException("Aluno não encontrado."));
        AnamnesePendencia p = travar(a, pendenciaId);
        AcessoAtual.exigir(p.getDestino().permissao());
        if (p.getSituacao() == AnamnesePendencia.Situacao.APLICADA) {
            return false;
        }
        exigirPendente(p);
        AlunoService.exigirNaoAnonimizado(aluno);
        JsonNode valor = json.readTree(p.getValor());
        switch (p.getDestino()) {
            case OBJETIVO -> aluno.alterarObjetivo(valor.path("texto").asString());
            case PESO -> gravarPeso(aluno.getId(), LocalDate.parse(valor.path("data").asString()), valor.path("pesoKg").decimalValue(), usuarioId);
            case CPF -> aplicarCpf(aluno, valor.path("texto").asString());
            case TELEFONE -> aplicarTelefone(aluno, valor.path("texto").asString());
            case ENDERECO -> aluno.alterarEndereco(enderecoDoJson(valor.path("endereco")));
        }
        p.resolver(AnamnesePendencia.Situacao.APLICADA, usuarioId, Instant.now());
        try {
            alunos.flush();
        } catch (DataIntegrityViolationException corrida) {
            if (AlunoService.violouCpf(corrida)) {
                throw AlunoService.cpfEmUso();
            }
            throw corrida;
        }
        pendencias.flush();
        return true;
    }

    /** Descarta a alteração proposta: o cadastro fica como está e a resposta continua na anamnese. Idempotente. */
    @Transactional(propagation = Propagation.MANDATORY)
    public boolean descartar(Anamnese a, UUID pendenciaId, UUID usuarioId) {
        AnamnesePendencia p = travar(a, pendenciaId);
        AcessoAtual.exigir(p.getDestino().permissao());
        if (p.getSituacao() == AnamnesePendencia.Situacao.DESCARTADA) {
            return false;
        }
        exigirPendente(p);
        p.resolver(AnamnesePendencia.Situacao.DESCARTADA, usuarioId, Instant.now());
        pendencias.flush();
        return true;
    }

    /** Exportação do titular (LGPD): todas, com o valor proposto. */
    @Transactional(readOnly = true)
    public Map<UUID, List<AnamnesePendencia>> porAnamnese(List<UUID> anamneseIds) {
        Map<UUID, List<AnamnesePendencia>> mapa = new HashMap<>();
        if (!anamneseIds.isEmpty()) {
            pendencias.findByAnamneseIdInOrderByCriadaEmAsc(anamneseIds)
                    .forEach(p -> mapa.computeIfAbsent(p.getAnamneseId(), k -> new java.util.ArrayList<>()).add(p));
        }
        return mapa;
    }

    /** Anonimização do aluno (na transação dela): o valor proposto é dado dele e sai inteiro. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void anonimizarDoAluno(UUID alunoId) {
        pendencias.deleteAll(pendencias.findByAlunoId(alunoId));
        pendencias.flush();
    }

    // ---------------------------------------------------------------- envio

    private record Resultado(Situacao situacao, String valor) {
        enum Situacao { PREENCHIDO, IGUAL, DIFERENTE }
    }

    /** Objetivo: comparado sem os espaços das pontas; resposta em branco não apaga o que há. */
    private Resultado objetivoNoEnvio(UUID alunoId, JsonNode resposta) {
        String proposto = resposta.asString("").strip();
        if (proposto.isEmpty()) {
            return new Resultado(Resultado.Situacao.IGUAL, null);
        }
        Aluno aluno = alunos.buscarParaAlterar(alunoId).orElseThrow(() -> new NaoEncontradoException("Aluno não encontrado."));
        String atual = aluno.getObjetivo() == null ? "" : aluno.getObjetivo().strip();
        String valor = json.writeValueAsString(texto(proposto));
        if (atual.isEmpty()) {
            aluno.alterarObjetivo(proposto);
            alunos.flush();
            return new Resultado(Resultado.Situacao.PREENCHIDO, valor);
        }
        return new Resultado(atual.equals(proposto) ? Resultado.Situacao.IGUAL : Resultado.Situacao.DIFERENTE, valor);
    }

    /** Peso: sem registro na data, grava; com registro igual, nada; diferente, nunca sobrescreve (vira pendência). */
    private Resultado pesoNoEnvio(UUID alunoId, JsonNode resposta, LocalDate data, UUID registradoPor) {
        if (!resposta.isNumber()) {
            return new Resultado(Resultado.Situacao.IGUAL, null);
        }
        BigDecimal kg = resposta.decimalValue();
        String valor = json.writeValueAsString(peso(kg, data));
        var existente = pesos.findByAlunoIdAndData(alunoId, data);
        if (existente.isEmpty()) {
            gravarPeso(alunoId, data, kg, registradoPor);
            return new Resultado(Resultado.Situacao.PREENCHIDO, valor);
        }
        return new Resultado(existente.get().getPesoKg().compareTo(kg) == 0 ? Resultado.Situacao.IGUAL : Resultado.Situacao.DIFERENTE, valor);
    }

    /**
     * CPF: já validado (e formatado) na resposta. Cadastro sem CPF é preenchido, salvo se o CPF já é de outro aluno da
     * consultoria (então fica PENDENTE e ninguém é avisado: o aluno não pode descobrir CPF alheio). A checagem vem antes de
     * mexer no aluno: uma violação do índice abortaria a transação inteira do envio.
     */
    private Resultado cpfNoEnvio(UUID alunoId, JsonNode resposta) {
        String proposto = cpfOuNulo(resposta.asString(""));
        if (proposto == null) {
            return new Resultado(Resultado.Situacao.IGUAL, null);
        }
        Aluno aluno = alunos.buscarParaAlterar(alunoId).orElseThrow(() -> new NaoEncontradoException("Aluno não encontrado."));
        String valor = json.writeValueAsString(texto(proposto));
        if (aluno.getCpf() == null || aluno.getCpf().isBlank()) {
            if (alunos.existsByCpfAndIdNot(proposto, alunoId)) {
                return new Resultado(Resultado.Situacao.DIFERENTE, valor);
            }
            aluno.alterarCpf(proposto);
            try {
                alunos.flush();
            } catch (DataIntegrityViolationException corrida) {
                if (AlunoService.violouCpf(corrida)) {
                    throw new ConflictException("Não foi possível concluir o envio agora. Tente de novo.", "ANAMNESE_TENTE_DE_NOVO");
                }
                throw corrida;
            }
            return new Resultado(Resultado.Situacao.PREENCHIDO, valor);
        }
        return new Resultado(aluno.getCpf().equals(proposto) ? Resultado.Situacao.IGUAL : Resultado.Situacao.DIFERENTE, valor);
    }

    /** Telefone do usuário do aluno (quem responde sempre o tem); comparado já no formato de {@code Formatos.telefone}. */
    private Resultado telefoneNoEnvio(UUID alunoId, JsonNode resposta) {
        String proposto = formatoOuNulo(() -> Formatos.telefone(resposta.asString("")));
        Aluno aluno = alunos.buscarParaAlterar(alunoId).orElseThrow(() -> new NaoEncontradoException("Aluno não encontrado."));
        Usuario usuario = proposto == null || aluno.getUsuarioId() == null ? null
                : usuarios.buscarParaAlterar(aluno.getUsuarioId()).orElse(null);
        if (usuario == null) {
            return new Resultado(Resultado.Situacao.IGUAL, null);
        }
        String atual = telefoneNormalizado(usuario.getTelefone());
        String valor = json.writeValueAsString(texto(proposto));
        if (atual == null) {
            usuario.alterarTelefone(proposto);
            usuarios.flush();
            return new Resultado(Resultado.Situacao.PREENCHIDO, valor);
        }
        return new Resultado(atual.equals(proposto) ? Resultado.Situacao.IGUAL : Resultado.Situacao.DIFERENTE, valor);
    }

    /** Endereço: comparado campo a campo, normalizado; cadastro vazio = os sete campos nulos. */
    private Resultado enderecoNoEnvio(UUID alunoId, JsonNode resposta) {
        Endereco proposto = enderecoDaResposta(resposta);
        if (proposto.vazio()) {
            return new Resultado(Resultado.Situacao.IGUAL, null);
        }
        Aluno aluno = alunos.buscarParaAlterar(alunoId).orElseThrow(() -> new NaoEncontradoException("Aluno não encontrado."));
        String valor = json.writeValueAsString(enderecoEmJson(proposto));
        Endereco atual = aluno.endereco();
        if (atual == null) {
            aluno.alterarEndereco(proposto);
            alunos.flush();
            return new Resultado(Resultado.Situacao.PREENCHIDO, valor);
        }
        return new Resultado(atual.equals(proposto) ? Resultado.Situacao.IGUAL : Resultado.Situacao.DIFERENTE, valor);
    }

    /**
     * Data da pesagem: a resposta da pergunta DATA que o treinador indicou ({@code destinoData}, só hoje ou antes, conferido
     * ao publicar); sem ela (não indicada, sem resposta ou escondida), a data do envio. A tela diz qual vale.
     */
    static LocalDate dataDaPesagem(JsonNode pergunta, JsonNode respostas, LocalDate hoje) {
        String id = pergunta.path("destinoData").asString("");
        JsonNode r = id.isEmpty() ? null : respostas.path(id);
        if (r == null || !r.isString()) {
            return hoje;
        }
        LocalDate informada = LocalDate.parse(r.asString());
        return informada.isAfter(hoje) ? hoje : informada;
    }

    // ---------------------------------------------------------------- apoio

    /** Mantém a observação já registrada no peso do dia (como a atualização). Corrida no mesmo dia = 409. */
    private void gravarPeso(UUID alunoId, LocalDate data, BigDecimal kg, UUID usuarioId) {
        try {
            pesos.findByAlunoIdAndData(alunoId, data).ifPresentOrElse(
                    r -> r.alterar(kg, r.getObservacao(), usuarioId),
                    () -> pesos.save(new RegistroPeso(alunoId, data, kg, null, usuarioId)));
            pesos.flush();
        } catch (DataIntegrityViolationException corrida) {
            if (!violou(corrida, "registro_peso_aluno_id_data_key")) {
                throw corrida;
            }
            throw new ConflictException("O peso deste dia acabou de ser registrado. Tente de novo.", "PESO_JA_REGISTRADO");
        }
    }

    /** Destino da pergunta da versão publicada (já validada: tipo compatível, um por questionário). */
    private static DestinoNoPerfil destino(JsonNode pergunta) {
        String d = pergunta.path("destino").asString("");
        String tipo = pergunta.path("tipo").asString("");
        for (DestinoNoPerfil x : DestinoNoPerfil.values()) {
            for (TipoPergunta t : TipoPergunta.values()) {
                if (x.name().equals(d) && t.name().equals(tipo) && x.aceita(t)) {
                    return x;
                }
            }
        }
        return null;
    }

    private AnamnesePendencia travar(Anamnese a, UUID pendenciaId) {
        return pendencias.buscarParaAlterar(pendenciaId, a.getId())
                .orElseThrow(() -> new NaoEncontradoException("Alteração não encontrada."));
    }

    private static void exigirPendente(AnamnesePendencia p) {
        if (p.getSituacao() != AnamnesePendencia.Situacao.PENDENTE) {
            throw new ConflictException("Esta alteração já foi resolvida. Recarregue.", "ANAMNESE_ALTERACAO_RESOLVIDA");
        }
    }

    /** Aplicar: o CPF proposto não pode ter virado de outro aluno desde o envio (409, sem repetir o valor). */
    private void aplicarCpf(Aluno aluno, String cpf) {
        if (!cpf.equals(aluno.getCpf()) && alunos.existsByCpfAndIdNot(cpf, aluno.getId())) {
            throw AlunoService.cpfEmUso();
        }
        aluno.alterarCpf(cpf);
    }

    /** Aplicar: o telefone mora no usuário do aluno; sem acesso não há onde guardar (409 {@code ALUNO_SEM_ACESSO}). */
    private void aplicarTelefone(Aluno aluno, String telefone) {
        if (aluno.getUsuarioId() == null) {
            throw AlunoService.semAcesso();
        }
        usuarios.buscarParaAlterar(aluno.getUsuarioId()).ifPresent(u -> u.alterarTelefone(telefone));
    }

    private static String cpfOuNulo(String texto) {
        return formatoOuNulo(() -> Formatos.cpf(texto));
    }

    /** Resposta já validada: formato inválido não deveria chegar aqui; se chegar, vale como "sem resposta". */
    private static String formatoOuNulo(java.util.function.Supplier<String> formato) {
        try {
            return formato.get();
        } catch (BadRequestException invalido) {
            return null;
        }
    }

    private static String telefoneNormalizado(String telefone) {
        if (telefone == null || telefone.isBlank()) {
            return null;
        }
        String normalizado = formatoOuNulo(() -> Formatos.telefone(telefone));
        return normalizado != null ? normalizado : telefone.strip();
    }

    private static String campo(JsonNode objeto, String chave) {
        JsonNode n = objeto.path(chave);
        return n.isString() && !n.asString().isBlank() ? n.asString().strip() : null;
    }

    /** Resposta ENDERECO (já validada) normalizada: sem espaços nas pontas, CEP formatado, UF maiúscula, em branco = nulo. */
    private static Endereco enderecoDaResposta(JsonNode resposta) {
        return new Endereco(formatoOuNulo(() -> Formatos.cep(campo(resposta, "cep"))), campo(resposta, "logradouro"),
                campo(resposta, "numero"), campo(resposta, "complemento"), campo(resposta, "bairro"), campo(resposta, "cidade"),
                formatoOuNulo(() -> Formatos.uf(campo(resposta, "uf"))));
    }

    /** O {@code endereco} do valor guardado: já normalizado, sete chaves com texto ou nulo. */
    private static Endereco enderecoDoJson(JsonNode e) {
        return new Endereco(campo(e, "cep"), campo(e, "logradouro"), campo(e, "numero"), campo(e, "complemento"),
                campo(e, "bairro"), campo(e, "cidade"), campo(e, "uf"));
    }

    /** {@code {"endereco": {cep, logradouro, numero, complemento, bairro, cidade, uf}}}, as sete chaves sempre (texto ou nulo). */
    private ObjectNode enderecoEmJson(Endereco e) {
        ObjectNode interno = json.createObjectNode();
        interno.put("cep", e.cep());
        interno.put("logradouro", e.logradouro());
        interno.put("numero", e.numero());
        interno.put("complemento", e.complemento());
        interno.put("bairro", e.bairro());
        interno.put("cidade", e.cidade());
        interno.put("uf", e.uf());
        ObjectNode raiz = json.createObjectNode();
        raiz.set("endereco", interno);
        return raiz;
    }

    private static Map<String, Object> texto(String t) {
        return Map.of("texto", t);
    }

    private static Map<String, Object> peso(BigDecimal kg, LocalDate data) {
        return Map.of("pesoKg", kg.stripTrailingZeros().scale() < 0 ? kg.setScale(0) : kg.stripTrailingZeros(), "data", data.toString());
    }

    private JsonNode paraJson(Map<String, Object> m) {
        ObjectNode n = json.createObjectNode();
        m.forEach((k, v) -> n.set(k, json.valueToTree(v)));
        return n;
    }

    private static boolean violou(DataIntegrityViolationException e, String restricao) {
        for (Throwable t = e; t != null; t = t.getCause()) {
            if (t instanceof org.hibernate.exception.ConstraintViolationException c && restricao.equals(c.getConstraintName())) {
                return true;
            }
        }
        return false;
    }
}
