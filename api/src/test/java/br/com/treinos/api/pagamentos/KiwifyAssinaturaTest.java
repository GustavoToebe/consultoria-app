package br.com.treinos.api.pagamentos;

import br.com.treinos.api.pagamentos.AvisoKiwifyService.Chaves;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * A verificação da assinatura do aviso da Kiwify (HMAC-SHA1 do corpo CRU, hex minúsculo, chave = token do webhook), sem Spring.
 * O vetor de teste é o da documentação oficial (docs.kiwify.com.br, "Receber e validar webhooks").
 */
class KiwifyAssinaturaTest {

    private static final String TOKEN = "kiwify-token-de-teste";
    private static final String CORPO = "{\"order_id\":\"9b1c2d3e-0000-4000-8000-000000000001\",\"order_status\":\"paid\","
            + "\"webhook_event_type\":\"order_approved\"}";
    private static final String ASSINATURA = "bf18f352a4f981b91dfa3f6d8742a81080ab8c86";

    private static byte[] bytes(String texto) {
        return texto.getBytes(StandardCharsets.UTF_8);
    }

    @Test
    void ovetorDaDocumentacaoOficialBate() {
        assertThat(new String(AvisoKiwifyService.hmacHex(TOKEN, bytes(CORPO)), StandardCharsets.US_ASCII)).isEqualTo(ASSINATURA);
        assertThat(AvisoKiwifyService.assinaturaConfere(bytes(CORPO), ASSINATURA, new Chaves(TOKEN, null))).isTrue();
    }

    @Test
    void naoConfereComCorpoOutroTokenOuAssinaturaAdulterada() {
        assertThat(AvisoKiwifyService.assinaturaConfere(bytes(CORPO + " "), ASSINATURA, new Chaves(TOKEN, null))).isFalse();
        assertThat(AvisoKiwifyService.assinaturaConfere(bytes(CORPO), ASSINATURA, new Chaves("outro-token-qualquer", null))).isFalse();
        assertThat(AvisoKiwifyService.assinaturaConfere(bytes(CORPO), ASSINATURA.replace('b', 'c'), new Chaves(TOKEN, null))).isFalse();
    }

    @Test
    void oCorpoNuncaEReserializado() {
        // O mesmo JSON com outra ordem das chaves e espaços tem outra assinatura: só vale o que chegou, byte a byte.
        String reordenado = "{ \"order_status\":\"paid\", \"order_id\":\"9b1c2d3e-0000-4000-8000-000000000001\","
                + "\"webhook_event_type\":\"order_approved\" }";

        assertThat(AvisoKiwifyService.assinaturaConfere(bytes(reordenado), ASSINATURA, new Chaves(TOKEN, null))).isFalse();
    }

    @Test
    void oTokenAnteriorAindaConfereEnquantoEntregue() {
        Chaves duas = new Chaves("token-novo-do-webhook-1234", TOKEN);

        assertThat(AvisoKiwifyService.assinaturaConfere(bytes(CORPO), ASSINATURA, duas)).isTrue();
        assertThat(AvisoKiwifyService.assinaturaConfere(bytes(CORPO), ASSINATURA, new Chaves("token-novo-do-webhook-1234", null)))
                .isFalse();
    }

    @Test
    void aAssinaturaVemDaQueryCrua() {
        assertThat(AvisoKiwifyController.assinatura("signature=" + ASSINATURA)).isEqualTo(ASSINATURA);
        assertThat(AvisoKiwifyController.assinatura("x=1&signature=" + ASSINATURA + "&y=2")).isEqualTo(ASSINATURA);
        assertThat(AvisoKiwifyController.assinatura("sig%6Eature=" + ASSINATURA)).isEqualTo(ASSINATURA);
        assertThat(AvisoKiwifyController.assinatura(null)).isNull();
        assertThat(AvisoKiwifyController.assinatura("")).isNull();
        assertThat(AvisoKiwifyController.assinatura("x=1&y=2")).isNull();
        // % solto ou %zz não lança (era 500): par de outro nome é ignorado e assinatura torta vale como ausente.
        assertThat(AvisoKiwifyController.assinatura("x=%")).isNull();
        assertThat(AvisoKiwifyController.assinatura("%=1&y=%zz")).isNull();
        assertThat(AvisoKiwifyController.assinatura("x=%zz&signature=" + ASSINATURA)).isEqualTo(ASSINATURA);
        assertThat(AvisoKiwifyController.assinatura("%zz=1&signature=" + ASSINATURA)).isEqualTo(ASSINATURA);
        assertThat(AvisoKiwifyController.assinatura("signature=%zz")).isNull();
        assertThat(AvisoKiwifyController.assinatura("signature=%")).isNull();
        // Repetida é ambígua: vale como ausente, nunca "a primeira" nem "a última".
        assertThat(AvisoKiwifyController.assinatura("signature=" + ASSINATURA + "&signature=" + ASSINATURA)).isNull();
    }

    @Test
    void aComparacaoNoCodigoEEmTempoConstante() throws IOException {
        // Verificado no código: a assinatura recebida só é comparada por MessageDigest.isEqual, nunca por equals ou ==.
        String fonte = Files.readString(Path.of("src/main/java/br/com/treinos/api/pagamentos/AvisoKiwifyService.java"));

        assertThat(fonte).contains("MessageDigest.isEqual(");
        assertThat(fonte).doesNotContain("recebida.equals(").doesNotContain(".equals(recebida")
                .doesNotContain("equalsIgnoreCase(recebida").doesNotContain("assinatura.equals(").doesNotContain(".equals(assinatura");
        // E as duas comparações (token atual e anterior) rodam sempre: sem curto-circuito que diga qual bateu.
        assertThat(fonte).contains("return atual | anterior;");
    }
}
