package br.com.treinos.api.importacao.assistida;

import br.com.treinos.api.alunos.Aluno;
import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.alunos.LimiteDoTreinador;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.biblioteca.AlimentoRepository;
import br.com.treinos.api.biblioteca.ExercicioRepository;
import br.com.treinos.api.conta.PlanoDaConsultoria;
import br.com.treinos.api.dieta.PlanoDietaRepository;
import br.com.treinos.api.execucao.RegistroPesoRepository;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.ConfirmacaoResultado;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.ConfirmarSessaoRequisicao;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.RespostaDuvidaRequisicao;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.SessaoDetalhe;
import br.com.treinos.api.importacao.assistida.ia.ConfiguracaoIaImportacao;
import br.com.treinos.api.importacao.assistida.ia.InterpretadorClaude;
import br.com.treinos.api.importacao.assistida.ia.InterpretadorGemini;
import br.com.treinos.api.importacao.assistida.ia.InterpretadorPorRegras;
import br.com.treinos.api.importacao.assistida.ia.RoteadorInterpretadorIa;
import br.com.treinos.api.pastas.PastaRepository;
import br.com.treinos.api.security.UsuarioAutenticado;
import br.com.treinos.api.tenant.TenantContext;
import br.com.treinos.api.treino.PlanoTreinoRepository;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.json.JsonMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ImportacaoAssistidaServiceTest {

    private ImportacaoSessaoRepository sessoes;
    private ImportacaoArquivoRepository arquivos;
    private ImportacaoApelidoConsultoriaRepository apelidos;
    private AlunoRepository alunos;
    private RegistroPesoRepository pesos;
    private PlanoTreinoRepository treinos;
    private PlanoDietaRepository dietas;
    private PastaRepository pastas;
    private PlanoDaConsultoria plano;
    private LimiteDoTreinador limiteDoTreinador;
    private Auditoria auditoria;
    private JsonMapper json;
    private ImportacaoAssistidaService service;

    private final UUID consultoriaId = UUID.randomUUID();
    private final UUID usuarioId = UUID.randomUUID();

    @BeforeEach
    void setup() {
        TenantContext.set(consultoriaId);
        sessoes = mock(ImportacaoSessaoRepository.class);
        arquivos = mock(ImportacaoArquivoRepository.class);
        apelidos = mock(ImportacaoApelidoConsultoriaRepository.class);
        alunos = mock(AlunoRepository.class);
        pesos = mock(RegistroPesoRepository.class);
        treinos = mock(PlanoTreinoRepository.class);
        dietas = mock(PlanoDietaRepository.class);
        pastas = mock(PastaRepository.class);
        plano = mock(PlanoDaConsultoria.class);
        limiteDoTreinador = mock(LimiteDoTreinador.class);
        auditoria = mock(Auditoria.class);
        json = JsonMapper.builder()
                .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false)
                .build();

        ConfiguracaoIaImportacao config = new ConfiguracaoIaImportacao();
        config.setProvedor("regras");
        InterpretadorPorRegras regras = new InterpretadorPorRegras();
        InterpretadorGemini gemini = new InterpretadorGemini(config, json);
        InterpretadorClaude claude = new InterpretadorClaude(config, json);
        RoteadorInterpretadorIa roteador = new RoteadorInterpretadorIa(config, gemini, claude, regras);

        service = new ImportacaoAssistidaService(sessoes, arquivos, apelidos, alunos, pesos, treinos, dietas,
                pastas, plano, limiteDoTreinador, auditoria, json, roteador);
    }

    @Test
    void fluxoCompletoDeSessaoProcessamentoEResolucaoDeDuvidas() {
        ImportacaoSessao sessao = new ImportacaoSessao(usuarioId, "CADASTROS_E_PLANOS_ATUAIS");
        when(sessoes.findByIdAndConsultoriaId(sessao.getId(), consultoriaId)).thenReturn(Optional.of(sessao));
        when(sessoes.save(any())).thenReturn(sessao);

        String texto = """
                Aluno: Felipe Santos
                Treino A - Peito
                1. Supino Reto 4x10
                """;
        ImportacaoArquivo arq = new ImportacaoArquivo(sessao.getId(), "Treino_Felipe.txt", "TEXTO_LIVRE",
                "hash", texto.length(), texto.getBytes(StandardCharsets.UTF_8));
        when(arquivos.findBySessaoIdOrderByCriadoEmAsc(sessao.getId())).thenReturn(List.of(arq));

        // 1. Processar
        SessaoDetalhe detalhe = service.processar(sessao.getId());
        assertThat(detalhe.grupos()).hasSize(1);
        assertThat(detalhe.grupos().getFirst().nomeDetectado()).isEqualTo("Felipe Santos");

        // 2. Confirmar rascunho
        UsuarioAutenticado eu = new UsuarioAutenticado(usuarioId, consultoriaId, "TREINADOR", null);
        ConfirmacaoResultado conf = service.confirmar(sessao.getId(), eu, new ConfirmarSessaoRequisicao(List.of(), 0));

        assertThat(conf.situacao()).isEqualTo("CONCLUIDA");
        assertThat(conf.gruposImportados()).isEqualTo(1);
        assertThat(conf.alunosCriados()).isEqualTo(1);
        assertThat(conf.treinosCriados()).isEqualTo(1);

        verify(auditoria).registrarEvento(Mockito.eq("IMPORTACAO_ASSISTIDA_CONCLUIDA"), Mockito.eq("IMPORTACAO"),
                Mockito.eq(sessao.getId()), any());
    }

    @Test
    void responderDuvidaComSalvarNoDicionarioGravaApelido() {
        ImportacaoSessao sessao = new ImportacaoSessao(usuarioId, "CADASTROS_E_PLANOS_ATUAIS");
        when(sessoes.findByIdAndConsultoriaId(sessao.getId(), consultoriaId)).thenReturn(Optional.of(sessao));

        // Configura uma dúvida na sessão
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

        RespostaDuvidaRequisicao req = new RespostaDuvidaRequisicao("duvida-1", "Puxada frontal pronada",
                true, "EXERCICIO", "puxada frent", null);

        SessaoDetalhe detalhe = service.responderDuvida(sessao.getId(), req);

        assertThat(detalhe.duvidas().getFirst().resolvida()).isTrue();
        assertThat(detalhe.duvidas().getFirst().respostaEscolhida()).isEqualTo("Puxada frontal pronada");
        // Verifica que o treino foi atualizado
        assertThat(detalhe.grupos().getFirst().treino().sessoes().getFirst().exercicios().getFirst().nome())
                .isEqualTo("Puxada frontal pronada");

        // Verifica gravação no dicionário de apelidos
        verify(apelidos).save(any(ImportacaoApelidoConsultoria.class));
    }
}
