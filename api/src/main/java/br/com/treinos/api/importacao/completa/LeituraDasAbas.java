package br.com.treinos.api.importacao.completa;

import br.com.treinos.api.importacao.LeitorDePlanilha;
import br.com.treinos.api.importacao.LeitorDePlanilha.Linha;
import br.com.treinos.api.importacao.LeitorDePlanilha.Planilha;

import java.util.ArrayList;
import java.util.List;

/**
 * Lê todas as abas de uma planilha pelo {@link LeitorDePlanilha#lerTodas}, que abre o arquivo uma vez só, com os mesmos
 * limites de tamanho, zip, linhas, colunas e texto por aba, no máximo {@value #ABAS_MAXIMAS} abas e o teto de células
 * somado do leitor. Erro com mensagem fixa, sem conteúdo da planilha.
 */
public final class LeituraDasAbas {

    static final int ABAS_MAXIMAS = 40;

    public record AbaLida(int indice, String nome, List<Linha> linhas) {
    }

    public record Leitura(List<AbaLida> abas, boolean data1904) {
    }

    private LeituraDasAbas() {
    }

    public static Leitura ler(String nomeDoArquivo, byte[] bytes) {
        // Nunca vazia: o leitor recusa a planilha sem abas.
        List<Planilha> lidas = LeitorDePlanilha.lerTodas(nomeDoArquivo, bytes, ABAS_MAXIMAS);
        List<AbaLida> abas = new ArrayList<>();
        for (int i = 0; i < lidas.size(); i++) {
            String nome = lidas.get(i).abas().get(i);
            abas.add(new AbaLida(i, nome == null ? "" : nome, lidas.get(i).linhas()));
        }
        return new Leitura(List.copyOf(abas), lidas.getFirst().data1904());
    }
}
