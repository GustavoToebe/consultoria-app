package br.com.treinos.api.push;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Controller das rotas do token de push: só responde com {@code TREINOS_PUSH_HABILITADO=true}; desligado, 503
 * {@code PUSH_INDISPONIVEL} em toda rota dele. Conferida por {@link PushConfiguracao}.
 */
@Documented
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.TYPE)
public @interface ExigePush {
}
