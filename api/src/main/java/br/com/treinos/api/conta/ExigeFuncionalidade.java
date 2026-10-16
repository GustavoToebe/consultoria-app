package br.com.treinos.api.conta;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Rota (ou controller inteiro) que só vale se o plano da consultoria incluir a funcionalidade
 * ({@link RecursosDoApp#FUNCIONALIDADES}). Barra só o que cria ou altera (POST, PUT, PATCH): leitura e exclusão ficam
 * livres, porque o plano que cai nunca apaga nem esconde o que já existe. Conferida por {@link FuncionalidadeInterceptor}.
 */
@Documented
@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.TYPE, ElementType.METHOD})
public @interface ExigeFuncionalidade {

    /** Código da funcionalidade, de {@link RecursosDoApp}. */
    String value();
}
