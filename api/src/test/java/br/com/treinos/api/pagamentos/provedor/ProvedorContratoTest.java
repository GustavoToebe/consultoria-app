package br.com.treinos.api.pagamentos.provedor;

import br.com.treinos.api.pagamentos.FormaDePagamento;
import br.com.treinos.api.web.Fuso;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.catchThrowable;

/**
 * O que todo adaptador de pagamento precisa cumprir. Cada adaptador estende esta classe e entrega o provedor e, quando
 * ele faz a operação, o material de teste dela; o que {@code capacidades()} nega tem de ser recusado com
 * {@link OperacaoNaoSuportadaException}, e o que afirma tem de funcionar. Assim o segundo adaptador herda o contrato.
 */
abstract class ProvedorContratoTest {

    protected abstract ProvedorDePagamento provedor();

    /** A credencial passada ao adaptador (ele não lê banco). Quem a usa de verdade troca a conta e o segredo. */
    protected CredencialDoProvedor credencial() {
        return new CredencialDoProvedor(UUID.randomUUID(), "conta-de-teste", null);
    }

    /** Só para quem gera cobrança: o pedido que o adaptador aceita. */
    protected PedidoDeCobranca pedidoValido() {
        return new PedidoDeCobranca(UUID.randomUUID(), 15_000L, LocalDate.now(Fuso.BRASILIA).plusDays(5), "Mensalidade",
                Set.of(FormaDePagamento.PIX), 1, null, null, null, 0);
    }

    /** Só para quem recebe aviso: um aviso que passa na conferência. */
    protected RequisicaoDeWebhook webhookValido() {
        throw new UnsupportedOperationException("Informe o aviso válido do adaptador que recebe webhook.");
    }

    /** Só para quem recebe aviso: um aviso adulterado (assinatura ou corpo que não confere). */
    protected RequisicaoDeWebhook webhookAdulterado() {
        throw new UnsupportedOperationException("Informe o aviso adulterado do adaptador que recebe webhook.");
    }

    /** Só para quem consulta: o pedido de consulta de uma cobrança que existe no provedor. */
    protected PedidoDeConsulta consultaExistente() {
        throw new UnsupportedOperationException("Informe a consulta de uma cobrança existente no adaptador que consulta.");
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
            assertThatThrownBy(() -> p.gerarCobranca(credencial(), pedidoValido()))
                    .isInstanceOf(OperacaoNaoSuportadaException.class);
            return;
        }
        CobrancaGerada gerada = p.gerarCobranca(credencial(), pedidoValido());
        assertThat(gerada.idExterno()).isNotBlank();
        assertThat(gerada.link()).isNotBlank();
    }

    @Test
    void consultarSegueACapacidade() {
        ProvedorDePagamento p = provedor();
        CapacidadesDoProvedor c = p.capacidades();
        if (!c.geraCobranca() && !c.recebeWebhook()) {
            assertThatThrownBy(() -> p.consultar(credencial(), new PedidoDeConsulta(UUID.randomUUID(), "qualquer", null)))
                    .isInstanceOf(OperacaoNaoSuportadaException.class);
            return;
        }
        ConsultaDeCobranca consulta = p.consultar(credencial(), consultaExistente());
        assertThat(consulta.situacao()).isNotNull();
        if (consulta.situacao() == SituacaoNormalizada.PAGA) {
            // A forma pode vir nula (meio que não conhecemos): a baixa trata como "para conferir", nunca chuta.
            assertThat(consulta.pagoEm()).isNotNull();
            assertThat(consulta.valorCentavos()).as("o valor do link, que se confere com o do servidor").isNotNull();
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
        assertThat(evento.referencia()).isNotNull();
        assertThat(p.lerWebhook(webhookValido()).idEvento()).as("o mesmo aviso tem sempre o mesmo id").isEqualTo(evento.idEvento());
        assertThatThrownBy(() -> p.lerWebhook(webhookAdulterado()))
                .isInstanceOf(WebhookInvalidoException.class)
                .hasMessage("Aviso do provedor inválido.");
    }

    /**
     * Corpo e cabeçalhos adulterados com marcadores únicos: nem a mensagem da exceção, nem o toString, nem a causa podem
     * conter nenhum deles. Vale também para quem não recebe aviso (a recusa de "não suportado" não repete nada).
     */
    @Test
    void recusaNaoVazaCorpoNemCabecalhoNaMensagem() {
        ProvedorDePagamento p = provedor();
        String marcador = "MARCADOR-" + UUID.randomUUID();
        String marcadorDoCabecalho = "CABECALHO-" + UUID.randomUUID();
        List<RequisicaoDeWebhook> requisicoes = List.of(
                new RequisicaoDeWebhook(Map.of("x-assinatura", marcadorDoCabecalho), marcador.getBytes(StandardCharsets.UTF_8)),
                new RequisicaoDeWebhook(Map.of("x-assinatura", marcadorDoCabecalho),
                        ("{\"order_nsu\":\"" + marcador + "\",\"transaction_nsu\":\"" + marcador + "\"}")
                                .getBytes(StandardCharsets.UTF_8)),
                new RequisicaoDeWebhook(Map.of("x-assinatura", marcadorDoCabecalho),
                        ("{\"order_nsu\":\"" + UUID.randomUUID() + "\",\"transaction_nsu\":\"tx " + marcador + "\"}")
                                .getBytes(StandardCharsets.UTF_8)));
        for (RequisicaoDeWebhook requisicao : requisicoes) {
            assertThat(requisicao.toString()).doesNotContain(marcador).doesNotContain(marcadorDoCabecalho);
            Throwable erro = catchThrowable(() -> p.lerWebhook(requisicao));
            assertThat(erro).isNotNull();
            if (p.capacidades().recebeWebhook()) {
                assertThat(erro).isInstanceOf(WebhookInvalidoException.class);
            } else {
                assertThat(erro).isInstanceOf(OperacaoNaoSuportadaException.class);
            }
            assertThat(erro.getMessage()).doesNotContain(marcador).doesNotContain(marcadorDoCabecalho);
            assertThat(erro.toString()).doesNotContain(marcador).doesNotContain(marcadorDoCabecalho);
            assertThat(erro.getCause()).as("sem causa: a mensagem dela poderia citar o corpo").isNull();
        }
        if (p.capacidades().recebeWebhook()) {
            // O marcador só no cabeçalho, com um corpo adulterado do adaptador: a recusa não o repete.
            var comCabecalho = new RequisicaoDeWebhook(Map.of("x-assinatura", marcadorDoCabecalho), webhookAdulterado().corpo());
            Throwable erro = catchThrowable(() -> p.lerWebhook(comCabecalho));
            assertThat(erro).isInstanceOf(WebhookInvalidoException.class);
            assertThat(erro.toString()).doesNotContain(marcadorDoCabecalho);
        }
    }
}
