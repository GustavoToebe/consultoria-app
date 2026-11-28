package br.com.treinos.api.importacao.assistida;

import br.com.treinos.api.auth.UsuarioRepository;
import br.com.treinos.api.equipe.PermissoesDoUsuario;
import br.com.treinos.api.importacao.assistida.ia.RoteadorInterpretadorIa;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;
import tools.jackson.databind.json.JsonMapper;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.same;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Corte da sessão, leitura velha × nova e fila por consultoria. */
class ProcessamentoAssincronoImportacaoTest {

    private final JsonMapper json = JsonMapper.builder().build();
    private final ImportacaoSessaoRepository sessoes = mock(ImportacaoSessaoRepository.class);
    private final ImportacaoAssistidaService service = mock(ImportacaoAssistidaService.class);
    private final ProcessamentoAssincronoImportacao processamento = new ProcessamentoAssincronoImportacao(sessoes,
            mock(ImportacaoArquivoRepository.class), mock(UsuarioRepository.class), mock(PermissoesDoUsuario.class),
            service, json, mock(PlatformTransactionManager.class));

    @AfterEach
    void fecharPool() {
        processamento.encerrar();
    }

    @Test
    void oPrimeiroArquivoSozinhoEOsOutrosEmRodadasDeTres() {
        assertThat(ProcessamentoAssincronoImportacao.rodadas(0)).isEqualTo(1);
        assertThat(ProcessamentoAssincronoImportacao.rodadas(1)).isEqualTo(1);
        assertThat(ProcessamentoAssincronoImportacao.rodadas(2)).isEqualTo(2);
        assertThat(ProcessamentoAssincronoImportacao.rodadas(4)).isEqualTo(2);
        assertThat(ProcessamentoAssincronoImportacao.rodadas(5)).isEqualTo(3);
        assertThat(ProcessamentoAssincronoImportacao.rodadas(7)).isEqualTo(3);
        // Dois arquivos = duas leituras em série (o primeiro sozinho): o corte não pode caber numa só.
        assertThat(ProcessamentoAssincronoImportacao.limiteDaSessaoEmSegundos(2))
                .isGreaterThanOrEqualTo(2 * RoteadorInterpretadorIa.ORCAMENTO_POR_ARQUIVO.toSeconds());
    }

    @Test
    void corteDaSessaoERodadasVezesOOrcamentoDoArquivoMaisAFolga() {
        assertThat(RoteadorInterpretadorIa.ORCAMENTO_POR_ARQUIVO).hasMinutes(15);
        assertThat(ProcessamentoAssincronoImportacao.limiteDaSessaoEmSegundos(1)).isEqualTo(15 * 60 + 30 + 120);
        assertThat(ProcessamentoAssincronoImportacao.limiteDaSessaoEmSegundos(20)).isEqualTo(8 * (15 * 60 + 30) + 120);
    }

    @Test
    void leituraVelhaQueTerminaDepoisDaNovaNaoGrava() {
        UUID consultoria = UUID.randomUUID();
        ImportacaoSessao sessao = new ImportacaoSessao(UUID.randomUUID());
        ReflectionTestUtils.setField(sessao, "id", UUID.randomUUID());
        when(sessoes.buscarParaAlterar(sessao.getId(), consultoria)).thenReturn(Optional.of(sessao));
        var loteVelho = new ImportacaoAssistidaService.ResultadoProcessamentoLote(List.of(), List.of());
        var loteNovo = new ImportacaoAssistidaService.ResultadoProcessamentoLote(List.of(), List.of());

        UUID velha = UUID.randomUUID();
        SessaoJson.marcarNovaLeitura(json, sessao, velha, 1);
        sessao.atualizarEstado("PROCESSANDO");
        // A velha foi cortada e o treinador mandou ler de novo: outra marca.
        UUID nova = UUID.randomUUID();
        SessaoJson.marcarNovaLeitura(json, sessao, nova, 1);

        processamento.concluirSeMesmaLeitura(consultoria, sessao.getId(), nova, loteNovo);
        processamento.concluirSeMesmaLeitura(consultoria, sessao.getId(), velha, loteVelho);

        verify(service).concluirProcessamentoEmTransacao(eq(sessao.getId()), same(loteNovo));
        verify(service, never()).concluirProcessamentoEmTransacao(any(), same(loteVelho));
    }

    @Test
    void aSessaoNaFilaFicaAguardandoSemRelogioEAoComecarODesligaEMarcaOInicio() {
        ImportacaoSessao sessao = new ImportacaoSessao(UUID.randomUUID());
        SessaoJson.marcarNovaLeitura(json, sessao, UUID.randomUUID(), 2);
        assertThat(json.readTree(sessao.getProgressoJson()).path("aguardando").asBoolean()).isTrue();
        assertThat(json.readTree(sessao.getProgressoJson()).has("processandoDesde")).isFalse();

        SessaoJson.leituraComecou(json, sessao);

        assertThat(json.readTree(sessao.getProgressoJson()).has("aguardando")).isFalse();
        assertThat(json.readTree(sessao.getProgressoJson()).has("processandoDesde")).isTrue();
    }

    @Test
    void noMaximoDuasLeiturasDaMesmaConsultoriaEAOutraConsultoriaNaoEspera() throws Exception {
        UUID cheia = UUID.randomUUID();
        UUID outra = UUID.randomUUID();
        Map<UUID, AtomicInteger> comecaram = new ConcurrentHashMap<>();
        CountDownLatch liberar = new CountDownLatch(1);
        // A primeira coisa da leitura que ganhou a vaga é pegar a sessão: aqui ela fica presa até o teste liberar.
        when(sessoes.buscarParaAlterar(any(), any())).thenAnswer(inv -> {
            comecaram.computeIfAbsent(inv.getArgument(1), c -> new AtomicInteger()).incrementAndGet();
            liberar.await(5, TimeUnit.SECONDS);
            return Optional.empty(); // sessão sumiu: a leitura termina sem fazer nada
        });

        for (int i = 0; i < 3; i++) {
            processamento.agendar(cheia, UUID.randomUUID(), UUID.randomUUID(), 1, UUID.randomUUID());
        }
        processamento.agendar(outra, UUID.randomUUID(), UUID.randomUUID(), 1, UUID.randomUUID());

        esperar(() -> contagem(comecaram, cheia) == 2 && contagem(comecaram, outra) == 1);
        Thread.sleep(100); // a terceira da consultoria cheia continua na fila
        assertThat(contagem(comecaram, cheia)).isEqualTo(2);

        liberar.countDown();
        esperar(() -> contagem(comecaram, cheia) == 3);
    }

    private static int contagem(Map<UUID, AtomicInteger> mapa, UUID consultoria) {
        AtomicInteger n = mapa.get(consultoria);
        return n == null ? 0 : n.get();
    }

    private static void esperar(java.util.function.BooleanSupplier condicao) throws InterruptedException {
        long fim = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
        while (!condicao.getAsBoolean()) {
            assertThat(System.nanoTime()).as("esperou demais").isLessThan(fim);
            Thread.sleep(10);
        }
    }
}
