package br.com.treinos.api.security;

import br.com.treinos.api.TreinosApiApplication;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.config.YamlPropertiesFactoryBean;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.core.io.ClassPathResource;

import java.time.Duration;
import java.util.Properties;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * Seção 5.6: segredos e banco vêm só de variável de ambiente, sem valor padrão. Faltando a variável, a API não sobe
 * (em vez de subir com um segredo conhecido).
 */
class ConfiguracaoProducaoTest {

    @Test
    void segredosNaoTemValorPadrao() {
        YamlPropertiesFactoryBean yaml = new YamlPropertiesFactoryBean();
        yaml.setResources(new ClassPathResource("application.yml"));
        Properties padrao = yaml.getObject();

        assertThat(padrao).isNotNull();
        assertSemPadrao(padrao, "treinos.security.jwt.secret", "TREINOS_JWT_SEGREDO");
        assertSemPadrao(padrao, "spring.datasource.url", "DB_URL");
        assertSemPadrao(padrao, "spring.datasource.username", "DB_USUARIO");
        assertSemPadrao(padrao, "spring.datasource.password", "DB_SENHA");
    }

    @Test
    void contextoPadraoSemAsVariaveisNaoSobe() {
        assumeTrue(System.getenv("TREINOS_JWT_SEGREDO") == null && System.getenv("DB_URL") == null,
                "a máquina já tem as variáveis definidas");
        assertThatThrownBy(() -> new SpringApplicationBuilder(TreinosApiApplication.class)
                .web(WebApplicationType.NONE)
                .run().close())
                .isInstanceOf(Exception.class);
    }

    @Test
    void segredoJwtAusenteCurtoOuInvalidoImpedeASubida() {
        assertThatThrownBy(() -> new JwtService(propriedades(null)))
                .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> new JwtService(propriedades("c2VncmVkby1jdXJ0bw==")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("32 bytes");
        assertThatThrownBy(() -> new JwtService(propriedades("isto não é base64!")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Base64");
    }

    private static SecurityProperties propriedades(String segredo) {
        return new SecurityProperties(new SecurityProperties.Jwt(segredo, Duration.ofMinutes(15)), Duration.ofDays(30),
                "/auth", true, new SecurityProperties.Cors(java.util.List.of()));
    }

    private static void assertSemPadrao(Properties props, String chave, String variavel) {
        assertThat(props.getProperty(chave)).as(chave).isEqualTo("${" + variavel + "}");
    }
}
