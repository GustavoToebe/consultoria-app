package br.com.treinos.api.importacao.assistida;

import java.util.List;
import java.util.Map;

/**
 * Resultado da extração local de texto e blocos estruturados de um arquivo.
 */
public record ResultadoExtracao(String formato, String textoCompleto, List<BlocoTexto> blocos,
                                Map<String, Object> metadados) {
    @Override
    public String toString() {
        return "ResultadoExtracao[formato=" + formato + ", blocos=" + (blocos == null ? 0 : blocos.size()) + "]";
    }
}
