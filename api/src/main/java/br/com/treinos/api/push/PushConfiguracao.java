package br.com.treinos.api.push;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** Com {@link PushProperties#habilitado()} falso, toda rota marcada com {@link ExigePush} (no método ou no controller) responde 503. */
@Configuration
@EnableConfigurationProperties(PushProperties.class)
public class PushConfiguracao implements WebMvcConfigurer {

    private final PushProperties propriedades;

    public PushConfiguracao(PushProperties propriedades) {
        this.propriedades = propriedades;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(new HandlerInterceptor() {
            @Override
            public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
                if (!propriedades.habilitado() && handler instanceof HandlerMethod metodo
                        && (metodo.hasMethodAnnotation(ExigePush.class)
                        || AnnotatedElementUtils.hasAnnotation(metodo.getBeanType(), ExigePush.class))) {
                    throw new PushIndisponivelException();
                }
                return true;
            }
        });
    }
}
