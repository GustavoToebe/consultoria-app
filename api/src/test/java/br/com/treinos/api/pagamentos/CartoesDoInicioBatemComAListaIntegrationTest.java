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
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Os números dos cartões do Início do treinador (vencidas e vencendo em 7 dias) são os da lista que o toque abre: o total de
 * {@code GET /financeiro/inadimplentes} bate com {@code GET /financeiro/cobrancas?situacao=VENCIDA} e o
 * {@code proximosRecebimentos.em7Dias} do {@code GET /financeiro/painel} com
 * {@code ?situacao=ABERTA&de=<hoje>&ate=<hoje+7>}, com e sem {@code meus}. Só teste: nenhuma regra mudou. O
 * {@code cartoes.emAtraso} do painel recorta 6 meses e não é o número do cartão. Dados fictícios; uma consultoria por teste.
 */
@AutoConfigureMockMvc
class CartoesDoInicioBatemComAListaIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;

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

    // ---- preparo ----

    private static String idDe(JsonNode login) {
        return login.path("usuario").path("id").asString();
    }

    /** Um aluno do responsável com uma contratação de parcela única (a cobrança não gera a próxima) de {@code valor}. */
    private JsonNode cobranca(JsonNode quemCria, JsonNode responsavel, long valor) throws Exception {
        UUID aluno = UUID.fromString(api.post("/alunos", quemCria, Map.of("nome", "Aluno Fictício " + UUID.randomUUID(),
                "responsavelId", idDe(responsavel)), 200).get("id").asString());
        Map<String, Object> plano = new LinkedHashMap<>();
        plano.put("nome", "Plano " + UUID.randomUUID());
        plano.put("valorCentavos", valor);
        plano.put("periodicidade", "PARCELA_UNICA");
        JsonNode p = api.post("/financeiro/planos", quemCria, plano, 200);
        Map<String, Object> contratacao = new LinkedHashMap<>();
        contratacao.put("planoComercialId", p.get("id").asString());
        contratacao.put("inicio", hoje.toString());
        contratacao.put("diaVencimento", hoje.getDayOfMonth());
        api.post("/alunos/" + aluno + "/contratacoes", quemCria, contratacao, 200);
        return api.get("/alunos/" + aluno + "/cobrancas", quemCria, 200).get(0);
    }

    private void vencerEm(JsonNode cobranca, LocalDate vencimento) {
        jdbc.update("update cobranca_aluno set vencimento = ?::date where id = ?::uuid", vencimento.toString(),
                cobranca.get("id").asString());
    }

    private JsonNode aberta(JsonNode quemCria, JsonNode responsavel, long valor, LocalDate vencimento) throws Exception {
        JsonNode c = cobranca(quemCria, responsavel, valor);
        vencerEm(c, vencimento);
        return c;
    }

    // ---- leitura: o cartão e a lista ----

    private record Numero(long quantidade, long valor) { }

    private Numero vencidasDoCartao(JsonNode quem, boolean meus) throws Exception {
        JsonNode pagina = api.get("/financeiro/inadimplentes?meus=" + meus, quem, 200);
        assertThat(pagina.get("itens").size()).as("a lista cabe numa página").isEqualTo(pagina.get("total").asInt());
        return new Numero(pagina.get("total").asLong(), pagina.get("valorTotalCentavos").asLong());
    }

    private Numero vencidasDaLista(JsonNode quem, boolean meus) throws Exception {
        JsonNode pagina = api.get("/financeiro/cobrancas?situacao=VENCIDA&meus=" + meus, quem, 200);
        return new Numero(pagina.get("total").asLong(), somar(pagina.get("itens")));
    }

    private Numero vencendoDoCartao(JsonNode quem, boolean meus) throws Exception {
        JsonNode janela = api.get("/financeiro/painel?meus=" + meus, quem, 200).path("proximosRecebimentos").path("em7Dias");
        return new Numero(janela.get("cobrancas").asLong(), janela.get("valorCentavos").asLong());
    }

    private Numero vencendoDaLista(JsonNode quem, boolean meus) throws Exception {
        JsonNode pagina = api.get("/financeiro/cobrancas?situacao=ABERTA&de=" + hoje + "&ate=" + hoje.plusDays(7)
                + "&meus=" + meus, quem, 200);
        assertThat(pagina.get("itens").size()).isEqualTo(pagina.get("total").asInt());
        return new Numero(pagina.get("total").asLong(), somar(pagina.get("itens")));
    }

    private static long somar(JsonNode itens) {
        long soma = 0;
        for (JsonNode i : itens) {
            soma += i.get("valorCentavos").asLong();
        }
        return soma;
    }

    private void confere(JsonNode quem, boolean meus, Numero vencidas, Numero vencendo) throws Exception {
        assertThat(vencidasDoCartao(quem, meus)).as("vencidas, cartão (meus=%s)", meus).isEqualTo(vencidas);
        assertThat(vencidasDaLista(quem, meus)).as("vencidas, lista (meus=%s)", meus).isEqualTo(vencidas);
        assertThat(vencendoDoCartao(quem, meus)).as("vencendo em 7 dias, cartão (meus=%s)", meus).isEqualTo(vencendo);
        assertThat(vencendoDaLista(quem, meus)).as("vencendo em 7 dias, lista (meus=%s)", meus).isEqualTo(vencendo);
    }

    @Test
    void osNumerosDosCartoesSaoOsDasListasComESemMeus() throws Exception {
        // Responsável: o administrador.
        aberta(admin, admin, 10_000, hoje.minusDays(200));      // vencida há mais de 6 meses: entra nas vencidas
        aberta(admin, admin, 11_000, hoje);                      // vence hoje: vencendo
        aberta(admin, admin, 12_000, hoje.plusDays(7));          // hoje + 7: vencendo
        aberta(admin, admin, 13_000, hoje.plusDays(8));          // hoje + 8: fora
        JsonNode paga = aberta(admin, admin, 14_000, hoje);      // paga: fora dos dois
        api.post("/cobrancas/" + paga.get("id").asString() + "/baixa-manual", admin,
                Map.of("data", hoje.toString(), "forma", "PIX_DIRETO", "versao", paga.get("versao").asLong()), 200);
        JsonNode cancelada = aberta(admin, admin, 18_000, hoje.minusDays(3)); // cancelada: fora dos dois
        api.post("/cobrancas/" + cancelada.get("id").asString() + "/cancelar", admin,
                Map.of("motivo", "Motivo fictício", "versao", cancelada.get("versao").asLong()), 200);
        // Responsável: o outro membro.
        aberta(admin, leitor, 15_000, hoje.minusDays(10));      // vencida
        aberta(admin, leitor, 16_000, hoje.plusDays(3));        // vencendo
        aberta(admin, leitor, 17_000, hoje.minusDays(1));       // vencida ontem

        // Outra consultoria, com cobranças vencida e vencendo: não conta em nenhuma conta daqui.
        JsonNode outro = api.novoTreinador();
        aberta(outro, outro, 99_000, hoje.minusDays(5));
        aberta(outro, outro, 98_000, hoje.plusDays(2));

        Numero todasVencidas = new Numero(3, 10_000 + 15_000 + 17_000);
        Numero todasVencendo = new Numero(3, 11_000 + 12_000 + 16_000);
        confere(admin, false, todasVencidas, todasVencendo);
        confere(admin, true, new Numero(1, 10_000), new Numero(2, 11_000 + 12_000));
        confere(leitor, false, todasVencidas, todasVencendo);
        confere(leitor, true, new Numero(2, 15_000 + 17_000), new Numero(1, 16_000));
        confere(outro, false, new Numero(1, 99_000), new Numero(1, 98_000));
    }

    @Test
    void semCobrancaNenhumaOsDoisLadosDaoZero() throws Exception {
        assertThat(vencidasDoCartao(admin, false)).isEqualTo(new Numero(0, 0));
        assertThat(vencidasDaLista(admin, false)).isEqualTo(new Numero(0, 0));
        JsonNode janela = api.get("/financeiro/painel", admin, 200).path("proximosRecebimentos").path("em7Dias");
        assertThat(janela.get("cobrancas").asLong()).isZero();
        assertThat(vencendoDaLista(admin, false)).isEqualTo(new Numero(0, 0));
    }
}
