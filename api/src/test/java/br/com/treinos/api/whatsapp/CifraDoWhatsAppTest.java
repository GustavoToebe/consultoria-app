package br.com.treinos.api.whatsapp;

import br.com.treinos.api.pagamentos.CifraDePagamento;
import br.com.treinos.api.pagamentos.PagamentosProperties;
import br.com.treinos.api.security.CifraAesGcm;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * A cifra do token de acesso da Meta (AES-GCM com a consultoria no dado autenticado e chaves próprias do WhatsApp): ida e
 * volta, dado associado errado e adulteração falham sem vazar nada, o formato dos pagamentos continua o mesmo depois de a
 * cifra ser extraída para {@link CifraAesGcm}, e a subida confere os ids de chave gravados (só ligado).
 */
class CifraDoWhatsAppTest {

    private static final String TOKEN = "EAAtoken-fake-so-de-teste-123";
    private static final UUID CONSULTORIA = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID OUTRA = UUID.fromString("22222222-2222-2222-2222-222222222222");

    private static String chave(char c) {
        return Base64.getEncoder().encodeToString(String.valueOf(c).repeat(32).getBytes(StandardCharsets.US_ASCII));
    }

    private static CifraDoWhatsApp cifra(String chaves, String ativa) {
        return new CifraDoWhatsApp(new WhatsAppProperties(true, chaves, ativa, "segredo-fake", "verify-fake", null, false, null));
    }

    @Test
    void idaEVoltaNoFormatoV1() {
        CifraDoWhatsApp cifra = cifra("k1:" + chave('a'), "k1");

        String cifrado = cifra.cifrar(CONSULTORIA, TOKEN);

        String[] partes = cifrado.split(":", -1);
        assertThat(partes).hasSize(4);
        assertThat(partes[0]).isEqualTo("v1");
        assertThat(partes[1]).isEqualTo("k1");
        assertThat(cifrado).doesNotContain(TOKEN);
        assertThat(cifra.decifrar(CONSULTORIA, cifrado)).isEqualTo(TOKEN);
        assertThat(cifra.cifrar(CONSULTORIA, TOKEN)).as("nonce novo a cada vez").isNotEqualTo(cifrado);
    }

    @Test
    void dadoAssociadoErradoEAdulteracaoFalhamSemVazarNada() {
        CifraDoWhatsApp cifra = cifra("k1:" + chave('a'), "k1");
        String cifrado = cifra.cifrar(CONSULTORIA, TOKEN);

        assertThatThrownBy(() -> cifra.decifrar(OUTRA, cifrado)).isInstanceOf(CifraDoWhatsAppIndisponivelException.class)
                .satisfies(e -> {
                    assertThat(e.getMessage()).doesNotContain(TOKEN).doesNotContain(cifrado).doesNotContain(chave('a'));
                    assertThat(e.getCause()).isNull();
                });
        String[] partes = cifrado.split(":", -1);
        byte[] texto = Base64.getDecoder().decode(partes[3]);
        texto[0] ^= 1;
        String adulterado = String.join(":", partes[0], partes[1], partes[2], Base64.getEncoder().encodeToString(texto));
        assertThatThrownBy(() -> cifra.decifrar(CONSULTORIA, adulterado)).isInstanceOf(CifraDoWhatsAppIndisponivelException.class);
        for (String lixo : new String[] {"", "abc", "v2:k1:AAAAAAAAAAAAAAAA:AAAA", "v1:desconhecida:AAAAAAAAAAAAAAAA:AAAA"}) {
            assertThatThrownBy(() -> cifra.decifrar(CONSULTORIA, lixo)).as(lixo).isInstanceOf(CifraDoWhatsAppIndisponivelException.class);
        }
    }

    @Test
    void segredoDosPagamentosNaoAbreNoWhatsAppENemOContrario() {
        String chaves = "k1:" + chave('a');
        CifraDoWhatsApp whatsapp = cifra(chaves, "k1");
        CifraDePagamento pagamentos = new CifraDePagamento(new PagamentosProperties(true, chaves, "k1", false, false));

        String dosPagamentos = pagamentos.cifrar(CONSULTORIA, TOKEN);
        String doWhatsApp = whatsapp.cifrar(CONSULTORIA, TOKEN);

        assertThatThrownBy(() -> whatsapp.decifrar(CONSULTORIA, dosPagamentos)).isInstanceOf(CifraDoWhatsAppIndisponivelException.class);
        assertThatThrownBy(() -> pagamentos.decifrar(CONSULTORIA, doWhatsApp)).isInstanceOf(RuntimeException.class);
    }

    @Test
    void oFormatoDosPagamentosContinuaOMesmoDepoisDeExtrairACifra() {
        String chaves = "k1:" + chave('a');
        CifraDePagamento pagamentos = new CifraDePagamento(new PagamentosProperties(true, chaves, "k1", false, false));
        // A mesma cifra genérica, com o contexto antigo dos pagamentos, abre o que a CifraDePagamento grava e o contrário.
        CifraAesGcm generica = new CifraAesGcm("consultoria:pagamentos:", chaves, "k1", "A", "B");

        assertThat(generica.decifrar(CONSULTORIA, pagamentos.cifrar(CONSULTORIA, TOKEN))).isEqualTo(TOKEN);
        assertThat(pagamentos.decifrar(CONSULTORIA, generica.cifrar(CONSULTORIA, TOKEN))).isEqualTo(TOKEN);
    }

    @Test
    void naoImprimeOTokenNemAsChaves() {
        CifraDoWhatsApp cifra = cifra("k1:" + chave('a'), "k1");
        WhatsAppProperties propriedades = new WhatsAppProperties(true, "k1:" + chave('a'), "k1", "segredo-fake-123", "verify-fake-123",
                null, false, null);

        assertThat(cifra.toString()).doesNotContain(chave('a')).doesNotContain(TOKEN);
        assertThat(propriedades.toString()).doesNotContain(chave('a')).doesNotContain("segredo-fake-123").doesNotContain("verify-fake-123");
        assertThat(new WhatsAppDtos.ConexaoRequest("123", "456", TOKEN, null).toString()).doesNotContain(TOKEN);
    }

    @Test
    void ligadoSemAsVariaveisNaoSobeEDesligadoSobeSemNenhuma() {
        assertThatThrownBy(() -> new WhatsAppProperties(true, "", "", "s", "v", null, null, null)).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> new WhatsAppProperties(true, "k1:" + chave('a'), "k1", "", "v", null, null, null))
                .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> new WhatsAppProperties(true, "k1:" + chave('a'), "k1", "s", "", null, null, null))
                .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> new WhatsAppProperties(true, "k1:" + chave('a'), "k1", "s", "v", "http://graph.exemplo.com", null, null))
                .isInstanceOf(IllegalStateException.class).hasMessageNotContaining("graph.exemplo.com");
        WhatsAppProperties desligado = new WhatsAppProperties(false, null, null, null, null, null, null, null);
        assertThat(desligado.habilitado()).isFalse();
        assertThat(desligado.metaUrl()).isEqualTo(WhatsAppProperties.URL_PADRAO);
        assertThat(new CifraDoWhatsApp(desligado).configurada()).isFalse();
    }

    @Test
    void aSubidaRecusaTokenCifradoComChaveQueNaoEstaMaisNaLista() {
        VerificacaoDasConexoes.conferir(List.of("k1", "k2"), Set.of("k1", "k2"));
        VerificacaoDasConexoes.conferir(List.of(), Set.of());
        assertThatThrownBy(() -> VerificacaoDasConexoes.conferir(List.of("k1", "velha"), Set.of("k1")))
                .isInstanceOf(IllegalStateException.class).hasMessageNotContaining("velha");
    }
}
