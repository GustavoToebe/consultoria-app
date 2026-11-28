package br.com.treinos.api.importacao.assistida;

import br.com.plataforma.comum.web.BadRequestException;
import br.com.plataforma.comum.web.ConflictException;
import br.com.plataforma.comum.web.ResourceNotFoundException;
import br.com.treinos.api.alunos.Aluno;
import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.alunos.AlunoService;
import br.com.treinos.api.consultoria.ConfiguracaoConsultoria;
import br.com.treinos.api.dieta.ConteudoDieta;
import br.com.treinos.api.equipe.AcessoAtual;
import br.com.treinos.api.importacao.LeitorDePlanilha;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.ApelidoDto;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.ArquivoResumo;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.AtualizarGrupoRequisicao;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.CadastroImportavel;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.CandidatoAluno;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.CoberturaArquivo;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.DecisaoImportacao;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.DuvidaImportacao;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.GrupoImportavel;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.LeituraEmAndamento;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.ModoProcessamentoResumo;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.OcorrenciaOrigem;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.ParceiroDeGrupo;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.PesoImportavel;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.ResponderDuvidaRequisicao;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.RespostaDuvidaRequisicao;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.SessaoDetalhe;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.SessaoListaItem;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.SugestaoDuvida;
import br.com.treinos.api.importacao.assistida.ia.ContextoIa;
import br.com.treinos.api.importacao.assistida.ia.ResultadoInterpretacao;
import br.com.treinos.api.importacao.assistida.ia.RoteadorInterpretadorIa;
import br.com.treinos.api.importacao.assistida.ia.TermoDeDuvida;
import br.com.treinos.api.receitas.ReceitaService;
import br.com.treinos.api.tenant.TenantContext;
import br.com.treinos.api.treino.ConteudoTreino;
import br.com.treinos.api.web.Buscas;
import br.com.treinos.api.web.Formatos;
import br.com.treinos.api.web.NaoEncontradoException;
import br.com.treinos.api.web.ValidacaoException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.Semaphore;
import java.util.regex.Pattern;

/**
 * Importação assistida (lote de PDF, DOCX, planilha e texto): recebe, interpreta e deixa em rascunho de revisão. A
 * gravação dos grupos é da {@link ConfirmacaoDaImportacaoAssistida}. Dado do aluno só vive na sessão por 7 dias
 * ({@link ImportacaoAssistidaRetencao}); os bytes do arquivo ficam retidos durante a revisão e saem na conclusão,
 * cancelamento, expiração ou anonimização.
 */
@Service
public class ImportacaoAssistidaService {

    static final int ARQUIVOS_POR_SESSAO = 20;
    static final int SESSOES_ABERTAS_POR_USUARIO = 20;
    /** Igual ao teto das planilhas da importação comum. */
    static final int BYTES_POR_ARQUIVO = LeitorDePlanilha.ARQUIVO_MAXIMO;
    static final long BYTES_POR_SESSAO = 8L * 1024 * 1024;
    static final int NOME_DO_ARQUIVO = 255;
    static final int TITULO_DO_TEXTO = 120;
    static final int TERMO_DO_APELIDO = 160;
    static final int TIPO_DO_APELIDO = 24;
    /** Arquivos de uma sessão lidos ao mesmo tempo: o provedor de IA é a espera, e mais que isso estoura o limite dele. */
    static final int ARQUIVOS_EM_PARALELO = 3;
    private static final int CANDIDATOS_POR_GRUPO = 5;
    /** Teto do "Juntar as N partes" num pedido (as partes de um documento grande ficam bem abaixo). */
    static final int MAXIMO_DE_GRUPOS_JUNTADOS = 50;
    private static final Pattern EMAIL_SIMPLES = Pattern.compile("[^@\\s]+@[^@\\s]+\\.[^@\\s]+");
    private static final Set<String> DESTINOS = Set.of("CRIAR_ALUNO", "VINCULAR_EXISTENTE", "MODELO_BIBLIOTECA", "IGNORAR");
    /** Destinos de aluno: só esses grupos podem ser o mesmo aluno de outro grupo (juntar, "possível mesmo aluno"). */
    private static final Set<String> DESTINOS_DE_ALUNO = Set.of("CRIAR_ALUNO", "VINCULAR_EXISTENTE");

    private final ImportacaoSessaoRepository sessoes;
    private final ImportacaoArquivoRepository arquivos;
    private final ImportacaoApelidoConsultoriaRepository apelidos;
    private final AlunoRepository alunos;
    private final JsonMapper json;
    private final RoteadorInterpretadorIa roteador;
    private final ReceitaService receitas;

    public ImportacaoAssistidaService(ImportacaoSessaoRepository sessoes, ImportacaoArquivoRepository arquivos,
                                      ImportacaoApelidoConsultoriaRepository apelidos, AlunoRepository alunos,
                                      JsonMapper json, RoteadorInterpretadorIa roteador, ReceitaService receitas) {
        this.sessoes = sessoes;
        this.arquivos = arquivos;
        this.apelidos = apelidos;
        this.alunos = alunos;
        this.json = json;
        this.roteador = roteador;
        this.receitas = receitas;
    }

    /** Política conservadora para o piloto: entrada/leitura de sessão mista exige as permissões de leitura do conteúdo. */
    void exigirPermissoesSessaoMista() {
        AcessoAtual.exigir("ALUNO_ALTERAR");
        AcessoAtual.exigir("ALUNO_SENSIVEL_LER");
        AcessoAtual.exigir("TREINO_LER");
        AcessoAtual.exigir("DIETA_LER");
    }

    @Transactional
    public SessaoDetalhe criarSessao(UUID usuarioId) {
        exigirPermissoesSessaoMista();
        if (sessoes.countByCriadoPorAndEstadoNotAndExpiraEmAfter(usuarioId, "CONCLUIDA", Instant.now())
                >= SESSOES_ABERTAS_POR_USUARIO) {
            throw new ConflictException("Muitas importações abertas. Conclua ou aguarde as antigas expirarem.",
                    "LIMITE_DE_SESSOES");
        }
        ImportacaoSessao sessao = new ImportacaoSessao(usuarioId);
        sessoes.save(sessao);
        return detalheDaSessao(sessao);
    }

    @Transactional(readOnly = true)
    public List<SessaoListaItem> listarSessoes() {
        AcessoAtual.exigir("ALUNO_LER");
        UUID consultoriaId = TenantContext.get();
        return sessoes.findTop20ByConsultoriaIdOrderByCriadoEmDesc(consultoriaId).stream()
                .map(s -> {
                    int totalArquivos = (int) arquivos.countBySessaoId(s.getId());
                    int totalGrupos = SessaoJson.grupos(json, s).size();
                    int duvidasAbertas = (int) SessaoJson.duvidas(json, s).stream().filter(d -> !d.resolvida()).count();
                    return new SessaoListaItem(s.getId(), SessaoJson.estadoEfetivo(json, s), s.getRevisao(),
                            totalArquivos, totalGrupos, duvidasAbertas, s.getCriadoEm(), s.getExpiraEm());
                })
                .toList();
    }

    @Transactional
    public ArquivoResumo adicionarArquivo(UUID sessaoId, MultipartFile arquivo) throws IOException {
        exigirPermissoesSessaoMista();
        ImportacaoSessao sessao = sessaoAberta(sessaoId);
        if (arquivo.isEmpty()) {
            throw new BadRequestException("O arquivo enviado está vazio.", "ARQUIVO_VAZIO");
        }
        if (arquivo.getSize() > BYTES_POR_ARQUIVO) {
            throw new BadRequestException("O arquivo passa do tamanho máximo.", "ARQUIVO_GRANDE_DEMAIS");
        }
        String nome = nomeLimpo(arquivo.getOriginalFilename(), "documento");
        byte[] bytes = arquivo.getBytes();
        String formato = detectarFormato(nome, bytes, roteador.arquivoVaiAoProvedor());
        return guardar(sessao, nome, formato, imagemSemMetadados(formato, bytes));
    }

    @Transactional
    public ArquivoResumo adicionarTexto(UUID sessaoId, String titulo, String conteudo) {
        exigirPermissoesSessaoMista();
        ImportacaoSessao sessao = sessaoAberta(sessaoId);
        if (conteudo == null || conteudo.isBlank()) {
            throw new BadRequestException("O texto enviado está vazio.", "TEXTO_VAZIO");
        }
        byte[] bytes = conteudo.getBytes(StandardCharsets.UTF_8);
        if (bytes.length > BYTES_POR_ARQUIVO) {
            throw new BadRequestException("O texto passa do tamanho máximo.", "ARQUIVO_GRANDE_DEMAIS");
        }
        if (titulo != null && titulo.strip().length() > TITULO_DO_TEXTO) {
            throw new BadRequestException("O título do texto é longo demais.", "TITULO_GRANDE_DEMAIS");
        }
        String nome = titulo != null && !titulo.isBlank() ? titulo.strip() : "Texto livre";
        return guardar(sessao, nome, "TEXTO_LIVRE", bytes);
    }

    private ArquivoResumo guardar(ImportacaoSessao sessao, String nome, String formato, byte[] bytes) {
        if (arquivos.countBySessaoId(sessao.getId()) >= ARQUIVOS_POR_SESSAO) {
            throw new ConflictException("A importação já tem arquivos demais.", "LIMITE_DE_ARQUIVOS");
        }
        if (arquivos.somaDeBytes(sessao.getId()) + bytes.length > BYTES_POR_SESSAO) {
            throw new ConflictException("A importação já passou do volume máximo.", "LIMITE_DE_VOLUME");
        }
        ImportacaoArquivo arq = new ImportacaoArquivo(sessao.getId(), nome, formato, calcularSha256(bytes), bytes.length, bytes);
        arquivos.save(arq);
        sessao.incrementarRevisao();
        return resumo(arq);
    }

    /** Processamento síncrono (usado em testes unitários de serviço). */
    @Transactional
    public SessaoDetalhe processar(UUID sessaoId) {
        exigirPermissoesSessaoMista();
        ImportacaoSessao sessao = sessaoTravada(sessaoId);
        exigirNaoEncerrada(sessao);
        List<ImportacaoArquivo> todos = arquivos.findBySessaoIdOrderByCriadoEmAsc(sessaoId);
        if (todos.isEmpty()) {
            throw new BadRequestException("Adicione ao menos um arquivo ou texto para processar.", "SEM_ARQUIVOS");
        }
        List<ImportacaoArquivo> pendentes = todos.stream().filter(a -> "RECEBIDO".equals(a.getEstado())).toList();
        if (pendentes.isEmpty()) {
            return detalheDaSessao(sessao);
        }
        // A mesma marca de leitura do caminho assíncrono: uma leitura velha dessa sessão não grava por cima desta.
        SessaoJson.marcarNovaLeitura(json, sessao, UUID.randomUUID(), pendentes.size());
        sessao.atualizarEstado("PROCESSANDO");
        PreparoProcessamento preparo = montarPreparo(sessao, pendentes);
        ResultadoProcessamentoLote resultado = executarProcessamentoSemTransacao(preparo);
        aplicarResultadoNaSessao(sessao, todos, resultado);
        return detalheDaSessao(sessao);
    }

    static final class ArquivoPendente {
        private final UUID id;
        private final String nomeOriginal;
        private final String formato;
        private final byte[] conteudoBytes;

        ArquivoPendente(UUID id, String nomeOriginal, String formato, byte[] conteudoBytes) {
            this.id = id;
            this.nomeOriginal = nomeOriginal;
            this.formato = formato;
            this.conteudoBytes = conteudoBytes;
        }

        UUID id() { return id; }
        String nomeOriginal() { return nomeOriginal; }
        String formato() { return formato; }
        byte[] conteudoBytes() { return conteudoBytes; }
    }

    /**
     * {@code metodologia} é a receita padrão da consultoria (nula quando não há: o plano fica sem ela, como os demais) e
     * {@code configuracao} é a que vale para nomear os tipos de série (a própria receita ou o padrão do sistema).
     */
    record PreparoProcessamento(UUID sessaoId, Map<String, String> dicionario,
                                List<ArquivoPendente> pendentes, List<Aluno> existentes,
                                ConteudoTreino.Metodologia metodologia, ConfiguracaoConsultoria configuracao) {
    }

    record ResultadoArquivoProcessado(UUID arquivoId, boolean sucesso, String extracaoJson, String erroCodigo,
                                      RoteadorInterpretadorIa.ExecucaoInterpretacao execucao,
                                      RedatorLgpdImportacao.RedacaoResultado redacao) {
    }

    record ResultadoProcessamentoLote(List<ResultadoArquivoProcessado> itens, List<Aluno> existentes) {
    }

    PreparoProcessamento prepararProcessamentoForaDeTransacao(UUID sessaoId) {
        ImportacaoSessao sessao = sessoes.findByIdAndConsultoriaId(sessaoId, TenantContext.get()).orElse(null);
        if (sessao == null || !"PROCESSANDO".equals(sessao.getEstado())) {
            return null;
        }
        List<ImportacaoArquivo> pendentes = arquivos.findBySessaoIdOrderByCriadoEmAsc(sessaoId).stream()
                .filter(a -> "RECEBIDO".equals(a.getEstado()))
                .toList();
        if (pendentes.isEmpty()) {
            return null;
        }
        return montarPreparo(sessao, pendentes);
    }

    private PreparoProcessamento montarPreparo(ImportacaoSessao sessao, List<ImportacaoArquivo> pendentes) {
        Map<String, String> dicionario = carregarDicionarioConsultoria();
        List<ArquivoPendente> itens = pendentes.stream()
                .map(a -> new ArquivoPendente(a.getId(), a.getNomeOriginal(), a.getFormato(), a.getConteudoBytes()))
                .toList();
        List<Aluno> existentes = alunos.findAll();
        ConteudoTreino.Metodologia metodologia = receitas.metodologiaPadrao().orElse(null);
        ConfiguracaoConsultoria configuracao = metodologia != null && metodologia.configuracao() != null
                ? metodologia.configuracao() : ConfiguracaoConsultoria.padrao();
        return new PreparoProcessamento(sessao.getId(), dicionario, itens, existentes, metodologia, configuracao);
    }

    ResultadoProcessamentoLote executarProcessamentoSemTransacao(PreparoProcessamento preparo) {
        return executarProcessamentoSemTransacao(preparo, null);
    }

    /**
     * Lê o primeiro arquivo sozinho e só então os demais, até ARQUIVOS_EM_PARALELO ao mesmo tempo (threads virtuais: a
     * espera é do provedor de IA): a primeira chamada grava o cache do provedor (o {@code system} é o mesmo para todos) e
     * as outras o leem. Devolve os resultados na ordem dos arquivos. {@code aoConcluirArquivo} roda a cada arquivo
     * terminado, na thread dele e já com a consultoria, e serve só para o progresso da tela. Sessão cortada (thread
     * interrompida): as leituras ainda em curso são interrompidas, sem deixar chamada órfã ao provedor.
     */
    ResultadoProcessamentoLote executarProcessamentoSemTransacao(PreparoProcessamento preparo, Runnable aoConcluirArquivo) {
        List<ArquivoPendente> lista = preparo.pendentes();
        List<ResultadoArquivoProcessado> itens = new ArrayList<>();
        if (lista.isEmpty()) {
            return new ResultadoProcessamentoLote(List.of(), preparo.existentes());
        }
        itens.add(processarArquivo(lista.getFirst(), preparo, aoConcluirArquivo));
        if (lista.size() == 1) {
            return new ResultadoProcessamentoLote(List.copyOf(itens), preparo.existentes());
        }
        if (Thread.currentThread().isInterrupted()) {
            throw new IllegalStateException("Leitura dos arquivos interrompida.");
        }
        List<ArquivoPendente> resto = lista.subList(1, lista.size());
        UUID consultoria = TenantContext.get();
        Semaphore vagas = new Semaphore(ARQUIVOS_EM_PARALELO);
        ExecutorService pool = Executors.newVirtualThreadPerTaskExecutor();
        try {
            List<Future<ResultadoArquivoProcessado>> futuros = new ArrayList<>();
            for (ArquivoPendente arq : resto) {
                futuros.add(pool.submit(() -> {
                    vagas.acquire();
                    try {
                        return consultoria == null ? processarArquivo(arq, preparo, aoConcluirArquivo)
                                : TenantContext.executarComo(consultoria, () -> processarArquivo(arq, preparo, aoConcluirArquivo));
                    } finally {
                        vagas.release();
                    }
                }));
            }
            for (int i = 0; i < resto.size(); i++) {
                try {
                    itens.add(futuros.get(i).get());
                } catch (ExecutionException e) {
                    itens.add(new ResultadoArquivoProcessado(resto.get(i).id(), false, null, "ERRO_PROCESSAMENTO", null, null));
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    throw new IllegalStateException("Leitura dos arquivos interrompida.");
                }
            }
        } finally {
            pool.shutdownNow();
        }
        return new ResultadoProcessamentoLote(List.copyOf(itens), preparo.existentes());
    }

    private ResultadoArquivoProcessado processarArquivo(ArquivoPendente arq, PreparoProcessamento preparo,
                                                         Runnable aoConcluirArquivo) {
        ResultadoArquivoProcessado resultado;
        try {
            ResultadoExtracao extracao = extrairArquivo(arq.formato(), arq.nomeOriginal(), arq.conteudoBytes());
            RedatorLgpdImportacao.RedacaoResultado redacao = RedatorLgpdImportacao.redigir(extracao.textoCompleto());
            ContextoIa contexto = roteador.comArquivoSeCouber(new ContextoIa(arq.nomeOriginal(), arq.formato(),
                    extracao.blocos(), extracao.textoCompleto(), tiposParaOContexto(preparo.configuracao()),
                    preparo.dicionario()), arq.conteudoBytes(),
                    extracao.metadados() == null ? null : String.valueOf(extracao.metadados().get("cobertura")));
            RoteadorInterpretadorIa.ExecucaoInterpretacao execucao = comTiposDaMetodologia(
                    roteador.interpretarComModo(contexto, preparo.sessaoId()), preparo);
            // O modo efetivo de cada arquivo fica nos metadados dele (a tela diz qual foi lido pelas regras e por quê).
            Map<String, Object> metadados = new HashMap<>(extracao.metadados() == null ? Map.of() : extracao.metadados());
            metadados.put("modo", execucao.modoEfetivo());
            metadados.put("motivoFallback", execucao.motivoFallback());
            metadados.put("enviadoComoArquivo", execucao.enviadoComoArquivo());
            resultado = new ResultadoArquivoProcessado(arq.id(), true, json.writeValueAsString(metadados),
                    null, execucao, redacao);
        } catch (ExtracaoRecusadaException e) {
            resultado = new ResultadoArquivoProcessado(arq.id(), false, null, e.codigo(), null, null);
        } catch (RuntimeException e) {
            resultado = new ResultadoArquivoProcessado(arq.id(), false, null, "ERRO_PROCESSAMENTO", null, null);
        }
        if (aoConcluirArquivo != null) {
            aoConcluirArquivo.run();
        }
        return resultado;
    }

    /** Uma linha por tipo, {@code CODIGO = Nome (PAPEL)}: é o que a IA e as regras podem usar em {@code serie.tipo}. */
    private static List<String> tiposParaOContexto(ConfiguracaoConsultoria config) {
        return config.tipos().stream().filter(t -> t != null && t.codigo() != null)
                .map(t -> t.codigo().strip() + " = " + (t.nome() == null ? t.codigo().strip() : t.nome().strip())
                        + (t.papel() == null ? "" : " (" + t.papel().name() + ")"))
                .toList();
    }

    /** Leva o tipo de cada série ao código da metodologia e põe a metodologia padrão no treino proposto. */
    private static RoteadorInterpretadorIa.ExecucaoInterpretacao comTiposDaMetodologia(
            RoteadorInterpretadorIa.ExecucaoInterpretacao exec, PreparoProcessamento preparo) {
        List<ResultadoInterpretacao.PropostaGrupo> grupos = exec.resultado().grupos().stream().map(pg -> {
            if (pg.treino() == null) {
                return pg;
            }
            ConteudoTreino treino = TiposDaMetodologia.normalizar(pg.treino(), preparo.configuracao());
            if (preparo.metodologia() != null) {
                treino = treino.comMetodologia(preparo.metodologia());
            }
            return new ResultadoInterpretacao.PropostaGrupo(pg.identificadorOrigem(), pg.nomeAluno(), pg.email(),
                    pg.telefone(), pg.objetivo(), pg.observacoes(), pg.pesos(), treino, pg.dieta(), pg.avisos(),
                    pg.origemDoNome());
        }).toList();
        return new RoteadorInterpretadorIa.ExecucaoInterpretacao(
                new ResultadoInterpretacao(grupos, exec.resultado().duvidas(), exec.resultado().uso()), exec.modoEfetivo(),
                exec.provedorConfigurado(), exec.fallbackParaRegras(), exec.motivoFallback(), exec.enviadoComoArquivo());
    }

    void concluirProcessamentoEmTransacao(UUID sessaoId, ResultadoProcessamentoLote resultado) {
        ImportacaoSessao sessao = sessoes.buscarParaAlterar(sessaoId, TenantContext.get()).orElse(null);
        if (sessao == null || !"PROCESSANDO".equals(sessao.getEstado())) {
            return;
        }
        if ("CANCELADA".equals(sessao.getEstado()) || sessao.getExpiraEm().isBefore(Instant.now())) {
            return;
        }
        List<ImportacaoArquivo> todos = arquivos.findBySessaoIdOrderByCriadoEmAsc(sessaoId);
        aplicarResultadoNaSessao(sessao, todos, resultado);
    }

    private void aplicarResultadoNaSessao(ImportacaoSessao sessao, List<ImportacaoArquivo> todos,
                                          ResultadoProcessamentoLote resultado) {
        Map<UUID, ImportacaoArquivo> porId = new HashMap<>();
        for (ImportacaoArquivo a : todos) {
            porId.put(a.getId(), a);
        }

        List<GrupoImportavel> grupos = new ArrayList<>(SessaoJson.grupos(json, sessao));
        List<DuvidaImportacao> duvidas = new ArrayList<>(SessaoJson.duvidas(json, sessao));
        int seqGrupo = maiorNumeroDeGrupo(grupos);
        int seqDuvida = duvidas.size();
        ModoProcessamentoResumo modo = lerModoProcessamento(sessao);

        for (ResultadoArquivoProcessado item : resultado.itens()) {
            ImportacaoArquivo arq = porId.get(item.arquivoId());
            // Só o arquivo que ainda espera leitura: o já lido (por outra leitura) ou com erro não entra duas vezes.
            if (arq == null || !"RECEBIDO".equals(arq.getEstado())) {
                continue;
            }
            if (!item.sucesso()) {
                arq.marcarErro(item.erroCodigo());
                arq.limparConteudoBytes();
                continue;
            }
            arq.marcarProcessado(item.extracaoJson());
            modo = consolidarModo(modo, item.execucao());
            boolean unico = item.execucao().resultado().grupos().size() == 1;
            String email = unico ? unico(item.redacao().emails(), false) : null;
            String telefone = unico ? unico(item.redacao().telefones(), true) : null;
            for (ResultadoInterpretacao.PropostaGrupo pg : item.execucao().resultado().grupos()) {
                seqGrupo++;
                GrupoImportavel novo = montarGrupo(pg, arq, "grupo-" + seqGrupo, email, telefone, resultado.existentes());
                // Só o nome lido do conteúdo junta sozinho (D6): o substituto (nome do arquivo, título, "Aluno N") repete
                // entre alunos diferentes, e cada grupo sem nome lido fica separado, com id próprio.
                if (!novo.nomeLidoDoConteudo() || !juntarAoMesmoAluno(grupos, novo)) {
                    grupos.add(novo);
                }
            }
            for (ResultadoInterpretacao.PropostaDuvida pd : item.execucao().resultado().duvidas()) {
                if (TermoDeDuvida.semConteudo(pd.termoOriginal())) {
                    continue; // mesma regra do decodificador, para qualquer interpretador
                }
                List<SugestaoDuvida> sugs = new ArrayList<>();
                if (pd.sugestoes() != null) {
                    for (ResultadoInterpretacao.PropostaSugestao ps : pd.sugestoes()) {
                        String origemSug = ps.referenciaId() != null ? "BIBLIOTECA" : "IA";
                        sugs.add(new SugestaoDuvida(ps.termo(), ps.referenciaId(), origemSug, ps.nota()));
                    }
                }
                seqDuvida++;
                List<String> ocIds = pd.ocorrenciaIds() == null ? List.of() : pd.ocorrenciaIds();
                int qtdOc = ocIds.isEmpty() ? 1 : ocIds.size();
                duvidas.add(new DuvidaImportacao("duvida-" + seqDuvida, pd.tipo(), pd.termoOriginal(), pd.trechoOriginal() == null ? "" : pd.trechoOriginal(),
                        arq.getNomeOriginal(), qtdOc, sugs, false, null, ocIds));
            }
        }

        long processados = todos.stream().filter(a -> !"RECEBIDO".equals(a.getEstado())).count();
        grupos = comEstadoDasDuvidas(grupos, duvidas);
        sessao.atualizarResultados(json.writeValueAsString(grupos), json.writeValueAsString(duvidas),
                serializarProgresso(sessao, processados, modo));
        sessao.atualizarEstado("REVISANDO");
    }

    /** Maior N entre os ids {@code grupo-N}: juntar apaga grupos, então o tamanho da lista não serve de sequência. */
    private static int maiorNumeroDeGrupo(List<GrupoImportavel> grupos) {
        int maior = 0;
        for (GrupoImportavel g : grupos) {
            if (g.id() != null && g.id().startsWith("grupo-")) {
                try {
                    maior = Math.max(maior, Integer.parseInt(g.id().substring("grupo-".length())));
                } catch (NumberFormatException ignored) {
                    // id fora do padrão: não conta
                }
            }
        }
        return Math.max(maior, grupos.size());
    }

    /** Grupo de aluno ainda por gravar: o que pode ser juntado a outro do mesmo aluno. */
    private static boolean juntavel(GrupoImportavel g) {
        return !"IMPORTADO".equals(g.estado()) && !"IGNORADO".equals(g.estado()) && DESTINOS_DE_ALUNO.contains(g.destino());
    }

    /**
     * Mesmo aluno em dois arquivos (D6): junta {@code novo} ao primeiro grupo juntável de mesmo nome (sem acento nem
     * caixa) que não conflita com ele e devolve {@code true}; senão não mexe e devolve {@code false}. Os DOIS têm de ter o
     * nome lido do conteúdo. Grupo com erro de gravação não junta sozinho (o treinador está mexendo nele).
     */
    private static boolean juntarAoMesmoAluno(List<GrupoImportavel> grupos, GrupoImportavel novo) {
        String chave = chaveDoNome(novo.nomeDetectado());
        if (chave.isEmpty() || !novo.nomeLidoDoConteudo()) {
            return false;
        }
        for (int i = 0; i < grupos.size(); i++) {
            GrupoImportavel g = grupos.get(i);
            if (juntavel(g) && !"ERRO".equals(g.estado()) && g.nomeLidoDoConteudo()
                    && chave.equals(chaveDoNome(g.nomeDetectado())) && !conflitam(g, novo)) {
                grupos.set(i, juntar(g, novo));
                return true;
            }
        }
        return false;
    }

    /**
     * Conflito de conteúdo: dois treinos, duas dietas, e-mails ou telefones diferentes, alunos existentes diferentes ou o
     * mesmo dia com pesos diferentes. Só sem conflito o servidor junta sozinho.
     */
    static boolean conflitam(GrupoImportavel a, GrupoImportavel b) {
        if ((a.treino() != null && b.treino() != null) || (a.dieta() != null && b.dieta() != null)) {
            return true;
        }
        if (a.alunoExistenteId() != null && b.alunoExistenteId() != null
                && !a.alunoExistenteId().equals(b.alunoExistenteId())) {
            return true;
        }
        CadastroImportavel ca = a.cadastro();
        CadastroImportavel cb = b.cadastro();
        if (ca != null && cb != null) {
            if (temTexto(ca.email()) && temTexto(cb.email()) && !ca.email().strip().equalsIgnoreCase(cb.email().strip())) {
                return true;
            }
            if (temTexto(ca.telefone()) && temTexto(cb.telefone())
                    && !ca.telefone().replaceAll("\\D", "").equals(cb.telefone().replaceAll("\\D", ""))) {
                return true;
            }
        }
        Map<java.time.LocalDate, java.math.BigDecimal> porData = new HashMap<>();
        for (PesoImportavel p : a.pesos() == null ? List.<PesoImportavel>of() : a.pesos()) {
            if (p != null && p.data() != null && p.kg() != null) {
                porData.put(p.data(), p.kg());
            }
        }
        for (PesoImportavel p : b.pesos() == null ? List.<PesoImportavel>of() : b.pesos()) {
            if (p != null && p.data() != null && p.kg() != null && porData.containsKey(p.data())
                    && porData.get(p.data()).compareTo(p.kg()) != 0) {
                return true;
            }
        }
        return false;
    }

    /**
     * {@code outro} dentro de {@code alvo}: o que diverge fica com o {@code alvo} e o {@code outro} só completa o que
     * falta; arquivos, pesos (sem repetir o dia), ocorrências, avisos e candidatos somam. Quem chama confere os planos.
     */
    static GrupoImportavel juntar(GrupoImportavel alvo, GrupoImportavel outro) {
        return juntar(alvo, outro, false, false);
    }

    /**
     * Com {@code partes}, os planos se somam como nas partes de um documento grande (o que passa dos tetos sai e vira
     * aviso); {@code outroAntes} põe as divisões e refeições do {@code outro} na frente.
     */
    static GrupoImportavel juntar(GrupoImportavel alvo, GrupoImportavel outro, boolean partes, boolean outroAntes) {
        CadastroImportavel ca = alvo.cadastro();
        CadastroImportavel cb = outro.cadastro();
        CadastroImportavel cadastro = ca == null ? cb : cb == null ? ca : new CadastroImportavel(
                temTexto(ca.nome()) ? ca.nome() : cb.nome(),
                temTexto(ca.email()) ? ca.email() : cb.email(),
                temTexto(ca.telefone()) ? ca.telefone() : cb.telefone(),
                temTexto(ca.objetivo()) ? ca.objetivo() : cb.objetivo(),
                temTexto(ca.observacoes()) ? ca.observacoes() : cb.observacoes(),
                ca.ativo() != null ? ca.ativo() : cb.ativo());
        boolean usaOAlunoDoOutro = alvo.alunoExistenteId() == null && outro.alunoExistenteId() != null;
        UUID alunoExistente = usaOAlunoDoOutro ? outro.alunoExistenteId() : alvo.alunoExistenteId();
        String destino = usaOAlunoDoOutro ? outro.destino() : alvo.destino();

        List<PesoImportavel> pesos = new ArrayList<>(alvo.pesos() == null ? List.of() : alvo.pesos());
        Set<java.time.LocalDate> dias = new HashSet<>();
        pesos.forEach(p -> {
            if (p != null && p.data() != null) {
                dias.add(p.data());
            }
        });
        for (PesoImportavel p : outro.pesos() == null ? List.<PesoImportavel>of() : outro.pesos()) {
            if (p != null && (p.data() == null || dias.add(p.data()))) {
                pesos.add(p);
            }
        }
        Map<UUID, CandidatoAluno> candidatos = new LinkedHashMap<>();
        for (CandidatoAluno c : uniao(alvo.candidatos(), outro.candidatos())) {
            if (c != null && c.alunoId() != null && candidatos.size() < CANDIDATOS_POR_GRUPO) {
                candidatos.putIfAbsent(c.alunoId(), c);
            }
        }
        Map<UUID, OcorrenciaOrigem> ocorrencias = new LinkedHashMap<>(alvo.ocorrencias());
        outro.ocorrencias().forEach(ocorrencias::putIfAbsent);
        Set<String> avisos = new java.util.LinkedHashSet<>(uniao(alvo.avisos(), outro.avisos()));
        GrupoImportavel primeiro = outroAntes ? outro : alvo;
        GrupoImportavel segundo = outroAntes ? alvo : outro;
        ConteudoTreino treino = partes ? RoteadorInterpretadorIa.juntar(primeiro.treino(), segundo.treino(), avisos)
                : alvo.treino() != null ? alvo.treino() : outro.treino();
        ConteudoDieta dieta = partes ? RoteadorInterpretadorIa.juntar(primeiro.dieta(), segundo.dieta(), avisos)
                : alvo.dieta() != null ? alvo.dieta() : outro.dieta();
        return new GrupoImportavel(alvo.id(), alvo.identificadorOrigem(), alvo.nomeDetectado(), destino, alunoExistente,
                uniao(alvo.arquivosOrigem(), outro.arquivosOrigem()), cadastro, pesos, treino, dieta,
                uniao(alvo.pendenciasIds(), outro.pendenciasIds()), alvo.estado(), alvo.erroCodigo(),
                List.copyOf(candidatos.values()), Map.copyOf(ocorrencias), List.copyOf(avisos),
                alvo.origemDoNome());
    }

    private static <T> List<T> uniao(List<T> a, List<T> b) {
        java.util.LinkedHashSet<T> todos = new java.util.LinkedHashSet<>();
        if (a != null) {
            todos.addAll(a);
        }
        if (b != null) {
            todos.addAll(b);
        }
        return List.copyOf(todos);
    }

    /**
     * {@code COM_DUVIDAS} enquanto alguma dúvida aberta aponta para uma ocorrência do grupo (ou, sem ocorrências, para um
     * arquivo dele); senão {@code PRONTO}. Grupo gravado, ignorado ou com erro fica como está.
     */
    static List<GrupoImportavel> comEstadoDasDuvidas(List<GrupoImportavel> grupos, List<DuvidaImportacao> duvidas) {
        Set<String> ocorrenciasAbertas = new HashSet<>();
        Set<String> arquivosAbertos = new HashSet<>();
        for (DuvidaImportacao d : duvidas) {
            if (d.resolvida()) {
                continue;
            }
            if (d.ocorrenciaIds().isEmpty()) {
                if (d.arquivoOrigem() != null) {
                    arquivosAbertos.add(d.arquivoOrigem());
                }
            } else {
                ocorrenciasAbertas.addAll(d.ocorrenciaIds());
            }
        }
        List<GrupoImportavel> saida = new ArrayList<>();
        for (GrupoImportavel g : grupos) {
            if (!"PRONTO".equals(g.estado()) && !"COM_DUVIDAS".equals(g.estado())) {
                saida.add(g);
                continue;
            }
            boolean aberta = g.ocorrencias().keySet().stream().anyMatch(id -> ocorrenciasAbertas.contains(id.toString()))
                    || (g.arquivosOrigem() != null && g.arquivosOrigem().stream().anyMatch(arquivosAbertos::contains));
            String estado = aberta ? "COM_DUVIDAS" : "PRONTO";
            saida.add(estado.equals(g.estado()) ? g : g.comEstado(estado));
        }
        return saida;
    }

    private static boolean temTexto(String s) {
        return s != null && !s.isBlank();
    }

    /**
     * O único lugar do nome substituto (D6): o lido do documento quando a origem é {@code CONTEUDO}; senão, só para a
     * tela, o nome do arquivo sem extensão (também o título digitado no texto colado) ou "Aluno N" (o título padrão
     * "Texto livre" e o que não parece nome). O substituto nunca conta como nome lido: não junta sozinho.
     */
    static String nomeDeExibicao(ResultadoInterpretacao.PropostaGrupo pg, String nomeArquivo, String id) {
        if (pg.origemDoNome() == ResultadoInterpretacao.OrigemDoNome.CONTEUDO && temTexto(pg.nomeAluno())) {
            return pg.nomeAluno().strip();
        }
        String doArquivo = pg.origemDoNome() == ResultadoInterpretacao.OrigemDoNome.NOME_DO_ARQUIVO
                ? PistaDeIdentidade.extrairDoNomeDoArquivo(nomeArquivo) : "";
        return doArquivo.isBlank() ? "Aluno " + id.substring("grupo-".length()) : doArquivo;
    }

    private GrupoImportavel montarGrupo(ResultadoInterpretacao.PropostaGrupo pg, ImportacaoArquivo arq, String id,
                                        String email, String telefone, List<Aluno> existentes) {
        String nome = nomeDeExibicao(pg, arq.getNomeOriginal(), id);
        boolean lido = pg.origemDoNome() == ResultadoInterpretacao.OrigemDoNome.CONTEUDO && temTexto(pg.nomeAluno());
        ResultadoInterpretacao.OrigemDoNome origem = lido ? ResultadoInterpretacao.OrigemDoNome.CONTEUDO
                : pg.origemDoNome() == ResultadoInterpretacao.OrigemDoNome.CONTEUDO
                ? ResultadoInterpretacao.OrigemDoNome.AUSENTE : pg.origemDoNome();
        List<CandidatoAluno> candidatos = candidatos(nome, email, existentes);
        // Só o e-mail vincula sozinho, e só quando um único aluno ativo o tem; por nome o treinador escolhe.
        List<CandidatoAluno> porEmail = candidatos.stream().filter(c -> "EMAIL".equals(c.motivo())).toList();
        UUID candidatoPorEmail = porEmail.size() == 1 ? porEmail.getFirst().alunoId() : null;
        UUID alunoExistente = candidatoPorEmail != null
                && existentes.stream().anyMatch(a -> a.getId().equals(candidatoPorEmail) && a.isAtivo())
                ? candidatoPorEmail : null;
        String destino = alunoExistente != null ? "VINCULAR_EXISTENTE" : "CRIAR_ALUNO";
        List<PesoImportavel> pesos = new ArrayList<>();
        if (pg.pesos() != null) {
            for (ResultadoInterpretacao.PropostaPeso pp : pg.pesos()) {
                pesos.add(new PesoImportavel(pp.data(), pp.kg(), pp.observacao()));
            }
        }
        CadastroImportavel cadastro = new CadastroImportavel(nome, emailValido(email != null ? email : pg.email()),
                telefoneValido(telefone != null ? telefone : pg.telefone()), pg.objetivo(), pg.observacoes(), true);
        Map<UUID, OcorrenciaOrigem> ocorrencias = extrairOcorrencias(arq.getNomeOriginal(), pg.treino(), pg.dieta());
        return new GrupoImportavel(id, arq.getNomeOriginal(), nome, destino, alunoExistente,
                List.of(arq.getNomeOriginal()), cadastro, pesos, pg.treino(), pg.dieta(), List.of(), "PRONTO", null,
                candidatos, ocorrencias, pg.avisos(), origem);
    }

    private static Map<UUID, OcorrenciaOrigem> extrairOcorrencias(String nomeArquivo, ConteudoTreino treino,
                                                                   ConteudoDieta dieta) {
        Map<UUID, OcorrenciaOrigem> mapa = new LinkedHashMap<>();
        if (treino != null && treino.sessoes() != null) {
            for (ConteudoTreino.Sessao s : treino.sessoes()) {
                for (ConteudoTreino.ExercicioPlano ex : s.exerciciosOuVazio()) {
                    if (ex.uid() != null && ex.nome() != null) {
                        mapa.put(ex.uid(), new OcorrenciaOrigem(ex.uid(), nomeArquivo + " — " + s.nome(), ex.nome()));
                    }
                }
            }
        }
        if (dieta != null && dieta.refeicoes() != null) {
            for (ConteudoDieta.Refeicao r : dieta.refeicoes()) {
                for (ConteudoDieta.Opcao op : r.opcoesOuVazio()) {
                    for (ConteudoDieta.Item it : op.itensOuVazio()) {
                        if (it.uid() != null && it.nome() != null) {
                            mapa.put(it.uid(), new OcorrenciaOrigem(it.uid(), nomeArquivo + " — " + r.nome(), it.nome()));
                        }
                    }
                }
            }
        }
        return Map.copyOf(mapa);
    }

    /** E-mail só com forma de e-mail e até 254 caracteres; senão o campo fica vazio e o treinador preenche. */
    private static String emailValido(String email) {
        if (email == null || email.isBlank()) {
            return null;
        }
        String e = email.strip();
        return e.length() <= 254 && EMAIL_SIMPLES.matcher(e).matches() ? e : null;
    }

    /** Telefone no formato da API ({@link Formatos#telefone}); inválido fica vazio em vez de derrubar o processamento. */
    private static String telefoneValido(String telefone) {
        try {
            return Formatos.telefone(telefone);
        } catch (BadRequestException e) {
            return null;
        }
    }

    /** Alunos ativos ou não, nunca os anonimizados: o mesmo e-mail ({@code EMAIL}) e o mesmo nome ({@code NOME}). */
    private static List<CandidatoAluno> candidatos(String nome, String email, List<Aluno> existentes) {
        List<CandidatoAluno> lista = new ArrayList<>();
        String chaveEmail = email == null ? null : email.strip().toLowerCase(Locale.ROOT);
        String chaveNome = chaveDoNome(nome);
        for (Aluno a : existentes) {
            if (a.isAnonimizado()) {
                continue;
            }
            boolean mesmoEmail = chaveEmail != null && a.getEmail() != null
                    && a.getEmail().strip().toLowerCase(Locale.ROOT).equals(chaveEmail);
            if (mesmoEmail) {
                lista.add(new CandidatoAluno(a.getId(), a.getNome(), "EMAIL"));
            } else if (!chaveNome.isEmpty() && chaveNome.equals(chaveDoNome(a.getNome()))) {
                lista.add(new CandidatoAluno(a.getId(), a.getNome(), "NOME"));
            }
            if (lista.size() >= CANDIDATOS_POR_GRUPO && chaveEmail == null) {
                break;
            }
        }
        // E-mail primeiro: é o que o treinador mais deve considerar.
        lista.sort((x, y) -> x.motivo().compareTo(y.motivo()));
        return lista.size() > CANDIDATOS_POR_GRUPO ? List.copyOf(lista.subList(0, CANDIDATOS_POR_GRUPO)) : List.copyOf(lista);
    }

    static String chaveDoNome(String nome) {
        return nome == null ? "" : Buscas.semAcento(nome).strip().toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
    }

    /** O único valor distinto da lista (telefone: só os dígitos); com mais de um, ou nenhum, é ambíguo e não vale. */
    private static String unico(List<String> valores, boolean telefone) {
        Map<String, String> distintos = new HashMap<>();
        for (String v : valores) {
            String chave = telefone ? v.replaceAll("\\D", "") : v.toLowerCase(Locale.ROOT);
            distintos.putIfAbsent(chave, v);
        }
        return distintos.size() == 1 ? distintos.values().iterator().next() : null;
    }

    @Transactional(readOnly = true)
    public SessaoDetalhe obterSessao(UUID sessaoId) {
        return detalheDaSessao(buscarSessao(sessaoId));
    }

    @Transactional
    public SessaoDetalhe responderDuvida(UUID sessaoId, RespostaDuvidaRequisicao req) {
        return responderDuvida(sessaoId, req.paraRequisicao());
    }

    @Transactional
    public SessaoDetalhe responderDuvida(UUID sessaoId, ResponderDuvidaRequisicao req) {
        ImportacaoSessao sessao = sessaoTravada(sessaoId);
        exigirNaoEncerrada(sessao);
        aplicarResposta(sessao, req);
        return detalheDaSessao(sessao);
    }

    /** Teto de dúvidas por chamada de "aceitar todas as sugestões". */
    static final int SUGESTOES_POR_CHAMADA = 200;

    /**
     * Aceita de uma vez as sugestões da biblioteca que são únicas: dúvida de exercício ou alimento ainda aberta, com
     * exatamente uma sugestão e ela ligada a um item da biblioteca. As com várias sugestões, só da IA ou sem sugestão
     * ficam para a pessoa; quem não lê treino ou dieta não aceita o que não vê. Não grava no dicionário da consultoria
     * (isso é escolha item a item) e repetir a chamada não faz nada, pois só olha o que ainda está aberto.
     */
    @Transactional
    public SessaoDetalhe aceitarSugestoes(UUID sessaoId, long revisaoEsperada) {
        ImportacaoSessao sessao = sessaoTravada(sessaoId);
        exigirNaoEncerrada(sessao);
        if (revisaoEsperada != sessao.getRevisao()) {
            throw new ConflictException("A importação mudou desde a sua revisão. Recarregue e confira de novo.",
                    "CONFLITO_EDICAO");
        }
        boolean treinoLer = AcessoAtual.pode("TREINO_LER");
        boolean dietaLer = AcessoAtual.pode("DIETA_LER");
        int aceitas = 0;
        for (DuvidaImportacao d : SessaoJson.duvidas(json, sessao)) {
            if (aceitas >= SUGESTOES_POR_CHAMADA) {
                break;
            }
            boolean exercicio = d.tipo() != null && d.tipo().startsWith("EXERCICIO") && treinoLer;
            boolean alimento = d.tipo() != null && d.tipo().startsWith("ALIMENTO") && dietaLer;
            if (d.resolvida() || !(exercicio || alimento) || d.sugestoes() == null || d.sugestoes().size() != 1
                    || d.sugestoes().getFirst().referenciaId() == null) {
                continue;
            }
            SugestaoDuvida unica = d.sugestoes().getFirst();
            aplicarResposta(sessao, new ResponderDuvidaRequisicao(d.id(), unica.termo(), false, d.tipo(),
                    d.termoOriginal(), unica.referenciaId(), null));
            aceitas++;
        }
        return detalheDaSessao(sessao);
    }

    private void aplicarResposta(ImportacaoSessao sessao, ResponderDuvidaRequisicao req) {
        if (req.duvidaId() == null || req.respostaEscolhida() == null || req.respostaEscolhida().isBlank()
                || req.respostaEscolhida().strip().length() > TERMO_DO_APELIDO) {
            throw new BadRequestException("Resposta da dúvida inválida.", "RESPOSTA_INVALIDA");
        }
        List<DuvidaImportacao> duvidas = SessaoJson.duvidas(json, sessao);
        List<GrupoImportavel> grupos = SessaoJson.grupos(json, sessao);
        List<DecisaoImportacao> decisoes = new ArrayList<>(SessaoJson.decisoes(json, sessao));

        DuvidaImportacao encontrada = null;
        List<DuvidaImportacao> atualizadas = new ArrayList<>();
        String termoPara = req.respostaEscolhida().strip();
        for (DuvidaImportacao d : duvidas) {
            if (d.id().equals(req.duvidaId())) {
                encontrada = new DuvidaImportacao(d.id(), d.tipo(), d.termoOriginal(), d.trechoOriginal(),
                        d.arquivoOrigem(), d.ocorrencias(), d.sugestoes(), true, termoPara, d.ocorrenciaIds());
                atualizadas.add(encontrada);
            } else {
                atualizadas.add(d);
            }
        }
        if (encontrada == null) {
            throw new NaoEncontradoException("Dúvida não encontrada na sessão.");
        }

        List<String> alvos = resolverAlvos(encontrada, req.ocorrenciaIds());
        Set<String> alvosSet = new HashSet<>(alvos);
        for (int i = 0; i < decisoes.size(); i++) {
            DecisaoImportacao ant = decisoes.get(i);
            if (ant.ativa() && ant.duvidaId().equals(encontrada.id())
                    && (alvosSet.isEmpty() || ant.ocorrenciaIds().stream().anyMatch(alvosSet::contains))) {
                decisoes.set(i, ant.desativada());
            }
        }
        decisoes.add(new DecisaoImportacao(UUID.randomUUID().toString(), encontrada.id(), alvos,
                encontrada.tipo(), encontrada.termoOriginal(), termoPara, req.referenciaId(), true));

        List<GrupoImportavel> gruposAtualizados = comEstadoDasDuvidas(
                reconstruirGrupos(grupos, decisoes, encontrada.termoOriginal(), termoPara), atualizadas);

        if (req.salvarNoDicionario() && req.tipo() != null && req.termoOriginal() != null) {
            salvarApelido(req.tipo(), req.termoOriginal(), termoPara, req.referenciaId());
        }
        sessao.aplicarRespostas(json.writeValueAsString(decisoes), json.writeValueAsString(gruposAtualizados),
                json.writeValueAsString(atualizadas));
    }

    @Transactional
    public SessaoDetalhe revogarDecisao(UUID sessaoId, String decisaoId, long revisaoEsperada) {
        ImportacaoSessao sessao = sessaoTravada(sessaoId);
        exigirNaoEncerrada(sessao);
        if (revisaoEsperada != sessao.getRevisao()) {
            throw new ConflictException("A importação mudou desde a sua revisão. Recarregue e confira de novo.",
                    "CONFLITO_EDICAO");
        }
        List<DecisaoImportacao> decisoes = new ArrayList<>(SessaoJson.decisoes(json, sessao));
        DecisaoImportacao alvo = null;
        for (int i = 0; i < decisoes.size(); i++) {
            DecisaoImportacao d = decisoes.get(i);
            if (d.decisaoId().equals(decisaoId) && d.ativa()) {
                alvo = d.desativada();
                decisoes.set(i, alvo);
                break;
            }
        }
        if (alvo == null) {
            throw new NaoEncontradoException("Decisão não encontrada ou já revogada.");
        }
        String duvidaId = alvo.duvidaId();
        boolean temOutraAtiva = decisoes.stream().anyMatch(d -> d.ativa() && d.duvidaId().equals(duvidaId));
        List<DuvidaImportacao> duvidas = new ArrayList<>(SessaoJson.duvidas(json, sessao));
        if (!temOutraAtiva) {
            for (int i = 0; i < duvidas.size(); i++) {
                DuvidaImportacao d = duvidas.get(i);
                if (d.id().equals(duvidaId)) {
                    duvidas.set(i, new DuvidaImportacao(d.id(), d.tipo(), d.termoOriginal(), d.trechoOriginal(),
                            d.arquivoOrigem(), d.ocorrencias(), d.sugestoes(), false, null, d.ocorrenciaIds()));
                    break;
                }
            }
        }
        List<GrupoImportavel> gruposAtualizados = comEstadoDasDuvidas(
                reconstruirGrupos(SessaoJson.grupos(json, sessao), decisoes, null, null), duvidas);
        sessao.aplicarRespostas(json.writeValueAsString(decisoes), json.writeValueAsString(gruposAtualizados),
                json.writeValueAsString(duvidas));
        return detalheDaSessao(sessao);
    }

    private static List<String> resolverAlvos(DuvidaImportacao duvida, List<String> solicitados) {
        List<String> validos = duvida.ocorrenciaIds();
        if (solicitados == null) {
            return validos;
        }
        if (validos.isEmpty() && solicitados.isEmpty()) {
            return List.of();
        }
        if (solicitados.isEmpty() || !validos.containsAll(solicitados)) {
            throw new BadRequestException("Ocorrências inválidas para esta dúvida.", "OCORRENCIA_INVALIDA");
        }
        return solicitados.stream().distinct().toList();
    }

    private List<GrupoImportavel> reconstruirGrupos(List<GrupoImportavel> grupos, List<DecisaoImportacao> decisoes,
                                                    String termoLegadoDe, String termoLegadoPara) {
        Map<String, DecisaoImportacao> ativasPorOcorrencia = new HashMap<>();
        for (DecisaoImportacao d : decisoes) {
            if (!d.ativa()) {
                continue;
            }
            for (String ocId : d.ocorrenciaIds()) {
                ativasPorOcorrencia.put(ocId, d);
            }
        }
        List<GrupoImportavel> saida = new ArrayList<>();
        for (GrupoImportavel g : grupos) {
            if ("IMPORTADO".equals(g.estado())) {
                saida.add(g);
                continue;
            }
            if (g.ocorrencias() != null && !g.ocorrencias().isEmpty()) {
                saida.add(g.comTreinoEDieta(
                        reconstruirTreino(g.treino(), g.ocorrencias(), ativasPorOcorrencia),
                        reconstruirDieta(g.dieta(), g.ocorrencias(), ativasPorOcorrencia)));
            } else if (termoLegadoDe != null && termoLegadoPara != null) {
                saida.add(g.comTreinoEDieta(
                        substituirTermoNoTreino(g.treino(), termoLegadoDe, termoLegadoPara),
                        substituirTermoNaDieta(g.dieta(), termoLegadoDe, termoLegadoPara)));
            } else {
                saida.add(g);
            }
        }
        return saida;
    }

    private static ConteudoTreino reconstruirTreino(ConteudoTreino treino, Map<UUID, OcorrenciaOrigem> origens,
                                                    Map<String, DecisaoImportacao> ativas) {
        if (treino == null || treino.sessoes() == null) {
            return treino;
        }
        List<ConteudoTreino.Sessao> novasSessoes = new ArrayList<>();
        boolean alterou = false;
        for (ConteudoTreino.Sessao s : treino.sessoes()) {
            List<ConteudoTreino.ExercicioPlano> novosExs = new ArrayList<>();
            for (ConteudoTreino.ExercicioPlano ex : s.exerciciosOuVazio()) {
                OcorrenciaOrigem orig = ex.uid() != null ? origens.get(ex.uid()) : null;
                if (orig == null) {
                    novosExs.add(ex);
                    continue;
                }
                DecisaoImportacao dec = ativas.get(ex.uid().toString());
                String novoNome = dec != null ? dec.valorAplicado() : orig.valorExtraido();
                UUID novoId = dec != null ? dec.referenciaId() : null;
                if (!java.util.Objects.equals(ex.nome(), novoNome) || !java.util.Objects.equals(ex.exercicioId(), novoId)) {
                    novosExs.add(new ConteudoTreino.ExercicioPlano(ex.uid(), novoId, novoNome, ex.modalidade(),
                            ex.videoUrl(), ex.observacao(), ex.progressao(), ex.unidade(), ex.series(),
                            ex.cadencia(), ex.isometriaSegundos(), ex.grupoUid(), ex.equipamento(), ex.alternativas()));
                    alterou = true;
                } else {
                    novosExs.add(ex);
                }
            }
            novasSessoes.add(new ConteudoTreino.Sessao(s.uid(), s.nome(), s.diaSemana(), s.tipo(),
                    s.frequenciaSemanal(), s.observacao(), s.cardio(), novosExs, s.grupos()));
        }
        return alterou ? new ConteudoTreino(treino.objetivo(), treino.orientacoes(), novasSessoes, treino.metodologia()) : treino;
    }

    private static ConteudoDieta reconstruirDieta(ConteudoDieta dieta, Map<UUID, OcorrenciaOrigem> origens,
                                                  Map<String, DecisaoImportacao> ativas) {
        if (dieta == null) {
            return null;
        }
        java.util.concurrent.atomic.AtomicBoolean alterou = new java.util.concurrent.atomic.AtomicBoolean();
        ConteudoDieta nova = dieta.comItens(it -> {
            OcorrenciaOrigem orig = it.uid() != null ? origens.get(it.uid()) : null;
            if (orig == null) {
                return it;
            }
            DecisaoImportacao dec = ativas.get(it.uid().toString());
            String novoNome = dec != null ? dec.valorAplicado() : orig.valorExtraido();
            UUID novoAlimentoId = dec != null ? dec.referenciaId() : null;
            if (java.util.Objects.equals(it.nome(), novoNome) && java.util.Objects.equals(it.alimentoId(), novoAlimentoId)) {
                return it;
            }
            alterou.set(true);
            return new ConteudoDieta.Item(it.uid(), novoAlimentoId, novoNome, it.quantidade(), it.unidade(),
                    it.kcal(), it.proteina(), it.carboidrato(), it.gordura(), it.manual(),
                    it.fatorCorrecao(), it.fatorCoccao(), it.grupo(), it.fibra());
        });
        return alterou.get() ? nova : dieta;
    }

    /**
     * Destino, aluno existente, nome, e-mail e telefone do grupo. O aluno escolhido é conferido aqui (e de novo ao
     * confirmar): outra consultoria 404, anonimizado 409 {@code ALUNO_ANONIMIZADO}, inativo 409 {@code ALUNO_INATIVO}.
     * E-mail e telefone seguem as regras do aceite (400 {@code EMAIL_INVALIDO}, {@code TELEFONE_INVALIDO}; o valor nunca
     * vai à mensagem); em branco, apagam.
     */
    @Transactional
    public SessaoDetalhe atualizarGrupo(UUID sessaoId, String grupoId, AtualizarGrupoRequisicao req) {
        ImportacaoSessao sessao = sessaoTravada(sessaoId);
        exigirNaoEncerrada(sessao);
        List<GrupoImportavel> grupos = SessaoJson.grupos(json, sessao);
        GrupoImportavel alvo = grupos.stream().filter(g -> g.id().equals(grupoId)).findFirst()
                .orElseThrow(() -> new NaoEncontradoException("Grupo não encontrado na sessão."));
        if ("IMPORTADO".equals(alvo.estado())) {
            throw new ConflictException("Este grupo já foi importado.", "GRUPO_JA_IMPORTADO");
        }
        String destino = req.destino() != null ? req.destino() : alvo.destino();
        if (!DESTINOS.contains(destino)) {
            throw new BadRequestException("Destino do grupo inválido.", "DESTINO_INVALIDO");
        }
        UUID alunoId = req.alunoExistenteId() != null ? req.alunoExistenteId() : alvo.alunoExistenteId();
        if ("VINCULAR_EXISTENTE".equals(destino)) {
            if (alunoId == null) {
                throw new BadRequestException("Escolha o aluno existente.", "ALUNO_NAO_ESCOLHIDO");
            }
            exigirAlunoVinculavel(alunoId);
        } else {
            alunoId = null;
        }
        String nome = alvo.nomeDetectado();
        if (req.nome() != null && !req.nome().isBlank()) {
            nome = req.nome().strip();
            if (nome.length() > 120) {
                throw new BadRequestException("O nome é longo demais.", "NOME_GRANDE_DEMAIS");
            }
        }
        CadastroImportavel atual = alvo.cadastro();
        String email = atual == null ? null : atual.email();
        if (req.email() != null) {
            email = req.email().isBlank() ? null : emailDoAceite(req.email());
        }
        String telefone = atual == null ? null : atual.telefone();
        if (req.telefone() != null) {
            telefone = req.telefone().isBlank() ? null : telefoneDoAceite(req.telefone());
        }
        GrupoImportavel novo = alvo.comDestino(destino, alunoId, nome, email, telefone);
        if (req.nome() != null && !req.nome().isBlank() && !alvo.nomeLidoDoConteudo()) {
            // O treinador deu o nome ao grupo sem nome lido: destrava a gravação (nunca a junção sozinha).
            novo = novo.comOrigemDoNome(ResultadoInterpretacao.OrigemDoNome.DIGITADO);
        }
        List<GrupoImportavel> atualizados = new ArrayList<>();
        for (GrupoImportavel g : grupos) {
            atualizados.add(g.id().equals(grupoId) ? novo : g);
        }
        SessaoJson.gravarGrupos(json, sessao, atualizados);
        sessao.incrementarRevisao();
        return detalheDaSessao(sessao);
    }

    /** A regra do e-mail na confirmação ({@link ConfirmacaoDaImportacaoAssistida}). */
    private static String emailDoAceite(String email) {
        String e = email.strip();
        if (e.length() > 254 || !EMAIL_SIMPLES.matcher(e).matches()) {
            throw new BadRequestException("E-mail inválido.", "EMAIL_INVALIDO");
        }
        return e;
    }

    private static String telefoneDoAceite(String telefone) {
        try {
            return Formatos.telefone(telefone);
        } catch (BadRequestException e) {
            throw new BadRequestException("Telefone inválido.", "TELEFONE_INVALIDO");
        }
    }

    /**
     * "Juntar com…": os grupos {@code outros} entram no {@code grupoId} e somem da sessão. O do caminho prevalece no que
     * diverge (nome, e-mail, telefone, aluno existente, peso do mesmo dia); dois treinos ou duas dietas são recusados
     * (409 {@code GRUPOS_COM_DOIS_PLANOS}: ignore um deles antes), para nenhum plano sumir calado. A exceção são as
     * partes de um mesmo arquivo sem nome lido ("Juntar as N partes", {@link #partesDoMesmoArquivo}): os treinos e as
     * dietas se somam, na ordem da sessão, como nas partes de um documento grande. Só grupos de aluno ainda por gravar
     * (409 {@code GRUPO_NAO_JUNTAVEL}); o mesmo grupo dos dois lados, repetido ou lista vazia é 400 {@code GRUPO_INVALIDO}.
     */
    @Transactional
    public SessaoDetalhe juntarGrupos(UUID sessaoId, String grupoId, List<String> outros) {
        ImportacaoSessao sessao = sessaoTravada(sessaoId);
        exigirNaoEncerrada(sessao);
        if (outros == null || outros.isEmpty() || outros.size() > MAXIMO_DE_GRUPOS_JUNTADOS
                || outros.stream().anyMatch(id -> id == null || id.isBlank() || id.equals(grupoId))
                || new HashSet<>(outros).size() != outros.size()) {
            throw new BadRequestException("Escolha outro aluno para juntar.", "GRUPO_INVALIDO");
        }
        List<GrupoImportavel> grupos = SessaoJson.grupos(json, sessao);
        GrupoImportavel alvo = grupoDaSessao(grupos, grupoId);
        List<GrupoImportavel> juntados = outros.stream().map(id -> grupoDaSessao(grupos, id)).toList();
        if (!juntavel(alvo) || juntados.stream().anyMatch(g -> !juntavel(g))) {
            throw new ConflictException("Só dá para juntar alunos que ainda não foram gravados nem ignorados.",
                    "GRUPO_NAO_JUNTAVEL");
        }
        List<GrupoImportavel> todos = new ArrayList<>(juntados);
        todos.add(alvo);
        boolean partes = partesDoMesmoArquivo(todos, arquivos.findBySessaoIdOrderByCriadoEmAsc(sessaoId));
        GrupoImportavel junto = alvo;
        if (partes && alvo.origemDoNome() != ResultadoInterpretacao.OrigemDoNome.DIGITADO) {
            // O nome que o treinador já deu a uma das partes não se perde ao juntar.
            for (GrupoImportavel g : juntados) {
                if (g.origemDoNome() == ResultadoInterpretacao.OrigemDoNome.DIGITADO) {
                    junto = alvo.comDestino(alvo.destino(), alvo.alunoExistenteId(), g.nomeDetectado(),
                            alvo.cadastro() == null ? null : alvo.cadastro().email(),
                            alvo.cadastro() == null ? null : alvo.cadastro().telefone())
                            .comOrigemDoNome(ResultadoInterpretacao.OrigemDoNome.DIGITADO);
                    break;
                }
            }
        }
        // Na ordem da sessão, qualquer que seja o grupo do caminho: as de antes entram na frente, da mais perto para a
        // mais longe (cada uma passa à frente da anterior); as de depois, no fim, em ordem.
        int posicaoDoAlvo = grupos.indexOf(alvo);
        List<Integer> ordem = new ArrayList<>();
        for (int i = posicaoDoAlvo - 1; i >= 0; i--) {
            ordem.add(i);
        }
        for (int i = posicaoDoAlvo + 1; i < grupos.size(); i++) {
            ordem.add(i);
        }
        for (int i : ordem) {
            GrupoImportavel g = grupos.get(i);
            if (!outros.contains(g.id())) {
                continue;
            }
            if (!partes && ((junto.treino() != null && g.treino() != null) || (junto.dieta() != null && g.dieta() != null))) {
                throw new ConflictException("Os dois têm treino ou os dois têm dieta. Ignore um deles antes de juntar.",
                        "GRUPOS_COM_DOIS_PLANOS");
            }
            junto = juntar(junto, g, partes, i < posicaoDoAlvo);
        }
        List<GrupoImportavel> atualizados = new ArrayList<>();
        for (GrupoImportavel g : grupos) {
            if (g.id().equals(grupoId)) {
                atualizados.add(junto);
            } else if (!outros.contains(g.id())) {
                atualizados.add(g);
            }
        }
        SessaoJson.gravarGrupos(json, sessao, comEstadoDasDuvidas(atualizados, SessaoJson.duvidas(json, sessao)));
        sessao.incrementarRevisao();
        return detalheDaSessao(sessao);
    }

    private static GrupoImportavel grupoDaSessao(List<GrupoImportavel> grupos, String id) {
        return grupos.stream().filter(g -> g.id().equals(id)).findFirst()
                .orElseThrow(() -> new NaoEncontradoException("Grupo não encontrado na sessão."));
    }

    /**
     * Partes de um arquivo só: todos os grupos vêm do mesmo arquivo (e só dele), a sessão tem um único arquivo com esse
     * nome (dois arquivos de mesmo nome podem ser alunos diferentes) e nenhum tem o nome lido do documento (esses o
     * servidor já separou por nome). É o caso do documento grande sem nome, que sai em vários "Aluno N".
     */
    static boolean partesDoMesmoArquivo(List<GrupoImportavel> grupos, List<ImportacaoArquivo> daSessao) {
        String arquivo = null;
        for (GrupoImportavel g : grupos) {
            if (g.nomeLidoDoConteudo() || g.arquivosOrigem() == null || g.arquivosOrigem().size() != 1
                    || (arquivo != null && !arquivo.equals(g.arquivosOrigem().getFirst()))) {
                return false;
            }
            arquivo = g.arquivosOrigem().getFirst();
        }
        String nome = arquivo;
        return nome != null && daSessao.stream().filter(a -> nome.equals(a.getNomeOriginal())).count() == 1;
    }

    @Transactional
    public SessaoDetalhe cancelarSessao(UUID sessaoId) {
        ImportacaoSessao sessao = sessaoTravada(sessaoId);
        String estadoAtual = SessaoJson.estadoEfetivo(json, sessao);
        if ("CANCELADA".equals(estadoAtual)) {
            return detalheDaSessao(sessao);
        }
        if ("CONCLUIDA".equals(estadoAtual)) {
            throw new ConflictException("A importação já foi concluída.", "SESSAO_CONCLUIDA");
        }
        List<GrupoImportavel> grupos = SessaoJson.grupos(json, sessao);
        List<GrupoImportavel> limpos = new ArrayList<>();
        for (GrupoImportavel g : grupos) {
            limpos.add("IMPORTADO".equals(g.estado()) ? g : g.limpo("IGNORADO", "IGNORAR"));
        }
        SessaoJson.gravarGrupos(json, sessao, limpos);
        sessao.aplicarRespostas("[]", null, "[]");
        SessaoJson.marcarFlagProgresso(json, sessao, "cancelada", true);
        sessao.atualizarEstado("CONCLUIDA");
        arquivos.limparConteudoBytesDaSessao(sessaoId);
        return detalheDaSessao(sessao);
    }

    public static final class ConteudoArquivo {
        private final String nomeOriginal;
        private final String formato;
        private final byte[] bytes;

        ConteudoArquivo(String nomeOriginal, String formato, byte[] bytes) {
            this.nomeOriginal = nomeOriginal;
            this.formato = formato;
            this.bytes = bytes;
        }

        public String nomeOriginal() { return nomeOriginal; }
        public String formato() { return formato; }
        public byte[] bytes() { return bytes; }
    }

    @Transactional(readOnly = true)
    public ConteudoArquivo obterConteudoArquivo(UUID sessaoId, UUID arquivoId) {
        AcessoAtual.exigir("ALUNO_LER");
        AcessoAtual.exigir("ALUNO_SENSIVEL_LER");
        AcessoAtual.exigir("TREINO_LER");
        AcessoAtual.exigir("DIETA_LER");
        buscarSessao(sessaoId);
        ImportacaoArquivo arq = arquivos.findByIdAndSessaoId(arquivoId, sessaoId)
                .orElseThrow(() -> new NaoEncontradoException("Arquivo não encontrado na sessão."));
        if (arq.getConteudoBytes() == null) {
            throw new ResourceNotFoundException("Conteúdo do arquivo indisponível.", "CONTEUDO_INDISPONIVEL");
        }
        return new ConteudoArquivo(arq.getNomeOriginal(), arq.getFormato(), arq.getConteudoBytes());
    }

    /** Aluno da consultoria da sessão ({@code @TenantId}; outra consultoria dá 404), ativo e não anonimizado. */
    Aluno exigirAlunoVinculavel(UUID alunoId) {
        Aluno aluno = alunos.findById(alunoId).orElseThrow(() -> new NaoEncontradoException("Aluno não encontrado."));
        AlunoService.exigirNaoAnonimizado(aluno);
        if (!aluno.isAtivo()) {
            throw new ConflictException("Este aluno está inativo. Reative-o antes de importar.", "ALUNO_INATIVO");
        }
        return aluno;
    }

    @Transactional(readOnly = true)
    public List<ApelidoDto> listarApelidos() {
        UUID consultoriaId = TenantContext.get();
        return apelidos.findByConsultoriaIdOrderByTermoOriginalAsc(consultoriaId).stream()
                .map(a -> new ApelidoDto(a.getId(), a.getTipo(), a.getTermoOriginal(), a.getValorMapeado(),
                        a.getReferenciaId(), a.getCriadoEm()))
                .toList();
    }

    @Transactional
    public void salvarApelido(String tipo, String termoOriginal, String valorMapeado, UUID referenciaId) {
        if (tipo == null || tipo.isBlank() || tipo.strip().length() > TIPO_DO_APELIDO || termoOriginal == null
                || termoOriginal.isBlank() || termoOriginal.strip().length() > TERMO_DO_APELIDO || valorMapeado == null
                || valorMapeado.isBlank() || valorMapeado.strip().length() > TERMO_DO_APELIDO) {
            throw new BadRequestException("Apelido inválido.", "APELIDO_INVALIDO");
        }
        UUID consultoriaId = TenantContext.get();
        String normalizado = termoOriginal.strip().toLowerCase(Locale.ROOT);
        Optional<ImportacaoApelidoConsultoria> opt = apelidos.findByConsultoriaIdAndTipoAndTermoNormalizado(
                consultoriaId, tipo.strip(), normalizado);
        if (opt.isPresent()) {
            opt.get().atualizarMapeamento(valorMapeado.strip(), referenciaId);
        } else {
            apelidos.save(new ImportacaoApelidoConsultoria(tipo.strip(), normalizado, termoOriginal.strip(), referenciaId,
                    valorMapeado.strip()));
        }
    }

    @Transactional
    public void removerApelido(UUID id) {
        UUID consultoriaId = TenantContext.get();
        ImportacaoApelidoConsultoria ap = apelidos.findByIdAndConsultoriaId(id, consultoriaId)
                .orElseThrow(() -> new NaoEncontradoException("Apelido não encontrado."));
        apelidos.delete(ap);
    }

    private ConteudoTreino substituirTermoNoTreino(ConteudoTreino treino, String termoDe, String termoPara) {
        if (treino == null || treino.sessoes() == null || termoDe == null || termoPara == null) {
            return treino;
        }
        List<ConteudoTreino.Sessao> novasSessoes = new ArrayList<>();
        boolean alterou = false;
        for (ConteudoTreino.Sessao s : treino.sessoes()) {
            List<ConteudoTreino.ExercicioPlano> novosExs = new ArrayList<>();
            for (ConteudoTreino.ExercicioPlano ex : s.exerciciosOuVazio()) {
                if (ex.nome() != null && ex.nome().equalsIgnoreCase(termoDe)) {
                    novosExs.add(ex.comNome(termoPara));
                    alterou = true;
                } else {
                    novosExs.add(ex);
                }
            }
            novasSessoes.add(new ConteudoTreino.Sessao(
                    s.uid(), s.nome(), s.diaSemana(), s.tipo(), s.frequenciaSemanal(),
                    s.observacao(), s.cardio(), novosExs, s.grupos()));
        }
        return alterou ? new ConteudoTreino(treino.objetivo(), treino.orientacoes(), novasSessoes, treino.metodologia()) : treino;
    }

    private ConteudoDieta substituirTermoNaDieta(ConteudoDieta dieta, String termoDe, String termoPara) {
        if (dieta == null || termoDe == null || termoPara == null) {
            return dieta;
        }
        // comItens reconstrói a raiz e cada variação juntas (reconstruir o record à mão perderia as variações).
        java.util.concurrent.atomic.AtomicBoolean alterou = new java.util.concurrent.atomic.AtomicBoolean();
        ConteudoDieta nova = dieta.comItens(it -> {
            if (it.nome() == null || !it.nome().equalsIgnoreCase(termoDe)) {
                return it;
            }
            alterou.set(true);
            return new ConteudoDieta.Item(it.uid(), it.alimentoId(), termoPara, it.quantidade(), it.unidade(),
                    it.kcal(), it.proteina(), it.carboidrato(), it.gordura(), it.manual(),
                    it.fatorCorrecao(), it.fatorCoccao(), it.grupo(), it.fibra());
        });
        return alterou.get() ? nova : dieta;
    }

    // -------------------------------------------------------------------------------------- métodos auxiliares

    /** Sessão da consultoria atual; de outra consultoria (ou inexistente) é 404. */
    ImportacaoSessao buscarSessao(UUID id) {
        return sessoes.findByIdAndConsultoriaId(id, TenantContext.get())
                .orElseThrow(() -> new NaoEncontradoException("Sessão de importação não encontrada."));
    }

    private ImportacaoSessao sessaoTravada(UUID id) {
        return sessoes.buscarParaAlterar(id, TenantContext.get())
                .orElseThrow(() -> new NaoEncontradoException("Sessão de importação não encontrada."));
    }

    /** Sessão travada que ainda aceita arquivos: depois de concluída, cancelada ou expirada não aceita mais. */
    private ImportacaoSessao sessaoAberta(UUID id) {
        ImportacaoSessao sessao = sessaoTravada(id);
        exigirNaoEncerrada(sessao);
        return sessao;
    }

    private void exigirNaoEncerrada(ImportacaoSessao sessao) {
        String estadoAtual = SessaoJson.estadoEfetivo(json, sessao);
        if ("CANCELADA".equals(estadoAtual)) {
            throw new ConflictException("A importação foi cancelada.", "SESSAO_CANCELADA");
        }
        if ("CONCLUIDA".equals(estadoAtual)) {
            throw new ConflictException("A importação já foi concluída.", "SESSAO_CONCLUIDA");
        }
        if ("EXPIRADA".equals(estadoAtual) || sessao.getExpiraEm().isBefore(Instant.now())) {
            throw new ConflictException("A importação expirou.", "SESSAO_EXPIRADA");
        }
        if ("PROCESSANDO".equals(estadoAtual)) {
            throw new ConflictException("A importação está sendo processada. Aguarde concluir.", "SESSAO_PROCESSANDO");
        }
    }

    private static ResultadoExtracao extrairArquivo(String formato, String nomeOriginal, byte[] bytes) {
        return switch (formato) {
            case "DOCX" -> ExtratorDocx.extrair(nomeOriginal, bytes);
            case "PDF" -> ExtratorPdf.extrair(nomeOriginal, bytes);
            case "XLSX", "CSV" -> ExtratorXlsxCsv.extrair(nomeOriginal, bytes);
            case "TEXTO_LIVRE" -> ExtratorTextoLivre.extrair(nomeOriginal,
                    bytes != null ? new String(bytes, StandardCharsets.UTF_8) : "");
            // Imagem não tem texto: só é lida se o Claude receber o arquivo (D1); sem ele, as regras não acham nada.
            case "JPG", "PNG" -> new ResultadoExtracao(formato, "", List.of(), Map.of("cobertura", "SEM_TEXTO"));
            default -> new ResultadoExtracao(formato, "", List.of(), Map.of());
        };
    }

    /** Sem barras nem caracteres de controle, no máximo 255 caracteres. */
    static String nomeLimpo(String original, String padrao) {
        if (original == null || original.isBlank()) {
            return padrao;
        }
        String nome = original.replaceAll("[\\p{Cntrl}]", "");
        nome = nome.substring(Math.max(nome.lastIndexOf('/'), nome.lastIndexOf('\\')) + 1).strip();
        if (nome.isEmpty()) {
            return padrao;
        }
        return nome.length() > NOME_DO_ARQUIVO ? nome.substring(0, NOME_DO_ARQUIVO) : nome;
    }

    /**
     * O formato vem da extensão E tem de bater com os primeiros bytes: PDF começa com {@code %PDF-}, DOCX e XLSX são zip
     * ({@code PK}), CSV e texto não podem ter byte nulo nem ser PDF ou zip renomeado. JPG ({@code FF D8 FF}) e PNG só
     * com {@code aceitaImagem} (o arquivo vai ao Claude, D1); sem ela, 400. Outra extensão é recusada.
     */
    static String detectarFormato(String nome, byte[] bytes, boolean aceitaImagem) {
        int ponto = nome.lastIndexOf('.');
        String ext = ponto < 0 ? "" : nome.substring(ponto + 1).toLowerCase(Locale.ROOT);
        boolean pdf = bytes.length >= 5 && bytes[0] == '%' && bytes[1] == 'P' && bytes[2] == 'D' && bytes[3] == 'F' && bytes[4] == '-';
        boolean zip = bytes.length >= 4 && bytes[0] == 'P' && bytes[1] == 'K' && bytes[2] == 3 && bytes[3] == 4;
        if ("xlsx".equals(ext) && ole(bytes)) {
            throw formatoXlsAntigo(); // .xls antigo só renomeado para .xlsx
        }
        String formato;
        boolean confere;
        switch (ext) {
            case "pdf" -> {
                formato = "PDF";
                confere = pdf;
            }
            case "docx" -> {
                formato = "DOCX";
                confere = zip;
            }
            case "xlsx" -> {
                formato = "XLSX";
                confere = zip;
            }
            case "csv", "txt", "" -> {
                formato = "csv".equals(ext) ? "CSV" : "TEXTO_LIVRE";
                confere = !pdf && !zip && semByteNulo(bytes);
            }
            case "jpg", "jpeg", "png" -> {
                if (!aceitaImagem) {
                    throw new BadRequestException("Envie o texto ou um PDF.", "FORMATO_NAO_SUPORTADO");
                }
                formato = "png".equals(ext) ? "PNG" : "JPG";
                confere = "PNG".equals(formato)
                        ? bytes.length >= 8 && Arrays.equals(bytes, 0, 8, ASSINATURA_PNG, 0, 8)
                        : bytes.length >= 3 && (bytes[0] & 0xFF) == 0xFF && (bytes[1] & 0xFF) == 0xD8 && (bytes[2] & 0xFF) == 0xFF;
            }
            case "xls" -> throw formatoXlsAntigo();
            default -> throw new BadRequestException("Formato de arquivo não suportado.", "FORMATO_NAO_SUPORTADO");
        }
        if (!confere) {
            throw new BadRequestException("O conteúdo do arquivo não corresponde ao formato.", "FORMATO_NAO_CONFERE");
        }
        return formato;
    }

    private static final byte[] ASSINATURA_PNG = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A};
    /** Maior lado que o Claude aceita numa imagem. */
    static final int LADO_MAXIMO_DA_IMAGEM = 8000;

    /** Guarda a imagem sem EXIF, GPS nem texto embutido; imagem que não passa (ou grande demais) é recusada. */
    static byte[] imagemSemMetadados(String formato, byte[] bytes) {
        try {
            return switch (formato) {
                case "JPG" -> br.com.treinos.api.fotos.JpegSemMetadados.limpar(bytes, LADO_MAXIMO_DA_IMAGEM);
                case "PNG" -> {
                    // IHDR logo depois da assinatura: largura e altura em 4 bytes cada (o limpador não confere o tamanho).
                    long largura = bytes.length >= 24 ? java.nio.ByteBuffer.wrap(bytes, 16, 4).getInt() & 0xFFFFFFFFL : 0;
                    long altura = bytes.length >= 24 ? java.nio.ByteBuffer.wrap(bytes, 20, 4).getInt() & 0xFFFFFFFFL : 0;
                    if (largura == 0 || altura == 0 || largura > LADO_MAXIMO_DA_IMAGEM || altura > LADO_MAXIMO_DA_IMAGEM) {
                        throw new IllegalArgumentException("tamanho da imagem");
                    }
                    yield br.com.treinos.api.consultoria.PngSemMetadados.limpar(bytes);
                }
                default -> bytes;
            };
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("O conteúdo do arquivo não corresponde ao formato.", "FORMATO_NAO_CONFERE");
        }
    }

    private static boolean ole(byte[] bytes) {
        return bytes.length >= 4 && (bytes[0] & 0xFF) == 0xD0 && (bytes[1] & 0xFF) == 0xCF && bytes[2] == 0x11
                && (bytes[3] & 0xFF) == 0xE0;
    }

    private static ValidacaoException formatoXlsAntigo() {
        return new ValidacaoException("Salve como .xlsx no Excel e envie de novo.", "FORMATO_XLS_ANTIGO", List.of());
    }

    private static boolean semByteNulo(byte[] bytes) {
        for (int i = 0; i < Math.min(bytes.length, 4096); i++) {
            if (bytes[i] == 0) {
                return false;
            }
        }
        return true;
    }

    private static String calcularSha256(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 indisponível.");
        }
    }

    private Map<String, String> carregarDicionarioConsultoria() {
        Map<String, String> mapa = new HashMap<>();
        for (ImportacaoApelidoConsultoria a : apelidos.findByConsultoriaIdOrderByTermoOriginalAsc(TenantContext.get())) {
            mapa.put(a.getTermoNormalizado(), a.getValorMapeado());
        }
        return Map.copyOf(mapa);
    }

    private ArquivoResumo resumo(ImportacaoArquivo a) {
        JsonNode metadados = lerMetadados(a);
        return new ArquivoResumo(a.getId(), a.getNomeOriginal(), a.getFormato(), a.getTamanhoBytes(), a.getEstado(),
                a.getErroCodigo(), a.getCriadoEm(), lerCobertura(a),
                metadados == null || !metadados.hasNonNull("modo") ? null : metadados.get("modo").asString(),
                metadados == null || !metadados.hasNonNull("motivoFallback") ? null : metadados.get("motivoFallback").asString(),
                metadados != null && metadados.path("enviadoComoArquivo").asBoolean(false));
    }

    private JsonNode lerMetadados(ImportacaoArquivo a) {
        String raw = a.getExtracaoJson();
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return json.readTree(raw);
        } catch (RuntimeException e) {
            return null;
        }
    }

    private CoberturaArquivo lerCobertura(ImportacaoArquivo a) {
        String raw = a.getExtracaoJson();
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            JsonNode n = json.readTree(raw);
            String status = n.hasNonNull("cobertura") ? n.get("cobertura").asString() : null;
            Integer paginasTotal = n.hasNonNull("paginasTotal") ? n.get("paginasTotal").asInt() : null;
            Integer paginasLidas = n.hasNonNull("paginasLidas") ? n.get("paginasLidas").asInt() : null;
            Integer paginasSemTexto = n.hasNonNull("paginasSemTexto") ? n.get("paginasSemTexto").asInt() : null;
            Integer blocos = n.hasNonNull("blocos") ? n.get("blocos").asInt() : null;
            Boolean truncado = n.hasNonNull("truncado") ? n.get("truncado").asBoolean() : null;
            if (status == null && paginasTotal == null && blocos == null) {
                return null;
            }
            return new CoberturaArquivo(status, paginasTotal, paginasLidas, paginasSemTexto, blocos, truncado);
        } catch (RuntimeException e) {
            return null;
        }
    }

    private ModoProcessamentoResumo consolidarModo(ModoProcessamentoResumo atual,
                                                   RoteadorInterpretadorIa.ExecucaoInterpretacao exec) {
        if (atual == null) {
            return new ModoProcessamentoResumo(exec.modoEfetivo(), exec.provedorConfigurado(),
                    exec.fallbackParaRegras(), exec.motivoFallback());
        }
        String modoEfetivo = "IA".equals(atual.modoEfetivo()) || "IA".equals(exec.modoEfetivo()) ? "IA" : "REGRAS";
        boolean fallback = atual.fallbackParaRegras() || exec.fallbackParaRegras();
        String motivo = exec.motivoFallback() != null ? exec.motivoFallback() : atual.motivoFallback();
        return new ModoProcessamentoResumo(modoEfetivo, exec.provedorConfigurado(), fallback, motivo);
    }

    /**
     * O progresso existente com o fim da leitura: guarda o que é da sessão e não da leitura ({@code confirmacoes},
     * {@code alunosCriados}, a marca da leitura), senão o {@code MESMO_NOME_NA_SESSAO} esqueceria os alunos já criados
     * quando um arquivo novo é lido depois de uma gravação.
     */
    private String serializarProgresso(ImportacaoSessao sessao, long processados, ModoProcessamentoResumo modo) {
        tools.jackson.databind.node.ObjectNode root;
        try {
            JsonNode n = sessao.getProgressoJson() == null || sessao.getProgressoJson().isBlank()
                    ? json.createObjectNode() : json.readTree(sessao.getProgressoJson());
            root = n instanceof tools.jackson.databind.node.ObjectNode o ? o : json.createObjectNode();
        } catch (RuntimeException e) {
            root = json.createObjectNode();
        }
        root.remove("aguardando");
        root.put("processados", processados);
        if (modo != null) {
            root.set("modoProcessamento", json.valueToTree(modo));
        }
        return json.writeValueAsString(root);
    }

    private ModoProcessamentoResumo lerModoProcessamento(ImportacaoSessao sessao) {
        String raw = sessao.getProgressoJson();
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            JsonNode n = json.readTree(raw);
            JsonNode m = n.get("modoProcessamento");
            if (m == null || m.isNull()) {
                return null;
            }
            return json.treeToValue(m, ModoProcessamentoResumo.class);
        } catch (RuntimeException e) {
            return null;
        }
    }

    /**
     * O que a pessoa pode ver, como na ficha do aluno: peso, objetivo e observações pedem {@code ALUNO_SENSIVEL_LER},
     * o treino {@code TREINO_LER} e a dieta {@code DIETA_LER}; sem elas saem vazios, e as dúvidas de alimento também.
     */
    SessaoDetalhe detalheDaSessao(ImportacaoSessao sessao) {
        boolean sensivel = AcessoAtual.pode("ALUNO_SENSIVEL_LER");
        boolean treinoLer = AcessoAtual.pode("TREINO_LER");
        boolean dietaLer = AcessoAtual.pode("DIETA_LER");
        boolean ergogenicoLer = AcessoAtual.pode("ERGOGENICO_LER");
        List<ArquivoResumo> arqs = arquivos.findBySessaoIdOrderByCriadoEmAsc(sessao.getId()).stream()
                .map(this::resumo).toList();
        List<GrupoImportavel> gruposBrutos = SessaoJson.grupos(json, sessao);
        List<GrupoImportavel> grupos = comParceiros(gruposBrutos).stream()
                .map(g -> g.paraLeitura(sensivel, treinoLer, dietaLer, ergogenicoLer)).toList();
        List<DuvidaImportacao> duvidas = SessaoJson.duvidas(json, sessao).stream()
                .filter(d -> dietaLer || d.tipo() == null || !d.tipo().startsWith("ALIMENTO"))
                .filter(d -> treinoLer || d.tipo() == null || !d.tipo().startsWith("EXERCICIO"))
                .toList();
        List<DecisaoImportacao> decisoes = SessaoJson.decisoes(json, sessao).stream()
                .filter(d -> dietaLer || d.tipo() == null || !d.tipo().startsWith("ALIMENTO"))
                .filter(d -> treinoLer || d.tipo() == null || !d.tipo().startsWith("EXERCICIO"))
                .toList();
        String estadoAtual = SessaoJson.estadoEfetivo(json, sessao);
        String hashPrevia = "REVISANDO".equals(estadoAtual) ? HashPreviaImportacao.calcular(sessao, gruposBrutos) : null;
        return new SessaoDetalhe(sessao.getId(), estadoAtual, sessao.getRevisao(), arqs,
                grupos, duvidas, sessao.getCriadoEm(), sessao.getExpiraEm(), lerModoProcessamento(sessao),
                decisoes, hashPrevia, "PROCESSANDO".equals(estadoAtual) ? lerLeitura(sessao) : null);
    }

    /**
     * Cada grupo juntável com os outros de mesmo nome (sem acento nem caixa) que sobraram: o servidor não os juntou por
     * conflito (ou o treinador deu o mesmo nome), e a tela oferece "Juntar com…".
     */
    static List<GrupoImportavel> comParceiros(List<GrupoImportavel> grupos) {
        Map<String, List<GrupoImportavel>> porNome = new HashMap<>();
        for (GrupoImportavel g : grupos) {
            String chave = chaveDoNome(g.nomeDetectado());
            if (juntavel(g) && !chave.isEmpty()) {
                porNome.computeIfAbsent(chave, k -> new ArrayList<>()).add(g);
            }
        }
        List<GrupoImportavel> saida = new ArrayList<>();
        for (GrupoImportavel g : grupos) {
            List<GrupoImportavel> mesmos = juntavel(g) ? porNome.getOrDefault(chaveDoNome(g.nomeDetectado()), List.of())
                    : List.of();
            List<ParceiroDeGrupo> parceiros = mesmos.stream().filter(o -> !o.id().equals(g.id()))
                    .map(o -> new ParceiroDeGrupo(o.id(), o.nomeDetectado())).toList();
            saida.add(g.comParceiros(parceiros));
        }
        return saida;
    }

    private LeituraEmAndamento lerLeitura(ImportacaoSessao sessao) {
        try {
            JsonNode n = json.readTree(sessao.getProgressoJson());
            return n.has("aLer") ? new LeituraEmAndamento(n.path("lidos").asInt(0), n.path("aLer").asInt(0),
                    n.path("aguardando").asBoolean(false)) : null;
        } catch (RuntimeException e) {
            return null;
        }
    }
}
