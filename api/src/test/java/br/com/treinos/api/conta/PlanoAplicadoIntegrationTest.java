package br.com.treinos.api.conta;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Plano da Central aplicado (chave {@code treinos.plano.aplicar} ligada): limites de alunos e membros, funcionalidades
 * MOBILIDADE e EQUIPE, sem linha de direitos, limite ausente, rebaixar o plano, caixa da funcionalidade e isolamento entre
 * consultorias. Só dados fictícios.
 */
@AutoConfigureMockMvc
@TestPropertySource(properties = "treinos.plano.aplicar=true")
class PlanoAplicadoIntegrationTest extends AbstractIntegrationTest {

    private static final List<String> TODAS = List.of("MOBILIDADE", "PDF", "EQUIPE");

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private ContaLocalRepositorio contas;

    private ApiDeTeste api;
    private JsonNode admin;
    private UUID consultoria;
    private final String emailA = "a-" + UUID.randomUUID() + "@example.com";
    private final String emailB = "b-" + UUID.randomUUID() + "@example.com";

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        consultoria = consultoriaDe(admin);
    }

    private UUID consultoriaDe(JsonNode login) {
        return jdbc.queryForObject("select consultoria_id from usuario where id = ?::uuid", UUID.class,
                login.path("usuario").path("id").asString());
    }

    private void direitos(UUID quem, Map<String, Long> limites, List<String> funcionalidades) {
        contas.gravarDireitos(new DireitosLocais(quem, UUID.randomUUID(), 1, "ATIVA", true, null, null, "PAGO", "Pago",
                limites, funcionalidades, Instant.now()));
    }

    private static void erro(JsonNode corpo, String codigo, String recurso) {
        assertThat(corpo.path("codigo").asString()).isEqualTo(codigo);
        assertThat(corpo.path("fieldErrors").get(0).path("field").asString()).isEqualTo(recurso);
        // o formato do erro é o de sempre (o app lê esses campos) e nunca leva nome de pessoa
        assertThat(corpo.propertyNames()).containsExactlyInAnyOrder("timestamp", "status", "error", "message", "codigo", "path",
                "requestId", "fieldErrors");
        assertThat(corpo.toString()).doesNotContain("Fictício").doesNotContain("@");
    }

    // ---- sem direitos / limite ausente ----

    @Test
    void semLinhaDeDireitosNadaEBarrado() throws Exception {
        for (int i = 0; i < 4; i++) api.criarAluno(admin, "Aluno Fictício " + i);
        convidar("Membro Fictício", emailA, perfilAssistente(), 200);
        api.post("/receitas", admin, mobilidadeModelo("Sem direitos"), 200);
        assertThat(funcionalidadesDoEu(admin)).containsExactlyElementsOf(TODAS);
    }

    @Test
    void limiteAusenteNaoELimiteNemZero() throws Exception {
        direitos(consultoria, Map.of(), TODAS);
        for (int i = 0; i < 4; i++) api.criarAluno(admin, "Aluno Fictício " + i);
        convidar("Membro Fictício", emailB, perfilAssistente(), 200);
    }

    // ---- alunos_ativos ----

    @Test
    void alunosAtivosNoLimiteAcimaEDepoisDeRebaixar() throws Exception {
        direitos(consultoria, Map.of("alunos_ativos", 2L), TODAS);
        UUID a = api.criarAluno(admin, "Aluno Fictício A");
        UUID b = api.criarAluno(admin, "Aluno Fictício B");
        JsonNode recusa = api.post("/alunos", admin, Map.of("nome", "Aluno Fictício C"), 409);
        erro(recusa, "LIMITE_DO_PLANO", "alunos_ativos");
        assertThat(recusa.path("message").asString()).isEqualTo("Seu plano permite até 2 alunos ativos.")
                .doesNotContain("Fictício");
        // PATCH em quem já está ativo não ocupa vaga nova.
        api.patch("/alunos/" + a + "/situacao", admin, Map.of("ativo", true), 200);
        // Inativar libera a vaga; reativar volta a ocupar.
        api.patch("/alunos/" + b + "/situacao", admin, Map.of("ativo", false), 200);
        UUID c = api.criarAluno(admin, "Aluno Fictício C");
        erro(api.patch("/alunos/" + b + "/situacao", admin, Map.of("ativo", true), 409), "LIMITE_DO_PLANO", "alunos_ativos");
        // Rebaixou para 1: ninguém é desativado, mas nada novo entra.
        direitos(consultoria, Map.of("alunos_ativos", 1L), TODAS);
        assertThat(api.get("/alunos", admin, 200).toString()).contains("Aluno Fictício A", "Aluno Fictício C");
        erro(api.post("/alunos", admin, Map.of("nome", "Aluno Fictício D"), 409), "LIMITE_DO_PLANO", "alunos_ativos");
        api.patch("/alunos/" + c + "/situacao", admin, Map.of("ativo", false), 200);
        api.patch("/alunos/" + a + "/situacao", admin, Map.of("ativo", false), 200);
        api.patch("/alunos/" + b + "/situacao", admin, Map.of("ativo", true), 200);
    }

    // ---- membros_equipe ----

    @Test
    void membrosContamUsuariosAtivosEConvitesValidosComAMesmaRegraDoConsumo() throws Exception {
        direitos(consultoria, Map.of("membros_equipe", 2L), TODAS);
        String perfil = perfilAssistente();
        convidar("Membro A", emailA, perfil, 200);
        erro(convidar("Membro B", emailB, perfil, 409), "LIMITE_DO_PLANO", "membros_equipe");
        // Reconvidar o mesmo e-mail troca o convite: não conta duas vezes.
        JsonNode conviteA = convidar("Membro A", emailA, perfil, 200);
        assertThat(consumoMembros()).isEqualTo(2);
        // Aceitar troca convite por usuário: a soma não muda.
        api.post("/publico/convites-equipe/aceitar", null,
                Map.of("codigo", conviteA.path("codigo").asString(), "senha", ApiDeTeste.SENHA), 200);
        assertThat(consumoMembros()).isEqualTo(2);
        String idA = idDoUsuario(emailA);
        // Desativar nunca é barrado e abre vaga; reativar volta a ocupar.
        api.put("/usuarios/" + idA, admin, Map.of("nome", "Membro A", "perfilId", perfil, "ativo", false), 200);
        convidar("Membro B", emailB, perfil, 200);
        erro(api.put("/usuarios/" + idA, admin, Map.of("nome", "Membro A", "perfilId", perfil, "ativo", true), 409),
                "LIMITE_DO_PLANO", "membros_equipe");
        // Cancelar convite (livre) abre vaga de novo.
        api.delete("/usuarios/convites/" + idDoUsuario(emailB), admin, 204);
        api.put("/usuarios/" + idA, admin, Map.of("nome", "Membro A", "perfilId", perfil, "ativo", true), 200);
    }

    // ---- funcionalidades ----

    @Test
    void equipeDesligadaBarraConvidarReativarEPerfilMasNaoDesativarNemLer() throws Exception {
        direitos(consultoria, Map.of(), TODAS);
        String perfil = perfilAssistente();
        JsonNode convite = convidar("Membro A", emailA, perfil, 200);
        api.post("/publico/convites-equipe/aceitar", null,
                Map.of("codigo", convite.path("codigo").asString(), "senha", ApiDeTeste.SENHA), 200);
        String idA = idDoUsuario(emailA);
        direitos(consultoria, Map.of(), List.of("MOBILIDADE", "PDF"));
        erro(convidar("Membro B", emailB, perfil, 403), "FUNCIONALIDADE_FORA_DO_PLANO", "EQUIPE");
        erro(api.post("/perfis", admin, Map.of("nome", "Perfil Fictício", "permissoes", Set.of("ALUNO_LER")), 403),
                "FUNCIONALIDADE_FORA_DO_PLANO", "EQUIPE");
        api.get("/usuarios", admin, 200);
        api.get("/perfis", admin, 200);
        api.put("/usuarios/" + idA, admin, Map.of("nome", "Membro A", "perfilId", perfil, "ativo", false), 200);
        erro(api.put("/usuarios/" + idA, admin, Map.of("nome", "Membro A", "perfilId", perfil, "ativo", true), 403),
                "FUNCIONALIDADE_FORA_DO_PLANO", "EQUIPE");
        assertThat(funcionalidadesDoEu(admin)).containsExactly("MOBILIDADE", "PDF");
    }

    @Test
    void mobilidadeDesligadaBarraOQueCriaEMantemLeituraEExclusao() throws Exception {
        direitos(consultoria, Map.of(), TODAS);
        UUID aluno = api.criarAluno(admin, "Aluno Fictício");
        String pasta = api.post("/alunos/" + aluno + "/pastas", admin,
                Map.of("titulo", "Pasta fictícia", "inicio", "2026-10-01", "fim", "2026-10-14"), 200).path("id").asString();
        String modelo = api.post("/receitas", admin, mobilidadeModelo("Modelo A"), 200).path("id").asString();
        String plano = api.post("/alunos/" + aluno + "/planos-mobilidade", admin,
                Map.of("titulo", "Mobilidade fictícia", "receitaId", modelo, "pastaId", pasta), 200)
                .path("plano").path("id").asString();

        direitos(consultoria, Map.of(), List.of("pdf", "equipe")); // minúsculas: a Central pode mandar assim
        erro(api.post("/receitas", admin, mobilidadeModelo("Modelo B"), 403), "FUNCIONALIDADE_FORA_DO_PLANO", "MOBILIDADE");
        erro(api.post("/receitas/" + modelo + "/duplicar", admin, null, 403), "FUNCIONALIDADE_FORA_DO_PLANO", "MOBILIDADE");
        erro(api.post("/receitas/" + modelo + "/aplicar", admin,
                Map.of("alunoId", aluno, "pastaId", pasta, "titulo", "Outra"), 403), "FUNCIONALIDADE_FORA_DO_PLANO", "MOBILIDADE");
        erro(api.post("/alunos/" + aluno + "/planos-mobilidade", admin, Map.of("titulo", "Nova", "pastaId", pasta), 403),
                "FUNCIONALIDADE_FORA_DO_PLANO", "MOBILIDADE");
        erro(api.post("/planos-mobilidade/" + plano + "/replicar", admin, Map.of("titulo", "Cópia"), 403),
                "FUNCIONALIDADE_FORA_DO_PLANO", "MOBILIDADE");
        erro(api.post("/planos-mobilidade/" + plano + "/salvar-como-receita", admin, Map.of("nome", "Modelo C"), 403),
                "FUNCIONALIDADE_FORA_DO_PLANO", "MOBILIDADE");
        // Leitura segue; replicar a pasta dá certo e sai sem a mobilidade (renovar não pode quebrar).
        api.get("/alunos/" + aluno + "/planos-mobilidade", admin, 200);
        api.get("/planos-mobilidade/" + plano, admin, 200);
        api.get("/receitas/" + modelo, admin, 200);
        JsonNode nova = api.post("/pastas/" + pasta + "/replicar", admin,
                Map.of("titulo", "Pasta renovada", "inicio", "2026-10-15", "fim", "2026-10-28"), 200);
        long daNova = api.get("/alunos/" + aluno + "/planos-mobilidade", admin, 200).valueStream()
                .filter(p -> nova.path("id").asString().equals(p.path("pastaId").asString())).count();
        assertThat(daNova).isZero();
        api.delete("/planos-mobilidade/" + plano, admin, 204);
        assertThat(funcionalidadesDoEu(admin)).containsExactly("PDF", "EQUIPE");
    }

    @Test
    void mobilidadeDesligadaBarraOAlunoDeMarcarFeitoMasAindaLeOQueJaExiste() throws Exception {
        direitos(consultoria, Map.of(), TODAS);
        UUID aluno = api.criarAluno(admin, "Aluno Fictício");
        var mobilidade = ApiDeTeste.mobilidade();
        api.publicarMobilidade(admin, aluno, mobilidade.conteudo());
        JsonNode login = api.convidarEEntrar(admin, aluno);
        String versao = api.get("/aluno/mobilidade", login, 200).path("mobilidade").path("id").asString();
        Map<String, Object> registro = Map.of("id", UUID.randomUUID().toString(), "planoVersaoId", versao,
                "secaoUid", mobilidade.secaoUid().toString(), "itemUid", mobilidade.itemUid().toString(),
                "data", java.time.LocalDate.now(br.com.treinos.api.web.Fuso.BRASILIA).toString(), "feito", true,
                "alteradoNoAparelhoEm", Instant.now().toString());

        // Com a funcionalidade, grava normalmente.
        api.post("/aluno/mobilidade/registros", login, Map.of("registros", List.of(registro)), 200);

        // Desligada: gravar dá 403 (o lote inteiro), ler o que já existe continua valendo.
        direitos(consultoria, Map.of(), List.of("PDF", "EQUIPE"));
        erro(api.post("/aluno/mobilidade/registros", login, Map.of("registros", List.of(registro)), 403),
                "FUNCIONALIDADE_FORA_DO_PLANO", "MOBILIDADE");
        assertThat(api.get("/aluno/mobilidade/registros", login, 200)).hasSize(1);
        assertThat(api.get("/alunos/" + aluno + "/mobilidade/registros", admin, 200)).hasSize(1);
    }

    @Test
    void alunoRecebeAsFuncionalidadesDaConsultoriaNoEu() throws Exception {
        direitos(consultoria, Map.of(), List.of("PDF"));
        UUID aluno = api.criarAluno(admin, "Aluno Fictício");
        JsonNode login = api.convidarEEntrar(admin, aluno);
        assertThat(funcionalidadesDoEu(login)).containsExactly("PDF");
    }

    // ---- isolamento ----

    @Test
    void outraConsultoriaNaoInterfere() throws Exception {
        direitos(consultoria, Map.of("alunos_ativos", 1L), List.of());
        api.criarAluno(admin, "Aluno Fictício A");
        JsonNode outro = api.novoTreinador(); // sem linha de direitos
        for (int i = 0; i < 3; i++) api.criarAluno(outro, "Aluno Fictício " + i);
        api.post("/receitas", outro, mobilidadeModelo("Da outra"), 200);
        JsonNode terceiro = api.novoTreinador();
        direitos(consultoriaDe(terceiro), Map.of("alunos_ativos", 5L), TODAS);
        for (int i = 0; i < 3; i++) api.criarAluno(terceiro, "Aluno Fictício " + i);
        erro(api.post("/alunos", admin, Map.of("nome", "Aluno Fictício B"), 409), "LIMITE_DO_PLANO", "alunos_ativos");
    }

    // ---- apoio ----

    private String perfilAssistente() throws Exception {
        for (var p : api.get("/perfis", admin, 200)) if (p.path("nome").asString().equals("Assistente")) return p.path("id").asString();
        throw new AssertionError("Perfil pronto ausente");
    }

    private JsonNode convidar(String nome, String email, String perfil, int status) throws Exception {
        return api.post("/usuarios/convites", admin, Map.of("nome", nome, "email", email, "perfilId", perfil), status);
    }

    private String idDoUsuario(String email) throws Exception {
        for (var u : api.get("/usuarios", admin, 200)) if (u.path("email").asString().equals(email)) return u.path("id").asString();
        throw new AssertionError("Usuário ausente");
    }

    private long consumoMembros() throws Exception {
        for (var i : api.get("/minha-conta/consumo", admin, 200).path("itens"))
            if ("membros_equipe".equals(i.path("codigo").asString())) return i.path("usado").asLong();
        throw new AssertionError("Item ausente");
    }

    private List<String> funcionalidadesDoEu(JsonNode login) throws Exception {
        return api.get("/eu", login, 200).path("funcionalidadesDoPlano").valueStream().map(JsonNode::asString).toList();
    }

    private static Map<String, Object> mobilidadeModelo(String nome) {
        return Map.of("tipo", "MOBILIDADE", "nome", nome, "conteudo", Map.of("orientacoes", "Todos os dias.",
                "secoes", List.of(Map.of("titulo", "Alongamentos", "itens",
                        List.of(Map.of("nome", "Gato e vaca", "prescricao", "2 x 20s"))))));
    }
}
