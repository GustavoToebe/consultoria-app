package br.com.treinos.api.cep;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/** Liga as propriedades {@code treinos.cep.*} da busca de CEP. */
@Configuration
@EnableConfigurationProperties(CepProperties.class)
public class CepConfiguracao {
}
