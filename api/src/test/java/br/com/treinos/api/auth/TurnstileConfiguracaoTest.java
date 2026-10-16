package br.com.treinos.api.auth;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import static org.assertj.core.api.Assertions.assertThat;

/** Subida da aplicação com o Turnstile desligado, ligado sem configuração e ligado com tudo. Sem rede e sem Spring completo. */
class TurnstileConfiguracaoTest {

    private final ApplicationContextRunner contexto = new ApplicationContextRunner().withUserConfiguration(TurnstileConfiguracao.class);

    @Test
    void desligadoSobeSemNadaConfigurado() {
        contexto.run(c -> {
            assertThat(c).hasNotFailed();
            assertThat(c.getBean(TurnstileProperties.class).habilitado()).isFalse();
            assertThat(c.getBean(TurnstileProperties.class).verifyUrl()).isEqualTo(TurnstileProperties.VERIFY_URL_PADRAO);
        });
        contexto.withPropertyValues("treinos.turnstile.habilitado=false", "treinos.turnstile.segredo=ignorado")
                .run(c -> assertThat(c).hasNotFailed());
    }

    @Test
    void ligadoSemConfiguracaoNaoSobeEDizSoONomeDaVariavelQueFalta() {
        contexto.withPropertyValues("treinos.turnstile.habilitado=true").run(c -> {
            assertThat(c).hasFailed();
            assertThat(rastro(c.getStartupFailure())).contains("TREINOS_TURNSTILE_SITE_KEY");
        });
        contexto.withPropertyValues("treinos.turnstile.habilitado=true", "treinos.turnstile.site-key=chave-publica-de-teste").run(c -> {
            assertThat(c).hasFailed();
            assertThat(rastro(c.getStartupFailure())).contains("TREINOS_TURNSTILE_SEGREDO").doesNotContain("chave-publica-de-teste");
        });
        contexto.withPropertyValues("treinos.turnstile.habilitado=true", "treinos.turnstile.segredo=segredo-de-teste").run(c -> {
            assertThat(c).hasFailed();
            assertThat(rastro(c.getStartupFailure())).contains("TREINOS_TURNSTILE_SITE_KEY").doesNotContain("segredo-de-teste");
        });
    }

    @Test
    void enderecoDoSiteverifyQueNaoEUrlNaoSobe() {
        contexto.withPropertyValues("treinos.turnstile.habilitado=true", "treinos.turnstile.site-key=k",
                "treinos.turnstile.segredo=s", "treinos.turnstile.verify-url=nao-e-url").run(c -> assertThat(c).hasFailed());
    }

    @Test
    void ligadoComTudoSobe() {
        contexto.withPropertyValues("treinos.turnstile.habilitado=true", "treinos.turnstile.site-key=k",
                "treinos.turnstile.segredo=s").run(c -> assertThat(c).hasNotFailed());
    }

    @Test
    void oObjetoDeConfiguracaoNaoMostraSegredoNoToString() {
        var p = new TurnstileProperties(true, "chave-publica", "segredo-secreto", null);
        assertThat(p.toString()).doesNotContain("segredo-secreto").doesNotContain("chave-publica");
    }

    private static String rastro(Throwable falha) {
        StringBuilder texto = new StringBuilder();
        for (Throwable t = falha; t != null; t = t.getCause()) {
            texto.append(t.getMessage()).append('\n');
        }
        return texto.toString();
    }
}
