package br.com.treinos.api.vitrine;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** Com {@link VitrineProperties#habilitada()} falso, toda rota marcada com {@link ExigeVitrine} responde 503, leitura inclusive. */
@Configuration
@EnableConfigurationProperties(VitrineProperties.class)
public class VitrineConfiguracao implements WebMvcConfigurer {

    private final VitrineProperties propriedades;

    public VitrineConfiguracao(VitrineProperties propriedades) {
        this.propriedades = propriedades;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(new HandlerInterceptor() {
            @Override
            public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
                if (!propriedades.habilitada() && handler instanceof HandlerMethod metodo
                        && AnnotatedElementUtils.hasAnnotation(metodo.getBeanType(), ExigeVitrine.class)) {
                    throw new VitrineIndisponivelException();
                }
                return true;
            }
        });
    }
}
