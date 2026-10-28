package br.com.treinos.api.retorno;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Controller do retorno ao aluno (concluir treino): só responde com {@code TREINOS_RETORNO_HABILITADO=true}; desligado,
 * 503 {@code RETORNO_INDISPONIVEL} em toda rota dele, leitura inclusive. Conferida por {@link RetornoConfiguracao}.
 */
@Documented
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.TYPE)
public @interface ExigeRetorno {
}
