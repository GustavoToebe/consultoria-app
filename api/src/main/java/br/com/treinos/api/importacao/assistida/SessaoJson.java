package br.com.treinos.api.importacao.assistida;

import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.DecisaoImportacao;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.DuvidaImportacao;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.GrupoImportavel;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

import java.util.List;
import java.util.UUID;

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

    /**
     * Margem além do corte da sessão ({@link ProcessamentoAssincronoImportacao#limiteDaSessaoEmSegundos}): o vigia da
     * leitura costuma marcar o erro antes; isto só vale quando ele não está mais lá (a API caiu no meio).
     */
    static final long FOLGA_DA_LEITURA_PRESA_SEGUNDOS = 120;

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
                if ("PROCESSANDO".equals(sessao.getEstado()) && leituraPresa(n)) {
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

    /**
     * Ids dos alunos que esta sessão já criou ({@code alunosCriados} no progresso; só o id, nunca o nome). Lido sob a
     * trava da sessão. JSON ilegível lança: quem confere {@code MESMO_NOME_NA_SESSAO} falha fechado em vez de liberar.
     */
    static List<UUID> alunosCriados(JsonMapper json, ImportacaoSessao sessao) {
        String raw = sessao.getProgressoJson();
        if (raw == null || raw.isBlank()) {
            return List.of();
        }
        List<UUID> ids = new java.util.ArrayList<>();
        for (JsonNode id : json.readTree(raw).path("alunosCriados")) {
            ids.add(UUID.fromString(id.asString()));
        }
        return ids;
    }

    /** Acrescenta o aluno criado ao progresso, na mesma transação que o criou. */
    static void registrarAlunoCriado(JsonMapper json, ImportacaoSessao sessao, UUID alunoId) {
        alterarProgresso(json, sessao, root -> {
            JsonNode lista = root.path("alunosCriados");
            tools.jackson.databind.node.ArrayNode ids = lista instanceof tools.jackson.databind.node.ArrayNode a
                    ? a : root.putArray("alunosCriados");
            ids.add(alunoId.toString());
        });
    }

    /** Chave da marca da leitura no progresso: um UUID por {@code iniciar}. */
    static final String MARCA_DA_LEITURA = "leituraId";

    /**
     * Começo de uma leitura ({@code iniciar}): marca nova, contadores zerados e sem erro. Tira o {@code processandoDesde}
     * da leitura anterior: ele só é gravado quando esta sai da fila e começa ({@link #leituraComecou}), então a espera na
     * fila nunca conta como leitura presa (a fila mora na memória; se a API cair, a subida solta a sessão). Enquanto
     * espera, {@code aguardando} fica ligado (a tela diz que está na fila).
     */
    static void marcarNovaLeitura(JsonMapper json, ImportacaoSessao sessao, UUID leituraId, int aLer) {
        alterarProgresso(json, sessao, root -> {
            root.put(MARCA_DA_LEITURA, leituraId.toString());
            root.put("aLer", aLer);
            root.put("lidos", 0);
            root.put("aguardando", true);
            root.remove("erroProcessamento");
            root.remove("processandoDesde");
        });
    }

    /** A leitura saiu da fila e começou: daqui conta o corte de {@link #estadoEfetivo}. */
    static void leituraComecou(JsonMapper json, ImportacaoSessao sessao) {
        alterarProgresso(json, sessao, root -> {
            root.put("processandoDesde", java.time.Instant.now().toString());
            root.remove("aguardando");
        });
    }

    /** A marca da leitura em curso (ou da última); nula sem marca ou com o JSON ilegível. */
    static UUID marcaDaLeitura(JsonMapper json, ImportacaoSessao sessao) {
        String raw = sessao.getProgressoJson();
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            String marca = json.readTree(raw).path(MARCA_DA_LEITURA).asString(null);
            return marca == null ? null : UUID.fromString(marca);
        } catch (RuntimeException e) {
            return null;
        }
    }

    /**
     * {@code leituraId} ainda é a leitura da sessão: resultado, contador e erro de uma leitura velha (cortada e lida de
     * novo) não mexem na nova. Sem marca ou JSON ilegível = não é a mesma (falha fechada).
     */
    static boolean mesmaLeitura(JsonMapper json, ImportacaoSessao sessao, UUID leituraId) {
        return leituraId != null && leituraId.equals(marcaDaLeitura(json, sessao));
    }

    /** {@code processandoDesde} mais antigo que o corte da sessão mais a folga; sem a marca, não está presa. */
    private static boolean leituraPresa(JsonNode progresso) {
        String desde = progresso.path("processandoDesde").asString(null);
        if (desde == null || desde.isBlank()) {
            return false;
        }
        long limite = ProcessamentoAssincronoImportacao.limiteDaSessaoEmSegundos(progresso.path("aLer").asInt(1))
                + FOLGA_DA_LEITURA_PRESA_SEGUNDOS;
        return java.time.Instant.parse(desde).plusSeconds(limite).isBefore(java.time.Instant.now());
    }

    /** Grava {@code chave} como texto no progresso. */
    static void textoNoProgresso(JsonMapper json, ImportacaoSessao sessao, String chave, String valor) {
        alterarProgresso(json, sessao, root -> root.put(chave, valor));
    }

    static void marcarFlagProgresso(JsonMapper json, ImportacaoSessao sessao, String chave, boolean valor) {
        alterarProgresso(json, sessao, root -> {
            if (valor) {
                root.put(chave, true);
            } else {
                root.remove(chave);
            }
        });
    }

    /** Grava {@code chave} como número no progresso (ex.: arquivos lidos até agora, para a tela). */
    static void numeroNoProgresso(JsonMapper json, ImportacaoSessao sessao, String chave, int valor) {
        alterarProgresso(json, sessao, root -> root.put(chave, valor));
    }

    /** Soma 1 ao número {@code chave} do progresso. */
    static void somarNoProgresso(JsonMapper json, ImportacaoSessao sessao, String chave) {
        alterarProgresso(json, sessao, root -> root.put(chave, root.path(chave).asInt(0) + 1));
    }

    private static void alterarProgresso(JsonMapper json, ImportacaoSessao sessao,
                                         java.util.function.Consumer<ObjectNode> alteracao) {
        ObjectNode root;
        try {
            JsonNode n = sessao.getProgressoJson() == null || sessao.getProgressoJson().isBlank()
                    ? json.createObjectNode()
                    : json.readTree(sessao.getProgressoJson());
            root = n instanceof ObjectNode o ? o : json.createObjectNode();
        } catch (RuntimeException e) {
            root = json.createObjectNode();
        }
        alteracao.accept(root);
        sessao.atualizarResultados(null, null, json.writeValueAsString(root));
    }
}
