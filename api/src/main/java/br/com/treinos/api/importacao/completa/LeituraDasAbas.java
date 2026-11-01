package br.com.treinos.api.importacao.completa;

import br.com.treinos.api.importacao.LeitorDePlanilha;
import br.com.treinos.api.importacao.LeitorDePlanilha.Linha;
import br.com.treinos.api.importacao.LeitorDePlanilha.Planilha;
import br.com.treinos.api.web.ValidacaoException;

import java.util.ArrayList;
import java.util.List;

/**
 * Lê todas as abas de uma planilha pelo {@link LeitorDePlanilha} (os mesmos limites de tamanho, zip, linhas, colunas e
 * texto por aba), com dois tetos a mais para o livro inteiro: {@value #ABAS_MAXIMAS} abas e {@value #CELULAS_MAXIMAS}
 * células somadas. Erro com mensagem fixa, sem conteúdo da planilha.
 */
public final class LeituraDasAbas {

    static final int ABAS_MAXIMAS = 40;
    static final int CELULAS_MAXIMAS = 500_000;

    public record AbaLida(int indice, String nome, List<Linha> linhas) {
    }

    public record Leitura(List<AbaLida> abas, boolean data1904) {
    }

    private LeituraDasAbas() {
    }

    public static Leitura ler(String nomeDoArquivo, byte[] bytes) {
        Planilha primeira = LeitorDePlanilha.ler(nomeDoArquivo, bytes, 0);
        int total = primeira.abas().size();
        if (total > ABAS_MAXIMAS) {
            throw arquivo("A planilha tem mais de " + ABAS_MAXIMAS + " abas.");
        }
        List<AbaLida> abas = new ArrayList<>();
        int celulas = 0;
        for (int i = 0; i < total; i++) {
            Planilha p = i == 0 ? primeira : LeitorDePlanilha.ler(nomeDoArquivo, bytes, i);
            for (Linha l : p.linhas()) {
                celulas += l.celulas().size();
            }
            if (celulas > CELULAS_MAXIMAS) {
                throw arquivo("A planilha tem células demais.");
            }
            String nome = primeira.abas().get(i);
            abas.add(new AbaLida(i, nome == null ? "" : nome, p.linhas()));
        }
        return new Leitura(List.copyOf(abas), primeira.data1904());
    }

    private static ValidacaoException arquivo(String mensagem) {
        return new ValidacaoException(mensagem, "ARQUIVO_INVALIDO", List.of());
    }
}
