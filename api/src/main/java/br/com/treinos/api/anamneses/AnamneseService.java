package br.com.treinos.api.anamneses;

import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.alunos.Aluno;
import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.alunos.AlunoService;
import br.com.treinos.api.anamneses.AnamneseDtos.AnamneseDetalhe;
import br.com.treinos.api.anamneses.AnamneseDtos.AnamneseExportada;
import br.com.treinos.api.anamneses.AnamneseDtos.AnamneseResumo;
import br.com.treinos.api.anamneses.AnamneseDtos.DispensarRequest;
import br.com.treinos.api.anamneses.AnamneseDtos.EnviarRequest;
import br.com.treinos.api.atualizacoes.Atualizacao;
import br.com.treinos.api.atualizacoes.AtualizacaoRepository;
import br.com.treinos.api.atualizacoes.ValidadorAtualizacao;
import br.com.treinos.api.auditoria.Auditar;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.auth.Usuario;
import br.com.treinos.api.auth.UsuarioRepository;
import br.com.treinos.api.execucao.AlunoAppService;
import br.com.treinos.api.fotos.FotoService;
import br.com.treinos.api.pastas.PastaVigente;
import br.com.treinos.api.questionarios.Questionario;
import br.com.treinos.api.questionarios.QuestionarioImagemService;
import br.com.treinos.api.questionarios.QuestionarioResolver;
import br.com.treinos.api.questionarios.QuestionarioService;
import br.com.treinos.api.questionarios.QuestionarioVersaoRepository;
import br.com.treinos.api.security.UsuarioAutenticado;
import br.com.treinos.api.web.Fuso;
import br.com.treinos.api.web.NaoEncontradoException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

/**
 * Anamnese atribuída ao aluno (respondida logada, no app ou na web). A equipe atribui um questionário de anamnese
 * publicado (a versão daquele momento fica presa à atribuição), acompanha, marca como revisada ou dispensa com motivo.
 * Uma pendente por aluno. O envio do aluno é idempotente: reenviar a já enviada devolve o estado sem mudar nada.
 * Respostas são dado sensível: nada daqui vai a log, e a auditoria grava resumos fixos. Tudo passa pelo {@code @TenantId}:
 * aluno ou anamnese de outra consultoria responde 404.
 */
@Service
public class AnamneseService {

    private final AnamneseRepository anamneses;
    private final AlunoRepository alunos;
    private final QuestionarioService questionarios;
    private final QuestionarioResolver resolver;
    private final QuestionarioVersaoRepository versoes;
    private final QuestionarioImagemService imagens;
    private final ValidadorAtualizacao validador;
    private final FotoService fotos;
    private final UsuarioRepository usuarios;
    private final AtualizacaoRepository atualizacoes;
    private final PastaVigente pastaVigente;
    private final Auditoria auditoria;
    private final JsonMapper json;

    public AnamneseService(AnamneseRepository anamneses, AlunoRepository alunos, QuestionarioService questionarios,
                           QuestionarioResolver resolver, QuestionarioVersaoRepository versoes,
                           QuestionarioImagemService imagens, ValidadorAtualizacao validador, FotoService fotos,
                           UsuarioRepository usuarios, AtualizacaoRepository atualizacoes, PastaVigente pastaVigente,
                           Auditoria auditoria, JsonMapper json) {
        this.anamneses = anamneses;
        this.alunos = alunos;
        this.questionarios = questionarios;
        this.resolver = resolver;
        this.versoes = versoes;
        this.imagens = imagens;
        this.validador = validador;
        this.fotos = fotos;
        this.usuarios = usuarios;
        this.atualizacoes = atualizacoes;
        this.pastaVigente = pastaVigente;
        this.auditoria = auditoria;
        this.json = json;
    }

    // ---------------------------------------------------------------- equipe

    /** Trava o aluno: duas atribuições ao mesmo tempo esperam em fila e a segunda encontra a pendente (409). */
    @Transactional
    @Auditar(acao = "ANAMNESE_ATRIBUIDA", entidade = "ANAMNESE", resumo = "Enviou uma anamnese ao aluno.")
    public AnamneseDetalhe atribuir(UUID alunoId, UUID questionarioId, UUID usuarioId) {
        Aluno aluno = alunos.buscarParaAlterar(alunoId).orElseThrow(() -> new NaoEncontradoException("Aluno não encontrado."));
        AlunoService.exigirNaoAnonimizado(aluno);
        Questionario q = questionarios.exigirAnamneseUsavel(questionarioId);
        if (anamneses.existsByAlunoIdAndSituacao(alunoId, Anamnese.Situacao.PENDENTE)) {
            throw pendente();
        }
        var versao = resolver.publicada(q);
        Anamnese nova;
        try {
            nova = anamneses.saveAndFlush(new Anamnese(alunoId, versao.versaoId(), usuarioId, Instant.now()));
        } catch (DataIntegrityViolationException corrida) {
            throw pendente();
        }
        return detalhe(nova, aluno);
    }

    @Transactional(readOnly = true)
    public List<AnamneseResumo> doAluno(UUID alunoId) {
        exigirAluno(alunoId);
        return anamneses.findByAlunoIdOrderByAtribuidaEmDesc(alunoId).stream().map(a -> {
            var v = resolver.fixa(a.getQuestionarioVersaoId());
            return new AnamneseResumo(a.getId(), a.getSituacao().name(), v.nome(), v.numero(), a.getAtribuidaEm(),
                    a.getEnviadaEm(), a.getRevisadaEm(), a.getDispensadaEm(), a.getDispensaMotivo(), a.getVersao());
        }).toList();
    }

    @Transactional(readOnly = true)
    public AnamneseDetalhe detalhe(UUID id) {
        return detalhe(buscar(id));
    }

    @Transactional
    @Auditar(acao = "ANAMNESE_DISPENSADA", entidade = "ANAMNESE", resumo = "Dispensou uma anamnese pendente.")
    public AnamneseDetalhe dispensar(UUID id, DispensarRequest r, UUID usuarioId) {
        Anamnese a = buscarParaAlterar(id);
        exigirMesmaVersao(a, r.versao());
        if (a.getSituacao() != Anamnese.Situacao.PENDENTE) {
            throw new ConflictException("Só uma anamnese pendente pode ser dispensada.", "ANAMNESE_NAO_PENDENTE");
        }
        a.dispensar(usuarioId, r.motivo().strip(), Instant.now());
        return detalhe(anamneses.saveAndFlush(a));
    }

    /** Idempotente: marcar de novo a já revisada responde 200 sem gravar nem auditar. */
    @Transactional
    public AnamneseDetalhe revisar(UUID id, Long versao, UUID usuarioId) {
        Anamnese a = buscarParaAlterar(id);
        if (a.getSituacao() == Anamnese.Situacao.REVISADA) {
            return detalhe(a);
        }
        exigirMesmaVersao(a, versao);
        if (a.getSituacao() != Anamnese.Situacao.ENVIADA) {
            throw new ConflictException("A anamnese ainda não foi enviada pelo aluno.", "ANAMNESE_NAO_ENVIADA");
        }
        a.revisar(usuarioId, Instant.now());
        Anamnese gravada = anamneses.saveAndFlush(a);
        auditoria.registrarEvento("ANAMNESE_REVISADA", "ANAMNESE", gravada.getId(), "Marcou uma anamnese como revisada.");
        return detalhe(gravada);
    }

    // ---------------------------------------------------------------- aluno

    /** A pendente; sem ela, a última enviada ou revisada. Nenhuma (ou só dispensadas): 404. */
    @Transactional(readOnly = true)
    public AnamneseDetalhe atualDoAluno(UsuarioAutenticado eu) {
        UUID alunoId = AlunoAppService.alunoDaSessao(eu);
        List<Anamnese> todas = anamneses.findByAlunoIdOrderByAtribuidaEmDesc(alunoId);
        Optional<Anamnese> escolhida = todas.stream().filter(a -> a.getSituacao() == Anamnese.Situacao.PENDENTE).findFirst()
                .or(() -> todas.stream().filter(Anamnese::isEnviada).findFirst());
        return escolhida.map(a -> detalhe(a).paraAluno())
                .orElseThrow(() -> new NaoEncontradoException("Nenhuma anamnese para responder."));
    }

    /**
     * Envio do aluno. Já enviada (rede caiu depois do commit, clique duplo): devolve o estado sem mudar nada. A versão
     * respondida tem de ser a da atribuição; as respostas são validadas por ela (pergunta escondida por condição não é
     * obrigatória e a resposta dela é descartada) e as fotos pendentes são ligadas na mesma transação.
     */
    @Transactional
    public AnamneseDetalhe enviar(UsuarioAutenticado eu, UUID id, EnviarRequest r) {
        UUID alunoId = AlunoAppService.alunoDaSessao(eu);
        Anamnese a = anamneses.buscarParaAlterar(id).filter(x -> x.getAlunoId().equals(alunoId))
                .orElseThrow(() -> new NaoEncontradoException("Anamnese não encontrada."));
        if (a.isEnviada()) {
            return detalhe(a).paraAluno();
        }
        if (a.getSituacao() == Anamnese.Situacao.DISPENSADA) {
            throw new ConflictException("Seu treinador dispensou esta anamnese.", "ANAMNESE_DISPENSADA");
        }
        if (!a.getQuestionarioVersaoId().equals(r.questionarioVersaoId())) {
            throw new ConflictException("Esta anamnese é de outra versão. Recarregue.", "ANAMNESE_VERSAO_DIFERENTE");
        }
        JsonNode modelo = json.readTree(resolver.fixa(a.getQuestionarioVersaoId()).conteudo());
        JsonNode respostas = validador.validar(modelo, r.respostas(), fotos.ligadas(), "ANAMNESE_INVALIDA",
                LocalDate.now(Fuso.BRASILIA));
        a.enviar(json.writeValueAsString(respostas), Instant.now());
        Anamnese gravada = anamneses.saveAndFlush(a);
        ligarFotos(modelo, respostas, alunoId, gravada.getId());
        auditoria.registrarEvento("ANAMNESE_ENVIADA", "ANAMNESE", gravada.getId(), "Enviou as respostas da anamnese.");
        return detalhe(gravada).paraAluno();
    }

    /**
     * Imagem de pergunta para o aluno: só se aparece numa versão que ele responde ou respondeu (anamnese, atualização
     * enviada ou a atualização vigente). Senão, 404, como se não existisse.
     */
    @Transactional(readOnly = true)
    public QuestionarioImagemService.Imagem imagemDoAluno(UsuarioAutenticado eu, UUID imagemId) {
        UUID alunoId = AlunoAppService.alunoDaSessao(eu);
        List<UUID> ids = new ArrayList<>(anamneses.versoesDoAluno(alunoId));
        atualizacoes.findByAlunoIdOrderByDataAtualizacaoDesc(alunoId).stream().map(Atualizacao::getQuestionarioVersaoId)
                .filter(Objects::nonNull).forEach(ids::add);
        vigenteDaAtualizacao(alunoId).ifPresent(ids::add);
        boolean citada = !ids.isEmpty() && versoes.conteudosDe(ids).stream()
                .anyMatch(c -> QuestionarioImagemService.citadas(c).contains(imagemId));
        if (!citada) {
            throw new NaoEncontradoException("Imagem não encontrada.");
        }
        return imagens.ler(imagemId);
    }

    // ---------------------------------------------------------------- privacidade

    /** Exportação do titular: respostas e situação; fotos só como metadados. */
    @Transactional(readOnly = true)
    public List<AnamneseExportada> exportar(UUID alunoId) {
        List<Anamnese> todas = anamneses.findByAlunoIdOrderByAtribuidaEmDesc(alunoId);
        var fotosPorAnamnese = fotos.metadadosDeAnamneses(todas.stream().map(Anamnese::getId).toList());
        return todas.stream().map(a -> new AnamneseExportada(a.getId(), a.getSituacao().name(), a.getQuestionarioVersaoId(),
                json.readTree(a.getRespostas()), a.getAtribuidaEm(), a.getEnviadaEm(), a.getRevisadaEm(), a.getDispensadaEm(),
                a.getDispensaMotivo(), fotosPorAnamnese.getOrDefault(a.getId(), List.of()))).toList();
    }

    /** Anonimização do aluno (na transação dela): respostas e motivo saem; as fotos saem pelo {@code FotoService}. */
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.MANDATORY)
    public void anonimizarDoAluno(UUID alunoId) {
        anamneses.findByAlunoIdOrderByAtribuidaEmDesc(alunoId).forEach(Anamnese::limparDadosPessoais);
        anamneses.flush();
    }

    // ---------------------------------------------------------------- apoio

    private Optional<UUID> vigenteDaAtualizacao(UUID alunoId) {
        try {
            var aluno = alunos.findById(alunoId).orElse(null);
            if (aluno == null) {
                return Optional.empty();
            }
            var pasta = pastaVigente.de(alunoId).orElse(null);
            return Optional.of(resolver.vigente(pasta == null ? null : pasta.getQuestionarioId(), aluno.getQuestionarioId()).versaoId());
        } catch (NaoEncontradoException semPadrao) {
            return Optional.empty();
        }
    }

    private void ligarFotos(JsonNode modelo, JsonNode respostas, UUID alunoId, UUID anamneseId) {
        if (!fotos.ligadas()) {
            return;
        }
        for (var secao : modelo.path("secoes")) {
            for (var p : secao.path("perguntas")) {
                if (!"FOTOS".equals(p.path("tipo").asString())) {
                    continue;
                }
                String perguntaId = p.path("id").asString();
                List<UUID> ids = respostas.path(perguntaId).valueStream().map(n -> UUID.fromString(n.asString())).toList();
                if (!ids.isEmpty()) {
                    fotos.ligarNaAnamnese(alunoId, anamneseId, perguntaId, ids);
                }
            }
        }
    }

    private Anamnese buscar(UUID id) {
        return anamneses.findById(id).orElseThrow(() -> new NaoEncontradoException("Anamnese não encontrada."));
    }

    private Anamnese buscarParaAlterar(UUID id) {
        return anamneses.buscarParaAlterar(id).orElseThrow(() -> new NaoEncontradoException("Anamnese não encontrada."));
    }

    private void exigirAluno(UUID alunoId) {
        if (alunos.findById(alunoId).isEmpty()) {
            throw new NaoEncontradoException("Aluno não encontrado.");
        }
    }

    private static void exigirMesmaVersao(Anamnese a, Long versao) {
        if (versao == null || !versao.equals(a.getVersao())) {
            throw new ConflictException("Outra pessoa alterou esta anamnese. Recarregue.", "CONFLITO_EDICAO");
        }
    }

    private static ConflictException pendente() {
        return new ConflictException("O aluno já tem uma anamnese pendente. Dispense-a antes de enviar outra.",
                "ANAMNESE_PENDENTE");
    }

    private AnamneseDetalhe detalhe(Anamnese a) {
        return detalhe(a, alunos.findById(a.getAlunoId()).orElseThrow(() -> new NaoEncontradoException("Aluno não encontrado.")));
    }

    private AnamneseDetalhe detalhe(Anamnese a, Aluno aluno) {
        var v = resolver.fixa(a.getQuestionarioVersaoId());
        return new AnamneseDetalhe(a.getId(), aluno.getId(), aluno.getNome(), a.getSituacao().name(), v.versaoId(), v.numero(),
                v.nome(), json.readTree(v.conteudo()), json.readTree(a.getRespostas()), a.getAtribuidaEm(),
                nome(a.getAtribuidaPor(), aluno), a.getEnviadaEm(), a.getRevisadaEm(), nome(a.getRevisadaPor(), aluno),
                a.getDispensadaEm(), nome(a.getDispensadaPor(), aluno), a.getDispensaMotivo(), a.getVersao());
    }

    /** Nome de quem agiu, só se for da mesma consultoria (o usuário é global). */
    private String nome(UUID usuarioId, Aluno aluno) {
        return usuarioId == null ? null : usuarios.findById(usuarioId)
                .filter(u -> u.getConsultoriaId().equals(aluno.getConsultoriaId())).map(Usuario::getNome).orElse(null);
    }
}
