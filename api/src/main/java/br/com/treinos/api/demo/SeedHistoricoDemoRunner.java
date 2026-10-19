package br.com.treinos.api.demo;

import br.com.treinos.api.execucao.SeedHistoricoDemo;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Roda o {@link SeedHistoricoDemo} na subida, só com {@code treinos.demo.historico=true} (desligado por padrão) e
 * nunca no profile {@code prod}. Vem depois do {@link SeedDemoRunner}. Se faltarem os modelos do guia (ou qualquer passo falhar), registra o erro e
 * segue: a API sobe do mesmo jeito, sem o histórico.
 */
@Component
@Order(20)
@Profile("demo") // além da propriedade: produção roda no perfil "docker", nunca no "demo"
@ConditionalOnProperty(name = "treinos.demo.historico", havingValue = "true")
public class SeedHistoricoDemoRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(SeedHistoricoDemoRunner.class);

    private final SeedHistoricoDemo seed;
    private final String treinador;
    private final String senha;

    public SeedHistoricoDemoRunner(SeedHistoricoDemo seed,
                                   @Value("${treinos.demo.historico-treinador:" + SeedDemo.SARAIVA + "}") String treinador,
                                   @Value("${treinos.demo.senha}") String senha) {
        this.seed = seed;
        this.treinador = treinador;
        this.senha = senha;
    }

    @Override
    public void run(ApplicationArguments args) {
        try {
            SeedHistoricoDemo.Resultado r = seed.criar(treinador, senha);
            if (r != null) {
                log.info("Histórico de demonstração criado: {} alunos, {} pastas, {} execuções, {} pesos, {} atualizações.",
                        r.alunos(), r.pastas(), r.execucoes(), r.pesos(), r.atualizacoes());
            }
        } catch (RuntimeException e) {
            log.error("Histórico de demonstração NÃO criado (pode ter ficado parcial; nesse caso só zerar o banco repara): {}",
                    e.getMessage(), e);
        }
    }
}
