package br.com.treinos.api.questionarios;

/**
 * Limites do questionário (atualização e anamnese). Mudou um valor, muda também {@code LIMITES_QUESTIONARIO} em
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
    /** Fotos por pergunta FOTOS (o limite por dia e o tamanho de cada foto são do {@code FotoService} e vêm de {@code GET /aluno/fotos/configuracao}). */
    public static final int FOTOS_POR_PERGUNTA = 6;
    public static final int TEXTO_CURTO_CAPACIDADE = 500;
    public static final int TEXTO_LONGO_CAPACIDADE = 2000;
    /** Resposta do TEXTO com destino OBJETIVO: o tamanho de {@code aluno.objetivo} (o mesmo do cadastro na ficha). */
    public static final int OBJETIVO_TAMANHO = 200;
    /** Resposta do TEXTO com destino CPF: o CPF formatado (123.456.789-09) tem 14 caracteres, o tamanho de {@code aluno.cpf}. */
    public static final int CPF_TAMANHO = 14;
    /**
     * Campos da resposta ENDERECO e do endereço do aluno (colunas de {@code aluno}, V015; os limites contam depois do strip, na regra única
     * {@code alunos.RegrasDoEndereco}). O CEP formatado (85800-000) tem 9 caracteres.
     */
    public static final int ENDERECO_CEP_TAMANHO = 9;
    public static final int ENDERECO_LOGRADOURO_TAMANHO = 200;
    public static final int ENDERECO_NUMERO_TAMANHO = 20;
    public static final int ENDERECO_COMPLEMENTO_TAMANHO = 100;
    public static final int ENDERECO_BAIRRO_TAMANHO = 100;
    public static final int ENDERECO_CIDADE_TAMANHO = 100;
    public static final int ENDERECO_UF_TAMANHO = 2;
    /** Soma das capacidades de TEXTO e TEXTO_LONGO: garante que as respostas cabem em {@link #RESPOSTAS_BYTES}. */
    public static final int CAPACIDADE_DE_TEXTO_TOTAL = 40_000;
    public static final int RASCUNHO_BYTES = 256 * 1024;
    public static final int RESPOSTAS_BYTES = 256 * 1024;
    public static final int ID_TAMANHO = 40;
    /** Mínimo, máximo e resposta de NUMERO ficam em [-N, N]: fora disso o JSON pode virar infinito e quebrar a validação. */
    public static final int NUMERO_ABSOLUTO = 1_000_000_000;
    /** GRADE: linhas (uma resposta por linha) e colunas (as escolhas de cada linha). */
    public static final int LINHAS_MINIMO = 1;
    public static final int LINHAS_MAXIMO = 30;
    public static final int COLUNAS_MINIMO = 2;
    public static final int COLUNAS_MAXIMO = 10;
    /** Texto do ACEITE e do INFORMATIVO. */
    public static final int TEXTO_INFORMATIVO_TAMANHO = 4000;
    /** Frase de declaração do ACEITE ("Li e concordo..."). */
    public static final int DECLARACAO_TAMANHO = 200;
    public static final int TELEFONE_TAMANHO = 25;
    public static final int TELEFONE_DIGITOS_MINIMO = 10;
    public static final int TELEFONE_DIGITOS_MAXIMO = 13;
    public static final int EMAIL_TAMANHO = 254;
    /** Resposta de DATA fica entre 1900 e 2100 (e, com {@code somentePassado}, até hoje no horário de Brasília). */
    public static final int DATA_ANO_MINIMO = 1900;
    public static final int DATA_ANO_MAXIMO = 2100;
    /** Imagem da pergunta ou da opção: PNG ou JPEG, no banco, regravada sem metadados. */
    public static final int IMAGEM_BYTES = 300_000;
    public static final int IMAGEM_LADO = 1600;
    /** Identificador de pergunta, seção e opção: ids legíveis ({@code peso}, {@code sono}) e uids. */
    public static final String ID_PADRAO = "[A-Za-z0-9_-]{1,40}";
    /** Id de imagem do questionário (UUID em minúsculas, como a API devolve). */
    public static final String IMAGEM_PADRAO = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

    private LimitesQuestionario() {
    }
}
