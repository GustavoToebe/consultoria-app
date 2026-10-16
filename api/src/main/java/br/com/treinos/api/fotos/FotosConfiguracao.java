package br.com.treinos.api.fotos;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** O bucket só existe como bean com {@code TREINOS_FOTOS_HABILITADO=true}; desligado, nada aqui é construído. */
@Configuration
@EnableConfigurationProperties(FotosProperties.class)
public class FotosConfiguracao {

    @Bean
    @ConditionalOnProperty(prefix = "treinos.fotos", name = "habilitado", havingValue = "true")
    ArmazenamentoDeFotos armazenamentoDeFotos(FotosProperties propriedades) {
        return new ArmazenamentoS3(propriedades);
    }
}
