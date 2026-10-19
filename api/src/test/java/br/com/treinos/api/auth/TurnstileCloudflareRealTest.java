package br.com.treinos.api.auth;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.abort;

/**
 * As chaves de teste públicas da Cloudflare contra o siteverify de verdade: confere que o formato da resposta real é o que o
 * {@link TurnstileCliente} lê. Sem rede (ou Cloudflare fora) o teste pula, nunca falha por isso.
 * As chaves de teste respondem um hostname de exemplo, então aqui o hostname não é conferido (o {@link TurnstileClienteTest} confere).
 * Segredos de teste: {@code 1x0000000000000000000000000000000AA} sempre aprova; {@code 2x0000000000000000000000000000000AA} sempre recusa.
 */
class TurnstileCloudflareRealTest {

    private static final String DUMMY_TOKEN = "XXXX.DUMMY.TOKEN.XXXX";

    @Test
    void segredoDeTesteQueSempreAprovaAprova() {
        assertThat(verificar("1x0000000000000000000000000000000AA")).isEqualTo(TurnstileCliente.Veredito.APROVADO);
    }

    @Test
    void segredoDeTesteQueSempreRecusaRecusa() {
        assertThat(verificar("2x0000000000000000000000000000000AA")).isEqualTo(TurnstileCliente.Veredito.RECUSADO);
    }

    private static TurnstileCliente.Veredito verificar(String segredo) {
        var cliente = new TurnstileCliente(new TurnstileProperties(true, "chave-de-teste", segredo, null, null), "");
        try {
            return cliente.verificar(DUMMY_TOKEN, null);
        } catch (VerificacaoHumanaException semRede) {
            abort("Cloudflare inalcançável nesta máquina: teste pulado.");
            throw semRede;
        }
    }
}
