package br.com.treinos.api.demo;

import br.com.treinos.api.consultoria.ConsultoriaRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Roda o {@link SeedDemo} na subida, só no profile {@code demo} ({@code treinos.demo.seed=true}) e só com o banco sem
 * nenhuma consultoria. {@code DEMO_SENHA} é obrigatória nesse profile (sem valor padrão): faltando, a API não sobe.
 */
@Component
@ConditionalOnProperty(name = "treinos.demo.seed", havingValue = "true")
public class SeedDemoRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(SeedDemoRunner.class);

    private final SeedDemo seed;
    private final ConsultoriaRepository consultorias;
    private final String senha;

    public SeedDemoRunner(SeedDemo seed, ConsultoriaRepository consultorias,
                          @Value("${treinos.demo.senha}") String senha) {
        this.seed = seed;
        this.consultorias = consultorias;
        this.senha = senha;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (consultorias.count() > 0) {
            log.info("Seed de demonstração ignorado: o banco já tem consultorias.");
            return;
        }
        seed.criar(senha);
        log.info("Seed de demonstração criado: 2 consultorias, 2 treinadores, 2 alunos (dados fictícios).");
    }
}
