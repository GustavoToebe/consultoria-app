package br.com.treinos.api.contratos;

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

import java.time.Instant;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Prazo para assinar o contrato da consultoria (S6): {@code GET/PUT /consultoria/contratos} com {@code prazoDias} de 1 a 60 ou nulo,
 * permissões, 422 por campo, auditoria de resumo fixo só quando muda, isolamento por consultoria e o prazo fixado no contrato na hora
 * de gerar (mudar o prazo nunca mexe nos já gerados). O 503 com a chave desligada está em {@code ContratoTravaDesligadaIntegrationTest}.
 */
@AutoConfigureMockMvc
class PrazoDeContratosIntegrationTest extends AbstractIntegrationTest {

    private static final String CAMINHO = "/consultoria/contratos";

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;

    private ApiDeTeste api;
    private JsonNode admin;
    private UUID consultoria;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        consultoria = consultoriaDe(admin);
    }

    private UUID consultoriaDe(JsonNode login) {
        return jdbc.queryForObject("select consultoria_id from usuario where id = ?::uuid", UUID.class,
                login.get("usuario").get("id").asString());
    }

    private static Integer prazo(JsonNode resposta) {
        JsonNode n = resposta.path("prazoDias");
        return n.isNull() || n.isMissingNode() ? null : n.asInt();
    }

    private Integer noBanco(UUID daConsultoria) {
        return jdbc.queryForObject("select contrato_prazo_dias from consultoria where id = ?", Integer.class, daConsultoria);
    }

    private static Map<String, Object> corpo(Integer dias) {
        Map<String, Object> m = new HashMap<>();
        m.put("prazoDias", dias);
        return m;
    }

    private JsonNode membro(String nome, Set<String> permissoes) throws Exception {
        String perfil = api.post("/perfis", admin, Map.of("nome", "Perfil " + nome + UUID.randomUUID(), "permissoes", permissoes), 200)
                .get("id").asString();
        JsonNode convite = api.post("/usuarios/convites", admin,
                Map.of("nome", nome, "email", ApiDeTeste.emailUnico("membro"), "perfilId", perfil), 200);
        return api.post("/publico/convites-equipe/aceitar", null,
                Map.of("codigo", convite.get("codigo").asString(), "senha", ApiDeTeste.SENHA), 200);
    }

    private List<String> resumos() {
        return jdbc.queryForList("select resumo from auditoria where consultoria_id = ? and acao = 'CONTRATO_PRAZO_CONFIGURADO'",
                String.class, consultoria);
    }

    // ---- ler e gravar ----

    @Test
    void comecaSemPrazoGravaDe1a60EApagaComNulo() throws Exception {
        assertThat(prazo(api.get(CAMINHO, admin, 200))).isNull();

        assertThat(prazo(api.put(CAMINHO, admin, corpo(5), 200))).isEqualTo(5);
        assertThat(prazo(api.get(CAMINHO, admin, 200))).isEqualTo(5);
        assertThat(noBanco(consultoria)).isEqualTo(5);

        // Os extremos valem.
        assertThat(prazo(api.put(CAMINHO, admin, corpo(1), 200))).isEqualTo(1);
        assertThat(prazo(api.put(CAMINHO, admin, corpo(60), 200))).isEqualTo(60);
        assertThat(noBanco(consultoria)).isEqualTo(60);

        // Nulo (e corpo sem o campo) = não travar.
        assertThat(prazo(api.put(CAMINHO, admin, corpo(null), 200))).isNull();
        assertThat(noBanco(consultoria)).isNull();
        api.put(CAMINHO, admin, corpo(7), 200);
        assertThat(prazo(api.put(CAMINHO, admin, Map.of(), 200))).isNull();
        assertThat(noBanco(consultoria)).isNull();
    }

    @Test
    void foraDe1a60E422ComOCampoENadaMuda() throws Exception {
        api.put(CAMINHO, admin, corpo(10), 200);
        for (int invalido : new int[]{0, -1, 61, 1000}) {
            JsonNode erro = api.put(CAMINHO, admin, corpo(invalido), 422);
            assertThat(erro.get("codigo").asString()).isEqualTo("CONTRATO_PRAZO_INVALIDO");
            assertThat(erro.get("fieldErrors")).hasSize(1);
            assertThat(erro.get("fieldErrors").get(0).get("field").asString()).isEqualTo("prazoDias");
        }
        assertThat(noBanco(consultoria)).isEqualTo(10);
        assertThat(prazo(api.get(CAMINHO, admin, 200))).isEqualTo(10);
    }

    @Test
    void auditaComResumoFixoSoQuandoMuda() throws Exception {
        api.put(CAMINHO, admin, corpo(5), 200);
        api.put(CAMINHO, admin, corpo(5), 200); // igual: 200 sem gravar nem auditar
        assertThat(resumos()).containsExactly("Configurou o prazo para assinar contratos.");
        api.put(CAMINHO, admin, corpo(8), 200);
        api.put(CAMINHO, admin, corpo(null), 200);
        api.put(CAMINHO, admin, corpo(null), 200);
        assertThat(resumos()).hasSize(3).containsOnly("Configurou o prazo para assinar contratos.");
        // Prazo inválido não audita.
        api.put(CAMINHO, admin, corpo(99), 422);
        assertThat(resumos()).hasSize(3);
    }

    @Test
    void mudarOPrazoNaoMexeNaVersaoDaMarcaDaConsultoria() throws Exception {
        long antes = jdbc.queryForObject("select versao from consultoria where id = ?", Long.class, consultoria);
        api.put(CAMINHO, admin, corpo(12), 200);
        assertThat(jdbc.queryForObject("select versao from consultoria where id = ?", Long.class, consultoria)).isEqualTo(antes);
    }

    // ---- permissões ----

    @Test
    void lerExigeContratoLerGravarExigeContratoAlterarEAlunoNaoUsa() throws Exception {
        JsonNode semNada = membro("Sem Contrato", Set.of("ALUNO_LER"));
        JsonNode soLeitura = membro("So Leitura", Set.of("ALUNO_LER", "ALUNO_SENSIVEL_LER", "CONTRATO_LER"));
        JsonNode alteracao = membro("Altera", Set.of("ALUNO_LER", "ALUNO_SENSIVEL_LER", "CONTRATO_LER", "CONTRATO_ALTERAR"));

        api.get(CAMINHO, semNada, 403);
        api.put(CAMINHO, semNada, corpo(5), 403);
        api.get(CAMINHO, soLeitura, 200);
        api.put(CAMINHO, soLeitura, corpo(5), 403);
        assertThat(noBanco(consultoria)).isNull();
        assertThat(prazo(api.put(CAMINHO, alteracao, corpo(5), 200))).isEqualTo(5);
        assertThat(prazo(api.get(CAMINHO, soLeitura, 200))).isEqualTo(5);

        UUID aluno = api.criarAluno(admin, "Aluno Fictício " + UUID.randomUUID());
        JsonNode loginDoAluno = api.convidarEEntrar(admin, aluno);
        api.get(CAMINHO, loginDoAluno, 403);
        api.put(CAMINHO, loginDoAluno, corpo(5), 403);
        api.get(CAMINHO, null, 401);
        api.put(CAMINHO, null, corpo(5), 401);
    }

    @Test
    void outraConsultoriaNaoVeNemMudaOPrazoDeLa() throws Exception {
        api.put(CAMINHO, admin, corpo(9), 200);
        JsonNode outraEquipe = api.novoTreinador();
        UUID outra = consultoriaDe(outraEquipe);

        assertThat(prazo(api.get(CAMINHO, outraEquipe, 200))).isNull();
        api.put(CAMINHO, outraEquipe, corpo(3), 200);
        assertThat(prazo(api.get(CAMINHO, outraEquipe, 200))).isEqualTo(3);
        assertThat(prazo(api.get(CAMINHO, admin, 200))).isEqualTo(9);
        assertThat(noBanco(consultoria)).isEqualTo(9);
        assertThat(noBanco(outra)).isEqualTo(3);
    }

    // ---- o prazo fixado no contrato ----

    @Test
    void prazoNovoValeSoParaOContratoGeradoDepoisEOPrazoAteECimDoDiaDeBrasilia() throws Exception {
        JsonNode modelo = api.post("/contratos/modelos", admin, Map.of("nome", "Modelo " + UUID.randomUUID(), "texto", "Contrato de {aluno_nome}."), 201);
        UUID aluno = api.criarAluno(admin, "Aluno Fictício " + UUID.randomUUID());
        LocalDate hoje = LocalDate.now(Fuso.BRASILIA);

        api.put(CAMINHO, admin, corpo(5), 200);
        JsonNode primeiro = gerar(aluno, modelo);
        assertThat(Instant.parse(primeiro.get("prazoAte").asString())).isEqualTo(fimDoDia(hoje.plusDays(5)));

        // Mudar o prazo não mexe no contrato já gerado; o próximo nasce com o novo.
        api.put(CAMINHO, admin, corpo(10), 200);
        assertThat(Instant.parse(api.get("/contratos/" + primeiro.get("id").asString(), admin, 200).get("prazoAte").asString()))
                .isEqualTo(fimDoDia(hoje.plusDays(5)));
        JsonNode segundo = gerar(aluno, modelo);
        assertThat(Instant.parse(segundo.get("prazoAte").asString())).isEqualTo(fimDoDia(hoje.plusDays(10)));

        // Sem prazo: o contrato nasce sem prazo (não trava) e os anteriores continuam como estavam.
        api.put(CAMINHO, admin, corpo(null), 200);
        JsonNode terceiro = gerar(aluno, modelo);
        assertThat(terceiro.get("prazoAte").isNull()).isTrue();
        assertThat(Instant.parse(api.get("/contratos/" + segundo.get("id").asString(), admin, 200).get("prazoAte").asString()))
                .isEqualTo(fimDoDia(hoje.plusDays(10)));
    }

    private JsonNode gerar(UUID aluno, JsonNode modelo) throws Exception {
        return api.post("/alunos/" + aluno + "/contratos", admin,
                Map.of("pedidoId", UUID.randomUUID().toString(), "modeloId", modelo.get("id").asString()), 201);
    }

    private static Instant fimDoDia(LocalDate dia) {
        return dia.atTime(23, 59, 59).atZone(Fuso.BRASILIA).toInstant();
    }
}
