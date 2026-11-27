package br.com.treinos.api.contratos;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.web.Fuso;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * A trava por contrato (passo 5, D3, D5, D19 a D21): o aluno com contrato pendente de prazo vencido toma 403
 * {@code CONTRATO_PENDENTE} fora da lista fechada, calculado a cada requisição; assinar, prorrogar e cancelar liberam na hora; o treino
 * feito offline antes da trava ainda sincroniza; a trava do contrato vem antes da do ATRASO. A chave desligada está em
 * {@code ContratoTravaDesligadaIntegrationTest}. Só dados fictícios.
 */
@AutoConfigureMockMvc
class ContratoTravaIntegrationTest extends AbstractIntegrationTest {

    private static final String CONTRATO_PENDENTE = "CONTRATO_PENDENTE";
    private static final String ATRASO = "ACESSO_PAUSADO_POR_ATRASO";

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;

    private ApiDeTeste api;
    private JsonNode admin;
    private JsonNode modelo;
    private String nomeDoAluno;
    private UUID aluno;
    private JsonNode loginDoAluno;
    private final LocalDate hoje = LocalDate.now(Fuso.BRASILIA);

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        modelo = api.post("/contratos/modelos", admin,
                Map.of("nome", "Modelo " + UUID.randomUUID(), "texto", "Contrato de {aluno_nome} com a {consultoria}."), 201);
        nomeDoAluno = "Aluna Travada " + UUID.randomUUID().toString().substring(0, 8);
        aluno = UUID.fromString(api.post("/alunos", admin, Map.of("nome", nomeDoAluno), 200).get("id").asString());
        loginDoAluno = api.convidarEEntrar(admin, aluno);
    }

    // ---- ajudantes ----

    /** Gera um contrato do aluno (signatário aluno) e deixa o prazo como pedido: no passado ({@code horas < 0}), no futuro, ou nulo. */
    private JsonNode contrato(JsonNode equipe, UUID doAluno, JsonNode ummodelo, Integer horas) throws Exception {
        JsonNode c = api.post("/alunos/" + doAluno + "/contratos", equipe,
                Map.of("pedidoId", UUID.randomUUID().toString(), "modeloId", ummodelo.get("id").asString()), 201);
        definirPrazo(c.get("id").asString(), horas);
        return c;
    }

    private void definirPrazo(String contratoId, Integer horas) {
        if (horas == null) {
            jdbc.update("update contrato_aluno set prazo_ate = null where id = ?::uuid", contratoId);
        } else {
            jdbc.update("update contrato_aluno set prazo_ate = now() + (? * interval '1 hour') where id = ?::uuid", horas, contratoId);
        }
    }

    private JsonNode vencido() throws Exception {
        return contrato(admin, aluno, modelo, -2);
    }

    private static Map<String, Object> assinatura(String sha256, String nome) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("sha256", sha256);
        m.put("nome", nome);
        m.put("aceite", true);
        return m;
    }

    private JsonNode assinar(JsonNode contrato, int esperado) throws Exception {
        return api.post("/aluno/contratos/" + contrato.get("id").asString() + "/assinar", loginDoAluno,
                assinatura(contrato.get("sha256").asString(), nomeDoAluno), esperado);
    }

    private void travaDoContrato(JsonNode resposta) {
        assertThat(resposta.get("codigo").asString()).isEqualTo(CONTRATO_PENDENTE);
    }

    private void travaDoAtraso(JsonNode resposta) {
        assertThat(resposta.get("codigo").asString()).isEqualTo(ATRASO);
    }

    /** Chamada que só importa se a trava a deixou passar: o corpo, se tiver código, não é de nenhuma das duas travas. */
    private void naoBarrada(MockHttpServletRequestBuilder req, JsonNode login, Object corpo) throws Exception {
        req.header("Authorization", ApiDeTeste.bearer(login));
        if (corpo != null) {
            req.contentType(MediaType.APPLICATION_JSON).content(api.paraJson(corpo));
        }
        var resposta = mvc.perform(req).andReturn().getResponse();
        String texto = resposta.getContentAsString(StandardCharsets.UTF_8);
        if (!texto.isBlank() && texto.startsWith("{")) {
            String codigo = json.readTree(texto).path("codigo").asString("");
            assertThat(codigo).isNotIn(CONTRATO_PENDENTE, ATRASO);
        }
    }

    private boolean vencidoNoEu(JsonNode login) throws Exception {
        return api.get("/eu", login, 200).get("aluno").get("contratoPendenteVencido").asBoolean();
    }

    private void pausarPorAtraso() {
        jdbc.update("update aluno set acesso_desativado_em = now(), acesso_desativado_motivo = 'ATRASO' where id = ?", aluno);
    }

    // ---- a trava ----

    @Test
    void contratoPendenteVencidoBarraForaDaListaEPassaNasRotasLiberadas() throws Exception {
        api.publicarTreino(admin, aluno, ApiDeTeste.treino().conteudo());
        JsonNode contrato = vencido();
        String id = contrato.get("id").asString();

        // Fora da lista: 403 CONTRATO_PENDENTE em qualquer método e rota do aluno (o plano de treino vem no painel).
        travaDoContrato(api.get("/aluno/painel", loginDoAluno, 403));
        travaDoContrato(api.get("/aluno/dieta", loginDoAluno, 403));
        travaDoContrato(api.get("/aluno/mobilidade", loginDoAluno, 403));
        travaDoContrato(api.get("/aluno/pastas", loginDoAluno, 403));
        travaDoContrato(api.get("/aluno/execucoes", loginDoAluno, 403));
        travaDoContrato(api.get("/aluno/agua", loginDoAluno, 403));
        travaDoContrato(api.get("/aluno/mobilidade/registros", loginDoAluno, 403));
        travaDoContrato(api.get("/aluno/sessoes-concluidas", loginDoAluno, 403));
        travaDoContrato(api.get("/aluno/comunidade/perfil", loginDoAluno, 403));
        travaDoContrato(api.put("/aluno/push-token", loginDoAluno, Map.of("token", "ExponentPushToken[x]"), 403));
        travaDoContrato(api.put("/aluno/meus-dados", loginDoAluno, Map.of(), 403));
        travaDoContrato(api.post("/aluno/atualizacao/enviar", loginDoAluno, Map.of(), 403));
        travaDoContrato(api.get("/aluno/lembretes-de-cobranca", loginDoAluno, 403));

        // O aluno ainda entra e renova a sessão (login e refresh não passam pela trava).
        JsonNode renovada = api.post("/auth/refresh", null, Map.of("refreshToken", loginDoAluno.get("refreshToken").asString()), 200);
        assertThat(renovada.get("accessToken").asString()).isNotBlank();

        // Liberadas: situação, termos, conta, financeiro, o contrato e a fila de envio do offline.
        assertThat(vencidoNoEu(loginDoAluno)).isTrue();
        api.get("/termos", loginDoAluno, 200);
        api.get("/aluno/financeiro", loginDoAluno, 200);
        api.get("/aluno/meus-dados", loginDoAluno, 200);
        assertThat(api.get("/aluno/contratos", loginDoAluno, 200)).hasSize(1);
        assertThat(api.get("/aluno/contratos/" + id, loginDoAluno, 200).get("vencido").asBoolean()).isTrue();
        naoBarrada(MockMvcRequestBuilders.post("/aluno/agua"), loginDoAluno, Map.of("registros", List.of()));
        naoBarrada(MockMvcRequestBuilders.post("/aluno/mobilidade/registros"), loginDoAluno, Map.of("registros", List.of()));
        naoBarrada(MockMvcRequestBuilders.post("/aluno/sessoes-concluidas"), loginDoAluno, Map.of("registros", List.of()));
        naoBarrada(MockMvcRequestBuilders.post("/aluno/execucoes/lote"), loginDoAluno, Map.of("registros", List.of()));

        // O treinador não é afetado, e a trava não deixa o aluno ver contrato de outro (isso é do próprio serviço).
        api.get("/alunos/" + aluno, admin, 200);
        api.get("/contratos/" + id, admin, 200);
    }

    @Test
    void treinoFeitoOfflineAntesDaTravaAindaSincronizaComOContratoVencido() throws Exception {
        ApiDeTeste.TreinoDeTeste treino = ApiDeTeste.treino();
        api.publicarTreino(admin, aluno, treino.conteudo());
        String versaoId = api.get("/aluno/painel", loginDoAluno, 200).get("treino").get("versaoId").asString();

        vencido();
        travaDoContrato(api.get("/aluno/painel", loginDoAluno, 403));

        Map<String, Object> registro = new LinkedHashMap<>();
        registro.put("id", UUID.randomUUID().toString());
        registro.put("planoVersaoId", versaoId);
        registro.put("sessaoUid", treino.sessaoUid().toString());
        registro.put("exercicioUid", treino.exercicioUid().toString());
        registro.put("serieUid", treino.wsUid().toString());
        registro.put("data", hoje.minusDays(1).toString());
        registro.put("carga", "60");
        registro.put("repeticoes", 8);
        registro.put("concluida", true);
        registro.put("alteradoNoAparelhoEm", Instant.now().toString());

        JsonNode resposta = api.post("/aluno/execucoes/lote", loginDoAluno, Map.of("registros", List.of(registro)), 200);
        assertThat(resposta.get("resultados").valueStream().map(x -> x.get("situacao").asString())).containsOnly("ACEITO");
        // Gravou de verdade: a equipe vê o dia treinado.
        assertThat(api.get("/alunos/" + aluno + "/execucoes", admin, 200)).isNotEmpty();
    }

    @Test
    void assinarLiberaNaHora() throws Exception {
        JsonNode contrato = vencido();
        travaDoContrato(api.get("/aluno/painel", loginDoAluno, 403));

        assinar(contrato, 200);

        api.get("/aluno/painel", loginDoAluno, 200);
        assertThat(vencidoNoEu(loginDoAluno)).isFalse();
    }

    @Test
    void prorrogarLiberaNaHoraEVencerDeNovoTravaDeNovo() throws Exception {
        JsonNode contrato = vencido();
        String id = contrato.get("id").asString();
        travaDoContrato(api.get("/aluno/painel", loginDoAluno, 403));

        long versao = api.get("/contratos/" + id, admin, 200).get("versao").asLong();
        api.post("/contratos/" + id + "/prorrogar", admin, Map.of("dias", 5, "versao", versao), 200);

        api.get("/aluno/painel", loginDoAluno, 200);
        assertThat(vencidoNoEu(loginDoAluno)).isFalse();

        // Calculada a cada requisição, sem gravar nada: o prazo volta ao passado e a trava volta.
        definirPrazo(id, -1);
        travaDoContrato(api.get("/aluno/painel", loginDoAluno, 403));
        assertThat(vencidoNoEu(loginDoAluno)).isTrue();
    }

    @Test
    void cancelarLiberaNaHora() throws Exception {
        JsonNode contrato = vencido();
        travaDoContrato(api.get("/aluno/painel", loginDoAluno, 403));

        api.post("/contratos/" + contrato.get("id").asString() + "/cancelar", admin,
                Map.of("motivo", "Gerado por engano", "versao", contrato.get("versao").asLong()), 200);

        api.get("/aluno/painel", loginDoAluno, 200);
        assertThat(vencidoNoEu(loginDoAluno)).isFalse();
    }

    @Test
    void pendenteQueNaoVenceuOuSemPrazoNuncaTrava() throws Exception {
        JsonNode noFuturo = contrato(admin, aluno, modelo, 48);
        api.get("/aluno/painel", loginDoAluno, 200);
        assertThat(vencidoNoEu(loginDoAluno)).isFalse();

        // Sem prazo (a consultoria não trava): nunca vence, mesmo antigo.
        JsonNode semPrazo = contrato(admin, aluno, modelo, null);
        jdbc.update("update contrato_aluno set gerado_em = now() - interval '400 days' where id = ?::uuid", semPrazo.get("id").asString());
        api.get("/aluno/painel", loginDoAluno, 200);
        assertThat(vencidoNoEu(loginDoAluno)).isFalse();

        // O primeiro, assim que vence, trava; os outros pendentes não "seguram" nada além disso.
        definirPrazo(noFuturo.get("id").asString(), -1);
        travaDoContrato(api.get("/aluno/painel", loginDoAluno, 403));
    }

    @Test
    void contratoAssinadoOuCanceladoComPrazoVencidoNaoTrava() throws Exception {
        JsonNode assinado = contrato(admin, aluno, modelo, 24);
        assinar(assinado, 200);
        definirPrazo(assinado.get("id").asString(), -48);
        JsonNode cancelado = contrato(admin, aluno, modelo, -48);
        api.post("/contratos/" + cancelado.get("id").asString() + "/cancelar", admin,
                Map.of("motivo", "Teste", "versao", cancelado.get("versao").asLong()), 200);

        api.get("/aluno/painel", loginDoAluno, 200);
        assertThat(vencidoNoEu(loginDoAluno)).isFalse();
    }

    @Test
    void contratoDeOutroAlunoOuDeOutraConsultoriaNaoTrava() throws Exception {
        // Outro aluno da mesma consultoria com contrato vencido: este aluno segue livre (e o outro é que trava).
        UUID colega = api.criarAluno(admin, "Colega Travado " + UUID.randomUUID());
        JsonNode loginDoColega = api.convidarEEntrar(admin, colega);
        contrato(admin, colega, modelo, -2);
        api.get("/aluno/painel", loginDoAluno, 200);
        assertThat(vencidoNoEu(loginDoAluno)).isFalse();
        travaDoContrato(api.get("/aluno/painel", loginDoColega, 403));

        // Outra consultoria com contrato vencido: nada muda para o nosso aluno.
        JsonNode outraEquipe = api.novoTreinador();
        JsonNode outroModelo = api.post("/contratos/modelos", outraEquipe, Map.of("nome", "Outro " + UUID.randomUUID(), "texto", "Texto de {aluno_nome}."), 201);
        UUID alunoDeLa = api.criarAluno(outraEquipe, "Aluno de Outra " + UUID.randomUUID());
        contrato(outraEquipe, alunoDeLa, outroModelo, -2);
        api.get("/aluno/painel", loginDoAluno, 200);
        assertThat(vencidoNoEu(loginDoAluno)).isFalse();
    }

    // ---- a ordem das duas travas ----

    @Test
    void alunoEmAtrasoEComContratoVencidoRotasDeContratoPassamEORestoDaContratoPendenteDepoisVoltaOAtraso() throws Exception {
        pausarPorAtraso();
        JsonNode contrato = contrato(admin, aluno, modelo, 24); // pendente, ainda no prazo
        String id = contrato.get("id").asString();

        // Só o ATRASO vale: as rotas do contrato passam (D21) e o resto dá a trava do atraso.
        api.get("/aluno/contratos", loginDoAluno, 200);
        api.get("/aluno/contratos/" + id, loginDoAluno, 200);
        travaDoAtraso(api.get("/aluno/painel", loginDoAluno, 403));
        assertThat(api.get("/eu", loginDoAluno, 200).get("aluno").get("acessoDesativadoMotivo").asString()).isEqualTo("ATRASO");

        // Contrato vencido: a trava do contrato vem antes, o resto dá CONTRATO_PENDENTE; as de contrato e as do ATRASO passam.
        definirPrazo(id, -2);
        travaDoContrato(api.get("/aluno/painel", loginDoAluno, 403));
        travaDoContrato(api.get("/aluno/dieta", loginDoAluno, 403));
        api.get("/aluno/contratos", loginDoAluno, 200);
        api.get("/aluno/contratos/" + id, loginDoAluno, 200);
        api.get("/aluno/financeiro", loginDoAluno, 200);
        JsonNode eu = api.get("/eu", loginDoAluno, 200).get("aluno");
        assertThat(eu.get("contratoPendenteVencido").asBoolean()).isTrue();
        assertThat(eu.get("acessoDesativadoMotivo").asString()).isEqualTo("ATRASO");

        // A fila de envio passa pela do contrato, mas o ATRASO segue barrando (pendência separada do plano, S8).
        travaDoAtraso(api.post("/aluno/execucoes/lote", loginDoAluno, Map.of("registros", List.of()), 403));

        // O aluno em ATRASO consegue assinar; assinado, volta a valer só o ATRASO.
        assinar(contrato, 200);
        travaDoAtraso(api.get("/aluno/painel", loginDoAluno, 403));
        eu = api.get("/eu", loginDoAluno, 200).get("aluno");
        assertThat(eu.get("contratoPendenteVencido").asBoolean()).isFalse();
        assertThat(eu.get("acessoDesativadoMotivo").asString()).isEqualTo("ATRASO");
    }

    // ---- GET /eu ----

    @Test
    void euTrazContratoPendenteVencidoCertoParaAlunoETreinador() throws Exception {
        assertThat(vencidoNoEu(loginDoAluno)).isFalse();
        JsonNode contrato = vencido();
        assertThat(vencidoNoEu(loginDoAluno)).isTrue();
        assinar(contrato, 200);
        assertThat(vencidoNoEu(loginDoAluno)).isFalse();

        // O treinador não tem bloco de aluno.
        assertThat(api.get("/eu", admin, 200).has("aluno")).isFalse();
    }

    @Test
    void treinadorNuncaToma403DoContratoDoAluno() throws Exception {
        vencido();
        api.get("/alunos", admin, 200);
        api.get("/contratos/modelos", admin, 200);
        api.get("/eu", admin, 200);
    }
}
