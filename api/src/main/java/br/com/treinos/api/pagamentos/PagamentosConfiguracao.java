package br.com.treinos.api.pagamentos;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
@EnableConfigurationProperties(PagamentosProperties.class)
public class PagamentosConfiguracao implements WebMvcConfigurer {

    private final PagamentosInterceptor interceptor;

    public PagamentosConfiguracao(PagamentosInterceptor interceptor) {
        this.interceptor = interceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(interceptor);
    }
}
