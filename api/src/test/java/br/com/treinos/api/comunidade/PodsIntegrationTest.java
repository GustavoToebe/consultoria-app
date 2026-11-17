package br.com.treinos.api.comunidade;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.fotos.FotosDeTeste;
import br.com.treinos.api.web.Fuso;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

import java.awt.Color;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * V082: pods da comunidade. Quatro alunos com acesso na mesma consultoria: A e B no pod X, C no pod Y e D sem pod; cada teste
 * cria a própria consultoria. Só dados fictícios; o nome do pod nunca aparece na auditoria.
 */
@AutoConfigureMockMvc
class PodsIntegrationTest extends AbstractIntegrationTest {

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
    private UUID alunoC;
    private UUID alunoD;
    private JsonNode loginA;
    private JsonNode loginB;
    private JsonNode loginC;
    private JsonNode loginD;
    private String podX;
    private String podY;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        alunoA = api.criarAluno(admin, "Ana Pod Fictícia");
        alunoB = api.criarAluno(admin, "Beto Pod Fictício");
        alunoC = api.criarAluno(admin, "Cida Pod Fictícia");
        alunoD = api.criarAluno(admin, "Davi Pod Fictício");
        loginA = api.convidarEEntrar(admin, alunoA);
        loginB = api.convidarEEntrar(admin, alunoB);
        loginC = api.convidarEEntrar(admin, alunoC);
        loginD = api.convidarEEntrar(admin, alunoD);
        podX = criarPod("Pod Alfa " + UUID.randomUUID().toString().substring(0, 8));
        podY = criarPod("Pod Beta " + UUID.randomUUID().toString().substring(0, 8));
        atribuir(alunoA, podX, 204);
        atribuir(alunoB, podX, 204);
        atribuir(alunoC, podY, 204);
    }

    // ---- ajudantes ----

    private String criarPod(String nome) throws Exception {
        return api.post("/comunidade/pods", admin, Map.of("nome", nome), 200).get("id").asString();
    }

    private JsonNode atribuir(UUID aluno, String pod, int esperado) throws Exception {
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("podId", pod);
        return api.put("/alunos/" + aluno + "/pod", admin, corpo, esperado);
    }

    private int contar(String sql, Object... args) {
        return jdbc.queryForObject(sql, Integer.class, args);
    }

    private UUID podDoBanco(UUID aluno) {
        return jdbc.queryForObject("select pod_id from aluno where id = ?", UUID.class, aluno);
    }

    private UUID usuarioDoAluno(UUID aluno) {
        return jdbc.queryForObject("select usuario_id from aluno where id = ?", UUID.class, aluno);
    }

    private UUID consultoria() {
        return jdbc.queryForObject("select consultoria_id from aluno where id = ?", UUID.class, alunoA);
    }

    private static Map<String, Object> post(String texto, String podId) {
        Map<String, Object> c = new LinkedHashMap<>();
        c.put("texto", texto);
        c.put("podId", podId);
        return c;
    }

    private String postDoAluno(JsonNode login, String texto, String podId) throws Exception {
        return api.post(ALUNO, login, post(texto, podId), 200).get("id").asString();
    }

    private List<String> ids(JsonNode pagina) {
        List<String> r = new ArrayList<>();
        pagina.get("content").forEach(p -> r.add(p.get("id").asString()));
        return r;
    }

    private JsonNode membro(Set<String> permissoes) throws Exception {
        String perfil = api.post("/perfis", admin, Map.of("nome", "Perfil " + UUID.randomUUID(), "permissoes", permissoes), 200)
                .get("id").asString();
        JsonNode convite = api.post("/usuarios/convites", admin,
                Map.of("nome", "Membro fictício", "email", ApiDeTeste.emailUnico("membro"), "perfilId", perfil), 200);
        return api.post("/publico/convites-equipe/aceitar", null,
                Map.of("codigo", convite.get("codigo").asString(), "senha", ApiDeTeste.SENHA), 200);
    }

    private byte[] baixar(String caminho, JsonNode login, int esperado) throws Exception {
        MvcResult r = mvc.perform(get(caminho).header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(login)))
                .andExpect(status().is(esperado)).andReturn();
        return r.getResponse().getContentAsByteArray();
    }

    private String enviarFoto(JsonNode login) throws Exception {
        MvcResult r = mvc.perform(multipart(ALUNO + "/fotos")
                        .file(new MockMultipartFile("arquivo", "foto.jpg", "image/jpeg", FotosDeTeste.jpeg(Color.BLUE, 200, false)))
                        .header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(login)))
                .andExpect(status().isOk()).andReturn();
        return api.ler(r).get("id").asString();
    }

    private String enviarCapa() throws Exception {
        MvcResult r = mvc.perform(multipart("/comunidade/capas")
                        .file(new MockMultipartFile("arquivo", "capa.jpg", "image/jpeg", FotosDeTeste.jpeg(Color.RED, 300, false)))
                        .header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(admin)))
                .andExpect(status().isOk()).andReturn();
        return api.ler(r).get("id").asString();
    }

    // ---- rotas de pods ----

    @Test
    void criarListarRenomearENomeInvalidoOuRepetido() throws Exception {
        JsonNode lista = api.get("/comunidade/pods", admin, 200);
        assertThat(lista).hasSize(2);
        for (JsonNode p : lista) {
            if (p.get("id").asString().equals(podX)) {
                assertThat(p.get("membros").asInt()).isEqualTo(2);
            } else {
                assertThat(p.get("membros").asInt()).isEqualTo(1);
            }
            assertThat(p.get("temMenor").asBoolean()).isFalse();
            assertThat(p.propertyNames()).containsExactlyInAnyOrder("id", "nome", "membros", "temMenor", "criadoEm");
        }

        String nome = lista.get(0).get("nome").asString();
        JsonNode repetido = api.post("/comunidade/pods", admin, Map.of("nome", nome.toUpperCase(Locale.ROOT)), 409);
        assertThat(repetido.get("codigo").asString()).isEqualTo("POD_NOME_EM_USO");
        JsonNode curto = api.post("/comunidade/pods", admin, Map.of("nome", " a "), 422);
        assertThat(curto.get("codigo").asString()).isEqualTo("POD_INVALIDO");
        assertThat(curto.get("fieldErrors").get(0).get("field").asString()).isEqualTo("nome");
        api.post("/comunidade/pods", admin, Map.of("nome", "x".repeat(41)), 422);
        api.post("/comunidade/pods", admin, Map.of("nome", "   "), 422);
        assertThat(api.post("/comunidade/pods", admin, Map.of("nome", "  Ab  "), 200).get("nome").asString()).isEqualTo("Ab");

        assertThat(api.put("/comunidade/pods/" + podX, admin, Map.of("nome", "Novo nome " + podX.substring(0, 6)), 200)
                .get("nome").asString()).startsWith("Novo nome");
        assertThat(api.put("/comunidade/pods/" + podY, admin, Map.of("nome", "Novo nome " + podX.substring(0, 6)), 409)
                .get("codigo").asString()).isEqualTo("POD_NOME_EM_USO");
        api.put("/comunidade/pods/" + podX, admin, Map.of("nome", nome.toLowerCase(Locale.ROOT)), 200);
        api.put("/comunidade/pods/" + UUID.randomUUID(), admin, Map.of("nome", "Qualquer"), 404);
    }

    @Test
    void soQuemTemComunidadeModerarMexeNosPods() throws Exception {
        JsonNode semPermissao = membro(Set.of("TREINO_LER"));
        api.get("/comunidade/pods", semPermissao, 403);
        api.post("/comunidade/pods", semPermissao, Map.of("nome", "Sem permissão"), 403);
        api.put("/comunidade/pods/" + podX, semPermissao, Map.of("nome", "Sem permissão"), 403);
        api.put("/alunos/" + alunoD + "/pod", semPermissao, Map.of("podId", podX), 403);
        api.get("/comunidade/pods", loginA, 403);
        api.put("/alunos/" + alunoD + "/pod", loginA, Map.of("podId", podX), 403);

        JsonNode moderador = membro(Set.of("TREINO_LER", "COMUNIDADE_MODERAR"));
        api.get("/comunidade/pods", moderador, 200);
        api.put("/alunos/" + alunoD + "/pod", moderador, Map.of("podId", podX), 204);
    }

    @Test
    void temMenorSoSabeSeAlgumMembroTemMenosDe18SemNomeNemIdade() throws Exception {
        jdbc.update("update aluno set data_nascimento = ? where id = ?", LocalDate.now(Fuso.BRASILIA).minusYears(15), alunoC);
        jdbc.update("update aluno set data_nascimento = ? where id = ?", LocalDate.now(Fuso.BRASILIA).minusYears(30), alunoA);
        for (JsonNode p : api.get("/comunidade/pods", admin, 200)) {
            assertThat(p.get("temMenor").asBoolean()).isEqualTo(p.get("id").asString().equals(podY));
        }
    }

    // ---- atribuição ----

    @Test
    void atribuirRespeitaAcessoSituacaoAnonimizacaoOutraConsultoriaETeto() throws Exception {
        // Sem acesso (nunca entrou): 409.
        UUID semAcesso = api.criarAluno(admin, "Eva Sem Acesso Fictícia");
        assertThat(atribuir(semAcesso, podX, 409).get("codigo").asString()).isEqualTo("ALUNO_SEM_ACESSO");
        assertThat(podDoBanco(semAcesso)).isNull();

        // Idempotente e troca de pod.
        atribuir(alunoA, podX, 204);
        atribuir(alunoA, podY, 204);
        assertThat(podDoBanco(alunoA)).isEqualTo(UUID.fromString(podY));
        atribuir(alunoA, podX, 204);

        // Pod inexistente e aluno inexistente: 404.
        atribuir(alunoD, UUID.randomUUID().toString(), 404);
        api.put("/alunos/" + UUID.randomUUID() + "/pod", admin, Map.of("podId", podX), 404);

        // Outra consultoria: o pod e o aluno dela são 404 para esta.
        JsonNode outroAdmin = api.novoTreinador();
        UUID alunoDeOutra = api.criarAluno(outroAdmin, "Fábio Outra Consultoria");
        api.convidarEEntrar(outroAdmin, alunoDeOutra);
        api.put("/alunos/" + alunoDeOutra + "/pod", admin, Map.of("podId", podX), 404);
        api.put("/alunos/" + alunoD + "/pod", outroAdmin, Map.of("podId", podX), 404);
        String podDeOutra = api.post("/comunidade/pods", outroAdmin, Map.of("nome", "Pod de outra " + UUID.randomUUID().toString().substring(0, 8)), 200)
                .get("id").asString();
        api.put("/alunos/" + alunoD + "/pod", admin, Map.of("podId", podDeOutra), 404);
        assertThat(podDoBanco(alunoD)).isNull();

        // Tirar do pod.
        Map<String, Object> nulo = new LinkedHashMap<>();
        nulo.put("podId", null);
        api.put("/alunos/" + alunoB + "/pod", admin, nulo, 204);
        assertThat(podDoBanco(alunoB)).isNull();
        api.put("/alunos/" + alunoB + "/pod", admin, nulo, 204);

        // Inativo e anonimizado.
        api.patch("/alunos/" + alunoD + "/situacao", admin, Map.of("ativo", false), 200);
        assertThat(atribuir(alunoD, podX, 409).get("codigo").asString()).isEqualTo("ALUNO_INATIVO");
        api.post("/alunos/" + alunoD + "/anonimizar", admin, Map.of("nomeConfirmado", "Davi Pod Fictício"), 200);
        assertThat(atribuir(alunoD, podX, 409).get("codigo").asString()).isEqualTo("ALUNO_ANONIMIZADO");
    }

    @Test
    void podComDozeEstaCheioETirarAbreVaga() throws Exception {
        String cheio = criarPod("Pod Cheio " + UUID.randomUUID().toString().substring(0, 8));
        List<UUID> membros = new ArrayList<>();
        for (int i = 0; i < 12; i++) {
            UUID a = api.criarAluno(admin, "Membro Cheio " + i);
            api.convidarEEntrar(admin, a);
            membros.add(a);
            atribuir(a, cheio, 204);
        }
        assertThat(contar("select count(*) from aluno where pod_id = ?::uuid", cheio)).isEqualTo(12);
        assertThat(atribuir(alunoD, cheio, 409).get("codigo").asString()).isEqualTo("POD_CHEIO");
        // Quem já está no pod cheio continua podendo ser atribuído de novo (idempotente).
        atribuir(membros.get(0), cheio, 204);
        assertThat(podDoBanco(alunoD)).isNull();

        api.put("/alunos/" + membros.get(1) + "/pod", admin, Map.of(), 204);
        atribuir(alunoD, cheio, 204);
        assertThat(contar("select count(*) from aluno where pod_id = ?::uuid", cheio)).isEqualTo(12);
    }

    // ---- teto com pedidos simultâneos ----

    /** Pod com 11 membros (uma vaga). */
    private String podComOnze() throws Exception {
        String pod = criarPod("Pod Onze " + UUID.randomUUID().toString().substring(0, 8));
        for (int i = 0; i < 11; i++) {
            UUID a = api.criarAluno(admin, "Membro Onze " + i);
            api.convidarEEntrar(admin, a);
            atribuir(a, pod, 204);
        }
        return pod;
    }

    /** Dispara as atribuições juntas (uma barreira solta todas ao mesmo tempo) e devolve status e código de cada uma. */
    private List<String> atribuirEmParalelo(String pod, UUID... alunos) throws Exception {
        CyclicBarrier largada = new CyclicBarrier(alunos.length);
        ExecutorService fila = Executors.newFixedThreadPool(alunos.length);
        try {
            List<Future<String>> respostas = new ArrayList<>();
            for (UUID aluno : alunos) {
                respostas.add(fila.submit(() -> {
                    largada.await(10, TimeUnit.SECONDS);
                    MvcResult r = mvc.perform(put("/alunos/" + aluno + "/pod").header("X-Treinos-Cliente", "nativo")
                                    .header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(admin))
                                    .contentType("application/json").content(json.writeValueAsString(Map.of("podId", pod))))
                            .andReturn();
                    String corpo = r.getResponse().getContentAsString();
                    return r.getResponse().getStatus() + (corpo.isBlank() ? "" : " " + json.readTree(corpo).get("codigo").asString());
                }));
            }
            List<String> resultado = new ArrayList<>();
            for (Future<String> f : respostas) {
                resultado.add(f.get(60, TimeUnit.SECONDS));
            }
            return resultado;
        } finally {
            fila.shutdownNow();
        }
    }

    @Test
    void decimoTerceiroMembroDaPodCheioComDuasTransacoesSimultaneas() throws Exception {
        String pod = podComOnze();
        UUID outro = api.criarAluno(admin, "Eva Concorrente Fictícia");
        api.convidarEEntrar(admin, outro);
        assertThat(atribuirEmParalelo(pod, alunoD, outro)).containsExactlyInAnyOrder("204", "409 POD_CHEIO");
        assertThat(contar("select count(*) from aluno where pod_id = ?::uuid", pod)).isEqualTo(12);
    }

    @Test
    void mesmoAlunoNoMesmoPodEmParaleloNaoDaFalsoPodCheio() throws Exception {
        String pod = podComOnze();
        assertThat(atribuirEmParalelo(pod, alunoD, alunoD)).containsExactly("204", "204");
        assertThat(contar("select count(*) from aluno where pod_id = ?::uuid", pod)).isEqualTo(12);
        assertThat(podDoBanco(alunoD)).isEqualTo(UUID.fromString(pod));
    }

    // ---- isolamento do mural ----

    @Test
    void muralGeralEMuralDoPodNaoSeMisturam() throws Exception {
        String geral = postDoAluno(loginD, "Texto fictício geral", null);
        String doPod = postDoAluno(loginA, "Texto fictício do pod", podX);
        String doOutro = postDoAluno(loginC, "Texto fictício do outro pod", podY);
        assertThat(contar("select count(*) from comunidade_mural_post where id = ?::uuid and pod_id is null", geral)).isEqualTo(1);

        // Mural geral: só os posts sem pod, para todos.
        for (JsonNode login : List.of(loginA, loginB, loginC, loginD)) {
            assertThat(ids(api.get(ALUNO, login, 200))).containsExactly(geral);
        }
        // Mural do pod: só o do próprio pod.
        assertThat(ids(api.get(ALUNO + "?podId=" + podX, loginA, 200))).containsExactly(doPod);
        assertThat(ids(api.get(ALUNO + "?podId=" + podX, loginB, 200))).containsExactly(doPod);
        assertThat(ids(api.get(ALUNO + "?podId=" + podY, loginC, 200))).containsExactly(doOutro);
        // Pedir o pod dos outros ou ser de nenhum pod: o mesmo 404.
        api.get(ALUNO + "?podId=" + podX, loginC, 404);
        api.get(ALUNO + "?podId=" + podX, loginD, 404);
        api.get(ALUNO + "?podId=" + UUID.randomUUID(), loginA, 404);

        // A equipe vê qualquer pod e o geral.
        assertThat(ids(api.get(EQUIPE, admin, 200))).containsExactly(geral);
        assertThat(ids(api.get(EQUIPE + "?podId=" + podX, admin, 200))).containsExactly(doPod);
        assertThat(ids(api.get(EQUIPE + "?podId=" + podY, admin, 200))).containsExactly(doOutro);
        api.get(EQUIPE + "?podId=" + UUID.randomUUID(), admin, 404);

        // O pod aparece com id e nome no post do pod.
        JsonNode meu = api.get(ALUNO + "?podId=" + podX, loginA, 200).get("content").get(0);
        assertThat(meu.get("podId").asString()).isEqualTo(podX);
        assertThat(meu.get("podNome").asString()).isNotBlank();
    }

    @Test
    void alunoSoPublicaNoProprioPodENoGeral() throws Exception {
        // Pod alheio, pod inexistente e aluno sem pod com podId: 404.
        api.post(ALUNO, loginA, post("Texto fictício", podY), 404);
        api.post(ALUNO, loginD, post("Texto fictício", podX), 404);
        api.post(ALUNO, loginA, post("Texto fictício", UUID.randomUUID().toString()), 404);
        assertThat(contar("select count(*) from comunidade_mural_post where consultoria_id = ?", consultoria())).isZero();
        // A equipe publica em qualquer pod existente; pod que não existe é 404.
        api.post(EQUIPE, admin, post("Aviso fictício ao pod", podY), 200);
        api.post(EQUIPE, admin, post("Aviso fictício ao pod", UUID.randomUUID().toString()), 404);
        assertThat(contar("select count(*) from comunidade_mural_post where pod_id = ?::uuid", podY)).isEqualTo(1);
        // Quem saiu do pod volta a ver 404 no que era dele (o pod vem do banco a cada requisição).
        String doPod = postDoAluno(loginB, "Texto fictício do pod", podX);
        api.post(ALUNO + "/" + doPod + "/comentarios", loginB, Map.of("texto", "Oi"), 200);
        api.put("/alunos/" + alunoB + "/pod", admin, Map.of(), 204);
        api.post(ALUNO + "/" + doPod + "/comentarios", loginB, Map.of("texto", "Oi de novo"), 404);
        api.get(ALUNO + "?podId=" + podX, loginB, 404);
    }

    @Test
    void postDeOutroPodEInvisivelEmTodaAcaoDoAluno() throws Exception {
        String post = postDoAluno(loginA, "Texto fictício privado", podX);
        String rota = ALUNO + "/" + post;

        // Quem é do pod faz tudo.
        api.post(rota + "/comentarios", loginB, Map.of("texto", "Oi pod"), 200);
        api.get(rota + "/comentarios", loginB, 200);
        api.put(rota + "/reacoes/CURTIR", loginB, Map.of(), 204);
        api.post(rota + "/denuncias", loginB, Map.of("motivo", "SPAM"), 204);

        // Quem é de outro pod ou de nenhum recebe o 404 do post que não existe.
        String inexistente = ALUNO + "/" + UUID.randomUUID();
        for (JsonNode fora : List.of(loginC, loginD)) {
            api.post(rota + "/comentarios", fora, Map.of("texto", "Oi"), 404);
            api.get(rota + "/comentarios", fora, 404);
            api.put(rota + "/reacoes/CURTIR", fora, Map.of(), 404);
            api.delete(rota + "/reacoes/CURTIR", fora, 404);
            api.put(rota + "/votos", fora, Map.of("opcaoIds", List.of()), 404);
            api.get(rota + "/votos", fora, 404);
            api.post(rota + "/denuncias", fora, Map.of("motivo", "SPAM"), 404);
        }
        // O corpo do 404 é o mesmo do post que não existe.
        assertThat(api.post(rota + "/comentarios", loginC, Map.of("texto", "Oi"), 404).get("message").asString())
                .isEqualTo(api.post(inexistente + "/comentarios", loginC, Map.of("texto", "Oi"), 404).get("message").asString());
        assertThat(contar("select count(*) from comunidade_mural_comentario where post_id = ?::uuid", post)).isEqualTo(1);
        assertThat(contar("select count(*) from comunidade_mural_reacao where post_id = ?::uuid", post)).isEqualTo(1);
        assertThat(contar("select count(*) from comunidade_mural_denuncia where post_id = ?::uuid", post)).isEqualTo(1);
    }

    // ---- 404 sem oráculo de existência ----

    /** O corpo do erro sem o que muda a cada requisição (instante, caminho com o id e id da requisição). */
    private static JsonNode semVolateis(JsonNode erro) {
        ObjectNode copia = ((ObjectNode) erro).deepCopy();
        copia.remove(List.of("timestamp", "path", "requestId"));
        return copia;
    }

    /** Mesmo status, código e mensagem, e o corpo inteiro igual menos o volátil. */
    private static void mesmoErro(JsonNode doExistente, JsonNode doInexistente) {
        assertThat(doExistente.get("status").asInt()).isEqualTo(404).isEqualTo(doInexistente.get("status").asInt());
        assertThat(doExistente.get("codigo").asString()).isEqualTo(doInexistente.get("codigo").asString());
        assertThat(doExistente.get("message").asString()).isNotBlank().isEqualTo(doInexistente.get("message").asString());
        assertThat(semVolateis(doExistente)).isEqualTo(semVolateis(doInexistente));
    }

    @Test
    void recusaDoFunilTemOMesmoStatusCodigoEMensagemDoRecursoInexistente() throws Exception {
        jdbc.update("update aluno set data_nascimento = ? where id = ?", LocalDate.now(Fuso.BRASILIA).minusYears(25), alunoA);
        api.put("/comunidade/configuracao", admin, Map.of("alunosPublicam", true, "alunosAnexamFotos", true), 200);
        String aluno = ALUNO.replace("/mural", "");
        UUID nada = UUID.randomUUID();

        String foto = enviarFoto(loginA);
        Map<String, Object> comFoto = post("Texto fictício com foto", podX);
        comFoto.put("fotoIds", List.of(foto));
        String post = api.post(ALUNO, loginA, comFoto, 200).get("id").asString();
        String comentario = api.post(ALUNO + "/" + post + "/comentarios", loginB, Map.of("texto", "Oi pod"), 200).get("id").asString();
        String capa = enviarCapa();
        Map<String, Object> video = new LinkedHashMap<>();
        video.put("tipo", "VIDEO");
        video.put("texto", "Vídeo fictício do pod");
        video.put("videoUrl", "https://exemplo.test/v");
        video.put("capaId", capa);
        video.put("podId", podX);
        api.post(EQUIPE, admin, video, 200);

        // Post, foto e capa do pod alheio (e de quem não tem pod) x id inexistente.
        for (JsonNode fora : List.of(loginC, loginD)) {
            mesmoErro(api.post(ALUNO + "/" + post + "/comentarios", fora, Map.of("texto", "Oi"), 404),
                    api.post(ALUNO + "/" + nada + "/comentarios", fora, Map.of("texto", "Oi"), 404));
            mesmoErro(api.get(ALUNO + "/" + post + "/comentarios", fora, 404), api.get(ALUNO + "/" + nada + "/comentarios", fora, 404));
            mesmoErro(api.put(ALUNO + "/" + post + "/reacoes/CURTIR", fora, Map.of(), 404),
                    api.put(ALUNO + "/" + nada + "/reacoes/CURTIR", fora, Map.of(), 404));
            mesmoErro(api.put(ALUNO + "/" + post + "/votos", fora, Map.of("opcaoIds", List.of()), 404),
                    api.put(ALUNO + "/" + nada + "/votos", fora, Map.of("opcaoIds", List.of()), 404));
            mesmoErro(api.post(ALUNO + "/" + post + "/denuncias", fora, Map.of("motivo", "SPAM"), 404),
                    api.post(ALUNO + "/" + nada + "/denuncias", fora, Map.of("motivo", "SPAM"), 404));
            mesmoErro(api.get(ALUNO + "/fotos/" + foto, fora, 404), api.get(ALUNO + "/fotos/" + nada, fora, 404));
            mesmoErro(api.get(aluno + "/capas/" + capa, fora, 404), api.get(aluno + "/capas/" + nada, fora, 404));
        }
        assertThat(api.get(ALUNO + "/fotos/" + foto, loginC, 404).get("message").asString()).isEqualTo("Foto não encontrada.");
        assertThat(api.get(aluno + "/capas/" + capa, loginC, 404).get("message").asString()).isEqualTo("Capa não encontrada.");

        // Equipe: comentário e foto de post oculto x inexistente.
        api.delete(EQUIPE + "/" + post, admin, 204);
        mesmoErro(api.delete("/comunidade/mural/comentarios/" + comentario, admin, 404),
                api.delete("/comunidade/mural/comentarios/" + nada, admin, 404));
        assertThat(api.delete("/comunidade/mural/comentarios/" + comentario, admin, 404).get("message").asString())
                .isEqualTo("Comentário não encontrado.");
        mesmoErro(api.get(EQUIPE + "/fotos/" + foto, admin, 404), api.get(EQUIPE + "/fotos/" + nada, admin, 404));
    }

    @Test
    void capaDeVideoOcultoTemAMensagemDaCapaParaAEquipeEParaOAluno() throws Exception {
        String capa = enviarCapa();
        Map<String, Object> video = new LinkedHashMap<>();
        video.put("tipo", "VIDEO");
        video.put("texto", "Vídeo fictício a ocultar");
        video.put("videoUrl", "https://exemplo.test/v");
        video.put("capaId", capa);
        video.put("podId", podX);
        String post = api.post(EQUIPE, admin, video, 200).get("id").asString();
        // Direto no banco: oculta sem a rotina que apaga a capa, para exercitar só a recusa do funil.
        jdbc.update("update comunidade_mural_post set oculto = true where id = ?::uuid", post);
        JsonNode oculto = api.get("/comunidade/capas/" + capa, admin, 404);
        assertThat(oculto.get("message").asString()).isEqualTo("Capa não encontrada.");
        mesmoErro(oculto, api.get("/comunidade/capas/" + UUID.randomUUID(), admin, 404));
        String aluno = ALUNO.replace("/mural", "");
        mesmoErro(api.get(aluno + "/capas/" + capa, loginA, 404), api.get(aluno + "/capas/" + UUID.randomUUID(), loginA, 404));
    }

    @Test
    void enquetesDoPodSoSaoVotadasEVistasPeloPod() throws Exception {
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("tipo", "ENQUETE");
        corpo.put("texto", "Qual horário prefere?");
        corpo.put("opcoes", List.of("Manhã", "Noite"));
        corpo.put("podId", podX);
        JsonNode enquete = api.post(EQUIPE, admin, corpo, 200);
        String rota = ALUNO + "/" + enquete.get("id").asString();
        String opcao = enquete.get("enquete").get("opcoes").get(0).get("id").asString();

        api.put(rota + "/votos", loginC, Map.of("opcaoIds", List.of(opcao)), 404);
        api.put(rota + "/votos", loginD, Map.of("opcaoIds", List.of(opcao)), 404);
        api.get(rota + "/votos", loginC, 404);
        assertThat(contar("select count(*) from comunidade_enquete_voto where post_id = ?::uuid", enquete.get("id").asString()))
                .isZero();
        api.put(rota + "/votos", loginA, Map.of("opcaoIds", List.of(opcao)), 200);
        api.get(rota + "/votos", loginB, 200);
        assertThat(contar("select count(*) from comunidade_enquete_voto where post_id = ?::uuid", enquete.get("id").asString()))
                .isEqualTo(1);
    }

    @Test
    void capaEFotoDoPostDoPodSoSaemParaOPod() throws Exception {
        jdbc.update("update aluno set data_nascimento = ? where id = ?", LocalDate.now(Fuso.BRASILIA).minusYears(25), alunoA);
        api.put("/comunidade/configuracao", admin, Map.of("alunosPublicam", true, "alunosAnexamFotos", true), 200);

        // Capa de um vídeo do pod.
        String capa = enviarCapa();
        Map<String, Object> video = new LinkedHashMap<>();
        video.put("tipo", "VIDEO");
        video.put("texto", "Vídeo fictício do pod");
        video.put("videoUrl", "https://exemplo.test/v");
        video.put("capaId", capa);
        video.put("podId", podX);
        api.post(EQUIPE, admin, video, 200);
        baixar(ALUNO.replace("/mural", "") + "/capas/" + capa, loginA, 200);
        baixar(ALUNO.replace("/mural", "") + "/capas/" + capa, loginB, 200);
        baixar(ALUNO.replace("/mural", "") + "/capas/" + capa, loginC, 404);
        baixar(ALUNO.replace("/mural", "") + "/capas/" + capa, loginD, 404);
        baixar("/comunidade/capas/" + capa, admin, 200);

        // Foto anexada a um post do pod.
        String foto = enviarFoto(loginA);
        Map<String, Object> comFoto = post("Texto fictício com foto", podX);
        comFoto.put("fotoIds", List.of(foto));
        api.post(ALUNO, loginA, comFoto, 200);
        baixar(ALUNO + "/fotos/" + foto, loginA, 200);
        baixar(ALUNO + "/fotos/" + foto, loginB, 200);
        baixar(ALUNO + "/fotos/" + foto, loginC, 404);
        baixar(ALUNO + "/fotos/" + foto, loginD, 404);
        baixar(EQUIPE + "/fotos/" + foto, admin, 200);
    }

    @Test
    void equipeFixaModeraEApagaEmQualquerPodEOHistoricoDoPodSomeDoOutro() throws Exception {
        String post = postDoAluno(loginA, "Texto fictício a moderar", podX);
        String comentario = api.post(ALUNO + "/" + post + "/comentarios", loginB, Map.of("texto", "Oi pod"), 200)
                .get("id").asString();
        api.post(EQUIPE + "/" + post + "/fixar", admin, null, 204);
        assertThat(contar("select count(*) from comunidade_mural_post where id = ?::uuid and fixado", post)).isEqualTo(1);
        api.delete(EQUIPE + "/comentarios/" + comentario, admin, 204);
        api.delete(EQUIPE + "/" + post, admin, 204);
        assertThat(contar("select count(*) from comunidade_mural_post where id = ?::uuid and oculto", post)).isEqualTo(1);
        // Post oculto some até para quem era do pod.
        api.post(ALUNO + "/" + post + "/comentarios", loginB, Map.of("texto", "Oi"), 404);
        // Dispensar denúncias segue idempotente no post oculto (204); moderar o oculto é 404; post que não existe é 404.
        api.post(EQUIPE + "/" + post + "/denuncias/dispensar", admin, null, 204);
        api.post(EQUIPE + "/" + post + "/fixar", admin, null, 404);
        api.post(EQUIPE + "/" + UUID.randomUUID() + "/denuncias/dispensar", admin, null, 404);
    }

    @Test
    void filaDeDenunciadosDaEquipeVeTodosOsPodsComPodIdENome() throws Exception {
        String geral = postDoAluno(loginD, "Texto fictício geral denunciado", null);
        String doPod = postDoAluno(loginA, "Texto fictício do pod denunciado", podX);
        api.post(ALUNO + "/" + doPod + "/denuncias", loginB, Map.of("motivo", "SPAM"), 204);
        api.post(ALUNO + "/" + geral + "/denuncias", loginA, Map.of("motivo", "SPAM"), 204);

        JsonNode fila = api.get(EQUIPE + "?denunciados=true", admin, 200);
        assertThat(ids(fila)).containsExactlyInAnyOrder(geral, doPod);
        for (JsonNode p : fila.get("content")) {
            if (p.get("id").asString().equals(doPod)) {
                assertThat(p.get("podId").asString()).isEqualTo(podX);
                assertThat(p.get("podNome").asString()).isNotBlank();
            } else {
                assertThat(p.get("podId").isNull()).isTrue();
                assertThat(p.get("podNome").isNull()).isTrue();
            }
        }
        api.post(EQUIPE + "/" + doPod + "/denuncias/dispensar", admin, null, 204);
        assertThat(ids(api.get(EQUIPE + "?denunciados=true", admin, 200))).containsExactly(geral);
    }

    // ---- saída do pod ----

    @Test
    void inativarAnonimizarEExcluirAContaZeramOPod() throws Exception {
        api.patch("/alunos/" + alunoA + "/situacao", admin, Map.of("ativo", false), 200);
        assertThat(podDoBanco(alunoA)).isNull();

        api.patch("/alunos/" + alunoC + "/situacao", admin, Map.of("ativo", false), 200);
        api.post("/alunos/" + alunoC + "/anonimizar", admin, Map.of("nomeConfirmado", "Cida Pod Fictícia"), 200);
        assertThat(podDoBanco(alunoC)).isNull();

        assertThat(podDoBanco(alunoB)).isEqualTo(UUID.fromString(podX));
        api.post("/aluno/conta/excluir", loginB, Map.of("senha", ApiDeTeste.SENHA, "confirmacao", "EXCLUIR"), 204);
        assertThat(podDoBanco(alunoB)).isNull();
        for (JsonNode p : api.get("/comunidade/pods", admin, 200)) {
            assertThat(p.get("membros").asInt()).isZero();
        }
    }

    // ---- aluno sabe o pod, exportação, auditoria ----

    @Test
    void configuracaoDoAlunoTrazOPodDoBancoEExportacaoSoLevaOProprioPod() throws Exception {
        JsonNode config = api.get("/aluno/comunidade/configuracao", loginA, 200);
        assertThat(config.get("pod").get("id").asString()).isEqualTo(podX);
        assertThat(config.get("pod").get("nome").asString()).isNotBlank();
        assertThat(api.get("/aluno/comunidade/configuracao", loginD, 200).get("pod").isNull()).isTrue();

        String doPod = postDoAluno(loginA, "Texto fictício exportado", podX);
        String geral = postDoAluno(loginA, "Texto fictício geral exportado", null);
        JsonNode comunidade = api.get("/alunos/" + alunoA + "/exportacao", admin, 200).get("comunidade");
        assertThat(comunidade.get("pod").propertyNames()).containsExactly("nome");
        assertThat(comunidade.get("pod").get("nome").asString()).isEqualTo(config.get("pod").get("nome").asString());
        for (JsonNode p : comunidade.get("posts")) {
            assertThat(p.get("podId").isNull()).isEqualTo(p.get("id").asString().equals(geral));
            if (p.get("id").asString().equals(doPod)) {
                assertThat(p.get("podId").asString()).isEqualTo(podX);
            }
        }
        // Quem não tem pod: sem a chave de pod com conteúdo.
        JsonNode semPod = api.get("/alunos/" + alunoD + "/exportacao", admin, 200).get("comunidade");
        assertThat(semPod.get("pod") == null || semPod.get("pod").isNull()).isTrue();
        // A exportação nunca lista membros.
        assertThat(comunidade.toString()).doesNotContain("membros").doesNotContain("Beto Pod");
    }

    @Test
    void auditoriaDosPodsTemResumoFixoSemONomeDoPod() throws Exception {
        String nome = "Segredo Fictício " + UUID.randomUUID().toString().substring(0, 8);
        String pod = criarPod(nome);
        String novo = "Renomeado Fictício " + UUID.randomUUID().toString().substring(0, 8);
        api.put("/comunidade/pods/" + pod, admin, Map.of("nome", novo), 200);
        // Mesmo nome de novo: não audita.
        api.put("/comunidade/pods/" + pod, admin, Map.of("nome", novo), 200);
        atribuir(alunoD, pod, 204);
        atribuir(alunoD, pod, 204);

        assertThat(contar("select count(*) from auditoria where acao = 'POD_CRIADO' and entidade_id = ?::uuid", pod)).isEqualTo(1);
        assertThat(contar("select count(*) from auditoria where acao = 'POD_ALTERADO' and entidade_id = ?::uuid", pod)).isEqualTo(1);
        assertThat(contar("select count(*) from auditoria where acao = 'ALUNO_POD_ALTERADO' and entidade_id = ?", alunoD)).isEqualTo(1);
        assertThat(contar("select count(*) from auditoria where consultoria_id = ? and (resumo like ? or resumo like ?)",
                consultoria(), "%" + nome + "%", "%" + novo + "%")).isZero();
        assertThat(usuarioDoAluno(alunoD)).isNotNull();
    }

    @Test
    void migrationNaoDeixaApagarPodComPostEOPodDoAlunoVoltaANuloSeOPodSome() {
        UUID consultoria = consultoria();
        UUID pod = UUID.fromString(podX);
        UUID post = UUID.randomUUID();
        jdbc.update("insert into comunidade_mural_post (id, consultoria_id, autor_id, autor_nome, texto, tipo, texto_busca, pod_id)"
                        + " values (?, ?, ?, 'Fictícia', 'Texto fictício', 'CONVERSA', 'texto ficticio', ?)",
                post, consultoria, usuarioDoAluno(alunoA), pod);
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> jdbc.update("delete from comunidade_pod where id = ?", pod))
                .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        jdbc.update("delete from comunidade_mural_post where id = ?", post);
        jdbc.update("delete from comunidade_pod where id = ?", pod);
        // SET NULL só na coluna do pod: a consultoria do aluno continua intacta.
        assertThat(podDoBanco(alunoA)).isNull();
        assertThat(contar("select count(*) from aluno where id = ? and consultoria_id is not null", alunoA)).isEqualTo(1);
    }
}
