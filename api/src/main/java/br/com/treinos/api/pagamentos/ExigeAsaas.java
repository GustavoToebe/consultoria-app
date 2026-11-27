package br.com.treinos.api.pagamentos;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Controller ou rota do Overtraining Pay (Asaas): só responde com {@code TREINOS_PAGAMENTOS_ASAAS_HABILITADO=true};
 * desligado, responde 503 {@code OVERTRAINING_PAY_INDISPONIVEL}. Conferida por {@link PagamentosInterceptor}.
 */
@Documented
@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.TYPE, ElementType.METHOD})
public @interface ExigeAsaas {
}
