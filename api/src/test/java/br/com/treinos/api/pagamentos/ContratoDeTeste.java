package br.com.treinos.api.pagamentos;

import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.web.Fuso;
import tools.jackson.databind.JsonNode;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Ajudante dos testes do contrato fechado (V098): cria plano, aluno e contrato pela API, com dados fictícios e nomes únicos, e lê
 * as cobranças de volta. Cada teste que o usa cria a própria consultoria.
 */
final class ContratoDeTeste {

    static final LocalDate HOJE = LocalDate.now(Fuso.BRASILIA);

    private final ApiDeTeste api;
    private final JsonNode login;

    ContratoDeTeste(ApiDeTeste api, JsonNode login) {
        this.api = api;
        this.login = login;
    }

    JsonNode plano(String periodicidade) throws Exception {
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("nome", "Plano do contrato " + UUID.randomUUID());
        corpo.put("valorCentavos", 10_000);
        corpo.put("periodicidade", periodicidade);
        return api.post("/financeiro/planos", login, corpo, 200);
    }

    UUID aluno() throws Exception {
        return api.criarAluno(login, "Aluno Fictício " + UUID.randomUUID());
    }

    /** Só o texto do erro (message + fieldErrors): o JSON inteiro leva timestamp e requestId, que casam com números. */
    static String mensagens(JsonNode erro) {
        return erro.path("message").asString("") + erro.path("fieldErrors");
    }

    static Map<String, Object> parcela(LocalDate vencimento, long valorCentavos) {
        Map<String, Object> p = new LinkedHashMap<>();
        p.put("vencimento", vencimento.toString());
        p.put("valorCentavos", valorCentavos);
        return p;
    }

    static Map<String, Object> entrada(long valorCentavos, LocalDate data, boolean jaPaga, String forma) {
        Map<String, Object> e = new LinkedHashMap<>();
        e.put("valorCentavos", valorCentavos);
        e.put("data", data.toString());
        e.put("jaPaga", jaPaga);
        if (forma != null) {
            e.put("forma", forma);
        }
        return e;
    }

    /** Corpo do contratar nos modos fechados; {@code entrada} e {@code parcelas} nulos = ausentes. */
    static Map<String, Object> corpo(JsonNode plano, String modo, Long total, Map<String, Object> entrada,
                                     List<Map<String, Object>> parcelas) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("planoComercialId", plano.get("id").asString());
        m.put("inicio", HOJE.toString());
        m.put("modoCobranca", modo);
        m.put("valorTotalCentavos", total);
        if (entrada != null) {
            m.put("entrada", entrada);
        }
        if (parcelas != null) {
            m.put("parcelas", parcelas);
        }
        return m;
    }

    JsonNode contratar(UUID aluno, Map<String, Object> corpo, int esperado) throws Exception {
        return api.post("/alunos/" + aluno + "/contratacoes", login, corpo, esperado);
    }

    /** A contratação do aluno como a lista dela devolve agora (com o bloco {@code contrato}). */
    JsonNode contratacao(UUID aluno) throws Exception {
        return api.get("/alunos/" + aluno + "/contratacoes", login, 200).get(0);
    }

    List<JsonNode> cobrancas(UUID aluno) throws Exception {
        List<JsonNode> lista = new ArrayList<>();
        api.get("/alunos/" + aluno + "/cobrancas", login, 200).forEach(lista::add);
        return lista;
    }

    List<JsonNode> doTipo(UUID aluno, String tipo) throws Exception {
        return cobrancas(aluno).stream().filter(c -> tipo.equals(c.get("tipo").asString())).toList();
    }

    /** Um membro da equipe com só estas permissões (o administrador é {@code login}). */
    JsonNode membro(java.util.Set<String> permissoes) throws Exception {
        String perfil = api.post("/perfis", login, Map.of("nome", "Perfil " + UUID.randomUUID(), "permissoes", permissoes), 200)
                .get("id").asString();
        JsonNode convite = api.post("/usuarios/convites", login, Map.of("nome", "Membro fictício",
                "email", ApiDeTeste.emailUnico("membro"), "perfilId", perfil), 200);
        return api.post("/publico/convites-equipe/aceitar", null,
                Map.of("codigo", convite.get("codigo").asString(), "senha", ApiDeTeste.SENHA), 200);
    }

    JsonNode baixar(JsonNode cobranca) throws Exception {
        return api.post("/cobrancas/" + cobranca.get("id").asString() + "/baixa-manual", login,
                Map.of("data", HOJE.toString(), "forma", "DINHEIRO", "versao", cobranca.get("versao").asLong()), 200);
    }
}
