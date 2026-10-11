package br.com.treinos.api.demo;

import br.com.treinos.api.auth.UsuarioRepository;
import br.com.treinos.api.consultoria.ConsultoriaRepository;
import br.com.treinos.api.conta.SeedContaDemo;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Depois do {@link SeedDemoRunner}, completa a Minha conta (plano, dados comerciais e cobranças fictícios) das duas
 * consultorias do seed. Roda a cada subida do profile de demonstração e só cria o que falta, então um banco de
 * demonstração anterior à V021 também ganha os dados sem precisar ser apagado.
 */
@Component
@Order(11)
@ConditionalOnProperty(name = "treinos.demo.seed", havingValue = "true")
public class SeedContaDemoRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(SeedContaDemoRunner.class);

    private final SeedContaDemo seed;
    private final UsuarioRepository usuarios;
    private final ConsultoriaRepository consultorias;

    public SeedContaDemoRunner(SeedContaDemo seed, UsuarioRepository usuarios, ConsultoriaRepository consultorias) {
        this.seed = seed;
        this.usuarios = usuarios;
        this.consultorias = consultorias;
    }

    @Override
    public void run(ApplicationArguments args) {
        for (String email : List.of(SeedDemo.SARAIVA, SeedDemo.EXEMPLO)) {
            usuarios.buscarPorEmail(email).ifPresent(u -> consultorias.findById(u.getConsultoriaId())
                    .ifPresent(c -> seed.semear(c.getId(), c.getNome())));
        }
        log.info("Minha conta de demonstração conferida (dados fictícios).");
    }
}
