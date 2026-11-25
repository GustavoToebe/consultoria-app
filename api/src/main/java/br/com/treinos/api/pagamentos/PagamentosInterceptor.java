package br.com.treinos.api.pagamentos;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * Aplica {@link ExigePagamentos}, {@link ExigeInfinitePay}, {@link ExigeKiwify}, {@link ExigeAsaas} e
 * {@link ExigeRecebimentoOnline} antes do controller (nessa ordem: o financeiro desligado vale mais); o erro sai pelo
 * tratador da biblioteca.
 */
@Component
public class PagamentosInterceptor implements HandlerInterceptor {

    private final PagamentosProperties propriedades;
    private final InfinitePayProperties infinitePay;
    private final KiwifyProperties kiwify;
    private final AsaasProperties asaas;

    public PagamentosInterceptor(PagamentosProperties propriedades, InfinitePayProperties infinitePay,
                                 KiwifyProperties kiwify, AsaasProperties asaas) {
        this.propriedades = propriedades;
        this.infinitePay = infinitePay;
        this.kiwify = kiwify;
        this.asaas = asaas;
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
        if (!kiwify.habilitado() && tem(metodo, ExigeKiwify.class)) {
            throw new KiwifyIndisponivelException();
        }
        if (!asaas.habilitado() && tem(metodo, ExigeAsaas.class)) {
            throw new AsaasIndisponivelException();
        }
        if (!infinitePay.habilitado() && !kiwify.habilitado() && !asaas.habilitado() && tem(metodo, ExigeRecebimentoOnline.class)) {
            throw new RecebimentoOnlineIndisponivelException();
        }
        return true;
    }

    private static boolean tem(HandlerMethod metodo, Class<? extends java.lang.annotation.Annotation> anotacao) {
        return AnnotatedElementUtils.hasAnnotation(metodo.getBeanType(), anotacao)
                || AnnotatedElementUtils.hasAnnotation(metodo.getMethod(), anotacao);
    }
}
