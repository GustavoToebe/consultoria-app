package br.com.treinos.api.pagamentos;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * Aplica {@link ExigePagamentos} e {@link ExigeInfinitePay} antes do controller (nessa ordem: o financeiro desligado vale
 * mais); o erro sai pelo tratador da biblioteca.
 */
@Component
public class PagamentosInterceptor implements HandlerInterceptor {

    private final PagamentosProperties propriedades;
    private final InfinitePayProperties infinitePay;

    public PagamentosInterceptor(PagamentosProperties propriedades, InfinitePayProperties infinitePay) {
        this.propriedades = propriedades;
        this.infinitePay = infinitePay;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if (!(handler instanceof HandlerMethod metodo)) {
            return true;
        }
        if (!propriedades.habilitado() && AnnotatedElementUtils.hasAnnotation(metodo.getBeanType(), ExigePagamentos.class)) {
            throw new FinanceiroIndisponivelException();
        }
        if (!infinitePay.habilitado() && (AnnotatedElementUtils.hasAnnotation(metodo.getBeanType(), ExigeInfinitePay.class)
                || AnnotatedElementUtils.hasAnnotation(metodo.getMethod(), ExigeInfinitePay.class))) {
            throw new RecebimentoOnlineIndisponivelException();
        }
        return true;
    }
}
