package br.com.treinos.api.web;

import java.util.Optional;
import java.util.function.Supplier;

/**
 * Confere que um registro existe sem precisar do valor (igual à Central). Deixa explícita a intenção onde a consulta
 * serve só pela trava ou pela exceção, sem desligar a regra ReturnValueIgnored do Error Prone no resto do código.
 */
public final class Exigir {

    private Exigir() { }

    @SuppressWarnings("ReturnValueIgnored")
    public static <X extends Throwable> void existe(Optional<?> valor, Supplier<? extends X> erro) throws X {
        valor.orElseThrow(erro);
    }
}
