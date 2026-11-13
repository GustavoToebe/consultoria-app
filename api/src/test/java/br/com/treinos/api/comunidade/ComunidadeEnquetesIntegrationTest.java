package br.com.treinos.api.comunidade;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.equipe.CatalogoPermissoes;
import br.com.treinos.api.fotos.FotosDeTeste;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.awt.Color;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Enquetes do mural (V072): criação e validação, voto identificado com horário por opção (diferença de conjuntos), encerramento,
 * isolamento por consultoria, permissões, voto simultâneo, "Mostrar votos" (nome, apelido, foto, ordem, filtro, paginação),
 * limites, exportação e anonimização. Cada teste cria a própria consultoria; só dados fictícios.
 */
@AutoConfigureMockMvc
class ComunidadeEnquetesIntegrationTest extends AbstractIntegrationTest {

    private static final String ALUNO = "/aluno/comunidade/mural";
    private static final String EQUIPE = "/comunidade/mural";

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JsonMapper json;
    @Autowired
    private JdbcTemplate jdbc;

    private ApiDeTeste api;
    private JsonNode admin;
    private UUID alunoA;
    private UUID alunoB;
    private JsonNode loginA;
    private JsonNode loginB;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        alunoA = api.criarAluno(admin, "Ana Votante Fictícia");
        alunoB = api.criarAluno(admin, "Beto Votante Fictício");
        loginA = api.convidarEEntrar(admin, alunoA);
        loginB = api.convidarEEntrar(admin, alunoB);
    }

    // ---- ajudantes ----

    private JsonNode criarEnquete(List<String> opcoes, Boolean varias, Instant encerraEm) throws Exception {
        return api.post(EQUIPE, admin, corpoDeEnquete(opcoes, varias, encerraEm), 200);
    }

    private static Map<String, Object> corpoDeEnquete(List<String> opcoes, Boolean varias, Instant encerraEm) {
        Map<String, Object> c = new LinkedHashMap<>();
        c.put("tipo", "ENQUETE");
        c.put("texto", "Qual horário prefere?");
        c.put("opcoes", opcoes);
        if (varias != null) {
            c.put("variasRespostas", varias);
        }
        if (encerraEm != null) {
            c.put("encerraEm", encerraEm.toString());
        }
        return c;
    }

    private JsonNode enqueteDeTres(boolean varias) throws Exception {
        return criarEnquete(List.of("Manhã", "Tarde", "Noite"), varias, null);
    }

    private static String opcao(JsonNode post, int indice) {
        return post.get("enquete").get("opcoes").get(indice).get("id").asString();
    }

    private JsonNode votar(JsonNode login, JsonNode post, List<String> opcaoIds, int esperado) throws Exception {
        return api.put(ALUNO + "/" + post.get("id").asString() + "/votos", login, Map.of("opcaoIds", opcaoIds), esperado);
    }

    private JsonNode votos(JsonNode login, JsonNode post, String consulta, int esperado) throws Exception {
        return api.get(ALUNO + "/" + post.get("id").asString() + "/votos" + consulta, login, esperado);
    }

    private JsonNode noMural(JsonNode login, String postId) throws Exception {
        for (JsonNode p : api.get(ALUNO, login, 200).get("content")) {
            if (p.get("id").asString().equals(postId)) {
                return p;
            }
        }
        throw new AssertionError("O post deveria estar no mural.");
    }

    private UUID usuarioDoAluno(UUID aluno) {
        return jdbc.queryForObject("select usuario_id from aluno where id = ?", UUID.class, aluno);
    }

    private OffsetDateTime horario(JsonNode post, String opcaoId, UUID usuario) {
        return jdbc.queryForObject("select votado_em from comunidade_enquete_voto where post_id = ?::uuid and opcao_id = ?::uuid"
                + " and usuario_id = ?", OffsetDateTime.class, post.get("id").asString(), opcaoId, usuario);
    }

    private int contar(String sql, Object... args) {
        return jdbc.queryForObject(sql, Integer.class, args);
    }

    private int votosDoUsuario(JsonNode post, UUID usuario) {
        return contar("select count(*) from comunidade_enquete_voto where post_id = ?::uuid and usuario_id = ?",
                post.get("id").asString(), usuario);
    }

    private static void esperar() throws InterruptedException {
        Thread.sleep(25);
    }

    private static List<String> campos(JsonNode no) {
        List<String> r = new ArrayList<>();
        no.propertyNames().forEach(r::add);
        return r;
    }

    private JsonNode membro(Set<String> permissoes) throws Exception {
        String perfil = api.post("/perfis", admin,
                Map.of("nome", "Perfil " + UUID.randomUUID(), "permissoes", CatalogoPermissoes.comDependencias(permissoes)), 200)
                .get("id").asString();
        JsonNode convite = api.post("/usuarios/convites", admin,
                Map.of("nome", "Membro Fictício", "email", ApiDeTeste.emailUnico("membro"), "perfilId", perfil), 200);
        return api.post("/publico/convites-equipe/aceitar", null,
                Map.of("codigo", convite.get("codigo").asString(), "senha", ApiDeTeste.SENHA), 200);
    }

    // ---- criação ----

    @Test
    void equipeCriaEnqueteEOMuralTrazOContratoCompleto() throws Exception {
        JsonNode post = enqueteDeTres(false);

        assertThat(post.get("tipo").asString()).isEqualTo("ENQUETE");
        JsonNode enquete = post.get("enquete");
        assertThat(campos(enquete)).containsExactlyInAnyOrder("variasRespostas", "encerrada", "encerraEm", "opcoes", "meusVotos",
                "participantes");
        assertThat(enquete.get("variasRespostas").asBoolean()).isFalse();
        assertThat(enquete.get("encerrada").asBoolean()).isFalse();
        assertThat(enquete.get("participantes").asLong()).isZero();
        assertThat(enquete.get("opcoes")).hasSize(3);
        assertThat(enquete.get("opcoes").get(1).get("texto").asString()).isEqualTo("Tarde");
        assertThat(campos(enquete.get("opcoes").get(0))).containsExactlyInAnyOrder("id", "texto", "votos", "votantesAmostra");

        JsonNode doMural = noMural(loginA, post.get("id").asString());
        assertThat(doMural.get("enquete").get("opcoes")).hasSize(3);
        assertThat(doMural.get("enquete").get("meusVotos")).isEmpty();
        // Os outros tipos não têm enquete.
        JsonNode conversa = api.post(ALUNO, loginA, Map.of("texto", "Conversa fictícia"), 200);
        assertThat(noMural(loginA, conversa.get("id").asString()).get("enquete").isNull()).isTrue();
    }

    @Test
    void criacaoRecusaOpcoesPrazoECamposDeOutroTipoSemCriarNada() throws Exception {
        UUID consultoria = jdbc.queryForObject("select consultoria_id from aluno where id = ?", UUID.class, alunoA);
        int antes = contar("select count(*) from comunidade_mural_post where consultoria_id = ?", consultoria);

        String longa = "x".repeat(81);
        for (List<String> ruim : List.of(List.of("Só uma"), List.of("1", "2", "3", "4", "5", "6", "7"), List.of("Sim", "sim"),
                List.of("Sim", "  "), List.of("Sim", longa))) {
            JsonNode erro = api.post(EQUIPE, admin, corpoDeEnquete(ruim, null, null), 422);
            assertThat(erro.get("codigo").asString()).isEqualTo("POST_INVALIDO");
            assertThat(erro.get("fieldErrors").get(0).get("field").asString()).isEqualTo("opcoes");
            assertThat(erro.toString()).doesNotContain(longa);
        }
        api.post(EQUIPE, admin, Map.of("tipo", "ENQUETE", "texto", "Sem opções"), 422);
        for (Instant prazo : List.of(Instant.now().minusSeconds(60), Instant.now().plus(400, ChronoUnit.DAYS))) {
            JsonNode erro = api.post(EQUIPE, admin, corpoDeEnquete(List.of("Sim", "Não"), null, prazo), 422);
            assertThat(erro.get("fieldErrors").get(0).get("field").asString()).isEqualTo("encerraEm");
        }
        // Enquete recusa link, fotos e capa; os outros tipos recusam os campos da enquete.
        Map<String, Object> comLink = corpoDeEnquete(List.of("Sim", "Não"), null, null);
        comLink.put("videoUrl", "https://exemplo.test/v");
        assertThat(api.post(EQUIPE, admin, comLink, 422).get("fieldErrors").get(0).get("field").asString()).isEqualTo("videoUrl");
        Map<String, Object> comFotos = corpoDeEnquete(List.of("Sim", "Não"), null, null);
        comFotos.put("fotoIds", List.of(UUID.randomUUID().toString()));
        assertThat(api.post(EQUIPE, admin, comFotos, 422).get("fieldErrors").get(0).get("field").asString()).isEqualTo("fotoIds");
        for (String campo : List.of("opcoes", "variasRespostas", "encerraEm")) {
            Map<String, Object> conversa = new LinkedHashMap<>(Map.of("tipo", "CONVERSA", "texto", "Oi"));
            conversa.put(campo, switch (campo) {
                case "opcoes" -> List.of("Sim", "Não");
                case "variasRespostas" -> true;
                default -> Instant.now().plusSeconds(3600).toString();
            });
            assertThat(api.post(EQUIPE, admin, conversa, 422).get("fieldErrors").get(0).get("field").asString()).isEqualTo(campo);
        }
        // O aluno não cria enquete (nem pelo corpo do aluno).
        JsonNode doAluno = api.post(ALUNO, loginA, corpoDeEnquete(List.of("Sim", "Não"), null, null), 422);
        assertThat(doAluno.get("fieldErrors").get(0).get("field").asString()).isEqualTo("tipo");

        assertThat(contar("select count(*) from comunidade_mural_post where consultoria_id = ?", consultoria)).isEqualTo(antes);
    }

    // ---- voto ----

    @Test
    void votoUnicoSubstituiERetira() throws Exception {
        JsonNode post = enqueteDeTres(false);
        UUID usuarioA = usuarioDoAluno(alunoA);

        JsonNode depoisDoPrimeiro = votar(loginA, post, List.of(opcao(post, 0)), 200);
        assertThat(depoisDoPrimeiro.get("meusVotos")).hasSize(1);
        assertThat(depoisDoPrimeiro.get("participantes").asLong()).isEqualTo(1);
        assertThat(depoisDoPrimeiro.get("opcoes").get(0).get("votos").asLong()).isEqualTo(1);

        JsonNode trocado = votar(loginA, post, List.of(opcao(post, 1)), 200);
        assertThat(trocado.get("meusVotos").get(0).asString()).isEqualTo(opcao(post, 1));
        assertThat(trocado.get("opcoes").get(0).get("votos").asLong()).isZero();
        assertThat(votosDoUsuario(post, usuarioA)).isEqualTo(1);

        // O mural mostra o mesmo para quem votou e nada para quem não votou.
        assertThat(noMural(loginA, post.get("id").asString()).get("enquete").get("meusVotos")).hasSize(1);
        assertThat(noMural(loginB, post.get("id").asString()).get("enquete").get("meusVotos")).isEmpty();

        // Vazio retira o voto; retirar de novo é idempotente.
        votar(loginA, post, List.of(), 200);
        votar(loginA, post, List.of(), 200);
        assertThat(votosDoUsuario(post, usuarioA)).isZero();
    }

    @Test
    void votoRecusadoDa422SemGravarNada() throws Exception {
        JsonNode unica = enqueteDeTres(false);
        JsonNode varias = enqueteDeTres(true);
        JsonNode outra = enqueteDeTres(true);
        UUID usuarioA = usuarioDoAluno(alunoA);
        List<String> todas = List.of(opcao(varias, 0), opcao(varias, 1), opcao(varias, 2));

        // Mais de uma em escolha única, repetida, de outro post, desconhecida, nula e sem a lista.
        List<List<String>> ruins = new ArrayList<>();
        ruins.add(List.of(opcao(unica, 0), opcao(unica, 1)));
        for (JsonNode post : List.of(varias, unica)) {
            ruins.add(List.of(opcao(post, 0), opcao(post, 0)));
            ruins.add(List.of(opcao(outra, 0)));
            ruins.add(List.of(UUID.randomUUID().toString()));
        }
        for (List<String> ruim : ruins) {
            JsonNode erro = api.put(ALUNO + "/" + (ruim.size() == 2 && ruim.get(0).equals(opcao(unica, 0)) && ruim.get(1).equals(opcao(unica, 1))
                    ? unica : varias).get("id").asString() + "/votos", loginA, Map.of("opcaoIds", ruim), 422);
            assertThat(erro.get("codigo").asString()).isEqualTo("VOTO_INVALIDO");
        }
        List<String> comNulo = new ArrayList<>(List.of(opcao(varias, 0)));
        comNulo.add(null);
        assertThat(api.put(ALUNO + "/" + varias.get("id").asString() + "/votos", loginA, Map.of("opcaoIds", comNulo), 422)
                .get("codigo").asString()).isEqualTo("VOTO_INVALIDO");
        api.put(ALUNO + "/" + varias.get("id").asString() + "/votos", loginA, Map.of(), 422);
        // Mais de 6 opções.
        List<String> sete = new ArrayList<>(todas);
        for (int i = 0; i < 4; i++) {
            sete.add(UUID.randomUUID().toString());
        }
        api.put(ALUNO + "/" + varias.get("id").asString() + "/votos", loginA, Map.of("opcaoIds", sete), 422);

        assertThat(votosDoUsuario(unica, usuarioA)).isZero();
        assertThat(votosDoUsuario(varias, usuarioA)).isZero();
        // Várias respostas aceita o conjunto todo.
        assertThat(votar(loginA, varias, todas, 200).get("meusVotos")).hasSize(3);
    }

    @Test
    void horarioPorOpcaoAMantemCNovoBSome() throws Exception {
        JsonNode post = enqueteDeTres(true);
        UUID usuarioA = usuarioDoAluno(alunoA);
        String a = opcao(post, 0);
        String b = opcao(post, 1);
        String c = opcao(post, 2);

        votar(loginA, post, List.of(a, b), 200);
        OffsetDateTime horarioA = horario(post, a, usuarioA);
        esperar();

        votar(loginA, post, List.of(a, c), 200);

        assertThat(horario(post, a, usuarioA)).isEqualTo(horarioA);
        assertThat(horario(post, c, usuarioA)).isAfter(horarioA);
        assertThat(contar("select count(*) from comunidade_enquete_voto where post_id = ?::uuid and opcao_id = ?::uuid and usuario_id = ?",
                post.get("id").asString(), b, usuarioA)).isZero();

        // O horário que a API mostra é o do voto vigente de cada opção.
        JsonNode itens = votos(loginA, post, "", 200).get("votantes").get("itens");
        assertThat(itens).hasSize(2);
        for (JsonNode v : itens) {
            OffsetDateTime esperado = horario(post, v.get("opcaoId").asString(), usuarioA);
            assertThat(Instant.parse(v.get("votadoEm").asString())).isEqualTo(esperado.toInstant());
        }
    }

    @Test
    void tirarEEscolherDeNovoGravaHorarioNovo() throws Exception {
        JsonNode post = enqueteDeTres(true);
        UUID usuarioA = usuarioDoAluno(alunoA);
        String a = opcao(post, 0);

        votar(loginA, post, List.of(a), 200);
        OffsetDateTime primeiro = horario(post, a, usuarioA);
        esperar();
        votar(loginA, post, List.of(), 200);
        esperar();
        votar(loginA, post, List.of(a), 200);

        assertThat(horario(post, a, usuarioA)).isAfter(primeiro);
        // Nenhum histórico: só a linha vigente.
        assertThat(votosDoUsuario(post, usuarioA)).isEqualTo(1);
    }

    @Test
    void reenviarAsMesmasEscolhasNaoMudaNenhumHorario() throws Exception {
        JsonNode post = enqueteDeTres(true);
        UUID usuarioA = usuarioDoAluno(alunoA);
        String a = opcao(post, 0);
        String b = opcao(post, 1);

        votar(loginA, post, List.of(a, b), 200);
        OffsetDateTime antesA = horario(post, a, usuarioA);
        OffsetDateTime antesB = horario(post, b, usuarioA);
        JsonNode antesNaApi = votos(loginA, post, "", 200).get("votantes").get("itens");
        esperar();

        // Mesmas escolhas, em outra ordem e depois na mesma.
        votar(loginA, post, List.of(b, a), 200);
        votar(loginA, post, List.of(a, b), 200);

        assertThat(horario(post, a, usuarioA)).isEqualTo(antesA);
        assertThat(horario(post, b, usuarioA)).isEqualTo(antesB);
        assertThat(votos(loginA, post, "", 200).get("votantes").get("itens").toString()).isEqualTo(antesNaApi.toString());
    }

    @Test
    void enqueteEncerradaDa409InclusivePraRetirar() throws Exception {
        JsonNode post = criarEnquete(List.of("Sim", "Não"), null, Instant.now().plusSeconds(3600));
        votar(loginA, post, List.of(opcao(post, 0)), 200);
        assertThat(post.get("enquete").get("encerraEm").isNull()).isFalse();

        jdbc.update("update comunidade_mural_post set enquete_encerra_em = now() - interval '1 minute' where id = ?::uuid",
                post.get("id").asString());

        assertThat(votar(loginA, post, List.of(opcao(post, 1)), 409).get("codigo").asString()).isEqualTo("ENQUETE_ENCERRADA");
        votar(loginA, post, List.of(), 409);
        votar(loginB, post, List.of(opcao(post, 0)), 409);
        // O voto que já existia fica, e o mural diz que encerrou.
        assertThat(votosDoUsuario(post, usuarioDoAluno(alunoA))).isEqualTo(1);
        JsonNode doMural = noMural(loginA, post.get("id").asString()).get("enquete");
        assertThat(doMural.get("encerrada").asBoolean()).isTrue();
        assertThat(doMural.get("meusVotos")).hasSize(1);
        // Ler os votos continua valendo.
        votos(loginA, post, "", 200);
    }

    // ---- isolamento e permissões ----

    @Test
    void outraConsultoriaOcultoEOutroTipoDao404() throws Exception {
        JsonNode post = enqueteDeTres(false);
        JsonNode outroTreinador = api.novoTreinador();
        JsonNode alunoDeFora = api.convidarEEntrar(outroTreinador, api.criarAluno(outroTreinador, "Aluno de fora fictício"));
        JsonNode postDeFora = api.post(EQUIPE, outroTreinador, corpoDeEnquete(List.of("Sim", "Não"), null, null), 200);

        // Aluno e equipe de fora não votam nem leem a enquete daqui, e eu não mexo na de lá.
        votar(alunoDeFora, post, List.of(opcao(post, 0)), 404);
        votos(alunoDeFora, post, "", 404);
        api.put(EQUIPE + "/" + post.get("id").asString() + "/votos", outroTreinador, Map.of("opcaoIds", List.of(opcao(post, 0))), 404);
        api.get(EQUIPE + "/" + post.get("id").asString() + "/votos", outroTreinador, 404);
        votar(loginA, postDeFora, List.of(opcao(postDeFora, 0)), 404);
        // Opção de outra consultoria no filtro também é 404.
        votos(loginA, post, "?opcaoId=" + opcao(postDeFora, 0), 404);

        // Post que não é enquete e post oculto.
        JsonNode conversa = api.post(ALUNO, loginA, Map.of("texto", "Conversa fictícia"), 200);
        votar(loginA, conversa, List.of(UUID.randomUUID().toString()), 404);
        votos(loginA, conversa, "", 404);
        api.delete(EQUIPE + "/" + post.get("id").asString(), admin, 204);
        votar(loginA, post, List.of(opcao(post, 0)), 404);
        votos(loginA, post, "", 404);
        assertThat(contar("select count(*) from comunidade_enquete_voto where post_id = ?::uuid", postDeFora.get("id").asString())).isZero();
    }

    @Test
    void permissoesDeVotarEVerVotos() throws Exception {
        JsonNode post = enqueteDeTres(false);
        String id = post.get("id").asString();
        JsonNode soLeitor = membro(Set.of("TREINO_LER"));
        JsonNode semNada = membro(Set.of("ALUNO_LER"));

        // A equipe com TREINO_LER vota e lê; sem ela, 403; o aluno não usa a rota da equipe e vice-versa.
        JsonNode resposta = api.put(EQUIPE + "/" + id + "/votos", soLeitor, Map.of("opcaoIds", List.of(opcao(post, 0))), 200);
        assertThat(resposta.get("meusVotos")).hasSize(1);
        api.get(EQUIPE + "/" + id + "/votos", soLeitor, 200);
        api.put(EQUIPE + "/" + id + "/votos", semNada, Map.of("opcaoIds", List.of()), 403);
        api.get(EQUIPE + "/" + id + "/votos", semNada, 403);
        api.put(EQUIPE + "/" + id + "/votos", loginA, Map.of("opcaoIds", List.of()), 403);
        api.get(EQUIPE + "/" + id + "/votos", loginA, 403);
        api.put(ALUNO + "/" + id + "/votos", admin, Map.of("opcaoIds", List.of()), 403);
        api.get(ALUNO + "/" + id + "/votos", admin, 403);
        api.put(ALUNO + "/" + id + "/votos", null, Map.of("opcaoIds", List.of()), 401);
        api.get(ALUNO + "/" + id + "/votos", null, 401);
        // Equipe sem COMUNIDADE_MODERAR não cria enquete.
        api.post(EQUIPE, soLeitor, corpoDeEnquete(List.of("Sim", "Não"), null, null), 403);
        // Na equipe, o voto também aparece (nome do usuário, sem foto).
        JsonNode itens = api.get(EQUIPE + "/" + id + "/votos", soLeitor, 200).get("votantes").get("itens");
        assertThat(itens).hasSize(1);
        assertThat(itens.get(0).get("ehVoce").asBoolean()).isTrue();
        assertThat(itens.get(0).get("temFoto").asBoolean()).isFalse();
    }

    // ---- simultaneidade ----

    @Test
    void votosSimultaneosDoMesmoUsuarioEmEscolhaUnicaDeixamUmSo() throws Exception {
        JsonNode post = enqueteDeTres(false);
        UUID usuarioA = usuarioDoAluno(alunoA);
        int fios = 8;
        ExecutorService pool = Executors.newFixedThreadPool(fios);
        try {
            CountDownLatch largada = new CountDownLatch(1);
            List<Future<Integer>> resultados = new ArrayList<>();
            for (int i = 0; i < fios; i++) {
                String escolha = opcao(post, i % 3);
                Callable<Integer> tarefa = () -> {
                    largada.await();
                    return mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                            .put(ALUNO + "/" + post.get("id").asString() + "/votos")
                            .header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(loginA))
                            .contentType("application/json").content(api.paraJson(Map.of("opcaoIds", List.of(escolha)))))
                            .andReturn().getResponse().getStatus();
                };
                resultados.add(pool.submit(tarefa));
            }
            largada.countDown();
            for (Future<Integer> f : resultados) {
                assertThat(f.get()).isEqualTo(200);
            }
        } finally {
            pool.shutdownNow();
        }
        assertThat(votosDoUsuario(post, usuarioA)).isEqualTo(1);
    }

    // ---- Mostrar votos ----

    @Test
    void mostrarVotosTrazIdentidadeOrdemFiltroEPaginacao() throws Exception {
        JsonNode post = enqueteDeTres(true);
        String id = post.get("id").asString();
        api.put("/aluno/comunidade/apelido", loginA, Map.of("apelido", "Aninha"), 204);
        JsonNode alunoDeFora = loginB;

        votar(loginA, post, List.of(opcao(post, 0)), 200);
        esperar();
        votar(loginB, post, List.of(opcao(post, 0), opcao(post, 1)), 200);
        esperar();
        api.put(EQUIPE + "/" + id + "/votos", admin, Map.of("opcaoIds", List.of(opcao(post, 0))), 200);

        JsonNode visto = votos(alunoDeFora, post, "", 200);
        assertThat(campos(visto)).containsExactlyInAnyOrder("pergunta", "participantes", "opcoes", "votantes");
        assertThat(visto.get("pergunta").asString()).isEqualTo("Qual horário prefere?");
        assertThat(visto.get("participantes").asLong()).isEqualTo(3);
        assertThat(visto.get("opcoes").get(0).get("votos").asLong()).isEqualTo(3);
        assertThat(campos(visto.get("opcoes").get(0))).containsExactlyInAnyOrder("opcaoId", "texto", "votos");
        JsonNode votantes = visto.get("votantes");
        assertThat(votantes.get("total").asLong()).isEqualTo(4);
        JsonNode itens = votantes.get("itens");
        assertThat(itens).hasSize(4);
        // Mais recente primeiro: o da equipe, depois os dois de Beto (empate no instante, desempate por id) e por último Ana.
        assertThat(itens.get(0).get("nome").asString()).isNotEmpty();
        assertThat(itens.get(0).get("temFoto").asBoolean()).isFalse();
        assertThat(itens.get(3).get("nome").asString()).isEqualTo("Ana Votante Fictícia");
        assertThat(itens.get(3).get("apelido").asString()).isEqualTo("Aninha");
        assertThat(itens.get(3).get("ehVoce").asBoolean()).isFalse();
        assertThat(campos(itens.get(3))).containsExactlyInAnyOrder("autorId", "opcaoId", "nome", "apelido", "temFoto", "votadoEm", "ehVoce");
        // Sem apelido o campo some do JSON.
        assertThat(itens.get(1).has("apelido")).isFalse();
        long meus = 0;
        for (JsonNode v : itens) {
            meus += v.get("ehVoce").asBoolean() ? 1 : 0;
        }
        assertThat(meus).isEqualTo(2);

        // Filtro por opção e paginação (base 0).
        JsonNode soTarde = votos(loginA, post, "?opcaoId=" + opcao(post, 1), 200).get("votantes");
        assertThat(soTarde.get("total").asLong()).isEqualTo(1);
        assertThat(soTarde.get("itens").get(0).get("nome").asString()).isEqualTo("Beto Votante Fictício");
        JsonNode pagina = votos(loginA, post, "?pagina=1&tamanho=3", 200).get("votantes");
        assertThat(pagina.get("itens")).hasSize(1);
        assertThat(pagina.get("total").asLong()).isEqualTo(4);
        assertThat(votos(loginA, post, "?pagina=2147483647&tamanho=1000", 200).get("votantes").get("itens")).isEmpty();

        // A amostra do mural: até 3, os mais recentes primeiro.
        JsonNode amostra = noMural(loginA, id).get("enquete").get("opcoes").get(0).get("votantesAmostra");
        assertThat(amostra).hasSize(3);
        assertThat(campos(amostra.get(0))).isSubsetOf("autorId", "nome", "apelido", "temFoto");
        assertThat(amostra.get(2).get("nome").asString()).isEqualTo("Ana Votante Fictícia");
    }

    @Test
    void aFotoDoVotanteSegueARegraDoPerfilDoColega() throws Exception {
        JsonNode post = enqueteDeTres(false);
        String id = post.get("id").asString();
        UUID usuarioA = usuarioDoAluno(alunoA);
        // Maior de idade com o perfil visível e com foto.
        jdbc.update("update aluno set perfil_reservado = false where id = ?", alunoA);
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart(HttpMethod.PUT, "/aluno/foto-perfil")
                .file(new MockMultipartFile("arquivo", "foto.jpg", "image/jpeg", FotosDeTeste.jpeg(Color.BLUE, 200, false)))
                .header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(loginA))).andExpect(status().isOk());
        votar(loginA, post, List.of(opcao(post, 0)), 200);

        assertThat(votos(loginB, post, "", 200).get("votantes").get("itens").get(0).get("temFoto").asBoolean()).isTrue();
        assertThat(noMural(loginB, id).get("enquete").get("opcoes").get(0).get("votantesAmostra").get(0).get("temFoto").asBoolean())
                .isTrue();
        mvc.perform(get("/aluno/comunidade/perfis/" + usuarioA + "/foto").header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(loginB)))
                .andExpect(status().isOk());
        mvc.perform(get("/comunidade/perfis/" + usuarioA + "/foto").header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(admin)))
                .andExpect(status().isOk());

        // Reservou: some o temFoto e a rota da foto dá 404, para o aluno e para a equipe.
        jdbc.update("update aluno set perfil_reservado = true where id = ?", alunoA);
        assertThat(votos(loginB, post, "", 200).get("votantes").get("itens").get(0).get("temFoto").asBoolean()).isFalse();
        mvc.perform(get("/aluno/comunidade/perfis/" + usuarioA + "/foto").header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(loginB)))
                .andExpect(status().isNotFound());
        mvc.perform(get("/comunidade/perfis/" + usuarioA + "/foto").header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(admin)))
                .andExpect(status().isNotFound());
        // O próprio dono sempre vê a dele.
        assertThat(votos(loginA, post, "", 200).get("votantes").get("itens").get(0).get("temFoto").asBoolean()).isTrue();
        // Equipe sem TREINO_LER não lê a foto do votante.
        mvc.perform(get("/comunidade/perfis/" + usuarioA + "/foto").header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(loginB)))
                .andExpect(status().isForbidden());
    }

    @Test
    void alunoInativoContaComONomeSemApelidoENemFoto() throws Exception {
        JsonNode post = enqueteDeTres(false);
        api.put("/aluno/comunidade/apelido", loginA, Map.of("apelido", "Aninha"), 204);
        jdbc.update("update aluno set perfil_reservado = false where id = ?", alunoA);
        votar(loginA, post, List.of(opcao(post, 0)), 200);
        api.patch("/alunos/" + alunoA + "/situacao", admin, Map.of("ativo", false), 200);

        JsonNode item = votos(loginB, post, "", 200).get("votantes").get("itens").get(0);

        assertThat(item.get("nome").asString()).isEqualTo("Ana Votante Fictícia");
        assertThat(item.has("apelido")).isFalse();
        assertThat(item.get("temFoto").asBoolean()).isFalse();
        assertThat(votos(loginB, post, "", 200).get("participantes").asLong()).isEqualTo(1);
    }

    // ---- limites ----

    @Test
    void votarTemOLimiteDeEscritasELerVotosOBaldeDoPerfilDoColega() throws Exception {
        JsonNode post = enqueteDeTres(false);
        // PUT gasta o balde "comunidade" (120 por hora): 120 passam e o 121º leva 429.
        for (int i = 0; i < 120; i++) {
            votar(loginA, post, List.of(opcao(post, 0)), 200);
        }
        votar(loginA, post, List.of(opcao(post, 0)), 429);
        // Ler os votos tem balde próprio (300): o outro aluno lê 300 vezes e a seguinte leva 429; escrever segue livre para ele.
        for (int i = 0; i < 300; i++) {
            votos(loginB, post, "?tamanho=1", 200);
        }
        votos(loginB, post, "?tamanho=1", 429);
        votar(loginB, post, List.of(opcao(post, 1)), 200);
    }

    // ---- exportação e anonimização ----

    @Test
    void exportacaoTrazOsVotosDoAlunoEAnonimizarApagaSoOsDele() throws Exception {
        JsonNode post = enqueteDeTres(true);
        UUID usuarioA = usuarioDoAluno(alunoA);
        UUID usuarioB = usuarioDoAluno(alunoB);
        votar(loginA, post, List.of(opcao(post, 0), opcao(post, 2)), 200);
        votar(loginB, post, List.of(opcao(post, 1)), 200);

        JsonNode comunidade = api.get("/alunos/" + alunoA + "/exportacao", admin, 200).get("comunidade");
        JsonNode exportados = comunidade.get("votos");
        assertThat(exportados).hasSize(2);
        assertThat(campos(exportados.get(0))).containsExactlyInAnyOrder("postId", "opcaoId", "opcaoTexto", "votadoEm");
        assertThat(exportados.toString()).contains("Manhã").contains("Noite").doesNotContain("Tarde");
        assertThat(comunidade.get("truncado").asBoolean()).isFalse();

        api.post("/aluno/conta/excluir", loginA, Map.of("senha", ApiDeTeste.SENHA, "confirmacao", "EXCLUIR"), 204);

        assertThat(votosDoUsuario(post, usuarioA)).isZero();
        assertThat(votosDoUsuario(post, usuarioB)).isEqualTo(1);
        // Anonimização pelo treinador faz o mesmo.
        votar(loginB, post, List.of(opcao(post, 1), opcao(post, 2)), 200);
        api.patch("/alunos/" + alunoB + "/situacao", admin, Map.of("ativo", false), 200);
        api.post("/alunos/" + alunoB + "/anonimizar", admin, Map.of("nomeConfirmado", "Beto Votante Fictício"), 200);
        assertThat(votosDoUsuario(post, usuarioB)).isZero();
    }
}
