package br.com.treinos.api.importacao;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Contratos da importação. A prévia mostra valores na hora; o que fica gravado não tem valor de célula. */
public final class ImportacaoDtos {

    private ImportacaoDtos() {
    }

    public record Erro(int linha, String campo, String motivo) {
    }

    public record Amostra(int linha, Map<String, String> campos) {
    }

    /**
     * Colunas da aba escolhida, o total de linhas de dados e as linhas como estão no arquivo (até o teto da amostra, com
     * o número de cada uma no arquivo e `amostraCortada` quando o teto cortou), para a tela mostrar a planilha antes do
     * mapeamento; `celulasCortadas` = pares [posição na amostra, coluna] cujo texto passou de 120 caracteres e veio
     * cortado (a tela não deixa editá-las). Vai só para quem enviou o arquivo, na hora; nada é guardado nem vai para log.
     * `linhaDoCabecalho` = a usada (a pedida ou a detectada; 0 = sem cabeçalho) e `sugestoes` = o mapeamento que o servidor
     * sugere pelos títulos (vazio sem cabeçalho).
     */
    public record Colunas(List<String> abas, int aba, List<String> colunas, int linhas, List<List<String>> amostra,
                          List<Integer> numerosDasLinhas, boolean amostraCortada, List<List<Integer>> celulasCortadas,
                          int linhaDoCabecalho, List<Sugestao> sugestoes) {
    }

    /** Campo do destino sugerido para a coluna (0 = A); `confianca` = EXATA, SINONIMO ou PARECIDA. */
    public record Sugestao(String campo, int coluna, String confianca) {
    }

    /**
     * `destino` = id de uma importação de uma aba ({@code alunos}, {@code pesos}…) ou nulo; `tipoNaPlanilhaCompleta` = o
     * {@code TipoDeAba} que a planilha completa reconhece ou nulo; `linhaDoCabecalho` detectada (0 = sem cabeçalho) e
     * `linhas` = linhas de dados depois dela. Só nomes de aba (do próprio arquivo de quem enviou), nunca valor de célula.
     */
    public record AbaReconhecida(int indice, String nome, String destino, String tipoNaPlanilhaCompleta,
                                 int linhaDoCabecalho, int linhas) {
    }

    /** `trilha` = COMPLETA, UMA_ABA ou DESCONHECIDA; `aba` e `destino` só na UMA_ABA. */
    public record Reconhecimento(String trilha, List<AbaReconhecida> abas, Integer aba, String destino) {
    }

    public record Previa(String hash, int linhas, int novos, int atualizados, int ignorados, int comErro,
                         List<Erro> erros, int errosAlem, List<Amostra> amostra) {
    }

    public record Item(UUID id, String nomeArquivo, String destino, String nomeUsuario, Instant criadoEm,
                       int linhas, String situacao) {
    }

    public record Pagina(List<Item> itens, long total, int pagina) {
    }

    public record Detalhe(UUID id, String nomeArquivo, String destino, String nomeUsuario, Instant criadoEm,
                          int linhas, int novos, int atualizados, int ignorados, int comErro, String situacao,
                          Map<String, Object> configuracao, List<Erro> erros) {
    }
}
