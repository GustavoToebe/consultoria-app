package br.com.treinos.api.vitrine;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Controller ou rota da página pública da loja: só responde com a vitrine e a loja ligadas
 * ({@link VitrineProperties#lojaEfetiva()}); desligada, 503 {@code LOJA_INDISPONIVEL}. Conferida por {@link VitrineConfiguracao}.
 */
@Documented
@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.TYPE, ElementType.METHOD})
public @interface ExigeLoja {
}
