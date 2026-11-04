package br.com.treinos.api.migracao;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** Com {@link MigracaoAssistidaProperties#habilitado()} falso, toda rota marcada com {@link ExigeMigracaoAssistida} responde 503. */
@Configuration
@EnableConfigurationProperties(MigracaoAssistidaProperties.class)
public class MigracaoAssistidaConfiguracao implements WebMvcConfigurer {

    private final MigracaoAssistidaProperties propriedades;

    public MigracaoAssistidaConfiguracao(MigracaoAssistidaProperties propriedades) {
        this.propriedades = propriedades;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(new HandlerInterceptor() {
            @Override
            public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
                if (!propriedades.habilitado() && handler instanceof HandlerMethod metodo
                        && AnnotatedElementUtils.hasAnnotation(metodo.getBeanType(), ExigeMigracaoAssistida.class)) {
                    throw new MigracaoIndisponivelException();
                }
                return true;
            }
        });
    }
}
