package br.com.treinos.api.demo;

import br.com.treinos.api.auth.UsuarioRepository;
import br.com.treinos.api.consultoria.ConsultoriaRepository;
import br.com.treinos.api.conta.SeedContaDemo;
import br.com.treinos.api.integracao.IntegracaoProperties;
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
 * demonstração anterior à V021 também ganha os dados sem precisar ser apagado. Com a integração com a Central ativa
 * não faz nada: o plano e as cobranças reais vêm de lá, e dado fictício por cima do real seria pior que nenhum.
 */
@Component
@Order(11)
@ConditionalOnProperty(name = "treinos.demo.seed", havingValue = "true")
public class SeedContaDemoRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(SeedContaDemoRunner.class);

    private final SeedContaDemo seed;
    private final UsuarioRepository usuarios;
    private final ConsultoriaRepository consultorias;
    private final IntegracaoProperties integracao;

    public SeedContaDemoRunner(SeedContaDemo seed, UsuarioRepository usuarios, ConsultoriaRepository consultorias,
                               IntegracaoProperties integracao) {
        this.integracao = integracao;
        this.seed = seed;
        this.usuarios = usuarios;
        this.consultorias = consultorias;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (integracao.ativa()) {
            log.info("Integração com a Central ativa: Minha conta de demonstração não é semeada.");
            return;
        }
        for (String email : List.of(SeedDemo.SARAIVA, SeedDemo.EXEMPLO)) {
            usuarios.buscarPorEmail(email).ifPresent(u -> consultorias.findById(u.getConsultoriaId())
                    .ifPresent(c -> seed.semear(c.getId(), c.getNome())));
        }
        log.info("Minha conta de demonstração conferida (dados fictícios).");
    }
}
