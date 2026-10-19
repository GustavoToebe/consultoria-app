package br.com.treinos.api.auth;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.net.URI;
import java.util.Locale;

/**
 * Ligado sem chave pública ou sem segredo, a API não sobe (e a mensagem diz só o nome da variável). O hostname que o token
 * precisa trazer é o de {@code TREINOS_TURNSTILE_HOSTNAME} ou, sem ele, o do {@code APP_URL}.
 */
@Configuration
@EnableConfigurationProperties(TurnstileProperties.class)
public class TurnstileConfiguracao {

    @Bean
    TurnstileCliente turnstileCliente(TurnstileProperties propriedades, @Value("${treinos.app-url:}") String appUrl) {
        String hostname = hostnameEsperado(propriedades.hostname(), appUrl);
        if (propriedades.habilitado()) {
            propriedades.exigirCompleta();
            if (hostname.isEmpty()) {
                throw new IllegalStateException("Turnstile ligado, mas falta TREINOS_TURNSTILE_HOSTNAME (ou um APP_URL completo).");
            }
        }
        return new TurnstileCliente(propriedades, hostname);
    }

    static String hostnameEsperado(String configurado, String appUrl) {
        if (!configurado.isEmpty()) {
            return configurado.toLowerCase(Locale.ROOT);
        }
        try {
            String host = URI.create(appUrl == null ? "" : appUrl.trim()).getHost();
            return host == null ? "" : host.toLowerCase(Locale.ROOT);
        } catch (IllegalArgumentException e) {
            return "";
        }
    }
}
