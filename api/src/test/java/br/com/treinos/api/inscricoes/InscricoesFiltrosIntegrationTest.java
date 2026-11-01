package br.com.treinos.api.inscricoes;

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
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Filtros do lote 2 na fila de interessados ({@code GET /inscricoes} e {@code /contagens}): responsável e origem
 * repetíveis (OU dentro do filtro, E entre filtros), período de entrada e de última atividade, recusas (400 sem repetir o
 * valor, 404 de membro de fora, {@code meus} junto de {@code responsavel}) e outra consultoria. Só dados fictícios.
 */
@AutoConfigureMockMvc
class InscricoesFiltrosIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate banco;

    private ApiDeTeste api;
    private JsonNode admin;
    private JsonNode membro;
    private String codigo;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        String perfil = api.post("/perfis", admin, Map.of("nome", "Atendente fictício",
                "permissoes", Set.of("ALUNO_LER", "INSCRICAO_LER", "INSCRICAO_ALTERAR")), 200).path("id").asString();
        JsonNode convite = api.post("/usuarios/convites", admin, Map.of("nome", "Membro fictício",
                "email", ApiDeTeste.emailUnico("membro"), "perfilId", perfil), 200);
        membro = api.post("/publico/convites-equipe/aceitar", null,
                Map.of("codigo", convite.path("codigo").asString(), "senha", ApiDeTeste.SENHA), 200);
        codigo = abrirLink(admin);
    }

    private static String id(JsonNode login) {
        return login.path("usuario").path("id").asString();
    }

    private String abrirLink(JsonNode login) throws Exception {
        JsonNode atual = api.get("/inscricoes/configuracao", login, 200);
        Map<String, Object> corpo = new HashMap<>();
        corpo.put("aberta", true);
        corpo.put("responsavelId", null);
        corpo.put("texto", null);
        corpo.put("versao", atual.path("versao").isNull() ? null : atual.path("versao").asLong());
        return api.put("/inscricoes/configuracao", login, corpo, 200).path("codigo").asString();
    }

    /** Inscreve pelo link (origem opcional), dá o responsável e devolve o id. */
    private String inscrever(String nome, String whatsapp, String origem, JsonNode responsavel) throws Exception {
        Map<String, Object> corpo = new HashMap<>();
        corpo.put("nome", nome);
        corpo.put("whatsapp", whatsapp);
        if (origem != null) corpo.put("origem", origem);
        api.post("/publico/inscricoes/" + codigo, null, corpo, 202);
        String inscricao = api.get("/inscricoes?situacao=TODAS", admin, 200).path("itens").get(0).path("id").asString();
        if (responsavel != null) {
            long versao = api.get("/inscricoes/" + inscricao, admin, 200).path("versao").asLong();
            Map<String, Object> andamento = new HashMap<>();
            andamento.put("situacao", "NOVA");
            andamento.put("pagamento", "NAO_CONTROLADO");
            andamento.put("responsavelId", id(responsavel));
            andamento.put("versao", versao);
            api.put("/inscricoes/" + inscricao, admin, andamento, 200);
        }
        return inscricao;
    }

    private List<String> nomes(String consulta) throws Exception {
        List<String> nomes = new ArrayList<>();
        api.get("/inscricoes?situacao=TODAS&" + consulta, admin, 200).path("itens")
                .forEach(i -> nomes.add(i.path("nome").asString()));
        return nomes.stream().sorted().toList();
    }

    /** Põe a entrada e a última atividade num dia de Brasília (meio-dia), direto no banco: o teste não espera dias. */
    private void datas(String inscricao, LocalDate entrada, LocalDate atividade) {
        banco.update("update inscricao set criada_em = ?, ultima_atividade_em = ? where id = ?::uuid",
                java.sql.Timestamp.from(ZonedDateTime.of(entrada.atTime(12, 0), Fuso.BRASILIA).toInstant()),
                java.sql.Timestamp.from(ZonedDateTime.of(atividade.atTime(12, 0), Fuso.BRASILIA).toInstant()), inscricao);
    }

    @Test
    void responsavelEOrigemRepetiveis() throws Exception {
        inscrever("Ana do admin", "11987650011", "INSTAGRAM", admin);
        inscrever("Bruno do membro", "11987650012", "GOOGLE", membro);
        inscrever("Carla sem ninguém", "11987650013", null, null);

        assertThat(nomes("responsavel=" + id(admin) + "&responsavel=" + id(membro)))
                .containsExactly("Ana do admin", "Bruno do membro");
        // Vírgula vale como repetição; "nenhum" junta os sem responsável.
        assertThat(nomes("responsavel=" + id(membro) + ",nenhum")).containsExactly("Bruno do membro", "Carla sem ninguém");
        assertThat(nomes("origem=INSTAGRAM&origem=GOOGLE")).containsExactly("Ana do admin", "Bruno do membro");
        assertThat(nomes("origem=GOOGLE&origem=NAO_INFORMADA")).containsExactly("Bruno do membro", "Carla sem ninguém");
        // E entre filtros.
        assertThat(nomes("origem=INSTAGRAM&origem=GOOGLE&responsavel=" + id(membro))).containsExactly("Bruno do membro");
        assertThat(nomes("origem=NAO_INFORMADA&responsavel=" + id(admin))).isEmpty();

        JsonNode contagens = api.get("/inscricoes/contagens?responsavel=" + id(admin) + "&responsavel=nenhum", admin, 200);
        assertThat(contagens.path("porSituacao").path("NOVA").asLong()).isEqualTo(2);
        assertThat(api.get("/inscricoes/contagens?origem=INSTAGRAM,GOOGLE", admin, 200).path("todas").asLong()).isEqualTo(2);
        // "Meus" continua: o membro só vê as dele.
        assertThat(api.get("/inscricoes/contagens?meus=true", membro, 200).path("todas").asLong()).isEqualTo(1);
    }

    @Test
    void periodoDeEntradaEDeUltimaAtividade() throws Exception {
        LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
        String antiga = inscrever("Antiga fictícia", "11987650021", null, null);
        String recente = inscrever("Recente fictícia", "11987650022", null, null);
        datas(antiga, hoje.minusDays(40), hoje.minusDays(2));
        datas(recente, hoje.minusDays(5), hoje.minusDays(5));

        assertThat(nomes("de=" + hoje.minusDays(10) + "&ate=" + hoje)).containsExactly("Recente fictícia");
        assertThat(nomes("ate=" + hoje.minusDays(30))).containsExactly("Antiga fictícia");
        // Pontas inclusivas (o dia inteiro de Brasília).
        assertThat(nomes("de=" + hoje.minusDays(5) + "&ate=" + hoje.minusDays(5))).containsExactly("Recente fictícia");
        assertThat(nomes("atividadeDe=" + hoje.minusDays(3))).containsExactly("Antiga fictícia");
        assertThat(nomes("atividadeAte=" + hoje.minusDays(4))).containsExactly("Recente fictícia");
        // Os dois períodos juntos (E).
        assertThat(nomes("de=" + hoje.minusDays(50) + "&atividadeDe=" + hoje.minusDays(3))).containsExactly("Antiga fictícia");
        assertThat(nomes("de=" + hoje.minusDays(10) + "&atividadeDe=" + hoje.minusDays(3))).isEmpty();
        // As contagens seguem os mesmos períodos.
        assertThat(api.get("/inscricoes/contagens?de=" + hoje.minusDays(10), admin, 200).path("todas").asLong()).isEqualTo(1);
        assertThat(api.get("/inscricoes/contagens?atividadeAte=" + hoje.minusDays(4), admin, 200).path("porSituacao")
                .path("NOVA").asLong()).isEqualTo(1);
        // Invertido.
        assertThat(api.get("/inscricoes?de=" + hoje + "&ate=" + hoje.minusDays(1), admin, 400).path("codigo").asString())
                .isEqualTo("PERIODO_INVALIDO");
        assertThat(api.get("/inscricoes?atividadeDe=" + hoje + "&atividadeAte=" + hoje.minusDays(1), admin, 400)
                .path("codigo").asString()).isEqualTo("PERIODO_INVALIDO");
    }

    @Test
    void recusas() throws Exception {
        JsonNode r = api.get("/inscricoes?origem=TELEVISAO", admin, 400);
        assertThat(r.path("codigo").asString()).isEqualTo("FILTRO_INVALIDO");
        assertThat(r.toString()).doesNotContain("TELEVISAO");
        assertThat(api.get("/inscricoes?responsavel=ninguem", admin, 400).path("codigo").asString()).isEqualTo("FILTRO_INVALIDO");
        assertThat(api.get("/inscricoes?meus=true&responsavel=nenhum", admin, 400).path("codigo").asString())
                .isEqualTo("FILTRO_INVALIDO");
        assertThat(api.get("/inscricoes/contagens?meus=true&responsavel=" + id(membro), admin, 400).path("codigo").asString())
                .isEqualTo("FILTRO_INVALIDO");
        StringBuilder muitos = new StringBuilder("origem=");
        for (int i = 0; i < 51; i++) muitos.append(i == 0 ? "" : ",").append("V").append(i);
        assertThat(api.get("/inscricoes?" + muitos, admin, 400).path("codigo").asString()).isEqualTo("FILTRO_INVALIDO");
        // Membro de outra consultoria ou inexistente: 404.
        JsonNode outro = api.novoTreinador();
        api.get("/inscricoes?responsavel=" + id(outro), admin, 404);
        api.get("/inscricoes/contagens?responsavel=" + UUID.randomUUID(), admin, 404);
    }

    @Test
    void outraConsultoriaNaoVeNada() throws Exception {
        inscrever("Daqui fictícia", "11987650031", "INSTAGRAM", admin);
        JsonNode outro = api.novoTreinador();
        assertThat(api.get("/inscricoes?situacao=TODAS&origem=INSTAGRAM&responsavel=nenhum," + id(outro), outro, 200)
                .path("total").asLong()).isZero();
        assertThat(api.get("/inscricoes/contagens?origem=INSTAGRAM", outro, 200).path("todas").asLong()).isZero();
        // E o responsável daqui é "de fora" para ela.
        api.get("/inscricoes?responsavel=" + id(admin), outro, 404);
    }
}
