package br.com.treinos.api.pagamentos;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Controller ou rota do recebimento online: só responde com {@code TREINOS_PAGAMENTOS_INFINITEPAY_HABILITADO=true}; desligado,
 * 503 {@code RECEBIMENTO_ONLINE_INDISPONIVEL}. Vale além de {@link ExigePagamentos} (que é conferido antes). Conferida por
 * {@link PagamentosInterceptor}.
 */
@Documented
@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.TYPE, ElementType.METHOD})
public @interface ExigeInfinitePay {
}
