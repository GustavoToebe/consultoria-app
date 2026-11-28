package br.com.treinos.api.importacao.assistida;

import br.com.plataforma.comum.web.BadRequestException;
import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.alunos.Aluno;
import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.AtualizarGrupoRequisicao;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.GrupoImportavel;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.RespostaDuvidaRequisicao;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.SessaoDetalhe;
import br.com.treinos.api.importacao.assistida.ia.ConfiguracaoIaImportacao;
import br.com.treinos.api.importacao.assistida.ia.InterpretadorClaude;
import br.com.treinos.api.importacao.assistida.ia.InterpretadorGemini;
import br.com.treinos.api.importacao.assistida.ia.InterpretadorPorRegras;
import br.com.treinos.api.importacao.assistida.ia.ResultadoInterpretacao;
import br.com.treinos.api.importacao.assistida.ia.RoteadorInterpretadorIa;
import br.com.treinos.api.tenant.TenantContext;
import br.com.treinos.api.web.NaoEncontradoException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.json.JsonMapper;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import br.com.treinos.api.treino.ConteudoTreino;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Dados fictícios. Sessão, arquivos e aluno são mocks de repositório; nada toca banco nem rede. */
class ImportacaoAssistidaServiceTest {

    private ImportacaoSessaoRepository sessoes;
    private ImportacaoArquivoRepository arquivos;
    private ImportacaoApelidoConsultoriaRepository apelidos;
    private AlunoRepository alunos;
    private JsonMapper json;
    private ImportacaoAssistidaService service;

    private final UUID consultoriaId = UUID.randomUUID();
    private final UUID usuarioId = UUID.randomUUID();

    @AfterEach
    void tearDown() {
        TenantContext.clear();
        SecurityContextHolder.clearContext();
    }

    @BeforeEach
    void setup() {
        TenantContext.set(consultoriaId);
        comPermissoes("ALUNO_LER", "ALUNO_ALTERAR", "ALUNO_SENSIVEL_LER", "TREINO_LER", "DIETA_LER");
        sessoes = mock(ImportacaoSessaoRepository.class);
        arquivos = mock(ImportacaoArquivoRepository.class);
        apelidos = mock(ImportacaoApelidoConsultoriaRepository.class);
        alunos = mock(AlunoRepository.class);
        json = JsonMapper.builder().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false).build();

        ConfiguracaoIaImportacao config = new ConfiguracaoIaImportacao();
        config.setProvedor("regras");
        RoteadorInterpretadorIa roteador = new RoteadorInterpretadorIa(config, new InterpretadorGemini(config, json),
                new InterpretadorClaude(config, json), new InterpretadorPorRegras());
        service = new ImportacaoAssistidaService(sessoes, arquivos, apelidos, alunos, json, roteador,
                mock(br.com.treinos.api.receitas.ReceitaService.class));
    }

    private static void comPermissoes(String... codigos) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("u", null,
                Arrays.stream(codigos).map(c -> new SimpleGrantedAuthority("PERM_" + c)).toList()));
    }

    private ImportacaoSessao sessaoAberta() {
        ImportacaoSessao sessao = new ImportacaoSessao(usuarioId);
        ReflectionTestUtils.setField(sessao, "id", UUID.randomUUID());
        when(sessoes.findByIdAndConsultoriaId(sessao.getId(), consultoriaId)).thenReturn(Optional.of(sessao));
        when(sessoes.buscarParaAlterar(sessao.getId(), consultoriaId)).thenReturn(Optional.of(sessao));
        return sessao;
    }

    private Aluno aluno(String nome, String email) {
        Aluno a = new Aluno(nome, email, null, null, null);
        ReflectionTestUtils.setField(a, "id", UUID.randomUUID());
        return a;
    }

    private ImportacaoArquivo texto(ImportacaoSessao sessao, String nomeArquivo, String conteudo) {
        ImportacaoArquivo arq = new ImportacaoArquivo(sessao.getId(), nomeArquivo, "TEXTO_LIVRE", "hash",
                conteudo.length(), conteudo.getBytes(StandardCharsets.UTF_8));
        when(arquivos.findBySessaoIdOrderByCriadoEmAsc(sessao.getId())).thenReturn(List.of(arq));
        return arq;
    }

    @Test
    void processarGravaGrupoRetemOsBytesNaRevisaoENuncaVinculaSoPeloNome() {
        ImportacaoSessao sessao = sessaoAberta();
        ImportacaoArquivo arq = texto(sessao, "Treino_Felipe.txt", "Aluno: Felipe Santos\nTreino A - Peito\n1. Supino Reto 4x10\n");
        Aluno homonimo = aluno("Felipe Santos", null);
        when(alunos.findAll()).thenReturn(List.of(homonimo));

        SessaoDetalhe detalhe = service.processar(sessao.getId());

        assertThat(detalhe.grupos()).hasSize(1);
        GrupoImportavel g = detalhe.grupos().getFirst();
        assertThat(g.nomeDetectado()).isEqualTo("Felipe Santos");
        // Homônimo vira só candidato (o treinador escolhe); o destino continua sendo criar.
        assertThat(g.destino()).isEqualTo("CRIAR_ALUNO");
        assertThat(g.alunoExistenteId()).isNull();
        assertThat(g.candidatos()).hasSize(1);
        assertThat(g.candidatos().getFirst().motivo()).isEqualTo("NOME");
        assertThat(g.candidatos().getFirst().alunoId()).isEqualTo(homonimo.getId());
        // Os bytes ficam retidos durante a revisão e são limpos só quando a sessão conclui/expira/anonimiza.
        assertThat(arq.getConteudoBytes()).isNotNull();
        assertThat(arq.getEstado()).isEqualTo("PROCESSADO");
        assertThat(detalhe.estado()).isEqualTo("REVISANDO");
        assertThat(detalhe.modoProcessamento()).isNotNull();
        assertThat(detalhe.modoProcessamento().modoEfetivo()).isEqualTo("REGRAS");
        assertThat(detalhe.arquivos().getFirst().cobertura()).isNotNull();
        assertThat(detalhe.arquivos().getFirst().cobertura().status()).isEqualTo("COMPLETA");
        // O modo de cada arquivo vai nos metadados dele e volta no resumo.
        assertThat(detalhe.arquivos().getFirst().modo()).isEqualTo("REGRAS");
        assertThat(detalhe.arquivos().getFirst().motivoFallback()).isNull();
        assertThat(g.possivelMesmoAluno()).isFalse();
    }

    @Test
    void emailUnicoDoArquivoVinculaSoComUmAlunoAtivoComOMesmoEmail() {
        ImportacaoSessao sessao = sessaoAberta();
        texto(sessao, "ficha.txt", "Aluno: Bruna Lima\ncontato fulana@example.com\nTreino A\n1. Agachamento 3x10\n");
        Aluno dela = aluno("Bruna L.", "fulana@example.com");
        when(alunos.findAll()).thenReturn(List.of(dela));

        GrupoImportavel g = service.processar(sessao.getId()).grupos().getFirst();

        assertThat(g.destino()).isEqualTo("VINCULAR_EXISTENTE");
        assertThat(g.alunoExistenteId()).isEqualTo(dela.getId());
        assertThat(g.candidatos().getFirst().motivo()).isEqualTo("EMAIL");
    }

    @Test
    void doisEmailsNoArquivoNaoViramEmailDeNinguem() {
        ImportacaoSessao sessao = sessaoAberta();
        texto(sessao, "lote.txt", "Aluno: Caio Reis\na@example.com e b@example.com\nTreino A\n1. Remada 3x10\n");
        when(alunos.findAll()).thenReturn(List.of());

        GrupoImportavel g = service.processar(sessao.getId()).grupos().getFirst();

        assertThat(g.cadastro().email()).isNull();
    }

    @Test
    void arquivoCompactadoDemaisViraErroComCodigoFixoEApagaOsBytes() throws Exception {
        ImportacaoSessao sessao = sessaoAberta();
        ByteArrayOutputStream saida = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(saida)) {
            zip.putNextEntry(new ZipEntry("word/document.xml"));
            byte[] bloco = new byte[1024 * 1024];
            Arrays.fill(bloco, (byte) 'a');
            for (int i = 0; i < ExtratorDocx.XML_MAXIMO / bloco.length + 2; i++) {
                zip.write(bloco);
            }
            zip.closeEntry();
        }
        ImportacaoArquivo arq = new ImportacaoArquivo(sessao.getId(), "bomba.docx", "DOCX", "hash", saida.size(), saida.toByteArray());
        when(arquivos.findBySessaoIdOrderByCriadoEmAsc(sessao.getId())).thenReturn(List.of(arq));

        SessaoDetalhe detalhe = service.processar(sessao.getId());

        assertThat(arq.getEstado()).isEqualTo("ERRO");
        assertThat(arq.getErroCodigo()).isEqualTo("DOCX_COMPACTADO_DEMAIS");
        assertThat(arq.getConteudoBytes()).isNull();
        assertThat(detalhe.grupos()).isEmpty();
    }

    @Test
    void responderDuvidaComSalvarNoDicionarioGravaApelido() {
        ImportacaoSessao sessao = sessaoAberta();
        String duvidasJson = """
                [{"id":"duvida-1","tipo":"EXERCICIO_NAO_RECONHECIDO","termoOriginal":"puxada frent",
                "trechoOriginal":"puxada frent 4x10","arquivoOrigem":"treino.pdf","ocorrencias":1,
                "sugestoes":[],"resolvida":false,"respostaEscolhida":null}]
                """;
        String gruposJson = """
                [{"id":"grupo-1","identificadorOrigem":"treino.pdf","nomeDetectado":"Aluno Teste",
                "destino":"CRIAR_ALUNO","alunoExistenteId":null,"arquivosOrigem":[],"cadastro":null,
                "pesos":[],"treino":{"objetivo":"Treino A","orientacoes":null,"sessoes":[{"nome":"Costas",
                "diaSemana":1,"observacao":null,"exercicios":[{"exercicioId":null,"nome":"puxada frent",
                "modalidade":"MAQUINA","videoUrl":null,"observacao":null,"series":[]}]}],
                "metodologia":null},"dieta":null,"pendenciasIds":[],"estado":"PRONTO"}]
                """;
        sessao.atualizarResultados(gruposJson, duvidasJson, "{}");

        SessaoDetalhe detalhe = service.responderDuvida(sessao.getId(),
                new RespostaDuvidaRequisicao("duvida-1", "Puxada frontal pronada", true, "EXERCICIO", "puxada frent", null));

        assertThat(detalhe.duvidas().getFirst().resolvida()).isTrue();
        assertThat(detalhe.grupos().getFirst().treino().sessoes().getFirst().exercicios().getFirst().nome())
                .isEqualTo("Puxada frontal pronada");
        verify(apelidos).save(any(ImportacaoApelidoConsultoria.class));
    }

    @Test
    void duvidaSemTermoDeQualquerInterpretadorNaoEntraNaSessaoENemNaContagem() {
        ImportacaoSessao sessao = sessaoAberta();
        sessao.atualizarEstado("PROCESSANDO");
        ImportacaoArquivo arq = texto(sessao, "a.txt", "x");
        ReflectionTestUtils.setField(arq, "id", UUID.randomUUID());
        var duvidas = List.of(
                new ResultadoInterpretacao.PropostaDuvida("EXERCICIO_NAO_RECONHECIDO", "", "3x10", "a.txt", List.of()),
                new ResultadoInterpretacao.PropostaDuvida("EXERCICIO_NAO_RECONHECIDO", "**", "3x10", "a.txt", List.of()),
                new ResultadoInterpretacao.PropostaDuvida("EXERCICIO_NAO_RECONHECIDO", "—", "3x10", "a.txt", List.of()),
                new ResultadoInterpretacao.PropostaDuvida("EXERCICIO_NAO_RECONHECIDO", "Puxada frent", null, "a.txt", List.of()),
                new ResultadoInterpretacao.PropostaDuvida("EXERCICIO_NAO_RECONHECIDO", "Rosca 21", "3x10", "a.txt", List.of()));
        var execucao = new RoteadorInterpretadorIa.ExecucaoInterpretacao(new ResultadoInterpretacao(List.of(), duvidas), "REGRAS",
                "regras", false, null);
        var item = new ImportacaoAssistidaService.ResultadoArquivoProcessado(arq.getId(), true, "{}", null, execucao,
                new RedatorLgpdImportacao.RedacaoResultado("", List.of(), List.of(), List.of(), List.of()));

        service.concluirProcessamentoEmTransacao(sessao.getId(), new ImportacaoAssistidaService.ResultadoProcessamentoLote(List.of(item), List.of()));

        var gravadas = SessaoJson.duvidas(json, sessao);
        assertThat(gravadas).extracting(ImportacaoAssistidaDtos.DuvidaImportacao::termoOriginal).containsExactly("Puxada frent", "Rosca 21");
        assertThat(gravadas.getFirst().trechoOriginal()).isEmpty(); // trecho ausente com termo válido: a tela esconde
        assertThat(gravadas).noneMatch(ImportacaoAssistidaDtos.DuvidaImportacao::resolvida);
    }

    @Test
    void sessaoDeOutraConsultoriaDa404() {
        UUID id = UUID.randomUUID();
        when(sessoes.findByIdAndConsultoriaId(id, consultoriaId)).thenReturn(Optional.empty());
        when(sessoes.buscarParaAlterar(id, consultoriaId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.obterSessao(id)).isInstanceOf(NaoEncontradoException.class);
        assertThatThrownBy(() -> service.processar(id)).isInstanceOf(NaoEncontradoException.class);
    }

    @Test
    void vincularAlunoDeOutraConsultoriaDa404() {
        ImportacaoSessao sessao = sessaoAberta();
        sessao.atualizarResultados(grupoPronto("grupo-1"), null, null);
        UUID deOutra = UUID.randomUUID();
        when(alunos.findById(deOutra)).thenReturn(Optional.empty()); // o @TenantId esconde a linha

        assertThatThrownBy(() -> service.atualizarGrupo(sessao.getId(), "grupo-1",
                new AtualizarGrupoRequisicao("VINCULAR_EXISTENTE", deOutra, null, null, null)))
                .isInstanceOf(NaoEncontradoException.class);
    }

    @Test
    void vincularAlunoInativoOuAnonimizadoDa409() {
        ImportacaoSessao sessao = sessaoAberta();
        sessao.atualizarResultados(grupoPronto("grupo-1"), null, null);
        Aluno inativo = aluno("Inativo Teste", null);
        inativo.alterarSituacao(false, Instant.now());
        when(alunos.findById(inativo.getId())).thenReturn(Optional.of(inativo));
        Aluno anonimo = aluno("Anonimo Teste", null);
        ReflectionTestUtils.setField(anonimo, "anonimizadoEm", Instant.now());
        when(alunos.findById(anonimo.getId())).thenReturn(Optional.of(anonimo));

        assertThatThrownBy(() -> service.atualizarGrupo(sessao.getId(), "grupo-1",
                new AtualizarGrupoRequisicao("VINCULAR_EXISTENTE", inativo.getId(), null, null, null)))
                .isInstanceOf(ConflictException.class).hasMessageContaining("inativo");
        assertThatThrownBy(() -> service.atualizarGrupo(sessao.getId(), "grupo-1",
                new AtualizarGrupoRequisicao("VINCULAR_EXISTENTE", anonimo.getId(), null, null, null)))
                .isInstanceOf(ConflictException.class).hasMessageContaining("anonimizado");
    }

    @Test
    void destinoInvalidoEVincularSemAlunoSaoRecusados() {
        ImportacaoSessao sessao = sessaoAberta();
        sessao.atualizarResultados(grupoPronto("grupo-1"), null, null);

        assertThatThrownBy(() -> service.atualizarGrupo(sessao.getId(), "grupo-1", new AtualizarGrupoRequisicao("OUTRO", null, null, null, null)))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.atualizarGrupo(sessao.getId(), "grupo-1",
                new AtualizarGrupoRequisicao("VINCULAR_EXISTENTE", null, null, null, null))).isInstanceOf(BadRequestException.class);
    }

    @Test
    void leituraOmiteOSensivelSemPermissaoDeLerOSensivel() {
        ImportacaoSessao sessao = sessaoAberta();
        sessao.atualizarResultados("""
                [{"id":"grupo-1","identificadorOrigem":"a.txt","nomeDetectado":"Pessoa Teste","destino":"CRIAR_ALUNO",
                "arquivosOrigem":[],"cadastro":{"nome":"Pessoa Teste","email":null,"telefone":null,
                "objetivo":"Objetivo sentinela","observacoes":"Observacao sentinela","ativo":true},
                "pesos":[{"data":"2026-03-12","kg":70.5,"observacao":null}],"treino":null,"dieta":null,
                "pendenciasIds":[],"estado":"PRONTO"}]
                """, null, null);

        GrupoImportavel com = service.obterSessao(sessao.getId()).grupos().getFirst();
        assertThat(com.pesos()).hasSize(1);
        assertThat(com.cadastro().objetivo()).isEqualTo("Objetivo sentinela");

        comPermissoes("ALUNO_LER");
        GrupoImportavel sem = service.obterSessao(sessao.getId()).grupos().getFirst();
        assertThat(sem.pesos()).isEmpty();
        assertThat(sem.cadastro().objetivo()).isNull();
        assertThat(sem.cadastro().observacoes()).isNull();
        assertThat(sem.cadastro().nome()).isEqualTo("Pessoa Teste");
    }

    @Test
    void arquivoComExtensaoEConteudoQueNaoBatemSaoRecusados() {
        ImportacaoSessao sessao = sessaoAberta();
        byte[] naoEPdf = "nao sou pdf".getBytes(StandardCharsets.UTF_8);

        assertThatThrownBy(() -> service.adicionarArquivo(sessao.getId(),
                new MockMultipartFile("arquivo", "falso.pdf", "application/pdf", naoEPdf)))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("não corresponde");
        assertThatThrownBy(() -> service.adicionarArquivo(sessao.getId(),
                new MockMultipartFile("arquivo", "programa.exe", "application/octet-stream", naoEPdf)))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("não suportado");
        // Texto com extensão csv que na verdade é PDF também não passa.
        assertThatThrownBy(() -> service.adicionarArquivo(sessao.getId(),
                new MockMultipartFile("arquivo", "planilha.csv", "text/csv", "%PDF-1.4 fim".getBytes(StandardCharsets.UTF_8))))
                .isInstanceOf(BadRequestException.class);
        verify(arquivos, never()).save(any());
    }

    @Test
    void tetosDeArquivosEDeVolumePorSessao() {
        ImportacaoSessao sessao = sessaoAberta();
        byte[] texto = "Aluno: Teste Um".getBytes(StandardCharsets.UTF_8);
        MockMultipartFile arquivo = new MockMultipartFile("arquivo", "a.txt", "text/plain", texto);

        when(arquivos.countBySessaoId(sessao.getId())).thenReturn((long) ImportacaoAssistidaService.ARQUIVOS_POR_SESSAO);
        assertThatThrownBy(() -> service.adicionarArquivo(sessao.getId(), arquivo))
                .isInstanceOf(ConflictException.class).hasMessageContaining("arquivos demais");

        when(arquivos.countBySessaoId(sessao.getId())).thenReturn(1L);
        when(arquivos.somaDeBytes(sessao.getId())).thenReturn(ImportacaoAssistidaService.BYTES_POR_SESSAO);
        assertThatThrownBy(() -> service.adicionarArquivo(sessao.getId(), arquivo))
                .isInstanceOf(ConflictException.class).hasMessageContaining("volume");

        assertThatThrownBy(() -> service.adicionarTexto(sessao.getId(), "x".repeat(121), "texto"))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void criarSessaoAcimaDoTetoDeAbertasDa409EContaSoAsNaoConcluidas() {
        when(sessoes.countByCriadoPorAndEstadoNotAndExpiraEmAfter(any(), any(), any())).thenReturn(
                (long) ImportacaoAssistidaService.SESSOES_ABERTAS_POR_USUARIO);
        assertThatThrownBy(() -> service.criarSessao(usuarioId)).isInstanceOf(ConflictException.class);
        verify(sessoes).countByCriadoPorAndEstadoNotAndExpiraEmAfter(any(), org.mockito.ArgumentMatchers.eq("CONCLUIDA"), any());
    }

    @Test
    void sessaoVencidaDevolveEstadoEfetivoExpirada() {
        ImportacaoSessao sessao = sessaoAberta();
        ReflectionTestUtils.setField(sessao, "expiraEm", Instant.now().minusSeconds(60));
        when(sessoes.findTop20ByConsultoriaIdOrderByCriadoEmDesc(consultoriaId)).thenReturn(List.of(sessao));

        assertThat(service.obterSessao(sessao.getId()).estado()).isEqualTo("EXPIRADA");
        assertThat(service.listarSessoes().getFirst().estado()).isEqualTo("EXPIRADA");
    }

    @Test
    void revogarComRevisaoDesatualizadaDa409EManterSessaoIntacta() {
        ImportacaoSessao sessao = sessaoAberta();
        String respostasJson = """
                [{"decisaoId":"dec-1","duvidaId":"duvida-1","ocorrenciaIds":[],"tipo":"EXERCICIO_NAO_RECONHECIDO",
                "valorExtraido":"puxada","valorAplicado":"Puxada frontal","referenciaId":null,"ativa":true}]
                """;
        sessao.aplicarRespostas(respostasJson, grupoPronto("grupo-1"), "[]");

        assertThatThrownBy(() -> service.revogarDecisao(sessao.getId(), "dec-1", sessao.getRevisao() - 1L))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("mudou");
    }

    @Test
    void sessaoEmProcessamentoRecusaAlteracoes() {
        ImportacaoSessao sessao = sessaoAberta();
        sessao.atualizarEstado("PROCESSANDO");

        assertThatThrownBy(() -> service.adicionarTexto(sessao.getId(), "Titulo", "Conteudo"))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("processada");
        assertThatThrownBy(() -> service.atualizarGrupo(sessao.getId(), "grupo-1",
                new AtualizarGrupoRequisicao("IGNORAR", null, null, null, null)))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("processada");
    }

    @Test
    void ergogenicosDaDietaSoSaemParaQuemTemErgogenicoLer() {
        var dieta = new br.com.treinos.api.dieta.ConteudoDieta(null, null, null, List.of(), List.of(), null, List.of(),
                List.of(new br.com.treinos.api.dieta.ConteudoDieta.Ergogenico(UUID.randomUUID(), "Item fictício", null, null,
                        null, null, null, null)));
        GrupoImportavel g = new GrupoImportavel("grupo-1", "a.txt", "Pessoa Teste", "CRIAR_ALUNO", null, List.of(), null,
                List.of(), null, dieta, List.of(), "PRONTO", null, List.of());

        assertThat(g.paraLeitura(true, true, true, true).dieta().ergogenicos()).hasSize(1);
        assertThat(g.paraLeitura(true, true, true, false).dieta().ergogenicos()).isNull();
        assertThat(g.paraLeitura(true, true, false, true).dieta()).isNull();
    }

    private static String grupoPronto(String id) {
        return """
                [{"id":"%s","identificadorOrigem":"a.txt","nomeDetectado":"Pessoa Teste","destino":"CRIAR_ALUNO",
                "arquivosOrigem":[],"cadastro":null,"pesos":[],"treino":null,"dieta":null,"pendenciasIds":[],
                "estado":"PRONTO"}]
                """.formatted(id);
    }

    @Test
    void planilhaXlsAntigaERecusadaComCodigoProprioEPedeParaSalvarComoXlsx() {
        ImportacaoSessao sessao = sessaoAberta();
        byte[] ole = {(byte) 0xD0, (byte) 0xCF, 0x11, (byte) 0xE0, (byte) 0xA1, (byte) 0xB1, 0x1A, (byte) 0xE1, 0, 0};

        for (String nome : List.of("planilha.xls", "renomeada.xlsx")) {
            assertThatThrownBy(() -> service.adicionarArquivo(sessao.getId(),
                    new MockMultipartFile("arquivo", nome, "application/vnd.ms-excel", ole)))
                    .isInstanceOfSatisfying(br.com.treinos.api.web.ValidacaoException.class, e -> {
                        assertThat(e.getCodigo()).isEqualTo("FORMATO_XLS_ANTIGO");
                        assertThat(e.getMessage()).isEqualTo("Salve como .xlsx no Excel e envie de novo.");
                    });
        }
        verify(arquivos, never()).save(any());
    }

    @Test
    void arquivosSaemNaOrdemEOProgressoSobeUmPorArquivoMesmoLendoEmParalelo() {
        ImportacaoSessao sessao = sessaoAberta();
        List<ImportacaoAssistidaService.ArquivoPendente> pendentes = new java.util.ArrayList<>();
        for (int i = 0; i < 7; i++) {
            String conteudo = "Aluno: Pessoa Teste " + i + "\nTreino A\n1. Supino Reto 4x10\n";
            pendentes.add(new ImportacaoAssistidaService.ArquivoPendente(UUID.randomUUID(), "t" + i + ".txt", "TEXTO_LIVRE",
                    conteudo.getBytes(StandardCharsets.UTF_8)));
        }
        var preparo = new ImportacaoAssistidaService.PreparoProcessamento(sessao.getId(), java.util.Map.of(), pendentes, List.of(), null, br.com.treinos.api.consultoria.ConfiguracaoConsultoria.padrao());
        java.util.concurrent.atomic.AtomicInteger lidos = new java.util.concurrent.atomic.AtomicInteger();

        var resultado = service.executarProcessamentoSemTransacao(preparo, lidos::incrementAndGet);

        assertThat(resultado.itens()).extracting(ImportacaoAssistidaService.ResultadoArquivoProcessado::arquivoId)
                .containsExactlyElementsOf(pendentes.stream().map(ImportacaoAssistidaService.ArquivoPendente::id).toList());
        assertThat(resultado.itens()).allMatch(ImportacaoAssistidaService.ResultadoArquivoProcessado::sucesso);
        assertThat(lidos).hasValue(7);
    }

    private static final String GRUPO_DE_EXERCICIOS = """
            [{"id":"grupo-1","identificadorOrigem":"treino.pdf","nomeDetectado":"Aluno Teste",
            "destino":"CRIAR_ALUNO","alunoExistenteId":null,"arquivosOrigem":[],"cadastro":null,
            "pesos":[],"treino":{"objetivo":"Treino A","orientacoes":null,"sessoes":[{"nome":"Costas",
            "diaSemana":1,"observacao":null,"exercicios":[
            {"exercicioId":null,"nome":"puxada frent","modalidade":"MAQUINA","videoUrl":null,"observacao":null,"series":[]},
            {"exercicioId":null,"nome":"remada","modalidade":"MAQUINA","videoUrl":null,"observacao":null,"series":[]},
            {"exercicioId":null,"nome":"rosca","modalidade":"MAQUINA","videoUrl":null,"observacao":null,"series":[]}]}],
            "metodologia":null},"dieta":null,"pendenciasIds":[],"estado":"PRONTO"}]
            """;

    @Test
    void aceitarSugestoesSoAplicaADuvidaComUmaUnicaSugestaoDaBibliotecaERepetirNaoFazNada() {
        ImportacaoSessao sessao = sessaoAberta();
        UUID biblioteca = UUID.randomUUID();
        String duvidas = """
                [{"id":"duvida-1","tipo":"EXERCICIO_NAO_RECONHECIDO","termoOriginal":"puxada frent","trechoOriginal":"",
                "arquivoOrigem":"treino.pdf","ocorrencias":1,"resolvida":false,"respostaEscolhida":null,
                "sugestoes":[{"termo":"Puxada frontal","referenciaId":"%s","origem":"BIBLIOTECA","nota":0.9}]},
                {"id":"duvida-2","tipo":"EXERCICIO_NAO_RECONHECIDO","termoOriginal":"remada","trechoOriginal":"",
                "arquivoOrigem":"treino.pdf","ocorrencias":1,"resolvida":false,"respostaEscolhida":null,
                "sugestoes":[{"termo":"Remada curvada","referenciaId":"%s","origem":"BIBLIOTECA","nota":0.8},
                             {"termo":"Remada baixa","referenciaId":"%s","origem":"BIBLIOTECA","nota":0.7}]},
                {"id":"duvida-3","tipo":"EXERCICIO_NAO_RECONHECIDO","termoOriginal":"rosca","trechoOriginal":"",
                "arquivoOrigem":"treino.pdf","ocorrencias":1,"resolvida":false,"respostaEscolhida":null,
                "sugestoes":[{"termo":"Rosca direta","referenciaId":null,"origem":"IA","nota":null}]}]
                """.formatted(biblioteca, UUID.randomUUID(), UUID.randomUUID());
        sessao.atualizarResultados(GRUPO_DE_EXERCICIOS, duvidas, "{}");
        long revisao = sessao.getRevisao();

        SessaoDetalhe detalhe = service.aceitarSugestoes(sessao.getId(), revisao);

        assertThat(detalhe.duvidas()).extracting(ImportacaoAssistidaDtos.DuvidaImportacao::resolvida)
                .containsExactly(true, false, false);
        assertThat(detalhe.duvidas().getFirst().respostaEscolhida()).isEqualTo("Puxada frontal");
        var nomes = detalhe.grupos().getFirst().treino().sessoes().getFirst().exercicios().stream()
                .map(br.com.treinos.api.treino.ConteudoTreino.ExercicioPlano::nome).toList();
        assertThat(nomes).containsExactly("Puxada frontal", "remada", "rosca");
        verify(apelidos, never()).save(any());

        // Repetir (com a revisão nova) não muda nada.
        long depois = sessao.getRevisao();
        service.aceitarSugestoes(sessao.getId(), depois);
        assertThat(sessao.getRevisao()).isEqualTo(depois);
        // Revisão antiga = outra pessoa mexeu: 409 e nada muda.
        assertThatThrownBy(() -> service.aceitarSugestoes(sessao.getId(), revisao))
                .isInstanceOf(ConflictException.class);
    }

    @Test
    void aceitarSugestoesIgnoraExercicioSemTreinoLer() {
        ImportacaoSessao sessao = sessaoAberta();
        String duvidas = """
                [{"id":"duvida-1","tipo":"EXERCICIO_NAO_RECONHECIDO","termoOriginal":"puxada frent","trechoOriginal":"",
                "arquivoOrigem":"treino.pdf","ocorrencias":1,"resolvida":false,"respostaEscolhida":null,
                "sugestoes":[{"termo":"Puxada frontal","referenciaId":"%s","origem":"BIBLIOTECA","nota":0.9}]}]
                """.formatted(UUID.randomUUID());
        sessao.atualizarResultados(GRUPO_DE_EXERCICIOS, duvidas, "{}");
        comPermissoes("ALUNO_LER", "ALUNO_ALTERAR", "ALUNO_SENSIVEL_LER", "DIETA_LER");

        service.aceitarSugestoes(sessao.getId(), sessao.getRevisao());

        assertThat(SessaoJson.duvidas(json, sessao)).noneMatch(ImportacaoAssistidaDtos.DuvidaImportacao::resolvida);
    }

    // ------------------------------------------------------------------------------------------------ leva 4

    private ImportacaoArquivo arquivoComId(ImportacaoSessao sessao, String nome) {
        ImportacaoArquivo arq = new ImportacaoArquivo(sessao.getId(), nome, "TEXTO_LIVRE", "hash", 1, new byte[] {1});
        ReflectionTestUtils.setField(arq, "id", UUID.randomUUID());
        return arq;
    }

    private static br.com.treinos.api.treino.ConteudoTreino treino(String exercicio, UUID uid) {
        var ex = new br.com.treinos.api.treino.ConteudoTreino.ExercicioPlano(uid, null, exercicio,
                "MAQUINA", null, null, null, null, List.of(), null, null,
                null, null, null);
        var sessao = new br.com.treinos.api.treino.ConteudoTreino.Sessao(UUID.randomUUID(), "Treino A", null, null, null,
                null, null, List.of(ex), null);
        return new br.com.treinos.api.treino.ConteudoTreino(null, null, List.of(sessao), null);
    }

    private ImportacaoAssistidaService.ResultadoArquivoProcessado lido(ImportacaoArquivo arq,
                                                                      List<ResultadoInterpretacao.PropostaGrupo> grupos,
                                                                      List<ResultadoInterpretacao.PropostaDuvida> duvidas) {
        var execucao = new RoteadorInterpretadorIa.ExecucaoInterpretacao(new ResultadoInterpretacao(grupos, duvidas),
                "REGRAS", "regras", false, null);
        return new ImportacaoAssistidaService.ResultadoArquivoProcessado(arq.getId(), true, "{}", null, execucao,
                new RedatorLgpdImportacao.RedacaoResultado("", List.of(), List.of(), List.of(), List.of()));
    }

    private static ResultadoInterpretacao.PropostaGrupo proposta(String nome, String email, br.com.treinos.api.treino.ConteudoTreino treino,
                                                                  ResultadoInterpretacao.PropostaPeso... pesos) {
        return new ResultadoInterpretacao.PropostaGrupo(null, nome, email, null, null, null, List.of(pesos), treino, null);
    }

    @Test
    void mesmoAlunoEmDoisArquivosSemConflitoViraUmGrupoComOsDoisArquivos() {
        ImportacaoSessao sessao = sessaoAberta();
        sessao.atualizarEstado("PROCESSANDO");
        ImportacaoArquivo a = arquivoComId(sessao, "treino.txt");
        ImportacaoArquivo b = arquivoComId(sessao, "pesos.txt");
        when(arquivos.findBySessaoIdOrderByCriadoEmAsc(sessao.getId())).thenReturn(List.of(a, b));
        var peso = new ResultadoInterpretacao.PropostaPeso(java.time.LocalDate.of(2026, 3, 12), new java.math.BigDecimal("80"), null);

        service.concluirProcessamentoEmTransacao(sessao.getId(), new ImportacaoAssistidaService.ResultadoProcessamentoLote(List.of(
                lido(a, List.of(proposta("Pessoa Ficticia", null, treino("Supino", UUID.randomUUID()))), List.of()),
                lido(b, List.of(proposta("PESSOA FICTÍCIA", "pessoa@example.com", null, peso, peso)), List.of())), List.of()));

        List<GrupoImportavel> grupos = SessaoJson.grupos(json, sessao);
        assertThat(grupos).hasSize(1);
        GrupoImportavel g = grupos.getFirst();
        assertThat(g.arquivosOrigem()).containsExactly("treino.txt", "pesos.txt");
        assertThat(g.treino()).isNotNull();
        assertThat(g.pesos()).hasSize(1); // o mesmo dia não repete
        assertThat(g.cadastro().email()).isEqualTo("pessoa@example.com");
        assertThat(g.nomeDetectado()).isEqualTo("Pessoa Ficticia");
    }

    @Test
    void mesmoNomeComConflitoFicaSeparadoComoPossivelMesmoAlunoEJuntarRecusaDoisTreinos() {
        ImportacaoSessao sessao = sessaoAberta();
        sessao.atualizarEstado("PROCESSANDO");
        ImportacaoArquivo a = arquivoComId(sessao, "a.txt");
        ImportacaoArquivo b = arquivoComId(sessao, "b.txt");
        ImportacaoArquivo c = arquivoComId(sessao, "c.txt");
        when(arquivos.findBySessaoIdOrderByCriadoEmAsc(sessao.getId())).thenReturn(List.of(a, b, c));

        service.concluirProcessamentoEmTransacao(sessao.getId(), new ImportacaoAssistidaService.ResultadoProcessamentoLote(List.of(
                lido(a, List.of(proposta("Pessoa Ficticia", "um@example.com", treino("Supino", UUID.randomUUID()))), List.of()),
                lido(b, List.of(proposta("Pessoa Ficticia", "um@example.com", treino("Remada", UUID.randomUUID()))), List.of()),
                lido(c, List.of(proposta("Pessoa Ficticia", "dois@example.com", null)), List.of())), List.of()));

        SessaoDetalhe detalhe = service.obterSessao(sessao.getId());
        assertThat(detalhe.grupos()).hasSize(3);
        GrupoImportavel primeiro = detalhe.grupos().getFirst();
        assertThat(primeiro.possivelMesmoAluno()).isTrue();
        assertThat(primeiro.possiveisParceiros()).extracting(ImportacaoAssistidaDtos.ParceiroDeGrupo::grupoId)
                .containsExactlyInAnyOrder(detalhe.grupos().get(1).id(), detalhe.grupos().get(2).id());

        assertThatThrownBy(() -> service.juntarGrupos(sessao.getId(), primeiro.id(), List.of(detalhe.grupos().get(1).id())))
                .isInstanceOfSatisfying(ConflictException.class,
                        e -> assertThat(e.getCodigo()).isEqualTo("GRUPOS_COM_DOIS_PLANOS"));
        assertThatThrownBy(() -> service.juntarGrupos(sessao.getId(), primeiro.id(), List.of(primeiro.id())))
                .isInstanceOf(BadRequestException.class);

        // E-mails diferentes não juntam sozinhos, mas o treinador junta: o e-mail do grupo do caminho prevalece.
        int revisao = sessao.getRevisao();
        String terceiro = detalhe.grupos().get(2).id();
        SessaoDetalhe junto = service.juntarGrupos(sessao.getId(), terceiro, List.of(detalhe.grupos().get(1).id()));
        assertThat(junto.grupos()).extracting(GrupoImportavel::id).containsExactly(primeiro.id(), terceiro);
        assertThat(junto.grupos().get(1).arquivosOrigem()).containsExactly("c.txt", "b.txt");
        assertThat(junto.grupos().get(1).cadastro().email()).isEqualTo("dois@example.com");
        assertThat(junto.grupos().get(1).treino()).isNotNull();
        assertThat(sessao.getRevisao()).isGreaterThan(revisao);

        // O número dos grupos novos não repete o de um grupo que já existe.
        ImportacaoArquivo d = arquivoComId(sessao, "d.txt");
        when(arquivos.findBySessaoIdOrderByCriadoEmAsc(sessao.getId())).thenReturn(List.of(a, b, c, d));
        sessao.atualizarEstado("PROCESSANDO");
        service.concluirProcessamentoEmTransacao(sessao.getId(), new ImportacaoAssistidaService.ResultadoProcessamentoLote(List.of(
                lido(d, List.of(proposta("Outra Pessoa", null, null)), List.of())), List.of()));
        assertThat(SessaoJson.grupos(json, sessao)).extracting(GrupoImportavel::id).doesNotHaveDuplicates();
    }

    @Test
    void grupoComTermoAbertoNasceComDuvidasEVoltaAProntoAoResponder() {
        ImportacaoSessao sessao = sessaoAberta();
        sessao.atualizarEstado("PROCESSANDO");
        ImportacaoArquivo a = arquivoComId(sessao, "a.txt");
        when(arquivos.findBySessaoIdOrderByCriadoEmAsc(sessao.getId())).thenReturn(List.of(a));
        UUID uid = UUID.randomUUID();
        var duvida = new ResultadoInterpretacao.PropostaDuvida("EXERCICIO_NAO_RECONHECIDO", "puxada frent", "", "a.txt",
                List.of(), List.of(uid.toString()));

        service.concluirProcessamentoEmTransacao(sessao.getId(), new ImportacaoAssistidaService.ResultadoProcessamentoLote(List.of(
                lido(a, List.of(proposta("Pessoa Ficticia", null, treino("puxada frent", uid))), List.of(duvida))), List.of()));

        assertThat(SessaoJson.grupos(json, sessao).getFirst().estado()).isEqualTo("COM_DUVIDAS");
        String duvidaId = SessaoJson.duvidas(json, sessao).getFirst().id();
        service.responderDuvida(sessao.getId(), new RespostaDuvidaRequisicao(duvidaId, "Puxada frontal", false,
                "EXERCICIO", "puxada frent", null));
        assertThat(SessaoJson.grupos(json, sessao).getFirst().estado()).isEqualTo("PRONTO");
    }

    @Test
    void emailETelefoneDoGrupoSeguemAsRegrasDoAceiteEEmBrancoApagam() {
        ImportacaoSessao sessao = sessaoAberta();
        sessao.atualizarResultados(grupoPronto("grupo-1"), null, null);

        assertThatThrownBy(() -> service.atualizarGrupo(sessao.getId(), "grupo-1",
                new AtualizarGrupoRequisicao(null, null, null, "sem-arroba", null)))
                .isInstanceOfSatisfying(BadRequestException.class, e -> {
                    assertThat(e.getCodigo()).isEqualTo("EMAIL_INVALIDO");
                    assertThat(e.getMessage()).doesNotContain("sem-arroba");
                });
        assertThatThrownBy(() -> service.atualizarGrupo(sessao.getId(), "grupo-1",
                new AtualizarGrupoRequisicao(null, null, null, null, "12")))
                .isInstanceOfSatisfying(BadRequestException.class, e -> assertThat(e.getCodigo()).isEqualTo("TELEFONE_INVALIDO"));

        GrupoImportavel g = service.atualizarGrupo(sessao.getId(), "grupo-1",
                new AtualizarGrupoRequisicao(null, null, null, " pessoa@example.com ", "11 98765-4321")).grupos().getFirst();
        assertThat(g.cadastro().email()).isEqualTo("pessoa@example.com");
        assertThat(g.cadastro().telefone()).isNotBlank();
        assertThat(g.nomeDetectado()).isEqualTo("Pessoa Teste");

        g = service.atualizarGrupo(sessao.getId(), "grupo-1",
                new AtualizarGrupoRequisicao(null, null, null, "", null)).grupos().getFirst();
        assertThat(g.cadastro().email()).isNull();
        assertThat(g.cadastro().telefone()).isNotBlank();
    }

    @Test
    void sessaoEmLeituraHaMaisDoQueOCorteViraErroEDeixaLerDeNovo() {
        ImportacaoSessao sessao = sessaoAberta();
        sessao.atualizarEstado("PROCESSANDO");
        SessaoJson.numeroNoProgresso(json, sessao, "aLer", 1);
        assertThat(SessaoJson.estadoEfetivo(json, sessao)).isEqualTo("PROCESSANDO"); // sem a marca de início

        SessaoJson.textoNoProgresso(json, sessao, "processandoDesde", Instant.now().minusSeconds(30).toString());
        assertThat(SessaoJson.estadoEfetivo(json, sessao)).isEqualTo("PROCESSANDO");

        long corte = ProcessamentoAssincronoImportacao.limiteDaSessaoEmSegundos(1) + SessaoJson.FOLGA_DA_LEITURA_PRESA_SEGUNDOS;
        SessaoJson.textoNoProgresso(json, sessao, "processandoDesde", Instant.now().minusSeconds(corte + 5).toString());
        assertThat(SessaoJson.estadoEfetivo(json, sessao)).isEqualTo("ERRO");
        // Fora do PROCESSANDO a marca velha não muda nada.
        sessao.atualizarEstado("REVISANDO");
        assertThat(SessaoJson.estadoEfetivo(json, sessao)).isEqualTo("REVISANDO");
    }

    @Test
    void oPrimeiroArquivoELidoSozinhoAntesDosOutros() {
        ImportacaoSessao sessao = sessaoAberta();
        java.util.concurrent.atomic.AtomicBoolean primeiroTerminou = new java.util.concurrent.atomic.AtomicBoolean();
        java.util.concurrent.atomic.AtomicBoolean outroAntes = new java.util.concurrent.atomic.AtomicBoolean();
        ConfiguracaoIaImportacao config = new ConfiguracaoIaImportacao();
        config.setProvedor("regras");
        RoteadorInterpretadorIa vigiado = new RoteadorInterpretadorIa(config, new InterpretadorGemini(config, json),
                new InterpretadorClaude(config, json), new InterpretadorPorRegras()) {
            @Override
            public ExecucaoInterpretacao interpretarComModo(br.com.treinos.api.importacao.assistida.ia.ContextoIa contexto,
                                                            UUID sessaoId) {
                if ("t0.txt".equals(contexto.nomeArquivo())) {
                    try {
                        Thread.sleep(150);
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                    }
                    primeiroTerminou.set(true);
                } else if (!primeiroTerminou.get()) {
                    outroAntes.set(true);
                }
                return super.interpretarComModo(contexto, sessaoId);
            }
        };
        ImportacaoAssistidaService comVigia = new ImportacaoAssistidaService(sessoes, arquivos, apelidos, alunos, json,
                vigiado, mock(br.com.treinos.api.receitas.ReceitaService.class));
        List<ImportacaoAssistidaService.ArquivoPendente> pendentes = new java.util.ArrayList<>();
        for (int i = 0; i < 4; i++) {
            pendentes.add(new ImportacaoAssistidaService.ArquivoPendente(UUID.randomUUID(), "t" + i + ".txt", "TEXTO_LIVRE",
                    ("Aluno: Pessoa Teste " + i + "\n").getBytes(StandardCharsets.UTF_8)));
        }
        var preparo = new ImportacaoAssistidaService.PreparoProcessamento(sessao.getId(), java.util.Map.of(), pendentes,
                List.of(), null, br.com.treinos.api.consultoria.ConfiguracaoConsultoria.padrao());

        var resultado = comVigia.executarProcessamentoSemTransacao(preparo, null);

        assertThat(outroAntes).isFalse();
        assertThat(resultado.itens()).hasSize(4).allMatch(ImportacaoAssistidaService.ResultadoArquivoProcessado::sucesso);
    }

    // ------------------------------------------------------------------------------------------------ lote B (D6, 1.9)

    private ImportacaoArquivo textoComId(ImportacaoSessao sessao, String nome, String conteudo) {
        ImportacaoArquivo arq = new ImportacaoArquivo(sessao.getId(), nome, "TEXTO_LIVRE", "hash", conteudo.length(),
                conteudo.getBytes(StandardCharsets.UTF_8));
        ReflectionTestUtils.setField(arq, "id", UUID.randomUUID());
        return arq;
    }

    /**
     * IA de mentira: um grupo por arquivo, com {@code nomeLido} (nulo = sem nome no documento, a origem sai do nome do
     * arquivo como no decodificador) e treino só no arquivo cujo texto diz "treino" (passa pela reconstrução do grupo).
     */
    private ImportacaoAssistidaService comIaDeMentira(String nomeLido) {
        ConfiguracaoIaImportacao config = new ConfiguracaoIaImportacao();
        config.setProvedor("claude");
        RoteadorInterpretadorIa ia = new RoteadorInterpretadorIa(config, new InterpretadorGemini(config, json),
                new InterpretadorClaude(config, json), new InterpretadorPorRegras()) {
            @Override
            public ExecucaoInterpretacao interpretarComModo(br.com.treinos.api.importacao.assistida.ia.ContextoIa c,
                                                            UUID sessaoId) {
                var origem = nomeLido != null ? ResultadoInterpretacao.OrigemDoNome.CONTEUDO
                        : ResultadoInterpretacao.OrigemDoNome.semNomeNoConteudo(c.nomeArquivo(), c.formato());
                var treino = c.textoParaProvedor().contains("treino") ? treino("Supino", UUID.randomUUID()) : null;
                var grupo = new ResultadoInterpretacao.PropostaGrupo(c.nomeArquivo(), nomeLido, null, null, null, null,
                        List.of(), treino, null, List.of(), origem);
                return new ExecucaoInterpretacao(new ResultadoInterpretacao(List.of(grupo), List.of()), "IA", "claude",
                        false, null);
            }
        };
        return new ImportacaoAssistidaService(sessoes, arquivos, apelidos, alunos, json, ia,
                mock(br.com.treinos.api.receitas.ReceitaService.class));
    }

    @Test
    void pelasRegrasDoisArquivosSemNomeNoTextoComOMesmoNomeDeArquivoFicamDoisGrupos() {
        ImportacaoSessao sessao = sessaoAberta();
        ImportacaoArquivo a = textoComId(sessao, "Joao Ficticio.txt", "Treino A\n1. Supino Reto 4x10\n");
        ImportacaoArquivo b = textoComId(sessao, "Joao Ficticio.txt", "Sem treino nem dieta aqui.\n");
        when(arquivos.findBySessaoIdOrderByCriadoEmAsc(sessao.getId())).thenReturn(List.of(a, b));
        when(alunos.findAll()).thenReturn(List.of());

        List<GrupoImportavel> grupos = service.processar(sessao.getId()).grupos();

        assertThat(grupos).hasSize(2).extracting(GrupoImportavel::nomeDetectado).containsOnly("Joao Ficticio");
        assertThat(grupos).extracting(GrupoImportavel::id).doesNotHaveDuplicates();
        // A origem sai na resposta (a tela avisa "Nome não encontrado no documento").
        assertThat(grupos).extracting(GrupoImportavel::origemDoNome)
                .containsOnly(ResultadoInterpretacao.OrigemDoNome.NOME_DO_ARQUIVO);
        assertThat(SessaoJson.grupos(json, sessao)).extracting(GrupoImportavel::origemDoNome)
                .containsOnly(ResultadoInterpretacao.OrigemDoNome.NOME_DO_ARQUIVO);
        // O processar síncrono também deixa a marca da leitura.
        assertThat(SessaoJson.marcaDaLeitura(json, sessao)).isNotNull();
    }

    @Test
    void pelasRegrasDoisTextosColadosComOTituloPadraoFicamDoisGruposComNomesDiferentes() {
        ImportacaoSessao sessao = sessaoAberta();
        ImportacaoArquivo a = textoComId(sessao, "Texto livre do WhatsApp", "Treino A\n1. Supino Reto 4x10\n");
        ImportacaoArquivo b = textoComId(sessao, "Texto livre do WhatsApp", "Sem treino nem dieta aqui.\n");
        when(arquivos.findBySessaoIdOrderByCriadoEmAsc(sessao.getId())).thenReturn(List.of(a, b));
        when(alunos.findAll()).thenReturn(List.of());

        List<GrupoImportavel> grupos = service.processar(sessao.getId()).grupos();

        assertThat(grupos).hasSize(2).extracting(GrupoImportavel::nomeDetectado).doesNotHaveDuplicates()
                .allMatch(n -> n.startsWith("Aluno "));
        assertThat(SessaoJson.grupos(json, sessao)).extracting(GrupoImportavel::origemDoNome)
                .containsOnly(ResultadoInterpretacao.OrigemDoNome.TITULO_DO_TEXTO);
    }

    @Test
    void pelaIaDoisArquivosSemNomeComOMesmoNomeDeArquivoFicamDoisGruposEONomeLidoNosDoisJunta() {
        when(alunos.findAll()).thenReturn(List.of());
        ImportacaoSessao sessao = sessaoAberta();
        ImportacaoArquivo a = textoComId(sessao, "Joao Ficticio.txt", "treino");
        ImportacaoArquivo b = textoComId(sessao, "Joao Ficticio.txt", "nada");
        when(arquivos.findBySessaoIdOrderByCriadoEmAsc(sessao.getId())).thenReturn(List.of(a, b));

        List<GrupoImportavel> grupos = comIaDeMentira(null).processar(sessao.getId()).grupos();

        assertThat(grupos).hasSize(2).extracting(GrupoImportavel::nomeDetectado).containsOnly("Joao Ficticio");
        assertThat(grupos.getFirst().treino()).isNotNull();
        // A reconstrução do grupo (tipos da metodologia) não perde a origem.
        assertThat(SessaoJson.grupos(json, sessao)).extracting(GrupoImportavel::origemDoNome)
                .containsOnly(ResultadoInterpretacao.OrigemDoNome.NOME_DO_ARQUIVO);

        ImportacaoSessao outra = sessaoAberta();
        ImportacaoArquivo c = textoComId(outra, "a.txt", "treino");
        ImportacaoArquivo d = textoComId(outra, "b.txt", "nada");
        when(arquivos.findBySessaoIdOrderByCriadoEmAsc(outra.getId())).thenReturn(List.of(c, d));

        List<GrupoImportavel> juntos = comIaDeMentira("Joao Ficticio").processar(outra.getId()).grupos();

        assertThat(juntos).singleElement().satisfies(g -> {
            assertThat(g.arquivosOrigem()).containsExactly("a.txt", "b.txt");
            assertThat(g.treino()).isNotNull();
        });
    }

    @Test
    void pelaIaDoisTextosColadosComOTituloPadraoFicamDoisGrupos() {
        when(alunos.findAll()).thenReturn(List.of());
        ImportacaoSessao sessao = sessaoAberta();
        ImportacaoArquivo a = textoComId(sessao, "Texto livre do WhatsApp", "treino");
        ImportacaoArquivo b = textoComId(sessao, "Texto livre do WhatsApp", "nada");
        when(arquivos.findBySessaoIdOrderByCriadoEmAsc(sessao.getId())).thenReturn(List.of(a, b));

        List<GrupoImportavel> grupos = comIaDeMentira(null).processar(sessao.getId()).grupos();

        assertThat(grupos).hasSize(2).extracting(GrupoImportavel::nomeDetectado).doesNotHaveDuplicates()
                .allMatch(n -> n.startsWith("Aluno "));
        assertThat(SessaoJson.grupos(json, sessao)).extracting(GrupoImportavel::origemDoNome)
                .containsOnly(ResultadoInterpretacao.OrigemDoNome.TITULO_DO_TEXTO);
    }

    private static GrupoImportavel parte(String id, String arquivo, String sessao, ResultadoInterpretacao.OrigemDoNome origem) {
        ConteudoTreino treino = new ConteudoTreino(null, null, List.of(new ConteudoTreino.Sessao(UUID.randomUUID(), sessao,
                null, null, null, null, null, List.of())));
        return new GrupoImportavel(id, arquivo, "Aluno " + id, "CRIAR_ALUNO", null, List.of(arquivo), null, List.of(),
                treino, null, List.of(), "PRONTO", null, List.of(), java.util.Map.of(), List.of(), origem);
    }

    @Test
    void partesDoMesmoArquivoSemNomeLidoSomamOsTreinosNaOrdemDaSessao() {
        ImportacaoSessao sessao = sessaoAberta();
        ImportacaoArquivo pdf = textoComId(sessao, "plano.pdf", "x");
        GrupoImportavel p1 = parte("grupo-1", "plano.pdf", "Treino A", ResultadoInterpretacao.OrigemDoNome.AUSENTE);
        GrupoImportavel p2 = parte("grupo-2", "plano.pdf", "Treino B", ResultadoInterpretacao.OrigemDoNome.DIGITADO);
        GrupoImportavel p3 = parte("grupo-3", "plano.pdf", "Treino C", ResultadoInterpretacao.OrigemDoNome.AUSENTE);
        sessao.atualizarEstado("REVISANDO");
        SessaoJson.gravarGrupos(json, sessao, List.of(p1, p2, p3));
        when(arquivos.findBySessaoIdOrderByCriadoEmAsc(sessao.getId())).thenReturn(List.of(pdf));
        when(alunos.findAll()).thenReturn(List.of());

        // O grupo do caminho é o do meio: as divisões seguem a ordem da sessão (A, B, C) e o nome digitado fica.
        SessaoDetalhe junto = service.juntarGrupos(sessao.getId(), "grupo-2", List.of("grupo-3", "grupo-1"));

        assertThat(junto.grupos()).singleElement().satisfies(g -> {
            assertThat(g.id()).isEqualTo("grupo-2");
            assertThat(g.treino().sessoes()).extracting(ConteudoTreino.Sessao::nome)
                    .containsExactly("Treino A", "Treino B", "Treino C");
            assertThat(g.origemDoNome()).isEqualTo(ResultadoInterpretacao.OrigemDoNome.DIGITADO);
            assertThat(g.arquivosOrigem()).containsExactly("plano.pdf");
        });

        // O grupo do caminho é o último: as duas de antes entram na frente, na ordem da sessão.
        ImportacaoSessao outra = sessaoAberta();
        outra.atualizarEstado("REVISANDO");
        SessaoJson.gravarGrupos(json, outra, List.of(p1, p2, p3));
        when(arquivos.findBySessaoIdOrderByCriadoEmAsc(outra.getId())).thenReturn(List.of(pdf));
        assertThat(service.juntarGrupos(outra.getId(), "grupo-3", List.of("grupo-1", "grupo-2")).grupos())
                .singleElement().satisfies(g -> {
                    assertThat(g.treino().sessoes()).extracting(ConteudoTreino.Sessao::nome)
                            .containsExactly("Treino A", "Treino B", "Treino C");
                    assertThat(g.nomeDetectado()).isEqualTo("Aluno grupo-2");
                });
    }

    @Test
    void partesSoComUmArquivoDaqueleNomeESemNomeLido() {
        ImportacaoSessao sessao = sessaoAberta();
        GrupoImportavel a = parte("grupo-1", "plano.pdf", "Treino A", ResultadoInterpretacao.OrigemDoNome.AUSENTE);
        GrupoImportavel b = parte("grupo-2", "plano.pdf", "Treino B", ResultadoInterpretacao.OrigemDoNome.NOME_DO_ARQUIVO);
        ImportacaoArquivo um = textoComId(sessao, "plano.pdf", "x");
        assertThat(ImportacaoAssistidaService.partesDoMesmoArquivo(List.of(a, b), List.of(um))).isTrue();
        // Dois arquivos com o mesmo nome podem ser alunos diferentes: não são partes.
        assertThat(ImportacaoAssistidaService.partesDoMesmoArquivo(List.of(a, b),
                List.of(um, textoComId(sessao, "plano.pdf", "y")))).isFalse();
        // Nome lido do documento: o servidor já separou por nome.
        assertThat(ImportacaoAssistidaService.partesDoMesmoArquivo(List.of(a,
                parte("grupo-3", "plano.pdf", "B", ResultadoInterpretacao.OrigemDoNome.CONTEUDO)), List.of(um))).isFalse();
        assertThat(ImportacaoAssistidaService.partesDoMesmoArquivo(List.of(a,
                parte("grupo-4", "outro.pdf", "B", ResultadoInterpretacao.OrigemDoNome.AUSENTE)), List.of(um))).isFalse();

        // Fora das partes, dois treinos seguem recusados.
        sessao.atualizarEstado("REVISANDO");
        SessaoJson.gravarGrupos(json, sessao, List.of(a, b));
        when(arquivos.findBySessaoIdOrderByCriadoEmAsc(sessao.getId()))
                .thenReturn(List.of(um, textoComId(sessao, "plano.pdf", "y")));
        assertThatThrownBy(() -> service.juntarGrupos(sessao.getId(), "grupo-1", List.of("grupo-2")))
                .hasMessageContaining("Os dois têm treino");
    }

    @Test
    void aOrigemDoNomeVaiEVoltaPeloJsonDaSessaoComOMapperPadrao() {
        JsonMapper padrao = JsonMapper.builder().build();
        GrupoImportavel g = new GrupoImportavel("grupo-1", "a.txt", "Pessoa Teste", "CRIAR_ALUNO", null, List.of(), null,
                List.of(), null, null, List.of(), "PRONTO", null, List.of(), java.util.Map.of(), List.of(),
                ResultadoInterpretacao.OrigemDoNome.CONTEUDO);

        String gravado = padrao.writeValueAsString(List.of(g));
        List<GrupoImportavel> lidos = padrao.readValue(gravado,
                new tools.jackson.core.type.TypeReference<List<GrupoImportavel>>() { });

        assertThat(gravado).contains("\"origemDoNome\":\"CONTEUDO\"").doesNotContain("nomeLidoDoConteudo");
        assertThat(lidos).singleElement().satisfies(l -> assertThat(l.nomeLidoDoConteudo()).isTrue());
        assertThat(padrao.writeValueAsString(g.paraLeitura(false, false, false, false)))
                .contains("\"origemDoNome\":\"CONTEUDO\"");
    }

    @Test
    void nomeLidoNaoJuntaComGrupoDeLeituraAnteriorQueSoTinhaONomeDoArquivo() {
        ImportacaoSessao sessao = sessaoAberta();
        sessao.atualizarEstado("PROCESSANDO");
        ImportacaoArquivo a = arquivoComId(sessao, "Joao Ficticio.pdf");
        when(arquivos.findBySessaoIdOrderByCriadoEmAsc(sessao.getId())).thenReturn(List.of(a));
        var semNome = new ResultadoInterpretacao.PropostaGrupo("Joao Ficticio.pdf", null, null, null, null, null,
                List.of(), treino("Supino", UUID.randomUUID()), null, List.of(),
                ResultadoInterpretacao.OrigemDoNome.NOME_DO_ARQUIVO);
        service.concluirProcessamentoEmTransacao(sessao.getId(), new ImportacaoAssistidaService.ResultadoProcessamentoLote(
                List.of(lido(a, List.of(semNome), List.of())), List.of()));
        assertThat(SessaoJson.grupos(json, sessao)).singleElement()
                .satisfies(g -> assertThat(g.nomeDetectado()).isEqualTo("Joao Ficticio"));

        // Arquivo novo, lido depois, com o mesmo nome escrito no documento e sem conflito: continua separado.
        ImportacaoArquivo b = arquivoComId(sessao, "pesos.txt");
        when(arquivos.findBySessaoIdOrderByCriadoEmAsc(sessao.getId())).thenReturn(List.of(a, b));
        sessao.atualizarEstado("PROCESSANDO");
        service.concluirProcessamentoEmTransacao(sessao.getId(), new ImportacaoAssistidaService.ResultadoProcessamentoLote(
                List.of(lido(b, List.of(proposta("Joao Ficticio", null, null)), List.of())), List.of()));

        assertThat(SessaoJson.grupos(json, sessao)).hasSize(2);
    }

    @Test
    void arquivoQueNaoEstaMaisRecebidoEPuladoEOProgressoGuardaOsAlunosCriados() {
        ImportacaoSessao sessao = sessaoAberta();
        sessao.atualizarEstado("PROCESSANDO");
        UUID criado = UUID.randomUUID();
        SessaoJson.registrarAlunoCriado(json, sessao, criado);
        ImportacaoArquivo jaLido = arquivoComId(sessao, "a.txt");
        jaLido.marcarProcessado("{}");
        ImportacaoArquivo novo = arquivoComId(sessao, "b.txt");
        when(arquivos.findBySessaoIdOrderByCriadoEmAsc(sessao.getId())).thenReturn(List.of(jaLido, novo));

        service.concluirProcessamentoEmTransacao(sessao.getId(), new ImportacaoAssistidaService.ResultadoProcessamentoLote(
                List.of(lido(jaLido, List.of(proposta("Pessoa Um", null, null)), List.of()),
                        lido(novo, List.of(proposta("Pessoa Dois", null, null)), List.of())), List.of()));

        assertThat(SessaoJson.grupos(json, sessao)).extracting(GrupoImportavel::nomeDetectado).containsExactly("Pessoa Dois");
        assertThat(SessaoJson.alunosCriados(json, sessao)).containsExactly(criado);
    }

    @Test
    void sessaoNaFilaApareceAguardandoAteALeituraComecar() {
        ImportacaoSessao sessao = sessaoAberta();
        SessaoJson.marcarNovaLeitura(json, sessao, UUID.randomUUID(), 3);
        sessao.atualizarEstado("PROCESSANDO");
        assertThat(service.obterSessao(sessao.getId()).leitura().aguardando()).isTrue();

        SessaoJson.leituraComecou(json, sessao);

        assertThat(service.obterSessao(sessao.getId()).leitura().aguardando()).isFalse();
    }
}
