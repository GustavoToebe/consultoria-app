package br.com.treinos.api.pagamentos;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Controller do financeiro: só responde com {@code TREINOS_PAGAMENTOS_HABILITADO=true}; desligado, 503
 * {@code FINANCEIRO_INDISPONIVEL} em toda rota dele, leitura inclusive. Conferida por {@link PagamentosInterceptor}.
 */
@Documented
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.TYPE)
public @interface ExigePagamentos {
}
