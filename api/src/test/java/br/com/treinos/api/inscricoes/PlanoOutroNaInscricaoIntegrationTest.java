package br.com.treinos.api.inscricoes;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * V116: texto de "Outro" na escolha do plano da página completa ({@code planoOutroTexto}). Strip, vazio vira nulo, até 120
 * (acima, 422 no campo com mensagem fixa e sem gravar), descartado com plano da lista; volta na fila e no detalhe só da
 * própria consultoria, vai na exportação do aluno e some com a inscrição na anonimização. Só dados fictícios.
 */
@AutoConfigureMockMvc
class PlanoOutroNaInscricaoIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate banco;

    private ApiDeTeste api;
    private JsonNode admin;
    private String codigo;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        JsonNode atual = api.get("/inscricoes/configuracao", admin, 200);
        Map<String, Object> corpo = new HashMap<>();
        corpo.put("aberta", true);
        corpo.put("versao", atual.path("versao").isNull() ? null : atual.path("versao").asLong());
        codigo = api.put("/inscricoes/configuracao", admin, corpo, 200).path("codigo").asString();
    }

    private static Map<String, Object> corpo(String outro) {
        Map<String, Object> corpo = new HashMap<>();
        corpo.put("nome", "Pessoa Fictícia");
        corpo.put("whatsapp", "11987654321");
        corpo.put("email", ApiDeTeste.emailUnico("outro"));
        if (outro != null) corpo.put("planoOutroTexto", outro);
        return corpo;
    }

    /** Envia e devolve o resumo da única inscrição da consultoria. */
    private JsonNode enviar(Map<String, Object> corpo) throws Exception {
        api.post("/publico/inscricoes/" + codigo, null, corpo, 202);
        JsonNode lista = api.get("/inscricoes", admin, 200);
        assertThat(lista.path("total").asLong()).isEqualTo(1);
        return lista.path("itens").get(0);
    }

    private static boolean semValor(JsonNode campo) {
        return campo.isNull() || campo.isMissingNode();
    }

    @Test
    void outroComTextoGravaSemEspacosEApareceNaFilaENoDetalhe() throws Exception {
        JsonNode resumo = enviar(corpo("  Plano de um amigo  "));
        assertThat(resumo.path("planoOutroTexto").asString()).isEqualTo("Plano de um amigo");
        assertThat(semValor(resumo.path("planoComercialId"))).isTrue();
        String id = resumo.path("id").asString();
        assertThat(api.get("/inscricoes/" + id, admin, 200).path("planoOutroTexto").asString()).isEqualTo("Plano de um amigo");
        // Outra consultoria não vê a inscrição (404) nem o texto na fila dela.
        JsonNode outra = api.novoTreinador();
        api.get("/inscricoes/" + id, outra, 404);
        assertThat(api.get("/inscricoes", outra, 200).toString()).doesNotContain("Plano de um amigo");
    }

    @Test
    void textoEmBrancoViraNulo() throws Exception {
        JsonNode resumo = enviar(corpo("   "));
        assertThat(semValor(resumo.path("planoOutroTexto"))).isTrue();
        assertThat(banco.queryForObject("select plano_outro_texto from inscricao where id = ?::uuid", String.class,
                resumo.path("id").asString())).isNull();
    }

    @Test
    void comPlanoDaListaOTextoEDescartado() throws Exception {
        Map<String, Object> plano = new HashMap<>();
        plano.put("nome", "Mensal " + UUID.randomUUID());
        plano.put("valorCentavos", 99_00L);
        plano.put("periodicidade", "MENSAL");
        String planoId = api.post("/financeiro/planos", admin, plano, 200).path("id").asString();
        Map<String, Object> corpo = corpo("Texto que deve ser descartado");
        corpo.put("planoComercialId", planoId);
        JsonNode resumo = enviar(corpo);
        assertThat(resumo.path("planoComercialId").asString()).isEqualTo(planoId);
        assertThat(semValor(resumo.path("planoOutroTexto"))).isTrue();
        assertThat(api.get("/inscricoes/" + resumo.path("id").asString(), admin, 200).toString())
                .doesNotContain("Texto que deve ser descartado");
    }

    @Test
    void ate120ValeEAcimaDa422ComMensagemFixaSemGravar() throws Exception {
        String longo = "a".repeat(121);
        JsonNode erro = api.post("/publico/inscricoes/" + codigo, null, corpo(longo), 422);
        assertThat(erro.path("codigo").asString()).isEqualTo("INSCRICAO_INVALIDA");
        assertThat(erro.path("fieldErrors").get(0).path("field").asString()).isEqualTo("planoOutroTexto");
        assertThat(erro.path("fieldErrors").get(0).path("message").asString()).isEqualTo("Use até 120 caracteres.");
        assertThat(erro.toString()).doesNotContain(longo);
        assertThat(api.get("/inscricoes", admin, 200).path("total").asLong()).isZero();

        // 120 depois do strip vale (os espaços das pontas não contam).
        String limite = "b".repeat(120);
        assertThat(enviar(corpo(" " + limite + " ")).path("planoOutroTexto").asString()).isEqualTo(limite);
    }

    @Test
    void exportacaoLevaOTextoEAnonimizarApagaAInscricao() throws Exception {
        JsonNode resumo = enviar(corpo("Plano combinado no direct"));
        String id = resumo.path("id").asString();
        JsonNode detalhe = api.get("/inscricoes/" + id, admin, 200);
        String alunoId = api.post("/inscricoes/" + id + "/aceitar", admin,
                Map.of("convidar", false, "versao", detalhe.path("versao").asLong(), "semCobranca", true), 200).path("alunoId").asString();

        JsonNode item = api.get("/alunos/" + alunoId + "/exportacao", admin, 200).path("inscricao").path("itens").get(0);
        assertThat(item.path("planoOutroTexto").asString()).isEqualTo("Plano combinado no direct");

        api.patch("/alunos/" + alunoId + "/situacao", admin, Map.of("ativo", false), 200);
        api.post("/alunos/" + alunoId + "/anonimizar", admin, Map.of("nomeConfirmado", "Pessoa Fictícia"), 200);
        assertThat(banco.queryForObject("select count(*) from inscricao where id = ?::uuid", Long.class, id)).isZero();
    }
}
