package br.com.treinos.api.security;

import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** A lista fechada do aluno pausado falha fechada: método, caminho e grafia exatos; qualquer variação é barrada. */
class AcessoPausadoInterceptorTest {

    private static final String COBRANCA = "/aluno/financeiro/cobrancas/" + UUID.randomUUID();

    @Test
    void liberaSoAsRotasDaListaComOMetodoCerto() {
        assertThat(AcessoPausadoInterceptor.permitido("GET", "/eu")).isTrue();
        assertThat(AcessoPausadoInterceptor.permitido("GET", "/aluno/financeiro")).isTrue();
        assertThat(AcessoPausadoInterceptor.permitido("PUT", "/eu/senha")).isTrue();
        assertThat(AcessoPausadoInterceptor.permitido("DELETE", "/aluno/push-token")).isTrue();
        assertThat(AcessoPausadoInterceptor.permitido("POST", "/termos/aceite")).isTrue();
        assertThat(AcessoPausadoInterceptor.permitido("POST", COBRANCA + "/link")).isTrue();
        assertThat(AcessoPausadoInterceptor.permitido("POST", "/aluno/financeiro/cobrancas/"
                + UUID.randomUUID().toString().toUpperCase(java.util.Locale.ROOT) + "/pix")).isTrue();
    }

    @Test
    void outroMetodoNoCaminhoLiberadoEBarrado() {
        assertThat(AcessoPausadoInterceptor.permitido("HEAD", "/eu")).isFalse();
        assertThat(AcessoPausadoInterceptor.permitido("OPTIONS", "/eu")).isFalse();
        assertThat(AcessoPausadoInterceptor.permitido("PUT", "/eu")).isFalse();
        assertThat(AcessoPausadoInterceptor.permitido("POST", "/eu")).isFalse();
        assertThat(AcessoPausadoInterceptor.permitido("PATCH", "/eu/senha")).isFalse();
        assertThat(AcessoPausadoInterceptor.permitido("POST", "/aluno/meus-dados")).isFalse();
        assertThat(AcessoPausadoInterceptor.permitido("GET", COBRANCA + "/link")).isFalse();
        assertThat(AcessoPausadoInterceptor.permitido("get", "/eu")).isFalse();
    }

    @Test
    void grafiaDiferenteEBarrada() {
        assertThat(AcessoPausadoInterceptor.permitido("GET", "/eu/")).isFalse();
        assertThat(AcessoPausadoInterceptor.permitido("GET", "/EU")).isFalse();
        assertThat(AcessoPausadoInterceptor.permitido("GET", "/Aluno/financeiro")).isFalse();
        assertThat(AcessoPausadoInterceptor.permitido("GET", "/eu;x=1")).isFalse();
        assertThat(AcessoPausadoInterceptor.permitido("GET", "/aluno/financeiro/../painel")).isFalse();
        assertThat(AcessoPausadoInterceptor.permitido("POST", COBRANCA + "/link/")).isFalse();
        assertThat(AcessoPausadoInterceptor.permitido("POST", "/aluno/financeiro/cobrancas/123/link")).isFalse();
        assertThat(AcessoPausadoInterceptor.permitido("POST", COBRANCA + "/baixa")).isFalse();
        assertThat(AcessoPausadoInterceptor.permitido("GET", "/aluno/painel")).isFalse();
        assertThat(AcessoPausadoInterceptor.permitido("GET", "")).isFalse();
    }
}
