package br.com.treinos.api.pagamentos;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.web.Fuso;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * D9: inativar o aluno cancela as parcelas avulsas abertas que vencem de hoje em diante (Brasília), como já faz com a
 * mensalidade; as vencidas continuam em aberto (a equipe dá baixa, desfaz e cancela) e a anonimização cancela todas. O resumo do
 * painel de inativar ({@code GET /alunos/{id}/resumo-da-saida}) conta o mesmo. Dados fictícios.
 */
@AutoConfigureMockMvc
class InativarComAvulsaIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;

    private final LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
    private ApiDeTeste api;
    private JsonNode admin;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
    }

    private void avulsa(UUID aluno, String descricao, LocalDate primeiro, int parcelas) throws Exception {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("pedidoId", UUID.randomUUID().toString());
        m.put("alunoIds", List.of(aluno.toString()));
        m.put("descricao", descricao);
        m.put("valorCentavos", 3_000);
        m.put("primeiroVencimento", primeiro.toString());
        m.put("parcelas", parcelas);
        api.post("/financeiro/cobrancas-avulsas", admin, m, 201);
    }

    private void contratar(UUID aluno) throws Exception {
        String plano = api.post("/financeiro/planos", admin, Map.of("nome", "Plano da inativação " + UUID.randomUUID(),
                "valorCentavos", 10_000, "periodicidade", "MENSAL"), 200).get("id").asString();
        api.post("/alunos/" + aluno + "/contratacoes", admin,
                Map.of("planoComercialId", plano, "inicio", hoje.toString(), "diaVencimento", hoje.getDayOfMonth()), 200);
    }

    private int quantas(UUID aluno, String tipo, String situacao) {
        return jdbc.queryForObject("select count(*) from cobranca_aluno where aluno_id = ?::uuid and tipo = ? and situacao = ?",
                Integer.class, aluno.toString(), tipo, situacao);
    }

    private void inativar(UUID aluno) throws Exception {
        api.patch("/alunos/" + aluno + "/situacao", admin, Map.of("ativo", false), 200);
    }

    @Test
    void inativarCancelaAvulsaEMensalidadeAVencerEMantemAsVencidas() throws Exception {
        UUID aluno = api.criarAluno(admin, "Aluno Fictício " + UUID.randomUUID());
        contratar(aluno);
        // Três parcelas: 40 dias atrás e cerca de 10 dias atrás (vencidas) e cerca de 20 dias à frente.
        avulsa(aluno, "Camiseta", hoje.minusDays(40), 3);
        // Vence hoje: o dia de hoje ainda não venceu.
        avulsa(aluno, "Boné", hoje, 1);

        JsonNode resumo = api.get("/alunos/" + aluno + "/resumo-da-saida", admin, 200);
        assertThat(resumo.get("aCancelar").get("quantidade").asInt()).as("mensalidade, parcela 3 e o boné").isEqualTo(3);
        assertThat(resumo.get("aCancelar").get("valorCentavos").asLong()).isEqualTo(10_000 + 3_000 + 3_000);
        assertThat(resumo.get("emAberto").get("quantidade").asInt()).as("as duas vencidas").isEqualTo(2);
        assertThat(resumo.get("emAberto").get("valorCentavos").asLong()).isEqualTo(6_000);

        inativar(aluno);

        assertThat(quantas(aluno, "AVULSA", "ABERTA")).isEqualTo(2);
        assertThat(quantas(aluno, "AVULSA", "CANCELADA")).isEqualTo(2);
        assertThat(quantas(aluno, "MENSALIDADE", "CANCELADA")).isEqualTo(1);
        assertThat(quantas(aluno, "MENSALIDADE", "ABERTA")).isZero();
        assertThat(jdbc.queryForList("select distinct motivo from cobranca_aluno where aluno_id = ?::uuid and situacao = 'CANCELADA'",
                String.class, aluno.toString())).containsExactly("Aluno saiu da consultoria.");
        // Depois de inativar o resumo conta só o que ficou em aberto.
        JsonNode depois = api.get("/alunos/" + aluno + "/resumo-da-saida", admin, 200);
        assertThat(depois.get("aCancelar").get("quantidade").asInt()).isZero();
        assertThat(depois.get("emAberto").get("quantidade").asInt()).isEqualTo(2);
    }

    @Test
    void aAvulsaVencidaQueFicouAindaTemBaixaEPodeSerCancelada() throws Exception {
        UUID aluno = api.criarAluno(admin, "Aluno Fictício " + UUID.randomUUID());
        avulsa(aluno, "Taxa", hoje.minusDays(5), 1);
        inativar(aluno);
        assertThat(quantas(aluno, "AVULSA", "ABERTA")).as("a vencida fica aberta ao inativar").isEqualTo(1);

        JsonNode vencida = api.get("/alunos/" + aluno + "/cobrancas", admin, 200).get(0);
        JsonNode paga = api.post("/cobrancas/" + vencida.get("id").asString() + "/baixa-manual", admin,
                Map.of("data", hoje.toString(), "forma", "PIX_DIRETO", "versao", vencida.get("versao").asLong()), 200);
        assertThat(paga.get("situacao").asString()).isEqualTo("PAGA");

        UUID outro = api.criarAluno(admin, "Aluno Fictício " + UUID.randomUUID());
        avulsa(outro, "Taxa", hoje.minusDays(5), 1);
        inativar(outro);
        JsonNode aberta = api.get("/alunos/" + outro + "/cobrancas", admin, 200).get(0);
        JsonNode cancelada = api.post("/cobrancas/" + aberta.get("id").asString() + "/cancelar", admin,
                Map.of("motivo", "Motivo fictício", "versao", aberta.get("versao").asLong()), 200);
        assertThat(cancelada.get("situacao").asString()).isEqualTo("CANCELADA");
    }

    @Test
    void anonimizarCancelaTodasAsAvulsasAbertas() throws Exception {
        String nome = "Rita Fictícia da Avulsa";
        UUID aluno = api.criarAluno(admin, nome);
        avulsa(aluno, "Camiseta", hoje.minusDays(40), 3);
        inativar(aluno);
        assertThat(quantas(aluno, "AVULSA", "ABERTA")).isEqualTo(2);

        api.post("/alunos/" + aluno + "/anonimizar", admin, Map.of("nomeConfirmado", nome), 200);

        assertThat(quantas(aluno, "AVULSA", "ABERTA")).isZero();
        assertThat(quantas(aluno, "AVULSA", "CANCELADA")).isEqualTo(3);
    }
}
