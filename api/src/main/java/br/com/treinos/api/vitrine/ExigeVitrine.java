package br.com.treinos.api.vitrine;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Controller da vitrine: só responde com {@code TREINOS_VITRINE_HABILITADA=true}; desligada, 503 {@code VITRINE_INDISPONIVEL}
 * em toda rota dele, leitura inclusive. Conferida por {@link VitrineConfiguracao}.
 */
@Documented
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.TYPE)
public @interface ExigeVitrine {
}
