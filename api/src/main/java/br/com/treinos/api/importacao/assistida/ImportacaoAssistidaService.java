package br.com.treinos.api.importacao.assistida;

import br.com.plataforma.comum.web.BadRequestException;
import br.com.plataforma.comum.web.ConflictException;
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
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.DuvidaImportacao;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.GrupoImportavel;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.PesoImportavel;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.RespostaDuvidaRequisicao;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.SessaoDetalhe;
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
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HexFormat;
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
 * ({@link ImportacaoAssistidaRetencao}); os bytes do arquivo saem logo depois de processados e o grupo gravado perde o
 * conteúdo. Nada sai do servidor sem {@code treinos.importacao.ia.enviar-dados-ao-provedor}, e então só o texto redigido.
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

    @Transactional
    public SessaoDetalhe criarSessao(UUID usuarioId, String objetivo) {
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

    @Transactional
    public ArquivoResumo adicionarArquivo(UUID sessaoId, MultipartFile arquivo) throws IOException {
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

    /**
     * Interpreta os arquivos ainda não processados e acrescenta os grupos e as dúvidas aos que a sessão já tem. O conteúdo
     * do arquivo é apagado ao fim, com sucesso ou erro: reenviar é adicionar de novo.
     */
    @Transactional
    public SessaoDetalhe processar(UUID sessaoId) {
        ImportacaoSessao sessao = sessaoTravada(sessaoId);
        if ("CONCLUIDA".equals(sessao.getEstado())) {
            throw new ConflictException("A importação já foi concluída.", "SESSAO_CONCLUIDA");
        }
        List<ImportacaoArquivo> todos = arquivos.findBySessaoIdOrderByCriadoEmAsc(sessaoId);
        if (todos.isEmpty()) {
            throw new BadRequestException("Adicione ao menos um arquivo ou texto para processar.", "SEM_ARQUIVOS");
        }
        List<ImportacaoArquivo> pendentes = todos.stream().filter(a -> "RECEBIDO".equals(a.getEstado())).toList();
        if (pendentes.isEmpty()) {
            return detalheDaSessao(sessao);
        }

        Map<String, String> dicionario = carregarDicionarioConsultoria();
        List<GrupoImportavel> grupos = new ArrayList<>(SessaoJson.grupos(json, sessao));
        List<DuvidaImportacao> duvidas = new ArrayList<>(SessaoJson.duvidas(json, sessao));
        List<Aluno> existentes = null;
        int seqGrupo = grupos.size();
        int seqDuvida = duvidas.size();

        for (ImportacaoArquivo arq : pendentes) {
            Interpretado ok = interpretar(arq, sessao.getObjetivo(), dicionario);
            arq.limparConteudoBytes();
            if (ok == null) {
                continue;
            }
            if (existentes == null) {
                existentes = alunos.findAll();
            }
            // E-mail e telefone do arquivo só valem para o grupo quando o arquivo tem um único grupo e um único contato.
            boolean unico = ok.resultado().grupos().size() == 1;
            String email = unico ? unico(ok.redacao().emails(), false) : null;
            String telefone = unico ? unico(ok.redacao().telefones(), true) : null;
            for (ResultadoInterpretacao.PropostaGrupo pg : ok.resultado().grupos()) {
                seqGrupo++;
                grupos.add(montarGrupo(pg, arq, "grupo-" + seqGrupo, email, telefone, existentes));
            }
            for (ResultadoInterpretacao.PropostaDuvida pd : ok.resultado().duvidas()) {
                List<SugestaoDuvida> sugs = new ArrayList<>();
                if (pd.sugestoes() != null) {
                    for (ResultadoInterpretacao.PropostaSugestao ps : pd.sugestoes()) {
                        sugs.add(new SugestaoDuvida(ps.termo(), null, "IA", ps.nota()));
                    }
                }
                seqDuvida++;
                duvidas.add(new DuvidaImportacao("duvida-" + seqDuvida, pd.tipo(), pd.termoOriginal(), pd.trechoOriginal(),
                        arq.getNomeOriginal(), 1, sugs, false, null));
            }
        }

        long processados = todos.stream().filter(a -> !"RECEBIDO".equals(a.getEstado())).count();
        sessao.atualizarResultados(json.writeValueAsString(grupos), json.writeValueAsString(duvidas),
                "{\"processados\": " + processados + "}");
        sessao.atualizarEstado("REVISANDO");
        return detalheDaSessao(sessao);
    }

    private record Interpretado(ResultadoInterpretacao resultado, RedatorLgpdImportacao.RedacaoResultado redacao) {
    }

    /** Extrai, redige e interpreta um arquivo; falha vira {@code erro_codigo} fixo (nunca a mensagem da exceção). */
    private Interpretado interpretar(ImportacaoArquivo arq, String objetivo, Map<String, String> dicionario) {
        try {
            ResultadoExtracao extracao = extrairArquivo(arq);
            RedatorLgpdImportacao.RedacaoResultado redacao = RedatorLgpdImportacao.redigir(extracao.textoCompleto());
            ContextoIa contexto = new ContextoIa(arq.getNomeOriginal(), arq.getFormato(), extracao.blocos(),
                    redacao.textoRedigido(), objetivo, SIGLAS_METODOLOGIA, dicionario);
            ResultadoInterpretacao resultado = roteador.interpretar(contexto);
            arq.marcarProcessado(json.writeValueAsString(extracao.metadados()));
            return new Interpretado(resultado, redacao);
        } catch (ExtracaoRecusadaException e) {
            arq.marcarErro(e.codigo());
        } catch (RuntimeException e) {
            arq.marcarErro("ERRO_PROCESSAMENTO");
        }
        return null;
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
        return new GrupoImportavel(id, arq.getNomeOriginal(), nome, destino, alunoExistente,
                List.of(arq.getNomeOriginal()), cadastro, pesos, pg.treino(), pg.dieta(), List.of(), "PRONTO", null,
                candidatos);
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
        ImportacaoSessao sessao = sessaoTravada(sessaoId);
        if (req.duvidaId() == null || req.respostaEscolhida() == null || req.respostaEscolhida().isBlank()
                || req.respostaEscolhida().strip().length() > TERMO_DO_APELIDO) {
            throw new BadRequestException("Resposta da dúvida inválida.", "RESPOSTA_INVALIDA");
        }
        List<DuvidaImportacao> duvidas = SessaoJson.duvidas(json, sessao);
        List<GrupoImportavel> grupos = SessaoJson.grupos(json, sessao);

        DuvidaImportacao encontrada = null;
        List<DuvidaImportacao> atualizadas = new ArrayList<>();
        for (DuvidaImportacao d : duvidas) {
            if (d.id().equals(req.duvidaId())) {
                encontrada = new DuvidaImportacao(d.id(), d.tipo(), d.termoOriginal(), d.trechoOriginal(),
                        d.arquivoOrigem(), d.ocorrencias(), d.sugestoes(), true, req.respostaEscolhida().strip());
                atualizadas.add(encontrada);
            } else {
                atualizadas.add(d);
            }
        }
        if (encontrada == null) {
            throw new NaoEncontradoException("Dúvida não encontrada na sessão.");
        }

        // Aplica o termo escolhido no treino ou dieta dos grupos ainda não gravados
        String termoDe = encontrada.termoOriginal();
        String termoPara = req.respostaEscolhida().strip();
        List<GrupoImportavel> gruposAtualizados = new ArrayList<>();
        for (GrupoImportavel g : grupos) {
            if ("IMPORTADO".equals(g.estado())) {
                gruposAtualizados.add(g);
                continue;
            }
            gruposAtualizados.add(g.comTreinoEDieta(substituirTermoNoTreino(g.treino(), termoDe, termoPara),
                    substituirTermoNaDieta(g.dieta(), termoDe, termoPara)));
        }

        if (req.salvarNoDicionario() && req.tipo() != null && req.termoOriginal() != null) {
            salvarApelido(req.tipo(), req.termoOriginal(), termoPara, req.referenciaId());
        }
        sessao.aplicarRespostas(json.writeValueAsString(atualizadas), json.writeValueAsString(gruposAtualizados),
                json.writeValueAsString(atualizadas));
        return detalheDaSessao(sessao);
    }

    /**
     * Destino, aluno existente e nome do grupo. O aluno escolhido é conferido aqui (e de novo ao confirmar): outra
     * consultoria 404, anonimizado 409 {@code ALUNO_ANONIMIZADO}, inativo 409 {@code ALUNO_INATIVO}.
     */
    @Transactional
    public SessaoDetalhe atualizarGrupo(UUID sessaoId, String grupoId, AtualizarGrupoRequisicao req) {
        ImportacaoSessao sessao = sessaoTravada(sessaoId);
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
                    novosExs.add(new ConteudoTreino.ExercicioPlano(
                            ex.uid(), ex.exercicioId(), termoPara, ex.modalidade(), ex.videoUrl(),
                            ex.observacao(), ex.progressao(), ex.unidade(), ex.series(),
                            ex.cadencia(), ex.isometriaSegundos(), ex.grupoUid()));
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
        if (dieta == null || dieta.refeicoes() == null || termoDe == null || termoPara == null) {
            return dieta;
        }
        List<ConteudoDieta.Refeicao> novasRefeicoes = new ArrayList<>();
        boolean alterou = false;
        for (ConteudoDieta.Refeicao r : dieta.refeicoes()) {
            List<ConteudoDieta.Opcao> novasOpcoes = new ArrayList<>();
            for (ConteudoDieta.Opcao op : r.opcoesOuVazio()) {
                List<ConteudoDieta.Item> novosItens = new ArrayList<>();
                for (ConteudoDieta.Item it : op.itensOuVazio()) {
                    if (it.nome() != null && it.nome().equalsIgnoreCase(termoDe)) {
                        novosItens.add(new ConteudoDieta.Item(
                                it.uid(), it.alimentoId(), termoPara, it.quantidade(), it.unidade(),
                                it.kcal(), it.proteina(), it.carboidrato(), it.gordura(), it.manual(),
                                it.fatorCorrecao(), it.fatorCoccao(), it.grupo()));
                        alterou = true;
                    } else {
                        novosItens.add(it);
                    }
                }
                novasOpcoes.add(new ConteudoDieta.Opcao(op.uid(), op.rotulo(), novosItens));
            }
            novasRefeicoes.add(new ConteudoDieta.Refeicao(r.uid(), r.nome(), r.horario(), r.observacao(), novasOpcoes,
                    r.modoDePreparo()));
        }
        return alterou ? new ConteudoDieta(dieta.objetivo(), dieta.dataInicio(), dieta.profissional(), novasRefeicoes,
                dieta.orientacoes(), dieta.observacoes(), dieta.suplementacao(), dieta.ergogenicos(), dieta.aguaLitros()) : dieta;
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

    /** Sessão travada que ainda aceita arquivos: depois de concluída não aceita mais. */
    private ImportacaoSessao sessaoAberta(UUID id) {
        ImportacaoSessao sessao = sessaoTravada(id);
        if ("CONCLUIDA".equals(sessao.getEstado())) {
            throw new ConflictException("A importação já foi concluída.", "SESSAO_CONCLUIDA");
        }
        return sessao;
    }

    private ResultadoExtracao extrairArquivo(ImportacaoArquivo arq) {
        String formato = arq.getFormato();
        byte[] bytes = arq.getConteudoBytes();
        return switch (formato) {
            case "DOCX" -> ExtratorDocx.extrair(arq.getNomeOriginal(), bytes);
            case "PDF" -> ExtratorPdf.extrair(arq.getNomeOriginal(), bytes);
            case "XLSX", "CSV" -> ExtratorXlsxCsv.extrair(arq.getNomeOriginal(), bytes);
            case "TEXTO_LIVRE" -> ExtratorTextoLivre.extrair(arq.getNomeOriginal(),
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

    private static ArquivoResumo resumo(ImportacaoArquivo a) {
        return new ArquivoResumo(a.getId(), a.getNomeOriginal(), a.getFormato(), a.getTamanhoBytes(), a.getEstado(),
                a.getErroCodigo(), a.getCriadoEm());
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
                .map(ImportacaoAssistidaService::resumo).toList();
        List<GrupoImportavel> grupos = SessaoJson.grupos(json, sessao).stream()
                .map(g -> g.paraLeitura(sensivel, treinoLer, dietaLer)).toList();
        List<DuvidaImportacao> duvidas = SessaoJson.duvidas(json, sessao).stream()
                .filter(d -> dietaLer || d.tipo() == null || !d.tipo().startsWith("ALIMENTO"))
                .filter(d -> treinoLer || d.tipo() == null || !d.tipo().startsWith("EXERCICIO"))
                .toList();
        return new SessaoDetalhe(sessao.getId(), sessao.getObjetivo(), sessao.getEstado(), sessao.getRevisao(), arqs,
                grupos, duvidas, sessao.getCriadoEm(), sessao.getExpiraEm());
    }
}
