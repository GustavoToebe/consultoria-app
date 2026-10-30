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
     */
    public record Colunas(List<String> abas, int aba, List<String> colunas, int linhas, List<List<String>> amostra,
                          List<Integer> numerosDasLinhas, boolean amostraCortada, List<List<Integer>> celulasCortadas) {
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
