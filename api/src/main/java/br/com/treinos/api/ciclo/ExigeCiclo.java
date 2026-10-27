package br.com.treinos.api.ciclo;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Controller do ciclo menstrual: só responde com {@code TREINOS_CICLO_HABILITADO=true}; desligado, 503
 * {@code CICLO_INDISPONIVEL_NO_APP} em toda rota dele, leitura inclusive. Conferida por {@link CicloConfiguracao}.
 */
@Documented
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.TYPE)
public @interface ExigeCiclo {
}
