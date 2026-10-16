package br.com.treinos.api.conta;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class FuncionalidadeWebConfig implements WebMvcConfigurer {

    private final FuncionalidadeInterceptor interceptor;

    public FuncionalidadeWebConfig(FuncionalidadeInterceptor interceptor) {
        this.interceptor = interceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(interceptor);
    }
}
