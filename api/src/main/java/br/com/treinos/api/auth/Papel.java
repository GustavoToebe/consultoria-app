package br.com.treinos.api.auth;

/** Papel do usuário; vira {@code ROLE_TREINADOR} ou {@code ROLE_ALUNO} no Spring Security. */
public enum Papel {
    TREINADOR,
    ALUNO;

    public String autoridade() {
        return "ROLE_" + name();
    }
}
