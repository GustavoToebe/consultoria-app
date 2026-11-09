package br.com.treinos.api.comunidade;

public enum TipoConquista {
    PRIMEIRO_TREINO("Primeiro Treino", "Concluiu seu primeiro treino na consultoria!", "trophy-first"),
    TREINOS_10("10 Treinos", "Alcançou a marca de 10 treinos realizados!", "flame-10"),
    TREINOS_25("25 Treinos", "Alcançou 25 treinos concluídos com dedicação!", "medal-25"),
    TREINOS_50("50 Treinos", "Completou 50 treinos na consultoria!", "shield-50"),
    TREINOS_100("Centurião", "100 treinos concluídos! Você é uma lenda da constância!", "crown-100"),
    SEMANA_COMPLETA("Semana Completa", "Treinou com assiduidade máxima durante toda a semana!", "calendar-star"),
    CONSTANCIA_4_SEMANAS("Mês Impecável", "4 semanas consecutivas mantendo a constância!", "fire-month"),
    NOVO_RECORDE_CARGA("Recorde de Carga", "Superou sua carga máxima em um exercício!", "weight-record"),
    PLANO_EM_DIA("Plano em Dia", "Completou seu ciclo de treinos rigorosamente no prazo!", "check-circle");

    private final String titulo;
    private final String descricao;
    private final String icone;

    TipoConquista(String titulo, String descricao, String icone) {
        this.titulo = titulo;
        this.descricao = descricao;
        this.icone = icone;
    }

    public String titulo() { return titulo; }
    public String descricao() { return descricao; }
    public String icone() { return icone; }
}
