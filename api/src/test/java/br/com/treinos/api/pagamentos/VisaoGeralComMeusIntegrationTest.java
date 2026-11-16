package br.com.treinos.api.pagamentos;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.web.Fuso;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * {@code GET /financeiro/visao-geral?meus=}: renovações próximas e projeção anual só dos alunos do responsável autenticado.
 * Uma consultoria por teste (o filtro de tenant isola as contas); dados fictícios.
 */
@AutoConfigureMockMvc
class VisaoGeralComMeusIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;

    private final LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
    private ApiDeTeste api;
    private JsonNode admin;
    private JsonNode leitor;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        String perfil = api.post("/perfis", admin, Map.of("nome", "Perfil financeiro " + UUID.randomUUID(),
                "permissoes", Set.of("FINANCEIRO_LER", "ALUNO_LER")), 200).get("id").asString();
        JsonNode convite = api.post("/usuarios/convites", admin, Map.of("nome", "Leitor fictício",
                "email", ApiDeTeste.emailUnico("leitor"), "perfilId", perfil), 200);
        leitor = api.post("/publico/convites-equipe/aceitar", null,
                Map.of("codigo", convite.get("codigo").asString(), "senha", ApiDeTeste.SENHA), 200);
    }

    private static String idDe(JsonNode login) {
        return login.path("usuario").path("id").asString();
    }

    /** Um aluno do responsável com uma contratação ativa que começa hoje. */
    private void contratar(JsonNode quemCria, JsonNode responsavel, String periodicidade, long valor) throws Exception {
        UUID aluno = UUID.fromString(api.post("/alunos", quemCria, Map.of("nome", "Aluno Fictício " + UUID.randomUUID(),
                "responsavelId", idDe(responsavel)), 200).get("id").asString());
        Map<String, Object> plano = new LinkedHashMap<>();
        plano.put("nome", "Plano " + UUID.randomUUID());
        plano.put("valorCentavos", valor);
        plano.put("periodicidade", periodicidade);
        JsonNode p = api.post("/financeiro/planos", quemCria, plano, 200);
        Map<String, Object> contratacao = new LinkedHashMap<>();
        contratacao.put("planoComercialId", p.get("id").asString());
        contratacao.put("inicio", hoje.toString());
        contratacao.put("diaVencimento", hoje.getDayOfMonth());
        api.post("/alunos/" + aluno + "/contratacoes", quemCria, contratacao, 200);
    }

    private void confere(JsonNode quem, String consulta, int renovacoes, long renovacoesCentavos, long projecao)
            throws Exception {
        JsonNode r = api.get("/financeiro/visao-geral" + consulta, quem, 200);
        assertThat(r.get("renovacoesProximasCount").asInt()).as("renovações" + consulta).isEqualTo(renovacoes);
        assertThat(r.get("renovacoesProximasCentavos").asLong()).as("valor das renovações" + consulta)
                .isEqualTo(renovacoesCentavos);
        assertThat(r.get("projecaoAnualCentavos").asLong()).as("projeção anual" + consulta).isEqualTo(projecao);
    }

    @Test
    void meusSoContaOsAlunosDoResponsavelEOutraConsultoriaNuncaEntra() throws Exception {
        // Mensal começando hoje vence em um mês (menos de 40 dias): renovação próxima. Anual não.
        contratar(admin, admin, "MENSAL", 10_000);
        contratar(admin, leitor, "MENSAL", 5_000);
        contratar(admin, leitor, "ANUAL", 20_000);

        // Outra consultoria: não conta em nenhuma das contas daqui.
        JsonNode outro = api.novoTreinador();
        contratar(outro, outro, "MENSAL", 99_000);

        confere(admin, "", 2, 15_000, 12 * 10_000 + 12 * 5_000 + 20_000);
        confere(admin, "?meus=false", 2, 15_000, 12 * 10_000 + 12 * 5_000 + 20_000);
        confere(admin, "?meus=true", 1, 10_000, 12 * 10_000);
        confere(leitor, "?meus=true", 1, 5_000, 12 * 5_000 + 20_000);
        // Sem `meus`, quem não é administrador vê a consultoria inteira, como o administrador.
        confere(leitor, "", 2, 15_000, 12 * 10_000 + 12 * 5_000 + 20_000);
        confere(outro, "?meus=true", 1, 99_000, 12 * 99_000);
    }

    @Test
    void meusSemAlunoNemContratacaoDaZeroEmVezDeNulo() throws Exception {
        contratar(admin, admin, "MENSAL", 10_000);

        JsonNode r = api.get("/financeiro/visao-geral?meus=true", leitor, 200);
        assertThat(r.get("renovacoesProximasCount").isNumber()).isTrue();
        assertThat(r.get("renovacoesProximasCentavos").isNumber()).isTrue();
        assertThat(r.get("projecaoAnualCentavos").isNumber()).isTrue();
        confere(leitor, "?meus=true", 0, 0, 0);
    }
}
