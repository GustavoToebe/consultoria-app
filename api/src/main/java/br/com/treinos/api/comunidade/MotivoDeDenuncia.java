package br.com.treinos.api.comunidade;

import java.util.Optional;

/** Motivo da denúncia de um post (C10, lista fechada). */
public enum MotivoDeDenuncia {
    OFENSIVO, SPAM, IMPROPRIO, OUTRO;

    public static Optional<MotivoDeDenuncia> de(String nome) {
        for (MotivoDeDenuncia m : values()) {
            if (m.name().equals(nome)) {
                return Optional.of(m);
            }
        }
        return Optional.empty();
    }
}
