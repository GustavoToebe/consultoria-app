package br.com.treinos.api.pagamentos.provedor;

import br.com.treinos.api.pagamentos.FormaDePagamento;
import br.com.treinos.api.web.Fuso;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * O que todo adaptador de pagamento precisa cumprir. Cada adaptador estende esta classe e entrega o provedor e, quando
 * ele faz a operação, o material de teste dela; o que {@code capacidades()} nega tem de ser recusado com
 * {@link OperacaoNaoSuportadaException}, e o que afirma tem de funcionar. Assim o segundo adaptador herda o contrato.
 */
abstract class ProvedorContratoTest {

    protected abstract ProvedorDePagamento provedor();

    /** Só para quem gera cobrança: o pedido que o adaptador aceita. */
    protected PedidoDeCobranca pedidoValido() {
        return new PedidoDeCobranca(UUID.randomUUID(), 15_000L, LocalDate.now(Fuso.BRASILIA).plusDays(5), "Mensalidade",
                Set.of(FormaDePagamento.PIX), 1);
    }

    /** Só para quem recebe aviso: um aviso que passa na conferência. */
    protected RequisicaoDeWebhook webhookValido() {
        throw new UnsupportedOperationException("Informe o aviso válido do adaptador que recebe webhook.");
    }

    /** Só para quem recebe aviso: um aviso adulterado (assinatura ou corpo que não confere). */
    protected RequisicaoDeWebhook webhookAdulterado() {
        throw new UnsupportedOperationException("Informe o aviso adulterado do adaptador que recebe webhook.");
    }

    /** Só para quem consulta: o id de uma cobrança que existe no provedor. */
    protected String idExternoExistente() {
        throw new UnsupportedOperationException("Informe o id de uma cobrança existente no adaptador que consulta.");
    }

    @Test
    void codigoSegueOFormatoGravadoNoBanco() {
        assertThat(provedor().codigo()).matches("^[A-Z0-9_]{1,30}$");
    }

    @Test
    void capacidadesSaoCoerentes() {
        CapacidadesDoProvedor c = provedor().capacidades();
        assertThat(c.maxParcelas()).isGreaterThanOrEqualTo(1);
        if (!c.cartao()) {
            assertThat(c.maxParcelas()).as("sem cartão não há parcelamento").isEqualTo(1);
        }
        if (c.geraCobranca()) {
            assertThat(c.pix() || c.boleto() || c.cartao()).as("quem gera cobrança aceita alguma forma").isTrue();
        }
    }

    @Test
    void gerarCobrancaSegueACapacidade() {
        ProvedorDePagamento p = provedor();
        if (!p.capacidades().geraCobranca()) {
            assertThatThrownBy(() -> p.gerarCobranca(pedidoValido())).isInstanceOf(OperacaoNaoSuportadaException.class);
            return;
        }
        CobrancaGerada gerada = p.gerarCobranca(pedidoValido());
        assertThat(gerada.idExterno()).isNotBlank();
        assertThat(gerada.link()).isNotBlank();
    }

    @Test
    void consultarSegueACapacidade() {
        ProvedorDePagamento p = provedor();
        CapacidadesDoProvedor c = p.capacidades();
        if (!c.geraCobranca() && !c.recebeWebhook()) {
            assertThatThrownBy(() -> p.consultar("qualquer")).isInstanceOf(OperacaoNaoSuportadaException.class);
            return;
        }
        ConsultaDeCobranca consulta = p.consultar(idExternoExistente());
        assertThat(consulta.situacao()).isNotNull();
        if (consulta.situacao() == SituacaoNormalizada.PAGA) {
            assertThat(consulta.pagoEm()).isNotNull();
            assertThat(consulta.forma()).isNotNull();
        }
    }

    @Test
    void lerWebhookSegueACapacidade() {
        ProvedorDePagamento p = provedor();
        if (!p.capacidades().recebeWebhook()) {
            assertThatThrownBy(() -> p.lerWebhook(new RequisicaoDeWebhook(Map.of(), new byte[0])))
                    .isInstanceOf(OperacaoNaoSuportadaException.class);
            return;
        }
        EventoDeWebhook evento = p.lerWebhook(webhookValido());
        assertThat(evento.idEvento()).isNotBlank();
        assertThat(evento.idExterno()).isNotBlank();
        assertThat(p.lerWebhook(webhookValido()).idEvento()).as("o mesmo aviso tem sempre o mesmo id").isEqualTo(evento.idEvento());
        assertThatThrownBy(() -> p.lerWebhook(webhookAdulterado()))
                .isInstanceOf(WebhookInvalidoException.class)
                .hasMessage("Aviso do provedor inválido.");
    }

    @Test
    void recusaNaoVazaCorpoNemCabecalhoNaMensagem() {
        ProvedorDePagamento p = provedor();
        if (p.capacidades().recebeWebhook()) {
            return;
        }
        var requisicao = new RequisicaoDeWebhook(Map.of("x-assinatura", "valor-secreto"),
                "corpo-secreto-ficticio".getBytes(StandardCharsets.UTF_8));
        assertThatThrownBy(() -> p.lerWebhook(requisicao)).hasMessageNotContaining("secreto");
        assertThat(requisicao.toString()).doesNotContain("secreto");
    }
}
