package br.com.treinos.api.migracao;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Controller da migração assistida (diagnóstico do arquivo): só responde com {@code TREINOS_MIGRACAO_ASSISTIDA_HABILITADA=true};
 * desligado, 503 {@code MIGRACAO_INDISPONIVEL}. A anotação vale para a classe inteira: só um controller novo a leva, nunca o da
 * importação que já existe. Conferida por {@link MigracaoAssistidaConfiguracao}.
 */
@Documented
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.TYPE)
public @interface ExigeMigracaoAssistida {
}
