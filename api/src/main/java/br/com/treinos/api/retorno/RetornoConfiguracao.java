package br.com.treinos.api.retorno;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** Com {@link RetornoProperties#habilitado()} falso, toda rota marcada com {@link ExigeRetorno} responde 503, leitura inclusive. */
@Configuration
@EnableConfigurationProperties(RetornoProperties.class)
public class RetornoConfiguracao implements WebMvcConfigurer {

    private final RetornoProperties propriedades;

    public RetornoConfiguracao(RetornoProperties propriedades) {
        this.propriedades = propriedades;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(new HandlerInterceptor() {
            @Override
            public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
                if (!propriedades.habilitado() && handler instanceof HandlerMethod metodo
                        && AnnotatedElementUtils.hasAnnotation(metodo.getBeanType(), ExigeRetorno.class)) {
                    throw new RetornoIndisponivelException();
                }
                return true;
            }
        });
    }
}
