package br.com.treinos.api.questionarios;

/**
 * Limites do questionário de atualização. Mudou um valor, muda também {@code LIMITES_QUESTIONARIO} em
 * {@code app/src/dominio/questionario.ts} (o teste de paridade lê {@code limites.json} e confere os dois lados).
 * Tamanho de texto conta unidades UTF-16 ({@code String.length}), igual ao {@code .length} do TypeScript.
 */
public final class LimitesQuestionario {

    public static final int SECOES = 15;
    public static final int PERGUNTAS_POR_SECAO = 40;
    public static final int PERGUNTAS_TOTAL = 80;
    public static final int INSTRUCOES = 10;
    public static final int INSTRUCAO_TAMANHO = 300;
    public static final int TITULO_TAMANHO = 80;
    public static final int ROTULO_TAMANHO = 200;
    public static final int AJUDA_TAMANHO = 300;
    public static final int ROTULO_CURTO_TAMANHO = 20;
    public static final int OPCOES_MINIMO = 2;
    public static final int OPCOES_MAXIMO = 20;
    public static final int OPCAO_TAMANHO = 80;
    public static final int UNIDADE_TAMANHO = 12;
    public static final int CASAS_MAXIMO = 2;
    public static final int DIAS_MAXIMO = 7;
    public static final int DIA_VALOR_MAXIMO = 14;
    public static final int DESTAQUES_MAXIMO = 4;
    public static final int TEXTO_CURTO_CAPACIDADE = 500;
    public static final int TEXTO_LONGO_CAPACIDADE = 2000;
    /** Soma das capacidades de TEXTO e TEXTO_LONGO: garante que as respostas cabem em {@link #RESPOSTAS_BYTES}. */
    public static final int CAPACIDADE_DE_TEXTO_TOTAL = 40_000;
    public static final int RASCUNHO_BYTES = 256 * 1024;
    public static final int RESPOSTAS_BYTES = 256 * 1024;
    public static final int ID_TAMANHO = 40;
    /** Mínimo, máximo e resposta de NUMERO ficam em [-N, N]: fora disso o JSON pode virar infinito e quebrar a validação. */
    public static final int NUMERO_ABSOLUTO = 1_000_000_000;
    /** Identificador de pergunta, seção e opção: aceita os ids antigos ({@code peso}, {@code sono}) e uids. */
    public static final String ID_PADRAO = "[A-Za-z0-9_-]{1,40}";

    private LimitesQuestionario() {
    }
}
