package br.com.treinos.api.importacao.completa;

/** O que uma aba da planilha guarda, reconhecido pelas colunas e pelo conteúdo ({@link ReconhecimentoDeAbas}). */
public enum TipoDeAba {
    /** Cadastro dos alunos (nome e contato). */
    ALUNOS,
    /** Histórico de peso (aluno, data e peso). */
    PESOS,
    /** Linhas de exercício de um treino (exercício e prescrição). */
    TREINO,
    /** Cabeçalho de cada treino do aluno (rotina, sem exercício). */
    ROTINAS,
    /** Itens das refeições (refeição, alimento e quantidade). */
    DIETA,
    /** Cabeçalho de cada dieta do aluno (plano, sem alimento). */
    PLANOS_DE_DIETA,
    /** Suplementos ou medicamentos com dose ou horário. */
    SUPLEMENTOS,
    /** Lista de exercícios (nome com grupo muscular ou vídeo), sem prescrição. */
    LISTA_DE_EXERCICIOS,
    /** Tabela de composição de alimentos (de terceiros): reconhecida e contada, nunca usada. */
    TABELA_DE_ALIMENTOS,
    DESCONHECIDA
}
