package br.com.treinos.api.importacao.completa;

import java.util.Map;
import java.util.UUID;

/**
 * As respostas guardadas na consultoria, já lidas, para a análise marcar como sugestão (fase 2). {@code abas}: assinatura
 * dos títulos → tipo (ou {@code IGNORAR}); {@code exercicios} e {@code alimentos}: chave do nome
 * ({@link CasamentoDeNomes#chave}) → resposta; {@code suplementos}: nome comparável
 * ({@link MontagemDaImportacao#nomeDeSuplemento}) → destino, vazio para quem não pode gravar a dieta; {@code total} = quantas
 * respostas a consultoria tem guardadas.
 */
public record RespostasSalvas(Map<String, String> abas, Map<String, NomeSalvo> exercicios, Map<String, NomeSalvo> alimentos,
                              Map<String, String> suplementos, int total) {

    /** {@code id} = o item da biblioteca (só em {@code BIBLIOTECA}). */
    public record NomeSalvo(String acao, UUID id) {
    }

    public static final RespostasSalvas NENHUMA = new RespostasSalvas(Map.of(), Map.of(), Map.of(), Map.of(), 0);

    @Override
    public String toString() {
        return "RespostasSalvas[total=" + total + "]"; // as chaves são nomes (de suplemento, inclusive)
    }
}
