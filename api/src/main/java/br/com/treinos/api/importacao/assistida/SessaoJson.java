package br.com.treinos.api.importacao.assistida;

import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.DuvidaImportacao;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.GrupoImportavel;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

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

    /** {@code sessao.gruposJson} no lugar de {@code grupos}; sem mexer em dúvidas nem revisão. */
    static void gravarGrupos(JsonMapper json, ImportacaoSessao sessao, List<GrupoImportavel> grupos) {
        sessao.atualizarResultados(json.writeValueAsString(grupos), null, null);
    }
}
