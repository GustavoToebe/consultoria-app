package br.com.treinos.api.pagamentos;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Controller da Kiwify: só responde com {@code TREINOS_PAGAMENTOS_KIWIFY_HABILITADO=true}; desligado, 503
 * {@code KIWIFY_INDISPONIVEL}. Vale além de {@link ExigePagamentos} (conferido antes). Conferida por {@link PagamentosInterceptor}.
 */
@Documented
@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.TYPE, ElementType.METHOD})
public @interface ExigeKiwify {
}
