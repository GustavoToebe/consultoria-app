package br.com.treinos.api.planos;

import java.util.regex.Pattern;

/**
 * Título que o aluno vê quando o plano de treino ou de dieta é publicado (regra pura, sem banco): tira o "(rascunho)" e,
 * se sobrar só o nome padrão da importação (ou nada), usa "Treino de <aluno>" / "Dieta de <aluno>", o mesmo formato do app
 * ({@code dominio/planoDoAluno.ts}). Título que o treinador escolheu fica como está.
 */
public final class TituloDoPlanoPublicado {

    /** Nome padrão da importação por planilha; a pasta dela é este texto + " (rascunho)" (MontagemDaImportacao.TITULO_PASTA). */
    public static final String NOME_PADRAO_DA_IMPORTACAO = "Importada da planilha";

    /** Mesmo máximo do título do plano (coluna e DTOs). */
    static final int MAXIMO = 120;

    private static final Pattern RASCUNHO = Pattern.compile("\\(\\s*rascunho\\s*\\)", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
    private static final Pattern ESPACOS = Pattern.compile("\\s+");

    private TituloDoPlanoPublicado() {
    }

    /**
     * @param titulo       título gravado no plano
     * @param tipo         "Treino" ou "Dieta"
     * @param nomeDoAluno  nome do cadastro (pode ser nulo)
     */
    public static String de(String titulo, String tipo, String nomeDoAluno) {
        String limpo = normalizar(RASCUNHO.matcher(titulo == null ? "" : titulo).replaceAll(" "));
        if (!limpo.isEmpty() && !limpo.equalsIgnoreCase(NOME_PADRAO_DA_IMPORTACAO)) {
            return limpo;
        }
        String nome = normalizar(nomeDoAluno == null ? "" : nomeDoAluno);
        if (nome.isEmpty()) {
            return tipo + " do aluno";
        }
        String prefixo = tipo + " de ";
        return prefixo + (nome.length() <= MAXIMO - prefixo.length() ? nome : nome.substring(0, MAXIMO - prefixo.length()).strip());
    }

    private static String normalizar(String texto) {
        return ESPACOS.matcher(texto).replaceAll(" ").strip();
    }
}
