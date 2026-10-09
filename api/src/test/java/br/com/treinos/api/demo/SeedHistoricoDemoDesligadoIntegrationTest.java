package br.com.treinos.api.demo;

import br.com.treinos.api.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;

import static org.assertj.core.api.Assertions.assertThat;

/** Sem {@code treinos.demo.historico=true} (o padrão) ninguém sobe o histórico: o runner nem existe. */
class SeedHistoricoDemoDesligadoIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private ApplicationContext contexto;

    @Test
    void runnerNaoExisteComAPropriedadeDesligada() {
        assertThat(contexto.getBeansOfType(SeedHistoricoDemoRunner.class)).isEmpty();
        assertThat(contexto.getBeansOfType(SeedHistoricoDemo.class)).hasSize(1);
    }
}
