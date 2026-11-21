package br.com.treinos.api.whatsapp;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Rota (ou controller inteiro) do WhatsApp que só responde com {@code TREINOS_WHATSAPP_HABILITADO=true}; desligado, 503
 * {@code WHATSAPP_INDISPONIVEL}. Conferida por {@link WhatsAppConfiguracao}.
 */
@Documented
@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.TYPE, ElementType.METHOD})
public @interface ExigeWhatsApp {
}
