package br.com.treinos.api.importacao.assistida;

import br.com.plataforma.comum.web.BadRequestException;
import br.com.plataforma.comum.web.ConflictException;
import br.com.plataforma.comum.web.ResourceNotFoundException;
import br.com.treinos.api.alunos.Aluno;
import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.alunos.AlunoService;
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
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.ModoProcessamentoResumo;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.OcorrenciaOrigem;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.PesoImportavel;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.ResponderDuvidaRequisicao;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.RespostaDuvidaRequisicao;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.SessaoDetalhe;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.SessaoListaItem;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.SugestaoDuvida;
import br.com.treinos.api.importacao.assistida.ia.ContextoIa;
import br.com.treinos.api.importacao.assistida.ia.ResultadoInterpretacao;
import br.com.treinos.api.importacao.assistida.ia.RoteadorInterpretadorIa;
import br.com.treinos.api.tenant.TenantContext;
import br.com.treinos.api.treino.ConteudoTreino;
import br.com.treinos.api.web.Buscas;
import br.com.treinos.api.web.Formatos;
import br.com.treinos.api.web.NaoEncontradoException;
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
    static final int OBJETIVO_DA_SESSAO = 40;
    static final int TERMO_DO_APELIDO = 160;
    static final int TIPO_DO_APELIDO = 24;
    private static final int CANDIDATOS_POR_GRUPO = 5;
    private static final Pattern EMAIL_SIMPLES = Pattern.compile("[^@\\s]+@[^@\\s]+\\.[^@\\s]+");
    private static final Pattern OBJETIVO_VALIDO = Pattern.compile("[A-Z][A-Z0-9_]*");
    private static final Set<String> DESTINOS = Set.of("CRIAR_ALUNO", "VINCULAR_EXISTENTE", "MODELO_BIBLIOTECA", "IGNORAR");
    private static final List<String> SIGLAS_METODOLOGIA = List.of("WS", "FS", "AQUECIMENTO", "TOP_SET", "FEEDER", "BACKOFF",
            "REST_PAUSE");

    private final ImportacaoSessaoRepository sessoes;
    private final ImportacaoArquivoRepository arquivos;
    private final ImportacaoApelidoConsultoriaRepository apelidos;
    private final AlunoRepository alunos;
    private final JsonMapper json;
    private final RoteadorInterpretadorIa roteador;

    public ImportacaoAssistidaService(ImportacaoSessaoRepository sessoes, ImportacaoArquivoRepository arquivos,
                                      ImportacaoApelidoConsultoriaRepository apelidos, AlunoRepository alunos,
                                      JsonMapper json, RoteadorInterpretadorIa roteador) {
        this.sessoes = sessoes;
        this.arquivos = arquivos;
        this.apelidos = apelidos;
        this.alunos = alunos;
        this.json = json;
        this.roteador = roteador;
    }

    /** Política conservadora para o piloto: entrada/leitura de sessão mista exige as permissões de leitura do conteúdo. */
    void exigirPermissoesSessaoMista() {
        AcessoAtual.exigir("ALUNO_ALTERAR");
        AcessoAtual.exigir("ALUNO_SENSIVEL_LER");
        AcessoAtual.exigir("TREINO_LER");
        AcessoAtual.exigir("DIETA_LER");
    }

    @Transactional
    public SessaoDetalhe criarSessao(UUID usuarioId, String objetivo) {
        exigirPermissoesSessaoMista();
        String obj = objetivo == null || objetivo.isBlank() ? null : objetivo.strip();
        if (obj != null && (obj.length() > OBJETIVO_DA_SESSAO || !OBJETIVO_VALIDO.matcher(obj).matches())) {
            throw new BadRequestException("Objetivo da importação inválido.", "OBJETIVO_INVALIDO");
        }
        if (sessoes.countByCriadoPorAndExpiraEmAfter(usuarioId, Instant.now()) >= SESSOES_ABERTAS_POR_USUARIO) {
            throw new ConflictException("Muitas importações abertas. Conclua ou aguarde as antigas expirarem.",
                    "LIMITE_DE_SESSOES");
        }
        ImportacaoSessao sessao = new ImportacaoSessao(usuarioId, obj);
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
        String formato = detectarFormato(nome, bytes);
        return guardar(sessao, nome, formato, bytes);
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

    record PreparoProcessamento(UUID sessaoId, String objetivo, Map<String, String> dicionario,
                                List<ArquivoPendente> pendentes, List<Aluno> existentes) {
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
        return new PreparoProcessamento(sessao.getId(), sessao.getObjetivo(), dicionario, itens, existentes);
    }

    ResultadoProcessamentoLote executarProcessamentoSemTransacao(PreparoProcessamento preparo) {
        List<ResultadoArquivoProcessado> itens = new ArrayList<>();
        for (ArquivoPendente arq : preparo.pendentes()) {
            try {
                ResultadoExtracao extracao = extrairArquivo(arq.formato(), arq.nomeOriginal(), arq.conteudoBytes());
                RedatorLgpdImportacao.RedacaoResultado redacao = RedatorLgpdImportacao.redigir(extracao.textoCompleto());
                ContextoIa contexto = new ContextoIa(arq.nomeOriginal(), arq.formato(), extracao.blocos(),
                        extracao.textoCompleto(), preparo.objetivo(), SIGLAS_METODOLOGIA, preparo.dicionario());
                RoteadorInterpretadorIa.ExecucaoInterpretacao execucao = roteador.interpretarComModo(contexto);
                itens.add(new ResultadoArquivoProcessado(arq.id(), true, json.writeValueAsString(extracao.metadados()),
                        null, execucao, redacao));
            } catch (ExtracaoRecusadaException e) {
                itens.add(new ResultadoArquivoProcessado(arq.id(), false, null, e.codigo(), null, null));
            } catch (RuntimeException e) {
                itens.add(new ResultadoArquivoProcessado(arq.id(), false, null, "ERRO_PROCESSAMENTO", null, null));
            }
        }
        return new ResultadoProcessamentoLote(List.copyOf(itens), preparo.existentes());
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
        int seqGrupo = grupos.size();
        int seqDuvida = duvidas.size();
        ModoProcessamentoResumo modo = lerModoProcessamento(sessao);

        for (ResultadoArquivoProcessado item : resultado.itens()) {
            ImportacaoArquivo arq = porId.get(item.arquivoId());
            if (arq == null) {
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
                grupos.add(montarGrupo(pg, arq, "grupo-" + seqGrupo, email, telefone, resultado.existentes()));
            }
            for (ResultadoInterpretacao.PropostaDuvida pd : item.execucao().resultado().duvidas()) {
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
                duvidas.add(new DuvidaImportacao("duvida-" + seqDuvida, pd.tipo(), pd.termoOriginal(), pd.trechoOriginal(),
                        arq.getNomeOriginal(), qtdOc, sugs, false, null, ocIds));
            }
        }

        long processados = todos.stream().filter(a -> !"RECEBIDO".equals(a.getEstado())).count();
        sessao.atualizarResultados(json.writeValueAsString(grupos), json.writeValueAsString(duvidas),
                serializarProgresso(sessao, processados, modo));
        sessao.atualizarEstado("REVISANDO");
    }

    private GrupoImportavel montarGrupo(ResultadoInterpretacao.PropostaGrupo pg, ImportacaoArquivo arq, String id,
                                        String email, String telefone, List<Aluno> existentes) {
        String nome = pg.nomeAluno() != null && !pg.nomeAluno().isBlank() ? pg.nomeAluno().strip()
                : PistaDeIdentidade.extrairDoNomeDoArquivo(arq.getNomeOriginal());
        if (nome.isBlank()) {
            nome = "Aluno " + id.substring("grupo-".length());
        }
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
                candidatos, ocorrencias);
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

    private static String chaveDoNome(String nome) {
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

        List<GrupoImportavel> gruposAtualizados = reconstruirGrupos(grupos, decisoes, encontrada.termoOriginal(), termoPara);

        if (req.salvarNoDicionario() && req.tipo() != null && req.termoOriginal() != null) {
            salvarApelido(req.tipo(), req.termoOriginal(), termoPara, req.referenciaId());
        }
        sessao.aplicarRespostas(json.writeValueAsString(decisoes), json.writeValueAsString(gruposAtualizados),
                json.writeValueAsString(atualizadas));
        return detalheDaSessao(sessao);
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
        List<GrupoImportavel> gruposAtualizados = reconstruirGrupos(SessaoJson.grupos(json, sessao), decisoes, null, null);
        sessao.aplicarRespostas(json.writeValueAsString(decisoes), json.writeValueAsString(gruposAtualizados),
                json.writeValueAsString(duvidas));
        return detalheDaSessao(sessao);
    }

    private static List<String> resolverAlvos(DuvidaImportacao duvida, List<String> solicitados) {
        List<String> validos = duvida.ocorrenciaIds();
        if (solicitados == null) {
            return validos;
        }
        if (solicitados.isEmpty() || !validos.containsAll(solicitados)) {
            throw new BadRequestException("Ocorrências inválidas para esta dúvida.", "OCORRENCIA_INVALIDA");
        }
        return List.copyOf(solicitados);
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
     * Destino, aluno existente e nome do grupo. O aluno escolhido é conferido aqui (e de novo ao confirmar): outra
     * consultoria 404, anonimizado 409 {@code ALUNO_ANONIMIZADO}, inativo 409 {@code ALUNO_INATIVO}.
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
        GrupoImportavel novo = alvo.comDestino(destino, alunoId, nome);
        List<GrupoImportavel> atualizados = new ArrayList<>();
        for (GrupoImportavel g : grupos) {
            atualizados.add(g.id().equals(grupoId) ? novo : g);
        }
        SessaoJson.gravarGrupos(json, sessao, atualizados);
        sessao.incrementarRevisao();
        return detalheDaSessao(sessao);
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
    }

    private static ResultadoExtracao extrairArquivo(String formato, String nomeOriginal, byte[] bytes) {
        return switch (formato) {
            case "DOCX" -> ExtratorDocx.extrair(nomeOriginal, bytes);
            case "PDF" -> ExtratorPdf.extrair(nomeOriginal, bytes);
            case "XLSX", "CSV" -> ExtratorXlsxCsv.extrair(nomeOriginal, bytes);
            case "TEXTO_LIVRE" -> ExtratorTextoLivre.extrair(nomeOriginal,
                    bytes != null ? new String(bytes, StandardCharsets.UTF_8) : "");
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
     * ({@code PK}), CSV e texto não podem ter byte nulo nem ser PDF ou zip renomeado. Outra extensão é recusada.
     */
    static String detectarFormato(String nome, byte[] bytes) {
        int ponto = nome.lastIndexOf('.');
        String ext = ponto < 0 ? "" : nome.substring(ponto + 1).toLowerCase(Locale.ROOT);
        boolean pdf = bytes.length >= 5 && bytes[0] == '%' && bytes[1] == 'P' && bytes[2] == 'D' && bytes[3] == 'F' && bytes[4] == '-';
        boolean zip = bytes.length >= 4 && bytes[0] == 'P' && bytes[1] == 'K' && bytes[2] == 3 && bytes[3] == 4;
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
            default -> throw new BadRequestException("Formato de arquivo não suportado.", "FORMATO_NAO_SUPORTADO");
        }
        if (!confere) {
            throw new BadRequestException("O conteúdo do arquivo não corresponde ao formato.", "FORMATO_NAO_CONFERE");
        }
        return formato;
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
        return new ArquivoResumo(a.getId(), a.getNomeOriginal(), a.getFormato(), a.getTamanhoBytes(), a.getEstado(),
                a.getErroCodigo(), a.getCriadoEm(), lerCobertura(a));
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

    private String serializarProgresso(ImportacaoSessao sessao, long processados, ModoProcessamentoResumo modo) {
        Map<String, Object> map = new HashMap<>();
        try {
            if (sessao.getProgressoJson() != null && !sessao.getProgressoJson().isBlank()) {
                JsonNode n = json.readTree(sessao.getProgressoJson());
                if (n.has("confirmacoes")) {
                    map.put("confirmacoes", n.get("confirmacoes"));
                }
            }
        } catch (RuntimeException ignored) {
            // mantém mapa limpo
        }
        map.put("processados", processados);
        if (modo != null) {
            map.put("modoProcessamento", modo);
        }
        return json.writeValueAsString(map);
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
        List<ArquivoResumo> arqs = arquivos.findBySessaoIdOrderByCriadoEmAsc(sessao.getId()).stream()
                .map(this::resumo).toList();
        List<GrupoImportavel> gruposBrutos = SessaoJson.grupos(json, sessao);
        List<GrupoImportavel> grupos = gruposBrutos.stream()
                .map(g -> g.paraLeitura(sensivel, treinoLer, dietaLer)).toList();
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
        return new SessaoDetalhe(sessao.getId(), sessao.getObjetivo(), estadoAtual, sessao.getRevisao(), arqs,
                grupos, duvidas, sessao.getCriadoEm(), sessao.getExpiraEm(), lerModoProcessamento(sessao),
                decisoes, hashPrevia);
    }
}
