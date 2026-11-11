package br.com.treinos.api.comunidade;

import java.util.Optional;

/**
 * Tipo da publicação do mural (C1 e C2, lista fechada). {@code AVISO} e {@code VIDEO} só a equipe publica; o aluno publica
 * {@code CONVERSA} (o padrão, para o post sem assunto), {@code DUVIDA} e {@code RESULTADO}.
 */
public enum TipoDePost {
    AVISO(false), VIDEO(false), DUVIDA(true), RESULTADO(true), CONVERSA(true);

    private final boolean doAluno;

    TipoDePost(boolean doAluno) {
        this.doAluno = doAluno;
    }

    public boolean doAluno() {
        return doAluno;
    }

    /** Nome exato (a lista é fechada); desconhecido vira vazio. */
    public static Optional<TipoDePost> de(String nome) {
        for (TipoDePost t : values()) {
            if (t.name().equals(nome)) {
                return Optional.of(t);
            }
        }
        return Optional.empty();
    }
}
