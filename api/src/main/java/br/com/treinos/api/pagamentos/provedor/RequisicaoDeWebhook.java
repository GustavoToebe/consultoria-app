package br.com.treinos.api.pagamentos.provedor;

import java.util.Map;

/**
 * O aviso como chegou: cabeçalhos e corpo crus, para o adaptador conferir e ler. Nunca vai a log. Classe, não record:
 * array em record compara por referência (Error Prone, ArrayRecordComponent).
 */
public final class RequisicaoDeWebhook {

    private final Map<String, String> cabecalhos;
    private final byte[] corpo;

    public RequisicaoDeWebhook(Map<String, String> cabecalhos, byte[] corpo) {
        this.cabecalhos = Map.copyOf(cabecalhos);
        this.corpo = corpo.clone();
    }

    public Map<String, String> cabecalhos() {
        return cabecalhos;
    }

    public byte[] corpo() {
        return corpo.clone();
    }

    @Override
    public String toString() {
        return "RequisicaoDeWebhook[...]";
    }
}
