package br.com.treinos.api.importacao.assistida;

import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.GrupoImportavel;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.List;

/** Hash SHA-256 canônico da prévia da sessão e do pedido de confirmação. */
final class HashPreviaImportacao {

    private HashPreviaImportacao() {
    }

    static String calcular(ImportacaoSessao sessao, List<GrupoImportavel> grupos) {
        if (!"REVISANDO".equals(sessao.getEstado())) {
            return null;
        }
        StringBuilder sb = new StringBuilder();
        sb.append("rev=").append(sessao.getRevisao()).append(';');
        grupos.stream()
                .sorted(Comparator.comparing(GrupoImportavel::id))
                .forEach(g -> sb.append(g.id()).append('|')
                        .append(nullSafe(g.estado())).append('|')
                        .append(nullSafe(g.destino())).append('|')
                        .append(g.alunoExistenteId() == null ? "" : g.alunoExistenteId().toString()).append('|')
                        .append(nullSafe(g.nomeDetectado())).append('|')
                        .append(g.treino() != null).append('|')
                        .append(g.dieta() != null).append('|')
                        .append(g.pesos() == null ? 0 : g.pesos().size()).append(';'));
        return sha256(sb.toString());
    }

    static String hashPedido(long revisaoEsperada, String hashPrevia, List<String> gruposIds) {
        StringBuilder sb = new StringBuilder();
        sb.append(revisaoEsperada).append('|').append(nullSafe(hashPrevia)).append('|');
        if (gruposIds != null) {
            gruposIds.stream().sorted().forEach(id -> sb.append(id).append(','));
        }
        return sha256(sb.toString());
    }

    private static String nullSafe(String s) {
        return s == null ? "" : s;
    }

    private static String sha256(String valor) {
        try {
            byte[] dig = MessageDigest.getInstance("SHA-256").digest(valor.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(dig);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 indisponível.");
        }
    }
}
