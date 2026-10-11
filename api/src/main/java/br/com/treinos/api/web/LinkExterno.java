package br.com.treinos.api.web;

import jakarta.validation.Constraint;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import jakarta.validation.Payload;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/** Campo de link externo: vazio vale (sem link); preenchido tem que passar em {@link LinksExternos#valido}. */
@Documented
@Constraint(validatedBy = LinkExterno.Validador.class)
@Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.RECORD_COMPONENT})
@Retention(RetentionPolicy.RUNTIME)
public @interface LinkExterno {

    String message() default LinksExternos.MENSAGEM;

    Class<?>[] groups() default { };

    Class<? extends Payload>[] payload() default { };

    class Validador implements ConstraintValidator<LinkExterno, String> {
        @Override
        public boolean isValid(String valor, ConstraintValidatorContext contexto) {
            return valor == null || valor.isBlank() || LinksExternos.valido(valor.trim());
        }
    }
}
