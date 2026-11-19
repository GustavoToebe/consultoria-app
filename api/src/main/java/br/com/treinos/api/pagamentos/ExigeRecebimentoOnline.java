package br.com.treinos.api.pagamentos;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Rota que serve a qualquer recebimento online (hoje as conferências): responde com a InfinitePay OU a Kiwify ligada; com as
 * duas desligadas, 503 {@code RECEBIMENTO_ONLINE_INDISPONIVEL}. Conferida por {@link PagamentosInterceptor}.
 */
@Documented
@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.TYPE, ElementType.METHOD})
public @interface ExigeRecebimentoOnline {
}
