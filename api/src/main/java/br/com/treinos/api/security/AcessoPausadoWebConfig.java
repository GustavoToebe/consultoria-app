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
        // Sair, renovar a sessão e as rotas públicas nunca são do aluno pausado: o app manda o Bearer em toda chamada e o
        // logout barrado deixaria o refresh vivo. A lista fechada do interceptor segue valendo para todo o resto.
        registry.addInterceptor(interceptor).excludePathPatterns("/auth/**", "/publico/**", "/actuator/**");
    }
}
