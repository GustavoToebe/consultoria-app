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
        service = new ImportacaoAssistidaService(sessoes, arquivos, apelidos, alunos, json, roteador);
    }

    private static void comPermissoes(String... codigos) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("u", null,
                Arrays.stream(codigos).map(c -> new SimpleGrantedAuthority("PERM_" + c)).toList()));
    }

    private ImportacaoSessao sessaoAberta() {
        ImportacaoSessao sessao = new ImportacaoSessao(usuarioId, "CADASTROS_E_PLANOS_ATUAIS");
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
    void processarGravaGrupoApagaOsBytesENuncaVinculaSoPeloNome() {
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
        // O conteúdo do arquivo não fica depois de processado.
        assertThat(arq.getConteudoBytes()).isNull();
        assertThat(arq.getEstado()).isEqualTo("PROCESSADO");
        assertThat(detalhe.estado()).isEqualTo("REVISANDO");
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
                new AtualizarGrupoRequisicao("VINCULAR_EXISTENTE", deOutra, null)))
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
                new AtualizarGrupoRequisicao("VINCULAR_EXISTENTE", inativo.getId(), null)))
                .isInstanceOf(ConflictException.class).hasMessageContaining("inativo");
        assertThatThrownBy(() -> service.atualizarGrupo(sessao.getId(), "grupo-1",
                new AtualizarGrupoRequisicao("VINCULAR_EXISTENTE", anonimo.getId(), null)))
                .isInstanceOf(ConflictException.class).hasMessageContaining("anonimizado");
    }

    @Test
    void destinoInvalidoEVincularSemAlunoSaoRecusados() {
        ImportacaoSessao sessao = sessaoAberta();
        sessao.atualizarResultados(grupoPronto("grupo-1"), null, null);

        assertThatThrownBy(() -> service.atualizarGrupo(sessao.getId(), "grupo-1", new AtualizarGrupoRequisicao("OUTRO", null, null)))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.atualizarGrupo(sessao.getId(), "grupo-1",
                new AtualizarGrupoRequisicao("VINCULAR_EXISTENTE", null, null))).isInstanceOf(BadRequestException.class);
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
    void criarSessaoRecusaObjetivoLongoOuForaDoPadraoEAcimaDoTeto() {
        assertThatThrownBy(() -> service.criarSessao(usuarioId, "x".repeat(41))).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.criarSessao(usuarioId, "minusculo com espaco")).isInstanceOf(BadRequestException.class);
        when(sessoes.countByCriadoPorAndExpiraEmAfter(any(), any())).thenReturn(
                (long) ImportacaoAssistidaService.SESSOES_ABERTAS_POR_USUARIO);
        assertThatThrownBy(() -> service.criarSessao(usuarioId, null)).isInstanceOf(ConflictException.class);
    }

    private static String grupoPronto(String id) {
        return """
                [{"id":"%s","identificadorOrigem":"a.txt","nomeDetectado":"Pessoa Teste","destino":"CRIAR_ALUNO",
                "arquivosOrigem":[],"cadastro":null,"pesos":[],"treino":null,"dieta":null,"pendenciasIds":[],
                "estado":"PRONTO"}]
                """.formatted(id);
    }
}
