package br.com.treinos.api.contratos;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Controller do contrato digital: só responde com {@code TREINOS_CONTRATOS_HABILITADO=true}; desligado, 503
 * {@code CONTRATOS_INDISPONIVEL} em toda rota dele, leitura inclusive. Conferida por {@link ContratosConfiguracao}.
 */
@Documented
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.TYPE)
public @interface ExigeContratos {
}
