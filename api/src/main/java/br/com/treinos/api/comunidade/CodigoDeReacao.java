package br.com.treinos.api.comunidade;

import java.util.Optional;

/**
 * Reação do mural por código de lista fechada (D6): o banco, as respostas e a exportação usam o código; o emoji é só desenho no
 * app. Uma pessoa pode ter vários códigos no mesmo post. A ordem do enum é a ordem em que a API devolve {@code minhasReacoes}.
 */
public enum CodigoDeReacao {
    CURTIR, FORCA, FOGO, PALMAS, RISO;

    /** Nome exato (a lista é fechada); desconhecido vira vazio. */
    public static Optional<CodigoDeReacao> de(String nome) {
        for (CodigoDeReacao c : values()) {
            if (c.name().equals(nome)) {
                return Optional.of(c);
            }
        }
        return Optional.empty();
    }
}
