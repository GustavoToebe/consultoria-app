package br.com.treinos.api.security;

import br.com.treinos.api.TreinosApiApplication;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.config.YamlPropertiesFactoryBean;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.core.io.ClassPathResource;

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
        assertSemPadrao(padrao, "plataforma.auth.jwt.secret", "TREINOS_JWT_SEGREDO");
        assertSemPadrao(padrao, "plataforma.auth.login.sal", "TREINOS_LOGIN_SAL");
        assertSemPadrao(padrao, "spring.datasource.url", "DB_URL");
        assertSemPadrao(padrao, "spring.datasource.username", "DB_USUARIO");
        assertSemPadrao(padrao, "spring.datasource.password", "DB_SENHA");
    }

    /** Perfil de produção: o Flyway e o módulo migram com MIGRATION_DB_* (ou DB_*) e o papel da API é obrigatório. */
    @Test
    void perfilDockerExigeOPapelDaApiEMigraComAsCredenciaisDoMigrador() {
        YamlPropertiesFactoryBean yaml = new YamlPropertiesFactoryBean();
        yaml.setResources(new ClassPathResource("application-docker.yml"));
        Properties docker = yaml.getObject();

        assertThat(docker).isNotNull();
        assertSemPadrao(docker, "spring.flyway.placeholders.papelApp", "PLATAFORMA_PAPEL_APP");
        assertSemPadrao(docker, "plataforma.auth.migracao.papel-app", "PLATAFORMA_PAPEL_APP");
        for (String prefixo : new String[] {"spring.flyway.", "plataforma.auth.migracao."}) {
            assertThat(docker.getProperty(prefixo + "url")).as(prefixo + "url").isEqualTo("${MIGRATION_DB_URL:${DB_URL}}");
            assertThat(docker.getProperty(prefixo + "user")).as(prefixo + "user").isEqualTo("${MIGRATION_DB_USER:${DB_USUARIO}}");
            assertThat(docker.getProperty(prefixo + "password")).as(prefixo + "password").isEqualTo("${MIGRATION_DB_PASSWORD:${DB_SENHA}}");
        }
    }

    @Test
    void contextoPadraoSemAsVariaveisNaoSobe() {
        assumeTrue(System.getenv("TREINOS_JWT_SEGREDO") == null && System.getenv("TREINOS_LOGIN_SAL") == null
                        && System.getenv("DB_URL") == null,
                "a máquina já tem as variáveis definidas");
        assertThatThrownBy(() -> new SpringApplicationBuilder(TreinosApiApplication.class)
                .web(WebApplicationType.NONE)
                .run().close())
                .isInstanceOf(Exception.class);
    }

    private static void assertSemPadrao(Properties props, String chave, String variavel) {
        assertThat(props.getProperty(chave)).as(chave).isEqualTo("${" + variavel + "}");
    }
}
