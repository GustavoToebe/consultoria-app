package br.com.treinos.api.importacao.completa;

import java.util.List;

/**
 * Campo que uma coluna da planilha pode guardar, com os nomes de coluna que o reconhecem (sem acento, sem caixa e sem
 * pontuação: "Peso (kg)" = "peso kg"). Vale o sinônimo mais longo contido no nome da coluna; empate, a ordem desta lista
 * (os mais específicos primeiro). Colunas de código ("ID", "ID Aluno", "Código do plano") têm regra própria em
 * {@link ReconhecimentoDeAbas}.
 */
public enum Campo {
    CODIGO("id", "codigo", "cod"),
    ALUNO_CODIGO("id aluno", "codigo aluno", "cod aluno", "aluno id", "matricula"),
    PLANO_CODIGO("id plano", "codigo plano", "plano id", "id dieta"),
    ROTINA_CODIGO("id rotina", "codigo rotina", "rotina id", "id ficha"),
    PESO_INICIAL("peso inicial", "peso inicio", "peso entrada"),
    DATA_INICIO("data inicio", "inicio", "data entrada", "entrada", "data cadastro"),
    ORIENTACAO("intra treino", "hidratacao", "refeicao livre", "orientacao", "orientacoes"),
    EXERCICIO("exercicio", "exercicios", "nome exercicio", "exerc", "movimento"),
    LETRA_TREINO("letra", "letra treino", "treino letra"),
    NOME_TREINO("nome treino", "treino", "sessao", "ficha", "dia treino"),
    GRUPO_MUSCULAR("grupo muscular", "grupo", "musculo", "musculos", "musculatura", "grupamento"),
    VIDEO("video", "link", "link video", "url", "youtube"),
    PRESCRICAO("prescricao", "series x reps", "series x repeticoes", "series reps", "series repeticoes", "volume", "esquema"),
    SERIES("series", "serie", "sets", "n series", "numero series", "qtd series"),
    REPETICOES("repeticoes", "repeticao", "reps", "rep", "rep range", "faixa repeticoes", "faixa"),
    CARGA("carga", "carga kg", "peso carga"),
    DESCANSO("descanso", "intervalo", "pausa"),
    SERIES_TRABALHO("ws", "working sets", "series trabalho"),
    SERIES_PREPARACAO("fs", "feeder", "series preparacao"),
    TOP_SET("ts", "top set"),
    BACK_OFF("bo"),
    BACK_OFF_PERCENTUAL("back off", "back off percentual"),
    REFEICAO("refeicao", "n refeicao", "numero refeicao", "refeicoes"),
    OPCAO("opcao", "opcoes"),
    ORDEM("ordem", "item n", "n item", "item", "sequencia", "posicao"),
    ALIMENTO("alimento", "alimentos", "comida", "ingrediente", "descricao alimentos", "descricao alimento"),
    QUANTIDADE("quantidade", "quantidade g", "qtd", "qtde", "quant", "gramas", "porcao"),
    UNIDADE("unidade", "unid", "medida", "unidade mode", "peso unidade"),
    KCAL("kcal", "calorias", "caloria", "energia", "energia kcal", "cal", "valor energetico"),
    PROTEINA("proteina", "proteinas", "prot", "ptn"),
    CARBOIDRATO("carboidrato", "carboidratos", "carb", "carbo", "cho"),
    GORDURA("gordura", "gorduras", "gord", "lipidio", "lipidios", "lipideo", "lipideos", "lip"),
    SUPLEMENTO("suplemento", "medicamento", "suplemento medicamento", "suplementacao", "ergogenico", "manipulado", "remedio"),
    DOSE("dose", "dosagem", "posologia"),
    HORARIO("horario", "hora", "momento", "quando"),
    EMAIL("email", "e mail", "mail"),
    TELEFONE("telefone", "tel", "celular", "whats", "whatsapp", "whats app", "fone", "zap", "contato"),
    OBJETIVO("objetivo", "objetivos", "meta"),
    STATUS("status", "situacao"),
    ATIVO("ativo", "ativa", "vigente"),
    SEMANA("semana", "semana n"),
    VARIACAO("variacao", "variacao kg", "diferenca"),
    OBSERVACAO("obs", "observacao", "observacoes", "obs gerais", "obs especifica", "dica", "dicas", "notas", "nota",
            "comentario", "comentarios", "recomendacoes"),
    TITULO("titulo", "nome plano", "nome dieta", "nome rotina"),
    DATA("data", "dia", "data registro", "data pesagem", "data medicao"),
    PESO("peso", "kg", "peso kg", "massa", "peso atual", "massa corporal"),
    ALUNO("nome", "aluno", "nome aluno", "nome completo", "cliente", "paciente", "atleta");

    private final List<List<String>> sinonimos;

    Campo(String... sinonimos) {
        this.sinonimos = java.util.Arrays.stream(sinonimos).map(Normalizacao::palavras).toList();
    }

    /** Os sinônimos já em palavras normalizadas. */
    List<List<String>> sinonimos() {
        return sinonimos;
    }
}
