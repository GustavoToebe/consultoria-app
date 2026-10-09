package br.com.treinos.api.atualizacoes;

import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.execucao.AlunoAppService;
import br.com.treinos.api.execucao.RegistroPeso;
import br.com.treinos.api.execucao.RegistroPesoRepository;
import br.com.treinos.api.pastas.PastaPlano;
import br.com.treinos.api.pastas.PastaRepository;
import br.com.treinos.api.treino.PlanoTreinoRepository;
import br.com.treinos.api.dieta.PlanoDietaRepository;
import br.com.treinos.api.security.UsuarioAutenticado;
import br.com.treinos.api.web.*;
import jakarta.validation.constraints.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Um check-in por pasta; travar a pasta serializa o primeiro envio e o aviso de atraso. */
@Service
public class AtualizacaoService {
    public record EnviarRequest(@NotNull Integer modeloVersao, @NotNull JsonNode respostas) { }
    public record AtrasoRequest(@NotNull LocalDate novaData, @Size(max = 300) String motivo) { }
    public record FeedbackRequest(@NotBlank @Size(max = 4000) String texto, @NotNull Long versao) { }
    public record Feedback(String texto, Instant em, Instant editadoEm, boolean naoLido, String nomeAutor) { }
    public record Detalhe(UUID id, UUID pastaId, UUID alunoId, String nomeAluno, LocalDate dataAtualizacao,
            String fase, long diasParaData, long diasDeAtraso, LocalDate atrasoAte, String atrasoMotivo,
            int modeloVersao, JsonNode modelo, JsonNode respostas, Instant enviadaEm,
            Feedback feedback, Long versao, ResumoPeriodoService.Resumo resumo) { }
    private final AtualizacaoRepository atualizacoes;
    private final AtualizacaoModeloRepository modelos;
    private final PastaRepository pastas;
    private final PlanoTreinoRepository treinos;
    private final PlanoDietaRepository dietas;
    private final AlunoRepository alunos;
    private final RegistroPesoRepository pesos;
    private final ResumoPeriodoService resumos;
    private final ValidadorAtualizacao validador;
    private final JsonMapper json;
    private final br.com.treinos.api.auth.UsuarioRepository usuarios;
    public AtualizacaoService(AtualizacaoRepository atualizacoes, AtualizacaoModeloRepository modelos,
            PastaRepository pastas, PlanoTreinoRepository treinos, PlanoDietaRepository dietas, AlunoRepository alunos,
            RegistroPesoRepository pesos, ResumoPeriodoService resumos, ValidadorAtualizacao validador, JsonMapper json,
            br.com.treinos.api.auth.UsuarioRepository usuarios) {
        this.usuarios=usuarios;
        this.atualizacoes = atualizacoes; this.modelos = modelos; this.pastas = pastas;
        this.treinos = treinos; this.dietas = dietas; this.alunos = alunos; this.pesos = pesos;
        this.resumos = resumos; this.validador = validador; this.json = json;
    }
    @Transactional(readOnly = true)
    public Detalhe atual(UsuarioAutenticado eu) { return atualDoAluno(AlunoAppService.alunoDaSessao(eu)); }
    @Transactional(readOnly = true)
    public Detalhe atualDoAluno(UUID alunoId) {
        exigirAluno(alunoId);
        PastaPlano pasta = pastaAtiva(alunoId);
        if (pasta == null) return new Detalhe(null,null,alunoId,null,null,"NENHUMA",0,0,null,null,0,null,null,null,null,null,null);
        return detalhe(pasta, atualizacoes.findByPastaId(pasta.getId()).orElse(null));
    }
    @Transactional
    public Detalhe enviar(UsuarioAutenticado eu, EnviarRequest r) {
        UUID alunoId = AlunoAppService.alunoDaSessao(eu);
        PastaPlano pasta = exigirPastaAtiva(alunoId);
        Atualizacao atual = atualizacoes.findByPastaId(pasta.getId()).orElse(null);
        exigirNaoEnviada(atual);
        LocalDate data = atual == null ? pasta.getFim() : atual.getDataAtualizacao();
        if (LocalDate.now(Fuso.BRASILIA).isBefore(data.minusDays(1)))
            throw invalidos("data", "O formulário libera um dia antes da atualização.");
        AtualizacaoModelo modelo = modelo(atual);
        if (r.modeloVersao() != modelo.getVersao()) throw new ConflitoException("O modelo mudou. Recarregue o formulário.", "MODELO_ATUALIZACAO_ALTERADO");
        JsonNode respostas = validador.validar(json.readTree(modelo.getConteudo()), r.respostas());
        if (atual == null) atual = new Atualizacao(alunoId,pasta.getId(),data,modelo.getVersao());
        atual.enviar(json.writeValueAsString(respostas), Instant.now());
        atualizacoes.saveAndFlush(atual);
        // A data é a da atualização, inclusive no envio liberado na véspera (não usar validação de peso futuro).
        var peso = respostas.path("peso").decimalValue();
        pesos.findByAlunoIdAndData(alunoId,data).ifPresentOrElse(
            p -> p.alterar(peso, null, eu.usuarioId()),
            () -> pesos.save(new RegistroPeso(alunoId,data,peso,null,eu.usuarioId())));
        pesos.flush();
        return detalhe(pasta,atual);
    }
    @Transactional
    public Detalhe avisarAtraso(UsuarioAutenticado eu, AtrasoRequest r) {
        UUID alunoId = AlunoAppService.alunoDaSessao(eu);
        PastaPlano pasta = exigirPastaAtiva(alunoId);
        Atualizacao atual = atualizacoes.findByPastaId(pasta.getId()).orElse(null);
        exigirNaoEnviada(atual);
        LocalDate data = atual == null ? pasta.getFim() : atual.getDataAtualizacao();
        if (r.novaData().isBefore(LocalDate.now(Fuso.BRASILIA)) || r.novaData().isAfter(data.plusDays(15)))
            throw invalidos("novaData", "Informe uma data entre hoje e quinze dias após a atualização.");
        if (atual == null) atual = new Atualizacao(alunoId,pasta.getId(),data,modelo(null).getVersao());
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
        Atualizacao a = buscar(id);
        if (!a.getAlunoId().equals(AlunoAppService.alunoDaSessao(eu))) throw new NaoEncontradoException("Atualização não encontrada.");
        a.marcarVisto(Instant.now());
    }
    @Transactional(readOnly = true)
    public Detalhe detalheTreinador(UUID id) { return detalhe(buscar(id)); }
    @Transactional
    @br.com.treinos.api.auditoria.Auditar(acao="ATUALIZACAO_FEEDBACK",entidade="ATUALIZACAO",resumo="Enviou ou editou feedback de atualização.")
    public Detalhe responder(UUID id, FeedbackRequest r, UUID usuarioId) {
        Atualizacao a = buscar(id);
        if (!a.getVersao().equals(r.versao())) throw new ConflitoException("Outra pessoa alterou a atualização. Recarregue.", "CONFLITO_EDICAO");
        if ("ABERTA".equals(a.getEstado())) throw new ConflitoException("A atualização ainda não foi enviada.", "ATUALIZACAO_NAO_ENVIADA");
        a.responder(r.texto().trim(),usuarioId,Instant.now());
        return detalhe(atualizacoes.saveAndFlush(a));
    }
    @Transactional(readOnly = true)
    public List<Detalhe> listar(String situacao) {
        if (!List.of("PARA_REVISAR","ATRASADAS","AVISARAM_ATRASO","PROXIMAS").contains(situacao))
            throw new BadRequestException("Situação inválida.");
        return alunos.findByAtivoTrueOrderByNomeAsc().stream().map(a -> atualDoAluno(a.getId())).filter(d -> switch (situacao) {
            case "PARA_REVISAR" -> "ENVIADA".equals(d.fase());
            case "ATRASADAS" -> "ATRASADA".equals(d.fase());
            case "AVISARAM_ATRASO" -> d.atrasoAte() != null && !List.of("ENVIADA","REVISADA").contains(d.fase());
            case "PROXIMAS" -> d.dataAtualizacao() != null && d.diasParaData() >= 0 && d.diasParaData() <= 7 && !List.of("ENVIADA","REVISADA").contains(d.fase());
            default -> false;
        }).toList();
    }
    private PastaPlano pastaAtiva(UUID alunoId) {
        UUID pastaId = treinos.findByAlunoIdAndAtivoTrue(alunoId).map(p -> p.getPastaId())
                .or(() -> dietas.findByAlunoIdAndAtivoTrue(alunoId).map(p -> p.getPastaId())).orElse(null);
        return pastaId == null ? null : pastas.findById(pastaId).filter(p -> !p.isArquivado() && p.getFim() != null && p.getAlunoId().equals(alunoId)).orElse(null);
    }
    private PastaPlano exigirPastaAtiva(UUID alunoId) {
        PastaPlano pasta = pastaAtiva(alunoId);
        if (pasta == null) throw new NaoEncontradoException("Atualização não encontrada.");
        return pastas.travarParaAtualizacao(pasta.getId()).orElseThrow(() -> new NaoEncontradoException("Atualização não encontrada."));
    }
    private AtualizacaoModelo modelo(Atualizacao a) {
        return (a == null ? modelos.findFirstByOrderByVersaoDesc() : modelos.findByVersao(a.getModeloVersao()))
            .orElseThrow(() -> new NaoEncontradoException("Modelo de atualização não encontrado."));
    }
    private Atualizacao buscar(UUID id) { return atualizacoes.findById(id).orElseThrow(() -> new NaoEncontradoException("Atualização não encontrada.")); }
    private void exigirAluno(UUID id) { Exigir.existe(alunos.findById(id), () -> new NaoEncontradoException("Aluno não encontrado.")); }
    private static void exigirNaoEnviada(Atualizacao a) {
        if (a != null && !"ABERTA".equals(a.getEstado())) throw new ConflitoException("Esta atualização já foi enviada.", "ATUALIZACAO_JA_ENVIADA");
    }
    private static ValidacaoException invalidos(String campo, String mensagem) {
        return new ValidacaoException("Confira os campos.", "ATUALIZACAO_INVALIDA", List.of(new ApiError.FieldError(campo,mensagem)));
    }
    private Detalhe detalhe(Atualizacao a) { return detalhe(pastas.findById(a.getPastaId()).orElseThrow(() -> new NaoEncontradoException("Atualização não encontrada.")),a); }
    private Detalhe detalhe(PastaPlano pasta, Atualizacao a) {
        LocalDate data = a == null ? pasta.getFim() : a.getDataAtualizacao();
        var regras = RegrasAtualizacao.calcular(LocalDate.now(Fuso.BRASILIA),data,a == null ? null : a.getAtrasoAte(),a == null ? null : a.getEstado());
        var modelo = modelo(a);
        var aluno = alunos.findById(pasta.getAlunoId()).orElseThrow(() -> new NaoEncontradoException("Aluno não encontrado."));
        String autor=a==null || a.getFeedbackPor()==null ? null : usuarios.findById(a.getFeedbackPor())
                .filter(u -> u.getConsultoriaId().equals(aluno.getConsultoriaId())).map(br.com.treinos.api.auth.Usuario::getNome).orElse(null);
        var feedback = a == null || a.getFeedbackEm() == null ? null : new Feedback(a.getFeedback(),a.getFeedbackEm(),a.getFeedbackEditadoEm(),a.getFeedbackVistoEm() == null,autor);
        return new Detalhe(a == null ? null : a.getId(),pasta.getId(),aluno.getId(),aluno.getNome(),data,regras.fase(),regras.diasParaData(),regras.diasDeAtraso(),
            a == null ? null : a.getAtrasoAte(),a == null ? null : a.getAtrasoMotivo(),modelo.getVersao(),json.readTree(modelo.getConteudo()),
            a == null ? json.createObjectNode() : json.readTree(a.getRespostas()),a == null ? null : a.getEnviadaEm(),feedback,a == null ? null : a.getVersao(),resumos.calcular(aluno.getId(),pasta.getInicio(),data));
    }
}
