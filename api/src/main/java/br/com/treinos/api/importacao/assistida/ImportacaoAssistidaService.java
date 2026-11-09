package br.com.treinos.api.importacao.assistida;

import br.com.plataforma.comum.web.BadRequestException;
import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.web.NaoEncontradoException;
import br.com.treinos.api.alunos.Aluno;
import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.alunos.LimiteDoTreinador;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.biblioteca.Alimento;
import br.com.treinos.api.biblioteca.AlimentoRepository;
import br.com.treinos.api.biblioteca.Exercicio;
import br.com.treinos.api.biblioteca.ExercicioRepository;
import br.com.treinos.api.conta.PlanoDaConsultoria;
import br.com.treinos.api.dieta.ConteudoDieta;
import br.com.treinos.api.dieta.PlanoDieta;
import br.com.treinos.api.dieta.PlanoDietaRepository;
import br.com.treinos.api.equipe.AcessoAtual;
import br.com.treinos.api.execucao.RegistroPeso;
import br.com.treinos.api.execucao.RegistroPesoRepository;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.ApelidoDto;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.ArquivoResumo;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.AtualizarGrupoRequisicao;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.CadastroImportavel;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.ConfirmacaoResultado;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.ConfirmarSessaoRequisicao;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.DuvidaImportacao;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.GrupoImportavel;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.PesoImportavel;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.RespostaDuvidaRequisicao;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.SessaoDetalhe;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.SugestaoDuvida;
import br.com.treinos.api.importacao.assistida.ia.ContextoIa;
import br.com.treinos.api.importacao.assistida.ia.ResultadoInterpretacao;
import br.com.treinos.api.importacao.assistida.ia.RoteadorInterpretadorIa;
import br.com.treinos.api.pastas.PastaPlano;
import br.com.treinos.api.pastas.PastaRepository;
import br.com.treinos.api.security.UsuarioAutenticado;
import br.com.treinos.api.tenant.TenantContext;
import br.com.treinos.api.treino.ConteudoTreino;
import br.com.treinos.api.treino.PlanoTreino;
import br.com.treinos.api.treino.PlanoTreinoRepository;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Serviço de importação assistida por IA para lotes mistos (PDF, DOCX, planilhas e texto).
 */
@Service
public class ImportacaoAssistidaService {

    private final ImportacaoSessaoRepository sessoes;
    private final ImportacaoArquivoRepository arquivos;
    private final ImportacaoApelidoConsultoriaRepository apelidos;
    private final AlunoRepository alunos;
    private final RegistroPesoRepository pesos;
    private final PlanoTreinoRepository treinos;
    private final PlanoDietaRepository dietas;
    private final PastaRepository pastas;
    private final PlanoDaConsultoria plano;
    private final LimiteDoTreinador limiteDoTreinador;
    private final Auditoria auditoria;
    private final JsonMapper json;
    private final RoteadorInterpretadorIa roteador;

    public ImportacaoAssistidaService(ImportacaoSessaoRepository sessoes,
                                    ImportacaoArquivoRepository arquivos,
                                    ImportacaoApelidoConsultoriaRepository apelidos,
                                    AlunoRepository alunos,
                                    RegistroPesoRepository pesos,
                                    PlanoTreinoRepository treinos,
                                    PlanoDietaRepository dietas,
                                    PastaRepository pastas,
                                    PlanoDaConsultoria plano,
                                    LimiteDoTreinador limiteDoTreinador,
                                    Auditoria auditoria,
                                    JsonMapper json,
                                    RoteadorInterpretadorIa roteador) {
        this.sessoes = sessoes;
        this.arquivos = arquivos;
        this.apelidos = apelidos;
        this.alunos = alunos;
        this.pesos = pesos;
        this.treinos = treinos;
        this.dietas = dietas;
        this.pastas = pastas;
        this.plano = plano;
        this.limiteDoTreinador = limiteDoTreinador;
        this.auditoria = auditoria;
        this.json = json;
        this.roteador = roteador;
    }

    @Transactional
    public SessaoDetalhe criarSessao(UUID usuarioId, String objetivo) {
        ImportacaoSessao sessao = new ImportacaoSessao(usuarioId, objetivo);
        sessoes.save(sessao);
        return detalheDaSessao(sessao);
    }

    @Transactional
    public ArquivoResumo adicionarArquivo(UUID sessaoId, MultipartFile arquivo) throws IOException {
        ImportacaoSessao sessao = buscarSessao(sessaoId);
        if (arquivo.isEmpty()) {
            throw new BadRequestException("O arquivo enviado está vazio.", "ARQUIVO_VAZIO");
        }

        String nomeOriginal = arquivo.getOriginalFilename() != null ? arquivo.getOriginalFilename() : "documento";
        String formato = detectarFormato(nomeOriginal);
        byte[] bytes = arquivo.getBytes();
        String hash = calcularSha256(bytes);

        ImportacaoArquivo arq = new ImportacaoArquivo(sessao.getId(), nomeOriginal, formato, hash, bytes.length, bytes);
        arquivos.save(arq);

        sessao.incrementarRevisao();
        return new ArquivoResumo(arq.getId(), arq.getNomeOriginal(), arq.getFormato(), arq.getTamanhoBytes(),
                arq.getEstado(), arq.getErroCodigo(), arq.getCriadoEm());
    }

    @Transactional
    public ArquivoResumo adicionarTexto(UUID sessaoId, String titulo, String conteudo) {
        ImportacaoSessao sessao = buscarSessao(sessaoId);
        if (conteudo == null || conteudo.isBlank()) {
            throw new BadRequestException("O texto enviado está vazio.", "TEXTO_VAZIO");
        }

        byte[] bytes = conteudo.getBytes(StandardCharsets.UTF_8);
        String hash = calcularSha256(bytes);
        String nome = titulo != null && !titulo.isBlank() ? titulo.strip() : "Texto livre";

        ImportacaoArquivo arq = new ImportacaoArquivo(sessao.getId(), nome, "TEXTO_LIVRE", hash, bytes.length, bytes);
        arquivos.save(arq);

        sessao.incrementarRevisao();
        return new ArquivoResumo(arq.getId(), arq.getNomeOriginal(), arq.getFormato(), arq.getTamanhoBytes(),
                arq.getEstado(), arq.getErroCodigo(), arq.getCriadoEm());
    }

    @Transactional
    public SessaoDetalhe processar(UUID sessaoId) {
        ImportacaoSessao sessao = buscarSessao(sessaoId);
        sessao.atualizarEstado("PROCESSANDO");

        List<ImportacaoArquivo> listaArquivos = arquivos.findBySessaoIdOrderByCriadoEmAsc(sessaoId);
        if (listaArquivos.isEmpty()) {
            throw new BadRequestException("Adicione ao menos um arquivo ou texto para processar.", "SEM_ARQUIVOS");
        }

        Map<String, String> dicionarioApelidos = carregarDicionarioConsultoria();
        List<String> siglasMetodologia = List.of("WS", "FS", "AQUECIMENTO", "TOP_SET", "FEEDER", "BACKOFF", "REST_PAUSE");

        List<GrupoImportavel> todosGrupos = new ArrayList<>();
        List<DuvidaImportacao> todasDuvidas = new ArrayList<>();

        for (ImportacaoArquivo arq : listaArquivos) {
            try {
                ResultadoExtracao extracao = extrairArquivo(arq);
                RedatorLgpdImportacao.RedacaoResultado redacao = RedatorLgpdImportacao.redigir(extracao.textoCompleto());

                ContextoIa contexto = new ContextoIa(
                        arq.getNomeOriginal(),
                        arq.getFormato(),
                        extracao.blocos(),
                        sessao.getObjetivo(),
                        siglasMetodologia,
                        dicionarioApelidos,
                        "PDF".equals(arq.getFormato()) ? arq.getConteudoBytes() : null
                );

                ResultadoInterpretacao resultado = roteador.interpretar(contexto);

                // Converter propostas em grupos importáveis
                int grupoNum = todosGrupos.size() + 1;
                for (ResultadoInterpretacao.PropostaGrupo pg : resultado.grupos()) {
                    String nomeFinal = pg.nomeAluno() != null && !pg.nomeAluno().isBlank()
                            ? pg.nomeAluno() : PistaDeIdentidade.extrairDoNomeDoArquivo(arq.getNomeOriginal());
                    if (nomeFinal.isBlank()) nomeFinal = "Aluno " + grupoNum;

                    // Correlaciona com aluno existente no banco
                    UUID alunoExistenteId = correlacionarAlunoExistente(nomeFinal, redacao.primeiroEmail());
                    String destino = alunoExistenteId != null ? "VINCULAR_EXISTENTE" : "CRIAR_ALUNO";

                    CadastroImportavel cad = new CadastroImportavel(
                            nomeFinal,
                            redacao.primeiroEmail() != null ? redacao.primeiroEmail() : pg.email(),
                            redacao.primeiroTelefone() != null ? redacao.primeiroTelefone() : pg.telefone(),
                            pg.objetivo(),
                            pg.observacoes(),
                            true
                    );

                    List<PesoImportavel> pesosList = new ArrayList<>();
                    if (pg.pesos() != null) {
                        for (ResultadoInterpretacao.PropostaPeso pp : pg.pesos()) {
                            pesosList.add(new PesoImportavel(pp.data(), pp.kg(), pp.observacao()));
                        }
                    }

                    GrupoImportavel gi = new GrupoImportavel(
                            "grupo-" + grupoNum++,
                            arq.getNomeOriginal(),
                            nomeFinal,
                            destino,
                            alunoExistenteId,
                            List.of(arq.getNomeOriginal()),
                            cad,
                            pesosList,
                            pg.treino(),
                            pg.dieta(),
                            List.of(),
                            "PRONTO"
                    );
                    todosGrupos.add(gi);
                }

                // Dúvidas
                for (ResultadoInterpretacao.PropostaDuvida pd : resultado.duvidas()) {
                    List<SugestaoDuvida> sugs = new ArrayList<>();
                    if (pd.sugestoes() != null) {
                        for (ResultadoInterpretacao.PropostaSugestao ps : pd.sugestoes()) {
                            sugs.add(new SugestaoDuvida(ps.termo(), null, "IA", ps.nota()));
                        }
                    }
                    todasDuvidas.add(new DuvidaImportacao(
                            "duvida-" + (todasDuvidas.size() + 1),
                            pd.tipo(),
                            pd.termoOriginal(),
                            pd.trechoOriginal(),
                            arq.getNomeOriginal(),
                            1,
                            sugs,
                            false,
                            null
                    ));
                }

                arq.marcarProcessado(json.writeValueAsString(extracao.metadados()));
            } catch (Exception e) {
                arq.marcarErro("ERRO_PROCESSAMENTO: " + e.getMessage());
            }
        }

        try {
            sessao.atualizarResultados(
                    json.writeValueAsString(todosGrupos),
                    json.writeValueAsString(todasDuvidas),
                    "{\"processados\": " + listaArquivos.size() + "}"
            );
            sessao.atualizarEstado("REVISANDO");
        } catch (Exception e) {
            throw new RuntimeException("Falha ao serializar resultado da importação: " + e.getMessage(), e);
        }

        return detalheDaSessao(sessao);
    }

    @Transactional(readOnly = true)
    public SessaoDetalhe obterSessao(UUID sessaoId) {
        ImportacaoSessao sessao = buscarSessao(sessaoId);
        return detalheDaSessao(sessao);
    }

    @Transactional
    public SessaoDetalhe responderDuvida(UUID sessaoId, RespostaDuvidaRequisicao req) {
        ImportacaoSessao sessao = buscarSessao(sessaoId);
        List<DuvidaImportacao> duvidas = lerDuvidas(sessao);
        List<GrupoImportavel> grupos = lerGrupos(sessao);

        DuvidaImportacao encontrada = null;
        List<DuvidaImportacao> atualizadas = new ArrayList<>();
        for (DuvidaImportacao d : duvidas) {
            if (d.id().equals(req.duvidaId())) {
                encontrada = new DuvidaImportacao(d.id(), d.tipo(), d.termoOriginal(), d.trechoOriginal(),
                        d.arquivoOrigem(), d.ocorrencias(), d.sugestoes(), true, req.respostaEscolhida());
                atualizadas.add(encontrada);
            } else {
                atualizadas.add(d);
            }
        }

        if (encontrada == null) {
            throw new NaoEncontradoException("Dúvida não encontrada na sessão.");
        }

        // Aplica o termo escolhido no treino ou dieta de todos os grupos afetados
        String termoDe = encontrada.termoOriginal();
        String termoPara = req.respostaEscolhida();

        List<GrupoImportavel> gruposAtualizados = new ArrayList<>();
        for (GrupoImportavel g : grupos) {
            ConteudoTreino treino = substituirTermoNoTreino(g.treino(), termoDe, termoPara);
            ConteudoDieta dieta = substituirTermoNaDieta(g.dieta(), termoDe, termoPara);
            gruposAtualizados.add(new GrupoImportavel(
                    g.id(), g.identificadorOrigem(), g.nomeDetectado(), g.destino(), g.alunoExistenteId(),
                    g.arquivosOrigem(), g.cadastro(), g.pesos(), treino, dieta, g.pendenciasIds(), g.estado()
            ));
        }

        // Salvar no dicionário da consultoria se solicitado
        if (req.salvarNoDicionario() && req.tipo() != null && req.termoOriginal() != null) {
            salvarApelido(req.tipo(), req.termoOriginal(), req.respostaEscolhida(), req.referenciaId());
        }

        try {
            sessao.aplicarRespostas(
                    json.writeValueAsString(atualizadas),
                    json.writeValueAsString(gruposAtualizados),
                    json.writeValueAsString(atualizadas)
            );
        } catch (Exception e) {
            throw new RuntimeException("Erro ao salvar respostas: " + e.getMessage(), e);
        }

        return detalheDaSessao(sessao);
    }

    @Transactional
    public SessaoDetalhe atualizarGrupo(UUID sessaoId, String grupoId, AtualizarGrupoRequisicao req) {
        ImportacaoSessao sessao = buscarSessao(sessaoId);
        List<GrupoImportavel> grupos = lerGrupos(sessao);

        List<GrupoImportavel> atualizados = new ArrayList<>();
        for (GrupoImportavel g : grupos) {
            if (g.id().equals(grupoId)) {
                String novoDestino = req.destino() != null ? req.destino() : g.destino();
                UUID novoAlunoId = req.alunoExistenteId() != null ? req.alunoExistenteId() : g.alunoExistenteId();
                String novoNome = req.nome() != null && !req.nome().isBlank() ? req.nome().strip() : g.nomeDetectado();

                CadastroImportavel cad = g.cadastro() != null
                        ? new CadastroImportavel(novoNome, g.cadastro().email(), g.cadastro().telefone(),
                        g.cadastro().objetivo(), g.cadastro().observacoes(), g.cadastro().ativo())
                        : null;

                atualizados.add(new GrupoImportavel(
                        g.id(), g.identificadorOrigem(), novoNome, novoDestino, novoAlunoId,
                        g.arquivosOrigem(), cad, g.pesos(), g.treino(), g.dieta(), g.pendenciasIds(), g.estado()
                ));
            } else {
                atualizados.add(g);
            }
        }

        try {
            sessao.atualizarResultados(json.writeValueAsString(atualizados), null, null);
            sessao.incrementarRevisao();
        } catch (Exception e) {
            throw new RuntimeException("Erro ao atualizar grupo: " + e.getMessage(), e);
        }

        return detalheDaSessao(sessao);
    }

    @Transactional
    public ConfirmacaoResultado confirmar(UUID sessaoId, UsuarioAutenticado eu, ConfirmarSessaoRequisicao req) {
        ImportacaoSessao sessao = buscarSessao(sessaoId);
        if (req.revisaoEsperada() > 0 && sessao.getRevisao() != req.revisaoEsperada()) {
            throw new ConflictException("A sessão foi alterada por outro usuário. Recarregue os dados.", "REVISAO_DESATUALIZADA");
        }

        List<GrupoImportavel> grupos = lerGrupos(sessao);
        Set<String> alvos = req.gruposIds() != null && !req.gruposIds().isEmpty()
                ? new HashSet<>(req.gruposIds()) : Set.of();

        int alunosCriados = 0;
        int alunosVinculados = 0;
        int treinosCriados = 0;
        int dietasCriadas = 0;
        int modelosCriados = 0;
        int importados = 0;

        List<GrupoImportavel> gruposPosGravacao = new ArrayList<>();

        for (GrupoImportavel g : grupos) {
            if (!alvos.isEmpty() && !alvos.contains(g.id())) {
                gruposPosGravacao.add(g);
                continue;
            }
            if ("IMPORTADO".equals(g.estado()) || "IGNORAR".equals(g.destino())) {
                gruposPosGravacao.add(g);
                continue;
            }

            try {
                if ("MODELO_BIBLIOTECA".equals(g.destino())) {
                    if (g.treino() != null) {
                        PlanoTreino pt = new PlanoTreino(null, g.treino().objetivo() != null ? g.treino().objetivo() : "Treino Importado", null, null, json.writeValueAsString(g.treino()));
                        treinos.save(pt);
                        modelosCriados++;
                    }
                    if (g.dieta() != null) {
                        PlanoDieta pd = new PlanoDieta(null, g.dieta().objetivo() != null ? g.dieta().objetivo() : "Dieta Importada", null, null, json.writeValueAsString(g.dieta()));
                        dietas.save(pd);
                        modelosCriados++;
                    }
                } else {
                    UUID alunoId;
                    if ("VINCULAR_EXISTENTE".equals(g.destino()) && g.alunoExistenteId() != null) {
                        alunoId = g.alunoExistenteId();
                        alunosVinculados++;
                    } else {
                        // Criar novo aluno
                        CadastroImportavel cad = g.cadastro();
                        String nomeAluno = cad != null ? cad.nome() : g.nomeDetectado();
                        String emailAluno = cad != null ? cad.email() : null;
                        String telAluno = cad != null ? cad.telefone() : null;

                        Aluno aluno = new Aluno(nomeAluno, emailAluno, cad != null ? cad.objetivo() : null,
                                cad != null ? cad.observacoes() : null, null);
                        aluno.alterarSituacao(true, Instant.now());
                        aluno.alterarResponsavel(eu.usuarioId());
                        aluno.guardarTelefoneSemAcesso(telAluno);

                        plano.exigirVagaDeAluno();
                        limiteDoTreinador.exigirVaga(eu.usuarioId(), 1, null);
                        alunos.save(aluno);
                        alunoId = aluno.getId();
                        alunosCriados++;
                    }

                    // Gravar pesos
                    if (g.pesos() != null && !g.pesos().isEmpty()) {
                        for (PesoImportavel p : g.pesos()) {
                            RegistroPeso rp = new RegistroPeso(alunoId, p.data(), p.kg(), p.observacao(), eu.usuarioId());
                            pesos.save(rp);
                        }
                    }

                    // Gravar pasta e planos em rascunho
                    if (g.treino() != null || g.dieta() != null) {
                        PastaPlano pasta = new PastaPlano(alunoId, "Plano Atual (Importado)", null, null);
                        pastas.save(pasta);

                        if (g.treino() != null) {
                            PlanoTreino pt = new PlanoTreino(alunoId, g.treino().objetivo() != null ? g.treino().objetivo() : "Treino Importado", null, null, json.writeValueAsString(g.treino()));
                            pt.definirPasta(pasta.getId());
                            treinos.save(pt);
                            treinosCriados++;
                        }
                        if (g.dieta() != null) {
                            PlanoDieta pd = new PlanoDieta(alunoId, g.dieta().objetivo() != null ? g.dieta().objetivo() : "Dieta Importada", null, null, json.writeValueAsString(g.dieta()));
                            pd.definirPasta(pasta.getId());
                            dietas.save(pd);
                            dietasCriadas++;
                        }
                    }
                }

                importados++;
                gruposPosGravacao.add(new GrupoImportavel(
                        g.id(), g.identificadorOrigem(), g.nomeDetectado(), g.destino(), g.alunoExistenteId(),
                        g.arquivosOrigem(), g.cadastro(), g.pesos(), g.treino(), g.dieta(), g.pendenciasIds(), "IMPORTADO"
                ));
            } catch (Exception e) {
                gruposPosGravacao.add(new GrupoImportavel(
                        g.id(), g.identificadorOrigem(), g.nomeDetectado(), g.destino(), g.alunoExistenteId(),
                        g.arquivosOrigem(), g.cadastro(), g.pesos(), g.treino(), g.dieta(), g.pendenciasIds(), "ERRO"
                ));
            }
        }

        try {
            sessao.atualizarResultados(json.writeValueAsString(gruposPosGravacao), null, null);
            sessao.atualizarEstado("CONCLUIDA");
        } catch (Exception ignored) {
            // Ignora erro residual de gravação do estado da sessão
        }

        auditoria.registrarEvento("IMPORTACAO_ASSISTIDA_CONCLUIDA", "IMPORTACAO", sessao.getId(),
                "Importação assistida por IA confirmada (" + importados + " grupos gravados).");

        return new ConfirmacaoResultado(sessao.getId(), "CONCLUIDA", importados, alunosCriados,
                alunosVinculados, treinosCriados, dietasCriadas, modelosCriados);
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
        UUID consultoriaId = TenantContext.get();
        String normalizado = termoOriginal.strip().toLowerCase(Locale.ROOT);
        Optional<ImportacaoApelidoConsultoria> opt = apelidos.findByConsultoriaIdAndTipoAndTermoNormalizado(
                consultoriaId, tipo, normalizado);
        if (opt.isPresent()) {
            ImportacaoApelidoConsultoria ap = opt.get();
            ap.atualizarMapeamento(valorMapeado, referenciaId);
        } else {
            ImportacaoApelidoConsultoria novo = new ImportacaoApelidoConsultoria(tipo, normalizado,
                    termoOriginal.strip(), referenciaId, valorMapeado.strip());
            apelidos.save(novo);
        }
    }

    private ConteudoTreino substituirTermoNoTreino(ConteudoTreino treino, String termoDe, String termoPara) {
        if (treino == null || treino.sessoes() == null || termoDe == null || termoPara == null) return treino;
        List<ConteudoTreino.Sessao> novasSessoes = new ArrayList<>();
        boolean alterou = false;
        for (ConteudoTreino.Sessao s : treino.sessoes()) {
            List<ConteudoTreino.ExercicioPlano> novosExs = new ArrayList<>();
            for (ConteudoTreino.ExercicioPlano ex : s.exerciciosOuVazio()) {
                if (ex.nome() != null && ex.nome().equalsIgnoreCase(termoDe)) {
                    novosExs.add(new ConteudoTreino.ExercicioPlano(
                            ex.uid(), ex.exercicioId(), termoPara, ex.modalidade(), ex.videoUrl(),
                            ex.observacao(), ex.progressao(), ex.unidade(), ex.series(),
                            ex.cadencia(), ex.isometriaSegundos(), ex.grupoUid()
                    ));
                    alterou = true;
                } else {
                    novosExs.add(ex);
                }
            }
            novasSessoes.add(new ConteudoTreino.Sessao(
                    s.uid(), s.nome(), s.diaSemana(), s.tipo(), s.frequenciaSemanal(),
                    s.observacao(), s.cardio(), novosExs, s.grupos()
            ));
        }
        return alterou ? new ConteudoTreino(treino.objetivo(), treino.orientacoes(), novasSessoes, treino.metodologia()) : treino;
    }

    private ConteudoDieta substituirTermoNaDieta(ConteudoDieta dieta, String termoDe, String termoPara) {
        if (dieta == null || dieta.refeicoes() == null || termoDe == null || termoPara == null) return dieta;
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
                                it.fatorCorrecao(), it.fatorCoccao(), it.grupo()
                        ));
                        alterou = true;
                    } else {
                        novosItens.add(it);
                    }
                }
                novasOpcoes.add(new ConteudoDieta.Opcao(op.uid(), op.rotulo(), novosItens));
            }
            novasRefeicoes.add(new ConteudoDieta.Refeicao(r.uid(), r.nome(), r.horario(), r.observacao(), novasOpcoes, r.modoDePreparo()));
        }
        return alterou ? new ConteudoDieta(dieta.objetivo(), dieta.dataInicio(), dieta.profissional(), novasRefeicoes,
                dieta.orientacoes(), dieta.observacoes(), dieta.suplementacao(), dieta.ergogenicos(), dieta.aguaLitros()) : dieta;
    }

    @Transactional
    public void removerApelido(UUID id) {
        UUID consultoriaId = TenantContext.get();
        ImportacaoApelidoConsultoria ap = apelidos.findByIdAndConsultoriaId(id, consultoriaId)
                .orElseThrow(() -> new NaoEncontradoException("Apelido não encontrado."));
        apelidos.delete(ap);
    }

    // -------------------------------------------------------------------------------------- métodos auxiliares

    private ImportacaoSessao buscarSessao(UUID id) {
        UUID consultoriaId = TenantContext.get();
        return sessoes.findByIdAndConsultoriaId(id, consultoriaId)
                .orElseThrow(() -> new NaoEncontradoException("Sessão de importação não encontrada."));
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

    private String detectarFormato(String nome) {
        String min = nome.toLowerCase(Locale.ROOT);
        if (min.endsWith(".pdf")) return "PDF";
        if (min.endsWith(".docx")) return "DOCX";
        if (min.endsWith(".xlsx")) return "XLSX";
        if (min.endsWith(".csv")) return "CSV";
        return "TEXTO_LIVRE";
    }

    private String calcularSha256(byte[] bytes) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(bytes);
            StringBuilder sb = new StringBuilder();
            for (byte b : digest) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            return UUID.randomUUID().toString().replace("-", "");
        }
    }

    private Map<String, String> carregarDicionarioConsultoria() {
        UUID consultoriaId = TenantContext.get();
        Map<String, String> mapa = new HashMap<>();
        for (ImportacaoApelidoConsultoria a : apelidos.findByConsultoriaIdOrderByTermoOriginalAsc(consultoriaId)) {
            mapa.put(a.getTermoNormalizado(), a.getValorMapeado());
        }
        return Map.copyOf(mapa);
    }

    private UUID correlacionarAlunoExistente(String nome, String email) {
        if (email != null && !email.isBlank()) {
            for (Aluno a : alunos.findAll()) {
                if (a.getEmail() != null && a.getEmail().equalsIgnoreCase(email.strip())) {
                    return a.getId();
                }
            }
        }
        if (nome != null && !nome.isBlank()) {
            String chaveNome = nome.strip().toLowerCase(Locale.ROOT);
            for (Aluno a : alunos.findAll()) {
                if (a.getNome() != null && a.getNome().strip().toLowerCase(Locale.ROOT).equals(chaveNome)) {
                    return a.getId();
                }
            }
        }
        return null;
    }

    private List<GrupoImportavel> lerGrupos(ImportacaoSessao sessao) {
        try {
            return json.readValue(sessao.getGruposJson(), new TypeReference<List<GrupoImportavel>>() {});
        } catch (Exception e) {
            return List.of();
        }
    }

    private List<DuvidaImportacao> lerDuvidas(ImportacaoSessao sessao) {
        try {
            return json.readValue(sessao.getDuvidasJson(), new TypeReference<List<DuvidaImportacao>>() {});
        } catch (Exception e) {
            return List.of();
        }
    }

    private SessaoDetalhe detalheDaSessao(ImportacaoSessao sessao) {
        List<ArquivoResumo> arqs = arquivos.findBySessaoIdOrderByCriadoEmAsc(sessao.getId()).stream()
                .map(a -> new ArquivoResumo(a.getId(), a.getNomeOriginal(), a.getFormato(), a.getTamanhoBytes(),
                        a.getEstado(), a.getErroCodigo(), a.getCriadoEm()))
                .toList();

        return new SessaoDetalhe(
                sessao.getId(),
                sessao.getObjetivo(),
                sessao.getEstado(),
                sessao.getRevisao(),
                arqs,
                lerGrupos(sessao),
                lerDuvidas(sessao),
                sessao.getCriadoEm(),
                sessao.getExpiraEm()
        );
    }


}
