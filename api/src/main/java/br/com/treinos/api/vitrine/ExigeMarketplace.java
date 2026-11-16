package br.com.treinos.api.vitrine;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Controller ou rota da lista pública de lojas (marketplace): só responde com a vitrine, a loja e o marketplace ligados
 * ({@link VitrineProperties#marketplaceEfetivo()}); desligado, 503 {@code MARKETPLACE_INDISPONIVEL}. Conferida por {@link VitrineConfiguracao}.
 */
@Documented
@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.TYPE, ElementType.METHOD})
public @interface ExigeMarketplace {
}
