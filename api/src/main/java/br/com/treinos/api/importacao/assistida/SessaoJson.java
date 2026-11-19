package br.com.treinos.api.importacao.assistida;

import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.DecisaoImportacao;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.DuvidaImportacao;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.GrupoImportavel;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

import java.util.List;

/** Leitura e escrita dos JSONs da sessão. JSON ilegível vira lista vazia: a sessão é descartável e expira. */
final class SessaoJson {

    private SessaoJson() {
    }

    static List<GrupoImportavel> grupos(JsonMapper json, ImportacaoSessao sessao) {
        try {
            return json.readValue(sessao.getGruposJson(), new TypeReference<List<GrupoImportavel>>() { });
        } catch (RuntimeException e) {
            return List.of();
        }
    }

    static List<DuvidaImportacao> duvidas(JsonMapper json, ImportacaoSessao sessao) {
        try {
            return json.readValue(sessao.getDuvidasJson(), new TypeReference<List<DuvidaImportacao>>() { });
        } catch (RuntimeException e) {
            return List.of();
        }
    }

    static List<DecisaoImportacao> decisoes(JsonMapper json, ImportacaoSessao sessao) {
        try {
            String raw = sessao.getRespostasJson();
            if (raw == null || raw.isBlank()) {
                return List.of();
            }
            List<DecisaoImportacao> lidas = json.readValue(raw, new TypeReference<List<DecisaoImportacao>>() { });
            return lidas.stream().filter(d -> d != null && d.decisaoId() != null).toList();
        } catch (RuntimeException e) {
            return List.of();
        }
    }

    /** {@code sessao.gruposJson} no lugar de {@code grupos}; sem mexer em dúvidas nem revisão. */
    static void gravarGrupos(JsonMapper json, ImportacaoSessao sessao, List<GrupoImportavel> grupos) {
        sessao.atualizarResultados(json.writeValueAsString(grupos), null, null);
    }

    static String estadoEfetivo(JsonMapper json, ImportacaoSessao sessao) {
        String raw = sessao.getProgressoJson();
        if (raw != null && !raw.isBlank()) {
            try {
                JsonNode n = json.readTree(raw);
                if (n.path("cancelada").asBoolean(false)) {
                    return "CANCELADA";
                }
                if (n.path("erroProcessamento").asBoolean(false)) {
                    return "ERRO";
                }
            } catch (RuntimeException ignored) {
                // fallback para coluna estado
            }
        }
        String estado = sessao.getEstado();
        if (!"CONCLUIDA".equals(estado) && sessao.getExpiraEm() != null
                && sessao.getExpiraEm().isBefore(java.time.Instant.now())) {
            return "EXPIRADA";
        }
        return estado;
    }

    static void marcarFlagProgresso(JsonMapper json, ImportacaoSessao sessao, String chave, boolean valor) {
        ObjectNode root;
        try {
            JsonNode n = sessao.getProgressoJson() == null || sessao.getProgressoJson().isBlank()
                    ? json.createObjectNode()
                    : json.readTree(sessao.getProgressoJson());
            root = n instanceof ObjectNode o ? o : json.createObjectNode();
        } catch (RuntimeException e) {
            root = json.createObjectNode();
        }
        if (valor) {
            root.put(chave, true);
        } else {
            root.remove(chave);
        }
        sessao.atualizarResultados(null, null, json.writeValueAsString(root));
    }
}
