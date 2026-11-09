package br.com.treinos.api.importacao.assistida;

/**
 * Um bloco delimitado de texto extraído de um arquivo ou planilha.
 */
public record BlocoTexto(String titulo, String conteudo, String identificadorOrigem, int linhaOuPagina) {
    @Override
    public String toString() {
        return "BlocoTexto[titulo=" + titulo + ", origem=" + identificadorOrigem + ", pos=" + linhaOuPagina + "]";
    }
}
