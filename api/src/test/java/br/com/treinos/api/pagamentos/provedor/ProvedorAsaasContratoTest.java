package br.com.treinos.api.pagamentos.provedor;

import br.com.treinos.api.pagamentos.AsaasFalsa;
import br.com.treinos.api.pagamentos.AsaasProperties;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** O adaptador do Asaas cumpre integralmente {@link ProvedorContratoTest}. */
class ProvedorAsaasContratoTest extends ProvedorContratoTest {

    private static AsaasFalsa falsa;
    private static ProvedorAsaas provedor;
    private static final UUID REFERENCIA_FIXA = UUID.randomUUID();
    private String paymentIdExistente;

    @BeforeAll
    static void subir() {
        falsa = new AsaasFalsa();
        AsaasProperties props = new AsaasProperties(true, falsa.url(), "chave-matriz-teste",
                "https://api.teste.local", "wal_matriz", "wal_socio", 3500, false);
        provedor = new ProvedorAsaas(new AsaasCliente(props));
    }

    @AfterAll
    static void derrubar() {
        falsa.close();
    }

    @BeforeEach
    void preparar() {
        falsa.reiniciar();
        falsa.registrarSubconta("chave-subconta-teste", "wal_sub_1");
        paymentIdExistente = falsa.criarPagamentoPreExistente("PIX", new BigDecimal("150.00"),
                REFERENCIA_FIXA.toString(), "RECEIVED");
    }

    @Override
    protected ProvedorDePagamento provedor() {
        return provedor;
    }

    @Override
    protected CredencialDoProvedor credencial() {
        return new CredencialDoProvedor(UUID.randomUUID(), "cus_fake_1", "chave-subconta-teste");
    }

    @Override
    protected PedidoDeConsulta consultaExistente() {
        return new PedidoDeConsulta(REFERENCIA_FIXA, paymentIdExistente, null);
    }

    @Override
    protected RequisicaoDeWebhook webhookValido() {
        String corpo = "{\"event\":\"PAYMENT_RECEIVED\",\"payment\":{\"id\":\"" + paymentIdExistente
                + "\",\"externalReference\":\"" + REFERENCIA_FIXA + "\"}}";
        return new RequisicaoDeWebhook(Map.of("asaas-access-token", "tok-teste"),
                corpo.getBytes(StandardCharsets.UTF_8));
    }

    @Override
    protected RequisicaoDeWebhook webhookAdulterado() {
        return new RequisicaoDeWebhook(Map.of(), "{\"event\":\"DESCONHECIDO\"}".getBytes(StandardCharsets.UTF_8));
    }

    @Test
    void capacidadesECodigoSaoOsDoOvertrainingPayERegistroOConhece() {
        assertThat(provedor.codigo()).isEqualTo("ASAAS");
        assertThat(provedor.capacidades()).isEqualTo(
                new CapacidadesDoProvedor(true, false, true, 12, false, true, true, true, true));
        var registro = new ProvedoresDePagamento(List.of(new ProvedorManual(), provedor));
        assertThat(registro.conhece("ASAAS")).isTrue();
        assertThat(falsa.violacoes()).isEmpty();
    }

    @Test
    void boletoEFormaValidaDePagamento() {
        String boleto = falsa.criarPagamentoPreExistente("BOLETO", new BigDecimal("150.00"), REFERENCIA_FIXA.toString(),
                "RECEIVED");

        var consulta = provedor.consultar(credencial(), new PedidoDeConsulta(REFERENCIA_FIXA, boleto, null));

        assertThat(consulta.situacao()).isEqualTo(SituacaoNormalizada.PAGA);
        assertThat(consulta.forma()).isEqualTo(br.com.treinos.api.pagamentos.FormaDePagamento.BOLETO);
        assertThat(ProvedorAsaas.mapearForma("credit_card")).isEqualTo(br.com.treinos.api.pagamentos.FormaDePagamento.CARTAO);
        assertThat(ProvedorAsaas.mapearForma("DEBIT_CARD")).isNull();
    }

    @Test
    void estornoParcialEChargebackSaoLidosComoEstornoInformado() {
        for (String evento : List.of("PAYMENT_REFUNDED", "PAYMENT_PARTIALLY_REFUNDED", "PAYMENT_CHARGEBACK_REQUESTED",
                "PAYMENT_CHARGEBACK_DISPUTE", "PAYMENT_AWAITING_CHARGEBACK_REVERSAL")) {
            String corpo = "{\"event\":\"" + evento + "\",\"payment\":{\"id\":\"" + paymentIdExistente
                    + "\",\"externalReference\":\"" + REFERENCIA_FIXA + "\"}}";

            EventoDeWebhook lido = provedor.lerWebhook(new RequisicaoDeWebhook(Map.of(),
                    corpo.getBytes(StandardCharsets.UTF_8)));

            assertThat(lido.estornoInformado()).as(evento).isTrue();
        }
    }
}
