package br.com.treinos.api.push;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Rota (ou controller inteiro) do push que só responde com {@code TREINOS_PUSH_HABILITADO=true}; desligado, 503
 * {@code PUSH_INDISPONIVEL}. Conferida por {@link PushConfiguracao}. Apagar os tokens do próprio usuário fica fora dela: com a
 * chave desligada depois de o aluno ligar o aviso, o "Sair" ainda precisa conseguir apagar o token que ficou no servidor.
 */
@Documented
@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.TYPE, ElementType.METHOD})
public @interface ExigePush {
}
