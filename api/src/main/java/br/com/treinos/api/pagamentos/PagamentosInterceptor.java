package br.com.treinos.api.pagamentos;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

/** Aplica {@link ExigePagamentos} antes do controller; o erro sai pelo tratador da biblioteca. */
@Component
public class PagamentosInterceptor implements HandlerInterceptor {

    private final PagamentosProperties propriedades;

    public PagamentosInterceptor(PagamentosProperties propriedades) {
        this.propriedades = propriedades;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if (handler instanceof HandlerMethod metodo && !propriedades.habilitado()
                && AnnotatedElementUtils.hasAnnotation(metodo.getBeanType(), ExigePagamentos.class)) {
            throw new FinanceiroIndisponivelException();
        }
        return true;
    }
}
