package br.com.treinos.api.importacao.assistida.ia;

import br.com.treinos.api.importacao.assistida.BlocoTexto;

import java.util.List;
import java.util.Map;

/**
 * Contexto dos interpretadores. {@code blocos} e {@code nomeArquivo} só servem ao interpretador local (regras);
 * um conector externo só pode usar {@code textoParaProvedor} (o texto extraído inteiro, com CPF, e-mail, telefone
 * e CEP; só sai com {@code treinos.importacao.ia.enviar-dados-ao-provedor}), a metodologia e os apelidos.
 * Nunca o PDF bruto nem o nome do arquivo.
 */
public record ContextoIa(String nomeArquivo, String formato, List<BlocoTexto> blocos, String textoParaProvedor,
                         String objetivo, List<String> metodosConsultoria,
                         Map<String, String> apelidosConhecidos) {
    @Override
    public String toString() {
        return "ContextoIa[formato=" + formato + ", blocos=" + (blocos == null ? 0 : blocos.size()) + "]";
    }
}
