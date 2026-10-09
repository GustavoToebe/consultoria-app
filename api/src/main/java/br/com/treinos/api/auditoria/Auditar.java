package br.com.treinos.api.auditoria;
import java.lang.annotation.*;
@Retention(RetentionPolicy.RUNTIME) @Target(ElementType.METHOD)
public @interface Auditar {
    String acao();
    String entidade();
    String resumo();
}
