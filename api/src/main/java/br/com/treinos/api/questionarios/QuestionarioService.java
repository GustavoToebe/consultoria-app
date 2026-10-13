package br.com.treinos.api.questionarios;

import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.alunos.dto.AlunoDtos.AlunoDetalhe;
import br.com.treinos.api.atualizacoes.AtualizacaoModeloRepository;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.pastas.PastaDtos.PastaResumo;
import br.com.treinos.api.pastas.PastaRepository;
import br.com.treinos.api.planos.ResultadoValidacao;
import br.com.treinos.api.planos.ResultadoValidacao.Problema;
import br.com.treinos.api.questionarios.ConteudoQuestionario.Pergunta;
import br.com.treinos.api.questionarios.ConteudoQuestionario.Secao;
import br.com.treinos.api.questionarios.dto.QuestionarioDtos.*;
import br.com.treinos.api.web.ConflitoException;
import br.com.treinos.api.web.NaoEncontradoException;
import br.com.treinos.api.web.ValidacaoException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Gestão dos questionários de atualização da consultoria. Tudo passa pelo {@code @TenantId}: questionário, aluno ou
 * pasta de outra consultoria nem aparece (404). Sem SQL nativo. Nome, descrição e conteúdo não vão para log nem para a
 * auditoria (os resumos são fixos).
 */
@Service
public class QuestionarioService {

    /** Mesmo tamanho da coluna {@code questionario.nome}. */
    private static final int NOME_MAXIMO = 120;
    private static final int FORMATO = 2;

    private final QuestionarioRepository questionarios;
    private final QuestionarioVersaoRepository versoes;
    private final AtualizacaoModeloRepository fabrica;
    private final AlunoRepository alunos;
    private final PastaRepository pastas;
    private final ValidadorQuestionario validador;
    private final JsonMapper json;
    private final Auditoria auditoria;

    public QuestionarioService(QuestionarioRepository questionarios, QuestionarioVersaoRepository versoes,
                               AtualizacaoModeloRepository fabrica, AlunoRepository alunos, PastaRepository pastas,
                               ValidadorQuestionario validador, JsonMapper json, Auditoria auditoria) {
        this.auditoria = auditoria;
        this.questionarios = questionarios;
        this.versoes = versoes;
        this.fabrica = fabrica;
        this.alunos = alunos;
        this.pastas = pastas;
        this.validador = validador;
        this.json = json;
    }

    // ---------------------------------------------------------------- leitura

    @Transactional(readOnly = true)
    public List<QuestionarioResumo> listar(boolean arquivados) {
        Usos usos = usos();
        return questionarios.findByArquivadoOrderByNomeAsc(arquivados).stream()
                .sorted(Comparator.comparing((Questionario q) -> !q.isPadrao()))
                .map(q -> resumo(q, usos.de(q.getId()))).toList();
    }

    @Transactional(readOnly = true)
    public List<OpcaoQuestionario> opcoes() {
        return questionarios.findByArquivadoOrderByNomeAsc(false).stream().filter(Questionario::isUsavel)
                .sorted(Comparator.comparing((Questionario q) -> !q.isPadrao()))
                .map(q -> new OpcaoQuestionario(q.getId(), q.getNome(), q.isPadrao())).toList();
    }

    @Transactional(readOnly = true)
    public QuestionarioDetalhe detalhe(UUID id) {
        return detalhe(buscar(id));
    }

    /** Valida o rascunho salvo com as mesmas regras da publicação, sem publicar. */
    @Transactional(readOnly = true)
    public ResultadoValidacao validar(UUID id) {
        Questionario q = buscar(id);
        return resultadoDaPublicacao(q, normalizar(ler(q.getRascunho())));
    }

    // ---------------------------------------------------------------- escrita

    @Transactional
    @br.com.treinos.api.auditoria.Auditar(acao = "QUESTIONARIO_CRIADO", entidade = "QUESTIONARIO",
            resumo = "Criou um questionário de atualização.")
    public QuestionarioDetalhe criar(CriarRequest r) {
        String nome = r.nome().trim();
        exigirNomeLivre(nome, null);
        String rascunho = r.origem() == Origem.FABRICA
                ? fabrica.findFirstByOrderByVersaoDesc().orElseThrow(
                        () -> new NaoEncontradoException("Modelo de fábrica não encontrado.")).getConteudo()
                : escrever(new ConteudoQuestionario(FORMATO, List.of(),
                        List.of(new Secao(UUID.randomUUID().toString(), "Geral", List.of()))));
        return detalhe(gravar(new Questionario(nome, descricao(r.descricao()), rascunho)));
    }

    /** Rascunho: sem auditoria (é salvo o tempo todo); publicar é que fica registrado. */
    @Transactional
    public QuestionarioDetalhe salvar(UUID id, SalvarRequest r) {
        Questionario q = buscar(id);
        exigirAtivo(q);
        exigirMesmaVersao(q, r.versao());
        String nome = r.nome().trim();
        exigirNomeLivre(nome, q.getId());
        String rascunho = escrever(normalizar(r.conteudo()));
        if (ValidadorQuestionario.excedeTamanhoDoRascunho(rascunho)) {
            throw new ValidacaoException("O questionário é grande demais.", "QUESTIONARIO_GRANDE_DEMAIS", List.of());
        }
        q.salvarRascunho(nome, descricao(r.descricao()), rascunho);
        return detalhe(gravar(q));
    }

    @Transactional
    @br.com.treinos.api.auditoria.Auditar(acao = "QUESTIONARIO_PUBLICADO", entidade = "QUESTIONARIO",
            resumo = "Publicou uma versão de questionário de atualização.")
    public QuestionarioDetalhe publicar(UUID id, PublicarRequest r, UUID usuarioId) {
        Questionario q = buscarParaAlterar(id);
        exigirAtivo(q);
        exigirMesmaVersao(q, r.versao());
        ConteudoQuestionario conteudo = normalizar(ler(q.getRascunho()));
        ResultadoValidacao resultado = resultadoDaPublicacao(q, conteudo);
        if (resultado.temErros()) {
            throw new ValidacaoException("O questionário tem erros que impedem a publicação.",
                    "QUESTIONARIO_INVALIDO", ResultadoValidacao.comoCampos(resultado.erros()));
        }
        if (resultado.temAvisos() && !r.confirmarAvisos()) {
            throw new ValidacaoException("Confira os avisos antes de publicar.", "CONFIRMAR_AVISOS",
                    ResultadoValidacao.comoCampos(resultado.avisos()));
        }
        int numero = q.getVersaoPublicada() + 1;
        versoes.save(new QuestionarioVersao(q.getId(), numero, escrever(conteudo), usuarioId));
        q.publicar(numero, Instant.now());
        return detalhe(gravar(q));
    }

    @Transactional
    @br.com.treinos.api.auditoria.Auditar(acao = "QUESTIONARIO_DUPLICADO", entidade = "QUESTIONARIO",
            resumo = "Duplicou um questionário de atualização.")
    public QuestionarioDetalhe duplicar(UUID id) {
        Questionario origem = buscar(id);
        String nome = nomeDaCopia(origem.getNome());
        return detalhe(gravar(new Questionario(nome, origem.getDescricao(), origem.getRascunho())));
    }

    /** Idempotente: repetir o pedido no que já é o padrão responde 200 sem auditar. */
    @Transactional
    public QuestionarioDetalhe definirPadrao(UUID id) {
        Questionario q = buscarParaAlterar(id);
        if (!q.isUsavel()) {
            throw new ConflitoException("Só um questionário publicado e ativo pode ser o padrão.",
                    "QUESTIONARIO_NAO_PUBLICADO");
        }
        if (q.isPadrao()) {
            return detalhe(q);
        }
        // O índice único parcial só admite um padrão: desmarca o atual e grava antes de marcar o novo.
        questionarios.findByPadraoTrue().ifPresent(atual -> atual.definirPadrao(false));
        questionarios.flush();
        q.definirPadrao(true);
        Questionario gravado = gravar(q);
        auditoria.registrarEvento("QUESTIONARIO_PADRAO_ALTERADO", "QUESTIONARIO", gravado.getId(),
                "Trocou o questionário de atualização padrão.");
        return detalhe(gravado);
    }

    @Transactional
    @br.com.treinos.api.auditoria.Auditar(acao = "QUESTIONARIO_ARQUIVADO", entidade = "QUESTIONARIO",
            resumo = "Arquivou um questionário de atualização.")
    public QuestionarioDetalhe arquivar(UUID id) {
        Questionario q = buscar(id);
        if (q.isPadrao()) {
            throw new ConflitoException("O questionário padrão não pode ser arquivado. Escolha outro padrão antes.",
                    "QUESTIONARIO_PADRAO");
        }
        q.arquivar();
        return detalhe(gravar(q));
    }

    /** Idempotente: desarquivar o que não está arquivado responde 200 sem gravar nem auditar. */
    @Transactional
    public QuestionarioDetalhe desarquivar(UUID id) {
        Questionario q = buscar(id);
        if (!q.isArquivado()) {
            return detalhe(q);
        }
        exigirNomeLivre(q.getNome(), q.getId());
        q.desarquivar();
        Questionario gravado = gravar(q);
        auditoria.registrarEvento("QUESTIONARIO_DESARQUIVADO", "QUESTIONARIO", gravado.getId(),
                "Desarquivou um questionário de atualização.");
        return detalhe(gravado);
    }

    /**
     * Só sem uso: o padrão e o que já teve envio (a atualização guarda a versão respondida) ficam; o app oferece
     * arquivar. Aluno e pasta que o escolheram voltam a nulo pela chave estrangeira.
     */
    @Transactional
    @br.com.treinos.api.auditoria.Auditar(acao = "QUESTIONARIO_EXCLUIDO", entidade = "QUESTIONARIO",
            resumo = "Excluiu um questionário de atualização.")
    public void excluir(UUID id) {
        Questionario q = buscar(id);
        if (q.isPadrao()) {
            throw new ConflitoException("O questionário padrão não pode ser excluído. Escolha outro padrão antes.",
                    "QUESTIONARIO_PADRAO");
        }
        if (questionarios.contarEnviosDo(q.getId()) > 0) {
            throw new ConflitoException("Este questionário já foi respondido por alunos. Arquive em vez de excluir.",
                    "QUESTIONARIO_EM_USO");
        }
        try {
            questionarios.delete(q);
            questionarios.flush();
        } catch (DataIntegrityViolationException e) {
            // Um envio chegou entre a conferência e o delete: a FK de atualizacao protege.
            throw new ConflitoException("Este questionário já foi respondido por alunos. Arquive em vez de excluir.",
                    "QUESTIONARIO_EM_USO");
        }
    }

    // ---------------------------------------------------- escolha no aluno e na pasta

    @Transactional
    @br.com.treinos.api.auditoria.Auditar(acao = "ALUNO_QUESTIONARIO_ALTERADO", entidade = "ALUNO",
            resumo = "Trocou o questionário de atualização do aluno.")
    public AlunoDetalhe escolherDoAluno(UUID alunoId, UUID questionarioId) {
        var aluno = alunos.buscarParaAlterar(alunoId)
                .orElseThrow(() -> new NaoEncontradoException("Aluno não encontrado."));
        exigirEscolhivel(questionarioId);
        aluno.alterarQuestionario(questionarioId);
        return AlunoDetalhe.de(alunos.saveAndFlush(aluno));
    }

    @Transactional
    @br.com.treinos.api.auditoria.Auditar(acao = "PASTA_QUESTIONARIO_ALTERADO", entidade = "PASTA",
            resumo = "Trocou o questionário de atualização da pasta.")
    public PastaResumo escolherDaPasta(UUID pastaId, UUID questionarioId) {
        var pasta = pastas.findById(pastaId).orElseThrow(() -> new NaoEncontradoException("Pasta não encontrada."));
        exigirEscolhivel(questionarioId);
        pasta.alterarQuestionario(questionarioId);
        return PastaResumo.de(pastas.saveAndFlush(pasta));
    }

    // ---------------------------------------------------------------- apoio

    private void exigirEscolhivel(UUID questionarioId) {
        if (questionarioId == null) {
            return;
        }
        if (!buscar(questionarioId).isUsavel()) {
            throw new ConflitoException("Escolha um questionário publicado e que não esteja arquivado.",
                    "QUESTIONARIO_INDISPONIVEL");
        }
    }

    private Questionario buscar(UUID id) {
        return questionarios.findById(id)
                .orElseThrow(() -> new NaoEncontradoException("Questionário de atualização não encontrado."));
    }

    private Questionario buscarParaAlterar(UUID id) {
        return questionarios.buscarParaAlterar(id)
                .orElseThrow(() -> new NaoEncontradoException("Questionário de atualização não encontrado."));
    }

    private Questionario gravar(Questionario q) {
        try {
            return questionarios.saveAndFlush(q);
        } catch (DataIntegrityViolationException e) {
            // Corrida: os índices únicos são a rede. A mensagem nunca repete o que foi digitado.
            if (restricao(e).contains("nome")) {
                throw new ConflitoException("Já existe um questionário ativo com este nome.",
                        "QUESTIONARIO_NOME_EM_USO");
            }
            throw new ConflitoException(
                    "Outra pessoa alterou este questionário ao mesmo tempo. Recarregue para ver a versão atual.",
                    "CONFLITO_EDICAO");
        }
    }

    /** Nome da restrição violada (ex.: ux_questionario_nome), lido da causa; vazio se o banco não informou. */
    private static String restricao(Throwable erro) {
        for (Throwable t = erro; t != null; t = t.getCause()) {
            if (t instanceof org.hibernate.exception.ConstraintViolationException c && c.getConstraintName() != null) {
                return c.getConstraintName();
            }
        }
        return "";
    }

    private static void exigirAtivo(Questionario q) {
        if (q.isArquivado()) {
            throw new ConflitoException("Este questionário está arquivado. Desarquive para editar.",
                    "QUESTIONARIO_ARQUIVADO");
        }
    }

    private static void exigirMesmaVersao(Questionario q, Long versao) {
        if (!q.getVersao().equals(versao)) {
            throw new ConflitoException(
                    "Outra pessoa ou aba alterou este questionário. Recarregue para ver a versão atual.",
                    "CONFLITO_EDICAO");
        }
    }

    private void exigirNomeLivre(String nome, UUID proprio) {
        boolean ocupado = proprio == null
                ? questionarios.existsByNomeIgnoreCaseAndArquivadoFalse(nome)
                : questionarios.existsByNomeIgnoreCaseAndArquivadoFalseAndIdNot(nome, proprio);
        if (ocupado) {
            throw new ConflitoException("Já existe um questionário ativo com este nome.", "QUESTIONARIO_NOME_EM_USO");
        }
    }

    private String nomeDaCopia(String nome) {
        for (int n = 1; ; n++) {
            String sufixo = n == 1 ? " (cópia)" : " (cópia " + n + ")";
            String base = nome.length() + sufixo.length() > NOME_MAXIMO
                    ? nome.substring(0, NOME_MAXIMO - sufixo.length()) : nome;
            if (!questionarios.existsByNomeIgnoreCaseAndArquivadoFalse(base + sufixo)) {
                return base + sufixo;
            }
        }
    }

    private static String descricao(String texto) {
        return texto == null || texto.isBlank() ? null : texto.trim();
    }

    /** Erros do validador mais o tipo de um id que já foi publicado com outro tipo (nunca muda entre versões). */
    private ResultadoValidacao resultadoDaPublicacao(Questionario q, ConteudoQuestionario conteudo) {
        ResultadoValidacao base = validador.validar(conteudo);
        List<ConteudoQuestionario> publicadas = versoes.findByQuestionarioIdOrderByNumeroAsc(q.getId()).stream()
                .map(v -> ler(v.getConteudo())).toList();
        Set<String> mudaram = ValidadorQuestionario.tiposQueMudaram(conteudo, publicadas);
        if (mudaram.isEmpty()) {
            return base;
        }
        List<Problema> erros = new ArrayList<>(base.erros());
        for (int i = 0; i < conteudo.secoes().size(); i++) {
            var perguntas = conteudo.secoes().get(i).perguntas();
            for (int j = 0; perguntas != null && j < perguntas.size(); j++) {
                if (mudaram.contains(perguntas.get(j).id())) {
                    erros.add(new Problema("secoes[" + i + "].perguntas[" + j + "].tipo",
                            "O tipo de uma pergunta já publicada não pode mudar. Crie uma pergunta nova."));
                }
            }
        }
        return new ResultadoValidacao(List.copyOf(erros), base.avisos());
    }

    /** Rascunho incompleto é aceito; aqui só se fixa o formato e o que o JSON gravado precisa ter. */
    static ConteudoQuestionario normalizar(ConteudoQuestionario c) {
        List<Secao> secoes = c.secoes() == null ? List.of() : c.secoes().stream()
                .map(s -> new Secao(s.uid(), s.titulo(), s.perguntas() == null ? List.<Pergunta>of()
                        : s.perguntas().stream().map(QuestionarioService::normalizar).toList()))
                .toList();
        return new ConteudoQuestionario(FORMATO, c.instrucoes() == null ? List.of() : c.instrucoes(), secoes);
    }

    private static Pergunta normalizar(Pergunta p) {
        return new Pergunta(p.id(), p.tipo(), p.rotulo(), Boolean.TRUE.equals(p.obrigatoria()), p.ajuda(),
                p.destaque(), p.rotuloCurto(), p.ajudaAutomatica(), p.dias(), p.opcoes(), p.unidade(), p.min(),
                p.max(), p.casas());
    }

    private ConteudoQuestionario ler(String conteudo) {
        return json.readValue(conteudo, ConteudoQuestionario.class);
    }

    private String escrever(ConteudoQuestionario conteudo) {
        return json.writeValueAsString(conteudo);
    }

    private QuestionarioDetalhe detalhe(Questionario q) {
        List<VersaoResumo> publicadas = versoes.findByQuestionarioIdOrderByNumeroAsc(q.getId()).stream()
                .map(v -> new VersaoResumo(v.getNumero(), v.getPublicadoEm())).toList();
        return new QuestionarioDetalhe(q.getId(), q.getNome(), q.getDescricao(), q.isPadrao(), q.isArquivado(),
                q.getVersaoPublicada(), q.getPublicadoEm(), alterado(q), q.getRascunhoAlteradoEm(), q.getVersao(),
                usos().de(q.getId()), ler(q.getRascunho()), publicadas);
    }

    private static QuestionarioResumo resumo(Questionario q, Uso uso) {
        return new QuestionarioResumo(q.getId(), q.getNome(), q.getDescricao(), q.isPadrao(), q.isArquivado(),
                q.getVersaoPublicada(), q.getPublicadoEm(), alterado(q), q.getRascunhoAlteradoEm(), uso);
    }

    private static boolean alterado(Questionario q) {
        return q.getVersaoPublicada() > 0 && q.getPublicadoEm() != null
                && q.getRascunhoAlteradoEm().isAfter(q.getPublicadoEm());
    }

    private Usos usos() {
        Map<UUID, Long> a = new HashMap<>();
        Map<UUID, Long> p = new HashMap<>();
        Map<UUID, Long> e = new HashMap<>();
        questionarios.contarAlunos().forEach(c -> a.put(c.questionarioId(), c.total()));
        questionarios.contarPastas().forEach(c -> p.put(c.questionarioId(), c.total()));
        questionarios.contarEnvios().forEach(c -> e.put(c.questionarioId(), c.total()));
        return new Usos(a, p, e);
    }

    private record Usos(Map<UUID, Long> alunos, Map<UUID, Long> pastas, Map<UUID, Long> envios) {
        Uso de(UUID id) {
            return new Uso(alunos.getOrDefault(id, 0L), pastas.getOrDefault(id, 0L), envios.getOrDefault(id, 0L));
        }
    }
}
