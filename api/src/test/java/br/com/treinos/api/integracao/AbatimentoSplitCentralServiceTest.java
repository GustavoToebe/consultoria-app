package br.com.treinos.api.integracao;

import br.com.treinos.api.conta.ContaLocalRepositorio;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import tools.jackson.databind.json.JsonMapper;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AbatimentoSplitCentralServiceTest {

    private final JsonMapper json = JsonMapper.builder().build();

    @Test
    void noOpQuandoIntegracaoDesligada() {
        @SuppressWarnings("unchecked")
        ObjectProvider<CentralClient> provider = mock(ObjectProvider.class);
        ContaLocalRepositorio contas = mock(ContaLocalRepositorio.class);
        var props = new IntegracaoProperties(false, "", "", "", "", "TREINOS", 72, false);

        var service = new AbatimentoSplitCentralService(provider, props, contas, json);
        boolean ok = service.registrarAbatimento(UUID.randomUUID(), "pay_123", UUID.randomUUID(), 1500L, Instant.now());

        assertThat(ok).isFalse();
        verify(provider, never()).getIfAvailable();
        verify(contas, never()).reduzirSaldoAbater(any(), org.mockito.ArgumentMatchers.anyLong());
    }

    @Test
    void enviaAbatimentoEReduzSaldoLocalQuandoCentralAceita() throws Exception {
        CentralClient central = mock(CentralClient.class);
        @SuppressWarnings("unchecked")
        ObjectProvider<CentralClient> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(central);
        ContaLocalRepositorio contas = mock(ContaLocalRepositorio.class);
        var props = new IntegracaoProperties(true, "", "s1", "", "http://localhost", "TREINOS", 72, false);

        UUID consultoriaId = UUID.randomUUID();
        UUID cobrancaAlunoId = UUID.randomUUID();
        String caminhoEsperado = "/integracao/v1/produtos/TREINOS/instancias/" + consultoriaId + "/abatimentos-split";
        when(central.postJson(eq(caminhoEsperado), any(byte[].class)))
                .thenReturn(new CentralClient.Resposta(200, "{}".getBytes(StandardCharsets.UTF_8)));

        var service = new AbatimentoSplitCentralService(provider, props, contas, json);
        boolean ok = service.registrarAbatimento(consultoriaId, "pay_abc", cobrancaAlunoId, 3200L, Instant.parse("2026-11-24T12:00:00Z"));

        assertThat(ok).isTrue();
        verify(central).postJson(eq(caminhoEsperado), any(byte[].class));
        verify(contas).reduzirSaldoAbater(consultoriaId, 3200L);
    }

    @Test
    void naoReduzSaldoLocalQuandoCentralRespondeErro() throws Exception {
        CentralClient central = mock(CentralClient.class);
        @SuppressWarnings("unchecked")
        ObjectProvider<CentralClient> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(central);
        ContaLocalRepositorio contas = mock(ContaLocalRepositorio.class);
        var props = new IntegracaoProperties(true, "", "s1", "", "http://localhost", "TREINOS", 72, false);

        UUID consultoriaId = UUID.randomUUID();
        when(central.postJson(any(), any(byte[].class)))
                .thenReturn(new CentralClient.Resposta(502, "{}".getBytes(StandardCharsets.UTF_8)));

        var service = new AbatimentoSplitCentralService(provider, props, contas, json);
        boolean ok = service.registrarAbatimento(consultoriaId, "pay_err", UUID.randomUUID(), 1000L, Instant.now());

        assertThat(ok).isFalse();
        verify(contas, never()).reduzirSaldoAbater(any(), org.mockito.ArgumentMatchers.anyLong());
    }
}
