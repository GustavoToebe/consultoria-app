package br.com.treinos.api.atencao;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Controller das regras de atenção: só responde com {@code TREINOS_REGRAS_ATENCAO_HABILITADO=true}; desligado, 503
 * {@code REGRAS_ATENCAO_INDISPONIVEIS} em toda rota dele, leitura inclusive. Conferida por {@link RegrasAtencaoConfiguracao}.
 */
@Documented
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.TYPE)
public @interface ExigeRegrasAtencao {
}
