package br.com.treinos.api.importacao;

import br.com.treinos.api.web.ValidacaoException;

import java.util.List;
import java.util.Map;

/**
 * O que a prévia e a confirmação conferem junto com os bytes do arquivo. Sem valor de célula.
 * {@code linhaDoCabecalho}: 0 = a planilha não tem cabeçalho; N (1 a {@link #LINHA_DO_CABECALHO_MAXIMA}) = o número da
 * linha no arquivo (o mesmo das mensagens de erro). Essa linha dá o nome das colunas e as de cima não entram nos dados.
 */
public record ConfiguracaoDaImportacao(int aba, int linhaDoCabecalho, String chave, String existentes,
                                       Map<String, Integer> mapeamento) {

    public static final int LINHA_DO_CABECALHO_MAXIMA = 50;

    /** Posição, na lista de linhas lidas, do cabeçalho (a linha com esse número no arquivo); -1 sem cabeçalho. */
    static int posicaoDoCabecalho(LeitorDePlanilha.Planilha planilha, int linhaDoCabecalho) {
        if (linhaDoCabecalho <= 0 || planilha.linhas().isEmpty()) {
            return -1;
        }
        for (int i = 0; i < planilha.linhas().size(); i++) {
            int numero = planilha.linhas().get(i).numero();
            if (numero == linhaDoCabecalho) {
                return i;
            }
            if (numero > linhaDoCabecalho) {
                break;
            }
        }
        throw new ValidacaoException("A linha do cabeçalho não está na planilha (vazia ou fora do arquivo).",
                "ARQUIVO_INVALIDO", List.of());
    }

    /** Posição da primeira linha de dados: logo depois do cabeçalho, ou 0 sem cabeçalho. */
    static int primeiraDeDados(LeitorDePlanilha.Planilha planilha, int linhaDoCabecalho) {
        return posicaoDoCabecalho(planilha, linhaDoCabecalho) + 1;
    }

    public boolean mapeado(String campo) {
        Integer coluna = mapeamento.get(campo);
        return coluna != null && coluna >= 0;
    }

    public int coluna(String campo) {
        Integer valor = mapeamento.get(campo);
        return valor == null ? -1 : valor;
    }
}
