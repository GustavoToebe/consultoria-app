package br.com.treinos.api.atencao;

import java.util.Optional;

/**
 * Os seis modelos de regra de atenção (R1 de {@code docs/planos/regras-de-atencao.md}); o mesmo CHECK da V190. Operador sempre
 * inclusivo (C4: "sono 5 ou menos", "caiu 2 pontos ou mais"), fixado só em {@link AvaliadorDeAtencao}.
 */
public enum TipoDeRegra {
    /** Nota de uma pergunta NOTA igual ou abaixo do limite. */
    NOTA_ABAIXO("NOTA", true),
    /** Qualquer nota caiu o limite ou mais desde a atualização anterior (um fato por pergunta). */
    NOTA_CAIU(null, true),
    /** "Sim" numa pergunta SIM_NAO. */
    SIM("SIM_NAO", false),
    /** O peso mudou o limite (kg) ou mais desde a anterior, para cima ou para baixo. */
    PESO_MUDOU(null, true),
    /** Dias com treino registrado no período, no envio, iguais ou abaixo do limite. */
    POUCOS_TREINOS(null, true),
    /** Marcou ao menos um item numa pergunta ITENS_DO_PLANO. */
    ITEM_MARCADO("ITENS_DO_PLANO", false);

    private final String tipoDaPergunta;
    private final boolean temLimite;

    TipoDeRegra(String tipoDaPergunta, boolean temLimite) {
        this.tipoDaPergunta = tipoDaPergunta;
        this.temLimite = temLimite;
    }

    /** Tipo da pergunta escolhida ({@code NOTA}, {@code SIM_NAO}, {@code ITENS_DO_PLANO}); nulo = o modelo não tem pergunta. */
    public String tipoDaPergunta() {
        return tipoDaPergunta;
    }

    public boolean temPergunta() {
        return tipoDaPergunta != null;
    }

    public boolean temLimite() {
        return temLimite;
    }

    public static Optional<TipoDeRegra> ler(String valor) {
        for (TipoDeRegra t : values()) {
            if (t.name().equals(valor)) {
                return Optional.of(t);
            }
        }
        return Optional.empty();
    }
}
