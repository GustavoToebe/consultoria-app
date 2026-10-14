package br.com.treinos.api.atualizacoes;

import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.execucao.AlunoAppService;
import br.com.treinos.api.execucao.RegistroPeso;
import br.com.treinos.api.execucao.RegistroPesoRepository;
import br.com.treinos.api.pastas.PastaPlano;
import br.com.treinos.api.pastas.PastaRepository;
import br.com.treinos.api.pastas.PastaVigente;
import br.com.treinos.api.questionarios.QuestionarioResolver;
import br.com.treinos.api.security.UsuarioAutenticado;
import br.com.treinos.api.web.*;
import br.com.plataforma.comum.web.*;
import jakarta.validation.constraints.*;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import java.time.Instant;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Um check-in por pasta; travar a pasta serializa o primeiro envio e o aviso de atraso. */
@Service
public class AtualizacaoService {
    /** {@code pastaId} diz qual atualização o aluno está respondendo; só a da pasta vigente aceita escrita. */
    public record EnviarRequest(@NotNull UUID pastaId, @NotNull UUID questionarioVersaoId, @NotNull JsonNode respostas) { }
    public record AtrasoRequest(@NotNull UUID pastaId, @NotNull LocalDate novaData, @Size(max = 300) String motivo) { }
    public record FeedbackRequest(@NotBlank @Size(max = 4000) String texto, @NotNull Long versao) { }
    public record Feedback(String texto, Instant em, Instant editadoEm, boolean naoLido, String nomeAutor) { }
    public record Detalhe(UUID id, UUID pastaId, UUID alunoId, String nomeAluno, LocalDate dataAtualizacao,
            String fase, long diasParaData, long diasDeAtraso, LocalDate atrasoAte, String atrasoMotivo,
            int questionarioVersaoNumero, UUID questionarioVersaoId, String questionarioNome, JsonNode modelo, JsonNode respostas, Instant enviadaEm,
            Feedback feedback, Long versao, ResumoPeriodoService.Resumo resumo) {
        /** O que vai para o aluno: o nome do questionário é de trabalho do treinador ("Iniciantes", "Pós-lesão") e não sai. */
        public Detalhe paraAluno() {
            return new Detalhe(id, pastaId, alunoId, nomeAluno, dataAtualizacao, fase, diasParaData, diasDeAtraso, atrasoAte,
                    atrasoMotivo, questionarioVersaoNumero, questionarioVersaoId, null, modelo, respostas, enviadaEm, feedback,
                    versao, resumo);
        }
    }
    private final AtualizacaoRepository atualizacoes;
    private final QuestionarioResolver questionarios;
    private final PastaRepository pastas;
    private final PastaVigente vigente;
    private final AlunoRepository alunos;
    private final RegistroPesoRepository pesos;
    private final ResumoPeriodoService resumos;
    private final ValidadorAtualizacao validador;
    private final JsonMapper json;
    private final br.com.treinos.api.auth.UsuarioRepository usuarios;
    public AtualizacaoService(AtualizacaoRepository atualizacoes, QuestionarioResolver questionarios,
            PastaRepository pastas, PastaVigente vigente, AlunoRepository alunos,
            RegistroPesoRepository pesos, ResumoPeriodoService resumos, ValidadorAtualizacao validador, JsonMapper json,
            br.com.treinos.api.auth.UsuarioRepository usuarios) {
        this.usuarios=usuarios;
        this.atualizacoes = atualizacoes; this.questionarios = questionarios; this.pastas = pastas;
        this.vigente = vigente; this.alunos = alunos; this.pesos = pesos;
        this.resumos = resumos; this.validador = validador; this.json = json;
    }
    @Transactional(readOnly = true)
    public Detalhe atual(UsuarioAutenticado eu) { return atualDoAluno(AlunoAppService.alunoDaSessao(eu)); }
    @Transactional(readOnly = true)
    public Detalhe atualDoAluno(UUID alunoId) {
        exigirAluno(alunoId);
        PastaPlano pasta = pastaAtiva(alunoId);
        if (pasta == null) return new Detalhe(null,null,alunoId,null,null,"NENHUMA",0,0,null,null,0,null,null,null,null,null,null,null,null);
        return detalhe(pasta, atualizacoes.findByPastaId(pasta.getId()).orElse(null));
    }
    @Transactional
    public Detalhe enviar(UsuarioAutenticado eu, EnviarRequest r) {
        UUID alunoId = AlunoAppService.alunoDaSessao(eu);
        // Reenvio do que já foi gravado (rede caiu depois do commit) devolve o estado sem alterar nada,
        // mesmo que a pasta já tenha mudado; por isso vem antes da checagem de pasta vigente.
        var jaEnviada = atualizacoes.findByPastaId(r.pastaId())
                .filter(a -> a.getAlunoId().equals(alunoId) && !"ABERTA".equals(a.getEstado()));
        if (jaEnviada.isPresent()) return detalhe(jaEnviada.get());
        PastaPlano pasta = exigirPastaAtiva(alunoId);
        exigirAtual(pasta, r.pastaId());
        Atualizacao atual = atualizacoes.findByPastaId(pasta.getId()).orElse(null);
        // Dois envios simultâneos: o segundo espera a trava da pasta e encontra o primeiro já gravado.
        if (atual != null && !"ABERTA".equals(atual.getEstado())) return detalhe(pasta, atual);
        LocalDate data = atual == null ? pasta.getFim() : atual.getDataAtualizacao();
        if (LocalDate.now(Fuso.BRASILIA).isBefore(data.minusDays(1)))
            throw invalidos("data", "O formulário libera um dia antes da atualização.");
        var modelo = modelo(pasta, atual);
        // O app confere o id da versão que o aluno respondeu: se o treinador publicou outra no meio, recarrega.
        if (!r.questionarioVersaoId().equals(modelo.versaoId())) throw new ConflictException("O modelo mudou. Recarregue o formulário.", "MODELO_ATUALIZACAO_ALTERADO");
        JsonNode conteudo = json.readTree(modelo.conteudo());
        JsonNode respostas = validador.validar(conteudo, r.respostas());
        if (atual == null) atual = new Atualizacao(alunoId,pasta.getId(),data);
        atual.enviar(json.writeValueAsString(respostas), Instant.now(), modelo.versaoId());
        atualizacoes.saveAndFlush(atual);
        // O peso vem da pergunta do tipo PESO (se o questionário tiver e o aluno tiver respondido).
        var respostaPeso = respostas.path(idDaPergunta(conteudo, "PESO"));
        if (respostaPeso.isNumber()) gravarPeso(eu, alunoId, data, respostaPeso.decimalValue());
        return detalhe(pasta,atual);
    }
    private static String idDaPergunta(JsonNode conteudo, String tipo) {
        for (var secao : conteudo.path("secoes")) for (var p : secao.path("perguntas"))
            if (tipo.equals(p.path("tipo").asString())) return p.path("id").asString();
        return "";
    }
    /** A data é a da atualização, inclusive no envio liberado na véspera (não usar validação de peso futuro). */
    private void gravarPeso(UsuarioAutenticado eu, UUID alunoId, LocalDate data, java.math.BigDecimal peso) {
        try {
            // Mantém a observação já registrada no peso do dia.
            pesos.findByAlunoIdAndData(alunoId,data).ifPresentOrElse(
                p -> p.alterar(peso, p.getObservacao(), eu.usuarioId()),
                () -> pesos.save(new RegistroPeso(alunoId,data,peso,null,eu.usuarioId())));
            pesos.flush();
        } catch (DataIntegrityViolationException corrida) {
            if (!violou(corrida, "registro_peso_aluno_id_data_key")) throw corrida;
            // Outro peso do mesmo dia entrou ao mesmo tempo; a transação inteira volta e o aluno reenvia.
            throw new ConflictException("O peso deste dia acabou de ser registrado. Envie de novo.", "PESO_JA_REGISTRADO");
        }
    }
    @Transactional
    public Detalhe avisarAtraso(UsuarioAutenticado eu, AtrasoRequest r) {
        UUID alunoId = AlunoAppService.alunoDaSessao(eu);
        PastaPlano pasta = exigirPastaAtiva(alunoId);
        exigirAtual(pasta, r.pastaId());
        Atualizacao atual = atualizacoes.findByPastaId(pasta.getId()).orElse(null);
        exigirNaoEnviada(atual);
        LocalDate data = atual == null ? pasta.getFim() : atual.getDataAtualizacao();
        LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
        if (!RegrasAtualizacao.novaDataValida(hoje, data, r.novaData())) {
            LocalDate minimo = hoje.isAfter(data) ? hoje : data;
            throw invalidos("novaData", "Escolha uma data de " + DATA_BR.format(minimo) + " até "
                    + DATA_BR.format(data.plusDays(RegrasAtualizacao.DIAS_MAXIMOS_DE_ATRASO)) + ".");
        }
        if (atual == null) atual = new Atualizacao(alunoId,pasta.getId(),data);
        atual.avisarAtraso(r.novaData(),Buscas.opcional(r.motivo()),Instant.now());
        return detalhe(pasta,atualizacoes.saveAndFlush(atual));
    }
    @Transactional(readOnly = true)
    public List<Detalhe> historico(UsuarioAutenticado eu) { return doAluno(AlunoAppService.alunoDaSessao(eu)); }
    @Transactional(readOnly = true)
    public List<Detalhe> doAluno(UUID alunoId) {
        exigirAluno(alunoId);
        return atualizacoes.findByAlunoIdOrderByDataAtualizacaoDesc(alunoId).stream()
            .map(a -> detalhe(pastas.findById(a.getPastaId()).orElseThrow(() -> new NaoEncontradoException("Atualização não encontrada.")),a)).toList();
    }
    @Transactional(readOnly = true)
    public Detalhe detalheAluno(UsuarioAutenticado eu, UUID id) {
        Atualizacao a = buscar(id);
        if (!a.getAlunoId().equals(AlunoAppService.alunoDaSessao(eu))) throw new NaoEncontradoException("Atualização não encontrada.");
        return detalhe(a);
    }
    @Transactional
    public void feedbackVisto(UsuarioAutenticado eu, UUID id) {
        UUID alunoId = AlunoAppService.alunoDaSessao(eu);
        Atualizacao a = buscar(id);
        if (!a.getAlunoId().equals(alunoId)) throw new NaoEncontradoException("Atualização não encontrada.");
        atualizacoes.marcarFeedbackVisto(a.getId(), alunoId, Instant.now());
    }
    @Transactional(readOnly = true)
    public Detalhe detalheTreinador(UUID id) { return detalhe(buscar(id)); }
    @Transactional
    @br.com.treinos.api.auditoria.Auditar(acao="ATUALIZACAO_FEEDBACK",entidade="ATUALIZACAO",resumo="Enviou ou editou feedback de atualização.")
    public Detalhe responder(UUID id, FeedbackRequest r, UUID usuarioId) {
        Atualizacao a = buscar(id);
        if (!a.getVersao().equals(r.versao())) throw new ConflictException("Outra pessoa alterou a atualização. Recarregue.", "CONFLITO_EDICAO");
        if ("ABERTA".equals(a.getEstado())) throw new ConflictException("A atualização ainda não foi enviada.", "ATUALIZACAO_NAO_ENVIADA");
        a.responder(r.texto().trim(),usuarioId,Instant.now());
        return detalhe(atualizacoes.saveAndFlush(a));
    }
    public static final List<String> SITUACOES = List.of("PARA_REVISAR","ATRASADAS","AVISARAM_ATRASO","PROXIMAS");
    /** Item das listas do treinador: sem modelo, respostas nem resumo (isso é do detalhe). */
    public record ItemDaLista(UUID id, UUID pastaId, UUID alunoId, String nomeAluno, LocalDate dataAtualizacao,
            String fase, long diasParaData, long diasDeAtraso, LocalDate atrasoAte) { }
    private record Classificada(LinhaAtualizacao linha, RegrasAtualizacao.Situacao regras) { }
    /**
     * Lista e contadores do painel saem da mesma consulta e da mesma classificação, para nunca divergirem.
     * {@code responsavelId} vem do usuário autenticado ("Meus alunos"), nunca do cliente.
     */
    @Transactional(readOnly = true)
    public List<ItemDaLista> listar(String situacao, UUID responsavelId) {
        if (!SITUACOES.contains(situacao)) throw new BadRequestException("Situação inválida.");
        return classificar(responsavelId).stream().filter(c -> pertence(situacao, c)).map(c -> new ItemDaLista(
            c.linha().atualizacaoId(),c.linha().pastaId(),c.linha().alunoId(),c.linha().nomeAluno(),c.linha().data(),
            c.regras().fase(),c.regras().diasParaData(),c.regras().diasDeAtraso(),c.linha().atrasoAte())).toList();
    }
    @Transactional(readOnly = true)
    public Map<String,Long> contar(UUID responsavelId) {
        List<Classificada> todas = classificar(responsavelId);
        Map<String,Long> contagem = new LinkedHashMap<>();
        for (String situacao : SITUACOES) contagem.put(situacao, todas.stream().filter(c -> pertence(situacao, c)).count());
        return contagem;
    }
    private List<Classificada> classificar(UUID responsavelId) {
        LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
        return atualizacoes.linhasDoPainel(responsavelId).stream().map(l -> new Classificada(l,
            RegrasAtualizacao.calcular(hoje,l.data(),l.atrasoAte(),l.estado()))).toList();
    }
    private static boolean pertence(String situacao, Classificada c) {
        String fase = c.regras().fase();
        boolean aberta = !List.of("ENVIADA","REVISADA").contains(fase);
        return switch (situacao) {
            case "PARA_REVISAR" -> "ENVIADA".equals(fase);
            case "ATRASADAS" -> "ATRASADA".equals(fase);
            case "AVISARAM_ATRASO" -> c.linha().atrasoAte() != null && aberta;
            case "PROXIMAS" -> c.regras().diasParaData() >= 0 && c.regras().diasParaData() <= 7 && aberta;
            default -> false;
        };
    }
    private PastaPlano pastaAtiva(UUID alunoId) {
        return vigente.de(alunoId).orElse(null);
    }
    private PastaPlano exigirPastaAtiva(UUID alunoId) {
        PastaPlano pasta = pastaAtiva(alunoId);
        if (pasta == null) throw new NaoEncontradoException("Atualização não encontrada.");
        return pastas.travarParaAtualizacao(pasta.getId()).orElseThrow(() -> new NaoEncontradoException("Atualização não encontrada."));
    }
    /** Enviada: a versão fixada no envio. Aberta: a vigente (pasta, depois aluno, depois o padrão), resolvida na hora. */
    private QuestionarioResolver.Resolvida modelo(PastaPlano pasta, Atualizacao a) {
        if (a != null && a.getQuestionarioVersaoId() != null) return questionarios.fixa(a.getQuestionarioVersaoId());
        var aluno = alunos.findById(pasta.getAlunoId()).orElseThrow(() -> new NaoEncontradoException("Aluno não encontrado."));
        return questionarios.vigente(pasta.getQuestionarioId(), aluno.getQuestionarioId());
    }
    private Atualizacao buscar(UUID id) { return atualizacoes.findById(id).orElseThrow(() -> new NaoEncontradoException("Atualização não encontrada.")); }
    private void exigirAluno(UUID id) { Exigir.existe(alunos.findById(id), () -> new NaoEncontradoException("Aluno não encontrado.")); }
    private static void exigirAtual(PastaPlano pasta, UUID pastaId) {
        if (!pasta.getId().equals(pastaId))
            throw new ConflictException("Esta atualização não é mais a atual. Recarregue.", "ATUALIZACAO_NAO_ATUAL");
    }
    private static void exigirNaoEnviada(Atualizacao a) {
        if (a != null && !"ABERTA".equals(a.getEstado())) throw new ConflictException("Esta atualização já foi enviada.", "ATUALIZACAO_JA_ENVIADA");
    }
    private static boolean violou(DataIntegrityViolationException e, String restricao) {
        for (Throwable t = e; t != null; t = t.getCause())
            if (t instanceof org.hibernate.exception.ConstraintViolationException c && restricao.equals(c.getConstraintName())) return true;
        return false;
    }
    private static final java.time.format.DateTimeFormatter DATA_BR = java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static ValidacaoException invalidos(String campo, String mensagem) {
        return new ValidacaoException("Confira os campos.", "ATUALIZACAO_INVALIDA", List.of(new ApiError.FieldError(campo,mensagem)));
    }
    private Detalhe detalhe(Atualizacao a) { return detalhe(pastas.findById(a.getPastaId()).orElseThrow(() -> new NaoEncontradoException("Atualização não encontrada.")),a); }
    private Detalhe detalhe(PastaPlano pasta, Atualizacao a) {
        LocalDate data = a == null ? pasta.getFim() : a.getDataAtualizacao();
        var regras = RegrasAtualizacao.calcular(LocalDate.now(Fuso.BRASILIA),data,a == null ? null : a.getAtrasoAte(),a == null ? null : a.getEstado());
        var modelo = modelo(pasta, a);
        var aluno = alunos.findById(pasta.getAlunoId()).orElseThrow(() -> new NaoEncontradoException("Aluno não encontrado."));
        String autor=a==null || a.getFeedbackPor()==null ? null : usuarios.findById(a.getFeedbackPor())
                .filter(u -> u.getConsultoriaId().equals(aluno.getConsultoriaId())).map(br.com.treinos.api.auth.Usuario::getNome).orElse(null);
        var feedback = a == null || a.getFeedbackEm() == null ? null : new Feedback(a.getFeedback(),a.getFeedbackEm(),a.getFeedbackEditadoEm(),a.getFeedbackVistoEm() == null,autor);
        return new Detalhe(a == null ? null : a.getId(),pasta.getId(),aluno.getId(),aluno.getNome(),data,regras.fase(),regras.diasParaData(),regras.diasDeAtraso(),
            a == null ? null : a.getAtrasoAte(),a == null ? null : a.getAtrasoMotivo(),modelo.numero(),modelo.versaoId(),modelo.nome(),json.readTree(modelo.conteudo()),
            a == null ? json.createObjectNode() : json.readTree(a.getRespostas()),a == null ? null : a.getEnviadaEm(),feedback,a == null ? null : a.getVersao(),resumos.calcular(aluno.getId(),pasta.getInicio(),data));
    }
}
