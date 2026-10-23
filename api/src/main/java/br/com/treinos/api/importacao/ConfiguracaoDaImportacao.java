package br.com.treinos.api.importacao;

import java.util.Map;

/** O que a prévia e a confirmação conferem junto com os bytes do arquivo. Sem valor de célula. */
public record ConfiguracaoDaImportacao(int aba, boolean cabecalho, String chave, String existentes,
                                       Map<String, Integer> mapeamento) {

    public boolean mapeado(String campo) {
        Integer coluna = mapeamento.get(campo);
        return coluna != null && coluna >= 0;
    }

    public int coluna(String campo) {
        Integer valor = mapeamento.get(campo);
        return valor == null ? -1 : valor;
    }
}
