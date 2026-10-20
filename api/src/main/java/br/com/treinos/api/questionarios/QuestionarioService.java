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
import br.com.plataforma.comum.web.ConflictException;
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
 * Gestão dos questionários da consultoria (atualização e anamnese). Tudo passa pelo {@code @TenantId}: questionário, aluno ou
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
    private final br.com.treinos.api.alunos.AlunoService alunoService;
    private final PastaRepository pastas;
    private final ValidadorQuestionario validador;
    private final JsonMapper json;
    private final Auditoria auditoria;
    private final QuestionarioImagemService imagens;

    public QuestionarioService(QuestionarioRepository questionarios, QuestionarioVersaoRepository versoes,
                               AtualizacaoModeloRepository fabrica, AlunoRepository alunos, PastaRepository pastas,
                               ValidadorQuestionario validador, JsonMapper json, Auditoria auditoria,
                               QuestionarioImagemService imagens, br.com.treinos.api.alunos.AlunoService alunoService) {
        this.alunoService = alunoService;
        this.auditoria = auditoria;
        this.imagens = imagens;
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
    public List<QuestionarioResumo> listar(boolean arquivados, Finalidade finalidade) {
        Usos usos = usos();
        return questionarios.findByArquivadoAndFinalidadeOrderByNomeAsc(arquivados, finalidade).stream()
                .sorted(Comparator.comparing((Questionario q) -> !q.isPadrao()))
                .map(q -> resumo(q, usos.de(q.getId()))).toList();
    }

    @Transactional(readOnly = true)
    public List<OpcaoQuestionario> opcoes(Finalidade finalidade) {
        return questionarios.findByArquivadoAndFinalidadeOrderByNomeAsc(false, finalidade).stream().filter(Questionario::isUsavel)
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
            resumo = "Criou um questionário.")
    public QuestionarioDetalhe criar(CriarRequest r) {
        String nome = r.nome().trim();
        Finalidade finalidade = r.finalidade() == null ? Finalidade.ATUALIZACAO : r.finalidade();
        if (finalidade == Finalidade.ANAMNESE && r.origem() == Origem.FABRICA) {
            throw new br.com.plataforma.comum.web.BadRequestException("Ainda não há modelo da plataforma para anamnese: comece em branco.");
        }
        exigirNomeLivre(nome, null);
        String rascunho = r.origem() == Origem.FABRICA
                ? fabrica.findFirstByOrderByVersaoDesc().orElseThrow(
                        () -> new NaoEncontradoException("Modelo de fábrica não encontrado.")).getConteudo()
                : escrever(new ConteudoQuestionario(FORMATO, List.of(),
                        List.of(new Secao(UUID.randomUUID().toString(), "Geral", List.of()))));
        return detalhe(gravar(new Questionario(nome, descricao(r.descricao()), rascunho, finalidade)));
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
            resumo = "Publicou uma versão de questionário.")
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
        Questionario gravado = gravar(q);
        imagens.removerOrfas();
        return detalhe(gravado);
    }

    @Transactional
    @br.com.treinos.api.auditoria.Auditar(acao = "QUESTIONARIO_DUPLICADO", entidade = "QUESTIONARIO",
            resumo = "Duplicou um questionário.")
    public QuestionarioDetalhe duplicar(UUID id) {
        Questionario origem = buscar(id);
        String nome = nomeDaCopia(origem.getNome());
        return detalhe(gravar(new Questionario(nome, origem.getDescricao(), origem.getRascunho(), origem.getFinalidade())));
    }

    /** Idempotente: repetir o pedido no que já é o padrão responde 200 sem auditar. */
    @Transactional
    public QuestionarioDetalhe definirPadrao(UUID id) {
        Questionario q = buscarParaAlterar(id);
        if (!q.isUsavel()) {
            throw new ConflictException("Só um questionário publicado e ativo pode ser o padrão.",
                    "QUESTIONARIO_NAO_PUBLICADO");
        }
        if (q.isPadrao()) {
            return detalhe(q);
        }
        // O índice único parcial só admite um padrão por finalidade: desmarca o atual e grava antes de marcar o novo.
        questionarios.findByPadraoTrueAndFinalidade(q.getFinalidade()).ifPresent(atual -> atual.definirPadrao(false));
        questionarios.flush();
        q.definirPadrao(true);
        Questionario gravado = gravar(q);
        auditoria.registrarEvento("QUESTIONARIO_PADRAO_ALTERADO", "QUESTIONARIO", gravado.getId(),
                q.getFinalidade() == Finalidade.ANAMNESE ? "Trocou a anamnese padrão." : "Trocou o questionário de atualização padrão.");
        return detalhe(gravado);
    }

    /** Idempotente: arquivar o que já está arquivado responde 200 sem gravar nem auditar. */
    @Transactional
    public QuestionarioDetalhe arquivar(UUID id) {
        Questionario q = buscar(id);
        if (q.isArquivado()) {
            return detalhe(q);
        }
        if (q.isPadrao()) {
            throw new ConflictException("O questionário padrão não pode ser arquivado. Escolha outro padrão antes.",
                    "QUESTIONARIO_PADRAO");
        }
        q.arquivar();
        Questionario gravado = gravar(q);
        auditoria.registrarEvento("QUESTIONARIO_ARQUIVADO", "QUESTIONARIO", gravado.getId(),
                "Arquivou um questionário.");
        return detalhe(gravado);
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
                "Desarquivou um questionário.");
        return detalhe(gravado);
    }

    /**
     * Só sem uso: o padrão e o que já teve envio (a atualização guarda a versão respondida) ou anamnese atribuída (a
     * atribuição guarda a versão) ficam; o app oferece arquivar. Aluno e pasta que o escolheram voltam a nulo pela chave
     * estrangeira.
     */
    @Transactional
    @br.com.treinos.api.auditoria.Auditar(acao = "QUESTIONARIO_EXCLUIDO", entidade = "QUESTIONARIO",
            resumo = "Excluiu um questionário.")
    public void excluir(UUID id) {
        Questionario q = buscar(id);
        if (q.isPadrao()) {
            throw new ConflictException("O questionário padrão não pode ser excluído. Escolha outro padrão antes.",
                    "QUESTIONARIO_PADRAO");
        }
        if (questionarios.contarEnviosDo(q.getId()) > 0 || questionarios.contarAnamnesesDo(q.getId()) > 0) {
            throw new ConflictException("Este questionário já foi respondido por alunos. Arquive em vez de excluir.",
                    "QUESTIONARIO_EM_USO");
        }
        try {
            questionarios.delete(q);
            questionarios.flush();
            imagens.removerOrfas();
        } catch (DataIntegrityViolationException e) {
            // Um envio chegou entre a conferência e o delete: a FK de atualizacao protege.
            throw new ConflictException("Este questionário já foi respondido por alunos. Arquive em vez de excluir.",
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
        br.com.treinos.api.alunos.AlunoService.exigirNaoAnonimizado(aluno);
        exigirEscolhivel(questionarioId);
        aluno.alterarQuestionario(questionarioId);
        return alunoService.detalheDe(alunos.saveAndFlush(aluno));
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

    /** Questionário vazio vale (volta ao padrão); senão tem de ser de atualização, publicado e não arquivado. */
    public void exigirEscolhivel(UUID questionarioId) {
        if (questionarioId == null) {
            return;
        }
        Questionario q = buscar(questionarioId);
        if (!q.isUsavel() || q.getFinalidade() != Finalidade.ATUALIZACAO) {
            throw new ConflictException("Escolha um questionário publicado e que não esteja arquivado.",
                    "QUESTIONARIO_INDISPONIVEL");
        }
    }

    /** Anamnese para atribuir: de anamnese, publicada e não arquivada (senão 409 {@code QUESTIONARIO_INDISPONIVEL}). */
    public Questionario exigirAnamneseUsavel(UUID questionarioId) {
        Questionario q = buscar(questionarioId);
        if (!q.isUsavel() || q.getFinalidade() != Finalidade.ANAMNESE) {
            throw new ConflictException("Escolha uma anamnese publicada e que não esteja arquivada.",
                    "QUESTIONARIO_INDISPONIVEL");
        }
        return q;
    }

    private Questionario buscar(UUID id) {
        return questionarios.findById(id)
                .orElseThrow(() -> new NaoEncontradoException("Questionário não encontrado."));
    }

    private Questionario buscarParaAlterar(UUID id) {
        return questionarios.buscarParaAlterar(id)
                .orElseThrow(() -> new NaoEncontradoException("Questionário não encontrado."));
    }

    private Questionario gravar(Questionario q) {
        try {
            return questionarios.saveAndFlush(q);
        } catch (DataIntegrityViolationException e) {
            // Corrida: os índices únicos são a rede. A mensagem nunca repete o que foi digitado.
            if (restricao(e).contains("nome")) {
                throw new ConflictException("Já existe um questionário ativo com este nome.",
                        "QUESTIONARIO_NOME_EM_USO");
            }
            throw new ConflictException(
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
            throw new ConflictException("Este questionário está arquivado. Desarquive para editar.",
                    "QUESTIONARIO_ARQUIVADO");
        }
    }

    private static void exigirMesmaVersao(Questionario q, Long versao) {
        if (!q.getVersao().equals(versao)) {
            throw new ConflictException(
                    "Outra pessoa ou aba alterou este questionário. Recarregue para ver a versão atual.",
                    "CONFLITO_EDICAO");
        }
    }

    private void exigirNomeLivre(String nome, UUID proprio) {
        boolean ocupado = proprio == null
                ? questionarios.existsByNomeIgnoreCaseAndArquivadoFalse(nome)
                : questionarios.existsByNomeIgnoreCaseAndArquivadoFalseAndIdNot(nome, proprio);
        if (ocupado) {
            throw new ConflictException("Já existe um questionário ativo com este nome.", "QUESTIONARIO_NOME_EM_USO");
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

    /**
     * Erros do validador, o tipo de um id que já foi publicado com outro tipo (nunca muda entre versões) e imagem citada
     * que não existe na consultoria.
     */
    private ResultadoValidacao resultadoDaPublicacao(Questionario q, ConteudoQuestionario conteudo) {
        ResultadoValidacao base = validador.validar(conteudo, q.getFinalidade());
        List<ConteudoQuestionario> publicadas = versoes.findByQuestionarioIdOrderByNumeroAsc(q.getId()).stream()
                .map(v -> ler(v.getConteudo())).toList();
        Set<String> mudaram = ValidadorQuestionario.tiposQueMudaram(conteudo, publicadas);
        Set<UUID> semImagem = imagens.inexistentes(QuestionarioImagemService.imagensDo(conteudo));
        if (mudaram.isEmpty() && semImagem.isEmpty()) {
            return base;
        }
        List<Problema> erros = new ArrayList<>(base.erros());
        for (int i = 0; i < conteudo.secoes().size(); i++) {
            var perguntas = conteudo.secoes().get(i).perguntas();
            for (int j = 0; perguntas != null && j < perguntas.size(); j++) {
                var p = perguntas.get(j);
                String cp = "secoes[" + i + "].perguntas[" + j + "]";
                if (mudaram.contains(p.id())) {
                    erros.add(new Problema(cp + ".tipo",
                            "O tipo de uma pergunta já publicada não pode mudar. Crie uma pergunta nova."));
                }
                if (citaInexistente(p.imagemId(), semImagem)) {
                    erros.add(new Problema(cp + ".imagemId", "A imagem não existe mais. Envie de novo."));
                }
                for (int k = 0; p.opcoes() != null && k < p.opcoes().size(); k++) {
                    if (citaInexistente(p.opcoes().get(k).imagemId(), semImagem)) {
                        erros.add(new Problema(cp + ".opcoes[" + k + "].imagemId", "A imagem não existe mais. Envie de novo."));
                    }
                }
            }
        }
        return new ResultadoValidacao(List.copyOf(erros), base.avisos());
    }

    private static boolean citaInexistente(String imagemId, Set<UUID> semImagem) {
        if (imagemId == null || semImagem.isEmpty()) {
            return false;
        }
        try {
            return semImagem.contains(UUID.fromString(imagemId));
        } catch (IllegalArgumentException formatoErrado) {
            return false;
        }
    }

    /** Rascunho incompleto é aceito; aqui só se fixa o formato e o que o JSON gravado precisa ter. */
    static ConteudoQuestionario normalizar(ConteudoQuestionario c) {
        List<Secao> secoes = c.secoes() == null ? List.of() : c.secoes().stream()
                .map(s -> new Secao(s.uid(), s.titulo(), s.descricao(), s.perguntas() == null ? List.<Pergunta>of()
                        : s.perguntas().stream().map(QuestionarioService::normalizar).toList(), s.mostrarSe()))
                .toList();
        return new ConteudoQuestionario(FORMATO, c.instrucoes() == null ? List.of() : c.instrucoes(), secoes);
    }

    private static Pergunta normalizar(Pergunta p) {
        return new Pergunta(p.id(), p.tipo(), p.rotulo(), Boolean.TRUE.equals(p.obrigatoria()), p.ajuda(),
                p.destaque(), p.rotuloCurto(), p.ajudaAutomatica(), p.dias(), p.opcoes(), p.unidade(), p.min(),
                p.max(), p.casas(), p.imagemId(), p.somentePassado(), p.linhas(), p.colunas(), p.texto(),
                p.declaracao(), p.mostrarSe(), p.destino(), p.destinoData(), p.rotuloMin(), p.rotuloMax());
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
        return new QuestionarioDetalhe(q.getId(), q.getNome(), q.getDescricao(), q.getFinalidade(), q.isPadrao(), q.isArquivado(),
                q.getVersaoPublicada(), q.getPublicadoEm(), alterado(q), q.getRascunhoAlteradoEm(), q.getVersao(),
                usos().de(q.getId()), ler(q.getRascunho()), publicadas);
    }

    private static QuestionarioResumo resumo(Questionario q, Uso uso) {
        return new QuestionarioResumo(q.getId(), q.getNome(), q.getDescricao(), q.getFinalidade(), q.isPadrao(), q.isArquivado(),
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
        questionarios.contarAnamneses().forEach(c -> e.merge(c.questionarioId(), c.total(), Long::sum));
        return new Usos(a, p, e);
    }

    private record Usos(Map<UUID, Long> alunos, Map<UUID, Long> pastas, Map<UUID, Long> envios) {
        Uso de(UUID id) {
            return new Uso(alunos.getOrDefault(id, 0L), pastas.getOrDefault(id, 0L), envios.getOrDefault(id, 0L));
        }
    }
}
