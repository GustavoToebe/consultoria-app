package br.com.treinos.api.alunos;

/** Sexo informado no cadastro. Nulo no banco significa "não informado". */
public enum Sexo {
    MASCULINO,
    FEMININO,
    OUTRO;

    /** Nulo ou em branco vira nulo. Fora do enum, nulo de volta para o chamador recusar com 422. */
    public static Sexo ler(String valor) {
        if (valor == null || valor.isBlank()) {
            return null;
        }
        for (Sexo sexo : values()) {
            if (sexo.name().equals(valor)) {
                return sexo;
            }
        }
        return null;
    }

    public static boolean valido(String valor) {
        return valor == null || valor.isBlank() || ler(valor) != null;
    }
}
