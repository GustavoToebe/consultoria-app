package br.com.treinos.api.auth;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Ligado sem chave pública ou sem segredo, a API não sobe (e a mensagem diz só o nome da variável). */
@Configuration
@EnableConfigurationProperties(TurnstileProperties.class)
public class TurnstileConfiguracao {

    @Bean
    TurnstileCliente turnstileCliente(TurnstileProperties propriedades) {
        if (propriedades.habilitado()) {
            propriedades.exigirCompleta();
        }
        return new TurnstileCliente(propriedades);
    }
}
