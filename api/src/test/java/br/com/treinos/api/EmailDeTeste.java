package br.com.treinos.api;

import br.com.plataforma.comum.auth.EnvioDeEmailException;
import br.com.plataforma.comum.auth.EnviadorDeEmail;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Troca só o provedor do e-mail de acesso por um que guarda as mensagens (o resto da pilha é a de verdade, inclusive o despacho
 * em thread virtual). Compartilhado pela suíte: cada teste procura pelo destinatário, que é um e-mail único.
 */
@TestConfiguration(proxyBeanMethods = false)
public class EmailDeTeste {

    public static final List<EnviadorDeEmail.Mensagem> ENVIADAS = new CopyOnWriteArrayList<>();
    public static final AtomicBoolean FALHAR = new AtomicBoolean();

    @Bean
    EnviadorDeEmail enviadorDeTeste() {
        return mensagem -> {
            if (FALHAR.get()) {
                throw new EnvioDeEmailException("Provedor de teste fora do ar.");
            }
            ENVIADAS.add(mensagem);
        };
    }

    public static List<EnviadorDeEmail.Mensagem> para(String email) {
        return ENVIADAS.stream().filter(m -> m.para().equalsIgnoreCase(email)).toList();
    }
}
