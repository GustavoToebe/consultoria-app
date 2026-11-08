package br.com.treinos.api.biblioteca;

import java.math.BigDecimal;

/**
 * Whey do rótulo (E-002), sem marca e sem nome comercial. 30 g (2 dosadores), cerca de 33 porções.
 * Fibras e sódio não têm coluna. Não converter para 100 g e não estimar o que o rótulo não trouxe.
 */
public final class WheyDoRotulo {

    public static final String NOME = "Whey Protein";
    public static final BigDecimal BASE = new BigDecimal("30");
    public static final BigDecimal KCAL = new BigDecimal("124");
    public static final BigDecimal PROTEINA = new BigDecimal("24");
    public static final BigDecimal CARBOIDRATO = new BigDecimal("2.3");
    public static final BigDecimal GORDURA = new BigDecimal("2.1");
    public static final String PORCAO = "30 g (2 dosadores)";
    public static final String PORCOES = "cerca de 33";
    public static final String SABORES = "[]";

    private WheyDoRotulo() {
    }
}
