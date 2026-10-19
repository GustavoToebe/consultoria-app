package br.com.treinos.api.anamneses;

import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.alunos.Aluno;
import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.alunos.AlunoService;
import br.com.treinos.api.equipe.AcessoAtual;
import br.com.treinos.api.execucao.RegistroPeso;
import br.com.treinos.api.execucao.RegistroPesoRepository;
import br.com.treinos.api.questionarios.DestinoNoPerfil;
import br.com.treinos.api.questionarios.TipoPergunta;
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
 * (o e-mail é o login). Valores são dado sensível: nada daqui vai a log nem à auditoria (resumos fixos).
 *
 * <p>Ordem de travas: no envio, a anamnese (já travada pelo {@link AnamneseService}) e depois o aluno; ao aplicar ou
 * descartar, o aluno (só ao aplicar) e depois a pendência, lida já com a trava para nunca agir sobre um estado velho. O envio só cria pendências de uma anamnese ainda não enviada, e aplicar só mexe nas de uma já
 * enviada: as duas ordens nunca disputam as mesmas linhas.
 */
@Component
public class PerfilDaAnamnese {

    private final AnamnesePendenciaRepository pendencias;
    private final AlunoRepository alunos;
    private final RegistroPesoRepository pesos;
    private final JsonMapper json;

    public PerfilDaAnamnese(AnamnesePendenciaRepository pendencias, AlunoRepository alunos, RegistroPesoRepository pesos,
                            JsonMapper json) {
        this.pendencias = pendencias;
        this.alunos = alunos;
        this.pesos = pesos;
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
     * {@code valor}: {@code {"texto"}} ou {@code {"pesoKg", "data"}}; campo vazio = nulo.
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
        }
        p.resolver(AnamnesePendencia.Situacao.APLICADA, usuarioId, Instant.now());
        alunos.flush();
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
