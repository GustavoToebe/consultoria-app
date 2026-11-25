package br.com.treinos.api.security;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class AcessoPausadoWebConfig implements WebMvcConfigurer {

    private final AcessoPausadoInterceptor interceptor;

    public AcessoPausadoWebConfig(AcessoPausadoInterceptor interceptor) {
        this.interceptor = interceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(interceptor);
    }
}
