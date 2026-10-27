package br.com.treinos.api.ciclo;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** Com {@link CicloProperties#habilitado()} falso, toda rota marcada com {@link ExigeCiclo} responde 503, leitura inclusive. */
@Configuration
@EnableConfigurationProperties(CicloProperties.class)
public class CicloConfiguracao implements WebMvcConfigurer {

    private final CicloProperties propriedades;

    public CicloConfiguracao(CicloProperties propriedades) {
        this.propriedades = propriedades;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(new HandlerInterceptor() {
            @Override
            public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
                if (!propriedades.habilitado() && handler instanceof HandlerMethod metodo
                        && AnnotatedElementUtils.hasAnnotation(metodo.getBeanType(), ExigeCiclo.class)) {
                    throw new CicloDesligadoException();
                }
                return true;
            }
        });
    }
}
