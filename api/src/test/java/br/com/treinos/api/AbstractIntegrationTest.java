package br.com.treinos.api;

import br.com.plataforma.comum.teste.PostgresDeTeste;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.postgresql.PostgreSQLContainer;

/**
 * Base dos testes de integração (como a Central): um Postgres por execução da suíte. A imagem vem do plataforma-parent
 * (propriedade {@code plataforma.postgres.imagem}, repassada pelo Surefire): 18 por padrão, igual ao Docker local.
 */
@SpringBootTest
@ActiveProfiles("test")
@Import(EmailDeTeste.class)
public abstract class AbstractIntegrationTest {

    static final PostgreSQLContainer POSTGRES = PostgresDeTeste.iniciar("treinos_test", "treinos_test", "treinos_test");

    @DynamicPropertySource
    static void datasourceProperties(DynamicPropertyRegistry registry) {
        PostgresDeTeste.registrar(registry, POSTGRES);
    }
}
