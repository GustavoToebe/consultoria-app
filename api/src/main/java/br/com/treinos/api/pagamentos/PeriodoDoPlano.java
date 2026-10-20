package br.com.treinos.api.pagamentos;

/** Periodicidade de um plano comercial. {@code meses} é o passo entre competências; parcela única não tem próxima. */
public enum PeriodoDoPlano {
    MENSAL(1), TRIMESTRAL(3), SEMESTRAL(6), ANUAL(12), PARCELA_UNICA(0);

    private final int meses;

    PeriodoDoPlano(int meses) {
        this.meses = meses;
    }

    public int meses() {
        return meses;
    }

    public boolean recorrente() {
        return this != PARCELA_UNICA;
    }
}
