package br.com.treinos.api.inscricoes;

import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/** Código do link de inscrição: 144 bits em base64 url-safe (24 caracteres) e formato conferido antes do banco. */
class CodigoDeInscricaoTest {

    @Test
    void codigoNovoTem24CaracteresUrlSafeENaoSeRepete() {
        Set<String> vistos = new HashSet<>();
        for (int i = 0; i < 1000; i++) {
            String codigo = CodigoDeInscricao.novo();
            assertThat(codigo).hasSize(CodigoDeInscricao.TAMANHO).matches("[A-Za-z0-9_-]{24}");
            assertThat(CodigoDeInscricao.valido(codigo)).isTrue();
            assertThat(vistos.add(codigo)).isTrue();
        }
    }

    @Test
    void formatoForaDoPadraoEInvalido() {
        assertThat(CodigoDeInscricao.valido(null)).isFalse();
        assertThat(CodigoDeInscricao.valido("")).isFalse();
        assertThat(CodigoDeInscricao.valido("A".repeat(23))).isFalse();
        assertThat(CodigoDeInscricao.valido("A".repeat(25))).isFalse();
        assertThat(CodigoDeInscricao.valido("A".repeat(23) + "/")).isFalse();
        assertThat(CodigoDeInscricao.valido("A".repeat(23) + "=")).isFalse();
        assertThat(CodigoDeInscricao.valido("a-_".repeat(8))).isTrue();
    }
}
