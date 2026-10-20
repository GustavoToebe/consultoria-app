package br.com.treinos.api.pagamentos;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** A cifra da API Key do treinador: AES-GCM com a consultoria no dado autenticado, chaves fora do banco, nada de segredo em erro. */
class CifraDePagamentoTest {

    private static final String SEGREDO = "chave-fake-do-teste-123456";
    private static final UUID CONSULTORIA = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID OUTRA = UUID.fromString("22222222-2222-2222-2222-222222222222");

    private static String chave(char c) {
        return Base64.getEncoder().encodeToString(String.valueOf(c).repeat(32).getBytes(StandardCharsets.US_ASCII));
    }

    private static CifraDePagamento cifra(String chaves, String ativa) {
        return new CifraDePagamento(new PagamentosProperties(true, chaves, ativa, false, false));
    }

    @Test
    void idaEVoltaNoFormatoV1() {
        CifraDePagamento cifra = cifra("k1:" + chave('a'), "k1");
        assertThat(cifra.configurada()).isTrue();

        String cifrado = cifra.cifrar(CONSULTORIA, SEGREDO);

        String[] partes = cifrado.split(":", -1);
        assertThat(partes).hasSize(4);
        assertThat(partes[0]).isEqualTo("v1");
        assertThat(partes[1]).isEqualTo("k1");
        assertThat(Base64.getDecoder().decode(partes[2])).hasSize(12);
        assertThat(cifrado).doesNotContain(SEGREDO);
        assertThat(cifra.decifrar(CONSULTORIA, cifrado)).isEqualTo(SEGREDO);
        assertThat(cifra.cifrar(CONSULTORIA, SEGREDO)).as("nonce novo a cada vez").isNotEqualTo(cifrado);
    }

    @Test
    void textoComAcentoVoltaIgual() {
        CifraDePagamento cifra = cifra("k1:" + chave('a'), "k1");
        assertThat(cifra.decifrar(CONSULTORIA, cifra.cifrar(CONSULTORIA, "chavé-çomplexa-123"))).isEqualTo("chavé-çomplexa-123");
    }

    @Test
    void consultoriaDiferenteNaoDecifra() {
        CifraDePagamento cifra = cifra("k1:" + chave('a'), "k1");
        String cifrado = cifra.cifrar(CONSULTORIA, SEGREDO);

        assertThatThrownBy(() -> cifra.decifrar(OUTRA, cifrado)).isInstanceOf(CifraIndisponivelException.class);
    }

    @Test
    void adulteracaoNaoDecifra() {
        CifraDePagamento cifra = cifra("k1:" + chave('a'), "k1");
        String[] partes = cifra.cifrar(CONSULTORIA, SEGREDO).split(":", -1);
        byte[] texto = Base64.getDecoder().decode(partes[3]);
        texto[0] ^= 1;
        String adulterado = String.join(":", partes[0], partes[1], partes[2], Base64.getEncoder().encodeToString(texto));

        assertThatThrownBy(() -> cifra.decifrar(CONSULTORIA, adulterado)).isInstanceOf(CifraIndisponivelException.class);
        for (String lixo : new String[] {"", "abc", "v2:k1:AAAAAAAAAAAAAAAA:AAAA", "v1:k1:curto:AAAA", "v1:desconhecida:AAAAAAAAAAAAAAAA:AAAA", "v1:k1:!!!!:!!!!"}) {
            assertThatThrownBy(() -> cifra.decifrar(CONSULTORIA, lixo)).as(lixo).isInstanceOf(CifraIndisponivelException.class);
        }
    }

    @Test
    void chaveRotacionadaDecifraOQueFoiCifradoComAAntiga() {
        String antiga = cifra("k1:" + chave('a'), "k1").cifrar(CONSULTORIA, SEGREDO);

        CifraDePagamento nova = cifra("k1:" + chave('a') + ",k2:" + chave('b'), "k2");

        assertThat(nova.decifrar(CONSULTORIA, antiga)).isEqualTo(SEGREDO);
        assertThat(nova.cifrar(CONSULTORIA, SEGREDO)).startsWith("v1:k2:");
        assertThat(nova.idsDasChaves()).containsExactlyInAnyOrder("k1", "k2");
        // Sem a chave antiga na lista o que foi cifrado com ela não abre.
        CifraDePagamento semAntiga = cifra("k2:" + chave('b'), "k2");
        assertThatThrownBy(() -> semAntiga.decifrar(CONSULTORIA, antiga)).isInstanceOf(CifraIndisponivelException.class);
    }

    @Test
    void semChavesNaoCifraMasConstroi() {
        CifraDePagamento vazia = cifra("", "");

        assertThat(vazia.configurada()).isFalse();
        assertThatThrownBy(() -> vazia.cifrar(CONSULTORIA, SEGREDO)).isInstanceOfSatisfying(CifraIndisponivelException.class,
                e -> assertThat(e.getStatus().value()).isEqualTo(503));
        assertThat(cifra(null, null).configurada()).isFalse();
    }

    @Test
    void chaveInvalidaOuAtivaAusenteDerrubaAConstrucao() {
        String curta = Base64.getEncoder().encodeToString("curta".getBytes(StandardCharsets.US_ASCII));
        for (String invalida : new String[] {"k1:" + curta, "k1", "k 1:" + chave('a'), "k1:nao-e-base64!", ":" + chave('a'),
                "k1:" + chave('a') + ",k1:" + chave('b')}) {
            assertThatThrownBy(() -> cifra(invalida, "k1")).as(invalida).isInstanceOf(IllegalStateException.class);
        }
        assertThatThrownBy(() -> cifra("k1:" + chave('a'), "k2")).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> cifra("k1:" + chave('a'), "")).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> cifra("", "k1")).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void nuncaImprimeOSegredoNemAsChaves() {
        String chaves = "k1:" + chave('a');
        CifraDePagamento cifra = cifra(chaves, "k1");
        String cifrado = cifra.cifrar(CONSULTORIA, SEGREDO);
        PagamentosProperties propriedades = new PagamentosProperties(true, chaves, "k1", false, false);

        assertThat(cifra.toString()).doesNotContain(chave('a')).doesNotContain(SEGREDO);
        assertThat(propriedades.toString()).doesNotContain(chave('a')).doesNotContain("k1");
        assertThatThrownBy(() -> cifra.decifrar(OUTRA, cifrado)).satisfies(e -> {
            assertThat(e.getMessage()).doesNotContain(SEGREDO).doesNotContain(cifrado).doesNotContain(chave('a'));
            assertThat(e.getCause()).isNull();
        });
        assertThatThrownBy(() -> cifra("k1:" + chave('a') + ",k1:" + chave('b'), "k1")).satisfies(e ->
                assertThat(e.getMessage()).doesNotContain(chave('a')).doesNotContain(chave('b')));
    }
}
