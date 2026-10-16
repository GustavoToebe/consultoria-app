package br.com.treinos.api.conta;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

import java.util.Set;

/** Aplica {@link ExigeFuncionalidade} antes do controller; o erro sai pelo {@code TratadorDoApp}. */
@Component
public class FuncionalidadeInterceptor implements HandlerInterceptor {

    private static final Set<String> LIVRES = Set.of("GET", "HEAD", "OPTIONS", "DELETE");

    private final PlanoDaConsultoria plano;

    public FuncionalidadeInterceptor(PlanoDaConsultoria plano) {
        this.plano = plano;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if (!(handler instanceof HandlerMethod metodo) || LIVRES.contains(request.getMethod())) {
            return true;
        }
        ExigeFuncionalidade exigencia = AnnotatedElementUtils.findMergedAnnotation(metodo.getMethod(), ExigeFuncionalidade.class);
        if (exigencia == null) {
            exigencia = AnnotatedElementUtils.findMergedAnnotation(metodo.getBeanType(), ExigeFuncionalidade.class);
        }
        if (exigencia != null) {
            plano.exigirFuncionalidade(exigencia.value());
        }
        return true;
    }
}
