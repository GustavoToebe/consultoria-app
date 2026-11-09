package br.com.treinos.api.importacao.assistida.ia;

import br.com.treinos.api.importacao.assistida.BlocoTexto;

import java.util.List;
import java.util.Map;

/**
 * Contexto enviado aos interpretadores (IA ou Regras) contendo os blocos de texto redigidos (LGPD),
 * as siglas da metodologia e o dicionário de apelidos da consultoria.
 */
@SuppressWarnings("ArrayRecordComponent")
public record ContextoIa(String nomeArquivo, String formato, List<BlocoTexto> blocos,
                         String objetivo, List<String> metodosConsultoria,
                         Map<String, String> apelidosConhecidos, byte[] pdfBytesSeHouver) {
    @Override
    public String toString() {
        return "ContextoIa[formato=" + formato + ", blocos=" + (blocos == null ? 0 : blocos.size()) + "]";
    }
}
