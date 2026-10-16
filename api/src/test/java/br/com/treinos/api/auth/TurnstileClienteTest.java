package br.com.treinos.api.auth;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** A chamada ao siteverify contra um servidor local: o que vai no corpo e cada tipo de resposta. */
class TurnstileClienteTest {

    private static SiteverifyFalso falso;
    private static TurnstileCliente cliente;

    @BeforeAll
    static void subir() {
        falso = new SiteverifyFalso();
        cliente = new TurnstileCliente(new TurnstileProperties(true, "chave-publica", "segredo-de-teste", falso.url()));
    }

    @AfterAll
    static void descer() {
        falso.close();
    }

    @Test
    void enviaSegredoTokenEIpDoClienteEAprovaOTokenValido() {
        falso.chamadas().clear();
        assertThat(cliente.verificar(SiteverifyFalso.OK, "203.0.113.9")).isEqualTo(TurnstileCliente.Veredito.APROVADO);
        var chamada = falso.chamadas().getLast();
        assertThat(chamada).containsEntry("secret", "segredo-de-teste").containsEntry("response", SiteverifyFalso.OK)
                .containsEntry("remoteip", "203.0.113.9");
    }

    @Test
    void semIpNaoMandaORemoteip() {
        falso.chamadas().clear();
        cliente.verificar(SiteverifyFalso.OK, null);
        assertThat(falso.chamadas().getLast()).doesNotContainKey("remoteip");
    }

    @Test
    void tokenRecusadoPelaCloudflareERecusado() {
        assertThat(cliente.verificar(SiteverifyFalso.RUIM, "203.0.113.9")).isEqualTo(TurnstileCliente.Veredito.RECUSADO);
        assertThat(cliente.verificar("qualquer-outro", "203.0.113.9")).isEqualTo(TurnstileCliente.Veredito.RECUSADO);
    }

    @Test
    void cloudflareForaOuRespostaEstranhaFalhaFechadoComoIndisponivel() {
        for (String token : new String[] {SiteverifyFalso.QUEDA, SiteverifyFalso.LIXO, SiteverifyFalso.SEGREDO_INVALIDO}) {
            assertThatThrownBy(() -> cliente.verificar(token, "203.0.113.9")).as(token)
                    .isInstanceOfSatisfying(VerificacaoHumanaException.class,
                            e -> assertThat(e.getCodigo()).isEqualTo(VerificacaoHumanaException.INDISPONIVEL));
        }
    }

    @Test
    void servidorQueNaoRespondeFalhaFechadoComoIndisponivel() {
        var morto = new TurnstileCliente(new TurnstileProperties(true, "k", "s", "http://127.0.0.1:1/turnstile/v0/siteverify"));
        assertThatThrownBy(() -> morto.verificar(SiteverifyFalso.OK, "203.0.113.9"))
                .isInstanceOfSatisfying(VerificacaoHumanaException.class,
                        e -> assertThat(e.getCodigo()).isEqualTo(VerificacaoHumanaException.INDISPONIVEL));
    }
}
