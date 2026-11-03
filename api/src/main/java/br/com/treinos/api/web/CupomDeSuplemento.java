package br.com.treinos.api.web;

import br.com.plataforma.comum.web.ApiError;

import java.util.List;

/**
 * Cupom de desconto do suplemento: texto opcional, até {@value #MAXIMO} caracteres depois do strip; em branco vira nulo.
 * A recusa é 422 no campo {@code cupom} ({@link ValidacaoException}), nunca Bean Validation (daria 400), e a mensagem
 * não repete o valor.
 */
public final class CupomDeSuplemento {

    public static final int MAXIMO = 40;
    public static final String MENSAGEM = "O cupom pode ter no máximo " + MAXIMO + " caracteres.";

    private CupomDeSuplemento() { }

    /** Texto sem espaços nas pontas; em branco vira {@code null}. Não valida o tamanho. */
    public static String limpar(String cupom) {
        return cupom == null || cupom.isBlank() ? null : cupom.strip();
    }

    public static boolean valido(String cupom) {
        return cupom == null || cupom.strip().length() <= MAXIMO;
    }

    /** Limpa e recusa o que passa do tamanho, no campo {@code cupom}. */
    public static String normalizar(String cupom, String codigo) {
        String limpo = limpar(cupom);
        if (limpo != null && limpo.length() > MAXIMO) {
            throw new ValidacaoException("Confira os campos.", codigo,
                    List.of(new ApiError.FieldError("cupom", MENSAGEM)));
        }
        return limpo;
    }
}
