package br.com.treinos.api.tags;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.web.Buscas;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.SessionFactory;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tags de aluno (V093, {@code docs/planos/tags-de-aluno.md}): CRUD da lista da consultoria, nome único sem caixa nem acento (409),
 * 422 por campo sem repetir o nome, isolamento (404 de outra consultoria em todas as rotas), limite de 10 por aluno, filtro
 * {@code tag} (OU dentro, E com os demais, 400 malformado), permissões, a lista de alunos sem N+1, exportação, anonimização e
 * "Excluir minha conta" (a ligação sai, a tag fica), o aluno nunca vê tags e auditoria e log sem o nome. Só dados fictícios.
 */
@AutoConfigureMockMvc
class TagsDeAlunoIntegrationTest extends AbstractIntegrationTest {

    private static final String SIGILO = "Sigilosa Marcadora Fictícia";

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private EntityManagerFactory emf;
    @Autowired private PlatformTransactionManager transacoes;

    private ApiDeTeste api;
    private JsonNode admin;
    private UUID consultoria;
    private ListAppender<ILoggingEvent> log;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        consultoria = consultoriaDe(admin);
        log = new ListAppender<>();
        log.start();
        ((Logger) LoggerFactory.getLogger(Logger.ROOT_LOGGER_NAME)).addAppender(log);
    }

    @AfterEach
    void soltarOLog() {
        ((Logger) LoggerFactory.getLogger(Logger.ROOT_LOGGER_NAME)).detachAppender(log);
    }

    // ---- apoio ----

    private UUID consultoriaDe(JsonNode login) {
        return jdbc.queryForObject("select consultoria_id from usuario where id = ?::uuid", UUID.class,
                login.get("usuario").get("id").asString());
    }

    private static Map<String, Object> corpo(String nome, String cor, Long versao) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("nome", nome);
        m.put("cor", cor);
        if (versao != null) {
            m.put("versao", versao);
        }
        return m;
    }

    private JsonNode criarTag(JsonNode login, String nome, String cor) throws Exception {
        return api.post("/tags-de-alunos", login, corpo(nome, cor, null), 200);
    }

    private UUID tagId(JsonNode login, String nome, String cor) throws Exception {
        return UUID.fromString(criarTag(login, nome, cor).get("id").asString());
    }

    private JsonNode marcar(JsonNode login, UUID aluno, int esperado, UUID... tags) throws Exception {
        List<String> ids = new ArrayList<>();
        for (UUID t : tags) {
            ids.add(t.toString());
        }
        return api.put("/alunos/" + aluno + "/tags", login, Map.of("tagIds", ids), esperado);
    }

    private JsonNode membro(String nome, Set<String> permissoes) throws Exception {
        String perfil = api.post("/perfis", admin, Map.of("nome", "Perfil " + nome + UUID.randomUUID(), "permissoes", permissoes), 200)
                .get("id").asString();
        JsonNode convite = api.post("/usuarios/convites", admin,
                Map.of("nome", nome, "email", ApiDeTeste.emailUnico("membro"), "perfilId", perfil), 200);
        return api.post("/publico/convites-equipe/aceitar", null,
                Map.of("codigo", convite.get("codigo").asString(), "senha", ApiDeTeste.SENHA), 200);
    }

    private static Set<String> campos(JsonNode erro) {
        Set<String> nomes = new TreeSet<>();
        erro.get("fieldErrors").forEach(f -> nomes.add(f.get("field").asString()));
        return nomes;
    }

    private static List<String> nomes(JsonNode tags) {
        List<String> nomes = new ArrayList<>();
        tags.forEach(t -> nomes.add(t.get("nome").asString()));
        return nomes;
    }

    private List<String> nomesDosAlunos(JsonNode pagina) {
        List<String> nomes = new ArrayList<>();
        pagina.get("itens").forEach(a -> nomes.add(a.get("nome").asString()));
        return nomes;
    }

    private int auditorias(String acao) {
        return jdbc.queryForObject("select count(*) from auditoria where acao = ? and consultoria_id = ?", Integer.class, acao,
                consultoria);
    }

    private int ligacoes(UUID aluno) {
        return jdbc.queryForObject("select count(*) from aluno_tag where aluno_id = ?::uuid", Integer.class, aluno.toString());
    }

    private void nadaVazou(String... segredos) {
        String auditoria = jdbc.queryForObject(
                "select coalesce(string_agg(coalesce(acao,'') || ' ' || coalesce(resumo,'') || ' ' || coalesce(entidade,''), ' '), '') "
                        + "from auditoria where consultoria_id = ?", String.class, consultoria);
        String logado = String.join("\n", log.list.stream().map(ILoggingEvent::getFormattedMessage).toList());
        for (String segredo : segredos) {
            assertThat(auditoria).as("auditoria").doesNotContain(segredo);
            assertThat(logado).as("log").doesNotContain(segredo);
        }
    }

    // ---- lista da consultoria ----

    @Test
    void crudCompletoDaTagDaConsultoria() throws Exception {
        assertThat(api.get("/tags-de-alunos", admin, 200).size()).isZero();

        JsonNode criada = criarTag(admin, "  Retorno  ", "azul");
        assertThat(criada.propertyNames()).containsExactlyInAnyOrder("id", "nome", "cor", "totalAlunos", "versao");
        assertThat(criada.get("nome").asString()).isEqualTo("Retorno"); // strip
        assertThat(criada.get("cor").asString()).isEqualTo("AZUL"); // o código, sem diferença de caixa
        assertThat(criada.get("totalAlunos").asLong()).isZero();
        String id = criada.get("id").asString();
        long versao = criada.get("versao").asLong();
        assertThat(auditorias("TAG_ALUNO_CRIADA")).isEqualTo(1);

        UUID aluno = api.criarAluno(admin, "Aluno Fictício das Tags");
        marcar(admin, aluno, 200, UUID.fromString(id));
        JsonNode lista = api.get("/tags-de-alunos", admin, 200);
        assertThat(lista.size()).isEqualTo(1);
        assertThat(lista.get(0).get("totalAlunos").asLong()).isEqualTo(1);

        // Trocar a cor e renomear (a versão sobe); igual ao gravado não grava, não sobe a versão e não audita.
        JsonNode alterada = api.put("/tags-de-alunos/" + id, admin, corpo("Retorno online", "VIOLETA", versao), 200);
        assertThat(alterada.get("nome").asString()).isEqualTo("Retorno online");
        assertThat(alterada.get("cor").asString()).isEqualTo("VIOLETA");
        assertThat(alterada.get("totalAlunos").asLong()).isEqualTo(1);
        assertThat(alterada.get("versao").asLong()).isGreaterThan(versao);
        assertThat(auditorias("TAG_ALUNO_ALTERADA")).isEqualTo(1);
        JsonNode igual = api.put("/tags-de-alunos/" + id, admin, corpo("Retorno online", "VIOLETA", alterada.get("versao").asLong()), 200);
        assertThat(igual.get("versao").asLong()).isEqualTo(alterada.get("versao").asLong());
        assertThat(auditorias("TAG_ALUNO_ALTERADA")).isEqualTo(1);
        // A ficha do aluno já mostra o nome novo.
        assertThat(api.get("/alunos/" + aluno, admin, 200).get("tags").get(0).get("nome").asString()).isEqualTo("Retorno online");

        // Apagar: versão velha 409; a certa 204, a tag some da lista e de todos os alunos.
        api.delete("/tags-de-alunos/" + id + "?versao=" + versao, admin, 409);
        api.delete("/tags-de-alunos/" + id + "?versao=" + alterada.get("versao").asLong(), admin, 204);
        assertThat(api.get("/tags-de-alunos", admin, 200).size()).isZero();
        assertThat(api.get("/alunos/" + aluno, admin, 200).get("tags").size()).isZero();
        assertThat(ligacoes(aluno)).isZero();
        assertThat(auditorias("TAG_ALUNO_APAGADA")).isEqualTo(1);
        api.delete("/tags-de-alunos/" + id, admin, 404);
        api.put("/tags-de-alunos/" + id, admin, corpo("Qualquer", "AZUL", 0L), 404);
    }

    @Test
    void listaVemEmOrdemDeNome() throws Exception {
        criarTag(admin, "Retorno", "AZUL");
        criarTag(admin, "Avaliação", "CIANO");
        criarTag(admin, "online", "INDIGO");
        assertThat(nomes(api.get("/tags-de-alunos", admin, 200))).containsExactly("Avaliação", "online", "Retorno");
    }

    @Test
    void nomeUnicoSemCaixaNemAcentoEMensagemSemOValor() throws Exception {
        JsonNode primeira = criarTag(admin, "Avaliação Física", "AZUL");
        JsonNode repetida = api.post("/tags-de-alunos", admin, corpo("  avaliacao   FISICA ", "VIOLETA", null), 409);
        assertThat(repetida.get("codigo").asString()).isEqualTo("TAG_NOME_EM_USO");
        assertThat(repetida.toString()).doesNotContainIgnoringCase("avalia");
        // Decomposto (e + acento) e composto são o mesmo nome depois do NFC.
        api.post("/tags-de-alunos", admin, corpo("Avaliação Física", "VIOLETA", null), 409);

        JsonNode outra = criarTag(admin, "Online", "VIOLETA");
        // Renomear para o nome de outra tag = 409; mudar só a caixa da própria vale.
        JsonNode conflito = api.put("/tags-de-alunos/" + outra.get("id").asString(), admin,
                corpo("AVALIAÇÃO FÍSICA", "VIOLETA", outra.get("versao").asLong()), 409);
        assertThat(conflito.get("codigo").asString()).isEqualTo("TAG_NOME_EM_USO");
        JsonNode propria = api.put("/tags-de-alunos/" + primeira.get("id").asString(), admin,
                corpo("AVALIAÇÃO FÍSICA", "AZUL", primeira.get("versao").asLong()), 200);
        assertThat(propria.get("nome").asString()).isEqualTo("AVALIAÇÃO FÍSICA");
        // O normalizado gravado é o do Java.
        assertThat(jdbc.queryForObject("select nome_normalizado from tag_aluno where id = ?::uuid", String.class,
                primeira.get("id").asString())).isEqualTo(Buscas.semAcento("AVALIAÇÃO FÍSICA")).isEqualTo("avaliacao fisica");
        // Outra consultoria pode ter o mesmo nome.
        api.post("/tags-de-alunos", api.novoTreinador(), corpo("Avaliação Física", "AZUL", null), 200);
    }

    @Test
    void validacaoDevolve422PorCampoSemRepetirOValor() throws Exception {
        JsonNode semNome = api.post("/tags-de-alunos", admin, corpo("   ", "AZUL", null), 422);
        assertThat(semNome.get("codigo").asString()).isEqualTo("TAG_INVALIDA");
        assertThat(campos(semNome)).containsExactly("nome");
        assertThat(campos(api.post("/tags-de-alunos", admin, corpo(null, "AZUL", null), 422))).containsExactly("nome");

        JsonNode longo = api.post("/tags-de-alunos", admin, corpo("X".repeat(31), "AZUL", null), 422);
        assertThat(campos(longo)).containsExactly("nome");
        assertThat(longo.toString()).doesNotContain("XXXXXXXX");
        api.post("/tags-de-alunos", admin, corpo("Y".repeat(30), "AZUL", null), 200); // 30 vale

        assertThat(campos(api.post("/tags-de-alunos", admin, corpo("Com\u0007controle", "AZUL", null), 422))).containsExactly("nome");
        // Só acento solto não é um nome.
        assertThat(campos(api.post("/tags-de-alunos", admin, corpo("́", "AZUL", null), 422))).containsExactly("nome");

        // A cor é da lista fechada: nem a da marca nem as de situação.
        for (String cor : new String[]{"MARCA", "VERDE", "VERMELHO", "AMBAR", "", "#1A5CBA"}) {
            JsonNode erro = api.post("/tags-de-alunos", admin, corpo("Cor " + cor.length(), cor, null), 422);
            assertThat(campos(erro)).containsExactly("cor");
            assertThat(erro.toString()).doesNotContain("VERDE");
        }
        assertThat(campos(api.post("/tags-de-alunos", admin, corpo("  ", null, null), 422))).containsExactly("cor", "nome");
        for (String cor : new String[]{"CIANO", "AZUL", "INDIGO", "VIOLETA", "MAGENTA"}) {
            api.post("/tags-de-alunos", admin, corpo("Cor " + cor, cor, null), 200);
        }
        // No PUT também.
        JsonNode t = criarTag(admin, "Para editar", "AZUL");
        assertThat(campos(api.put("/tags-de-alunos/" + t.get("id").asString(), admin,
                corpo("", "VERDE", t.get("versao").asLong()), 422))).containsExactly("cor", "nome");
    }

    @Test
    void nomeQueDecompoeEmMaisDe60LetrasDa422EmVezDeEstourarAColuna() throws Exception {
        // 21 sílabas de hangul com final: cada uma vira 3 letras no NFD (63 > 60), mesmo com só 21 caracteres.
        String hangul = "각".repeat(21);
        assertThat(Buscas.semAcento(hangul)).hasSize(63);
        JsonNode erro = api.post("/tags-de-alunos", admin, corpo(hangul, "AZUL", null), 422);
        assertThat(erro.get("codigo").asString()).isEqualTo("TAG_INVALIDA");
        assertThat(campos(erro)).containsExactly("nome");
        assertThat(erro.toString()).doesNotContain(hangul);
        // 20 sílabas (60 letras) cabem; e no PUT a recusa é a mesma.
        JsonNode cabe = criarTag(admin, "각".repeat(20), "AZUL");
        assertThat(campos(api.put("/tags-de-alunos/" + cabe.get("id").asString(), admin,
                corpo(hangul, "AZUL", cabe.get("versao").asLong()), 422))).containsExactly("nome");
    }

    /**
     * A corrida do nome único que a checagem prévia não pega: outra tag com o mesmo nome normalizado está gravada mas ainda não
     * confirmada (a checagem não a enxerga); a chamada trava no índice único e, quando a outra é confirmada, o insert/update viola
     * {@code ux_tag_aluno_nome}. Devolve a resposta dessa chamada.
     */
    private MockHttpServletResponse corridaDoNome(String nomeNormalizado, boolean alterar, String caminho, Map<String, Object> corpo)
            throws Exception {
        ExecutorService pool = Executors.newSingleThreadExecutor();
        try {
            List<Future<MockHttpServletResponse>> chamada = new ArrayList<>();
            new TransactionTemplate(transacoes).executeWithoutResult(status -> {
                jdbc.update("insert into tag_aluno (id, consultoria_id, nome, nome_normalizado, cor) values (?, ?, 'Concorrente', ?, 'AZUL')",
                        UUID.randomUUID(), consultoria, nomeNormalizado);
                chamada.add(pool.submit(() -> mvc.perform((alterar ? MockMvcRequestBuilders.put(caminho)
                                : MockMvcRequestBuilders.post(caminho)).header("X-Treinos-Cliente", "nativo")
                        .header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(corpo))).andReturn().getResponse()));
                aguardarBloqueio();
            });
            return chamada.get(0).get(30, TimeUnit.SECONDS);
        } finally {
            pool.shutdownNow();
        }
    }

    private void aguardarBloqueio() {
        long limite = System.nanoTime() + TimeUnit.SECONDS.toNanos(15);
        while (System.nanoTime() < limite) {
            if (jdbc.queryForObject("select count(*) from pg_locks where not granted", Integer.class) > 0) {
                return;
            }
            try {
                Thread.sleep(50);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            }
        }
        throw new AssertionError("a chamada não chegou a esperar pelo índice do nome");
    }

    @Test
    void corridaDoNomeAoCriarDa409TagNomeEmUsoEnaoUm500() throws Exception {
        MockHttpServletResponse r = corridaDoNome("nome da corrida", false, "/tags-de-alunos", corpo("Nome da Corrida", "AZUL", null));

        assertThat(r.getStatus()).isEqualTo(409);
        assertThat(json.readTree(r.getContentAsString(StandardCharsets.UTF_8)).get("codigo").asString()).isEqualTo("TAG_NOME_EM_USO");
        assertThat(r.getContentAsString(StandardCharsets.UTF_8)).doesNotContainIgnoringCase("corrida");
        assertThat(jdbc.queryForObject("select count(*) from tag_aluno where consultoria_id = ? and nome_normalizado = ?", Integer.class,
                consultoria, "nome da corrida")).isEqualTo(1);
    }

    @Test
    void corridaDoNomeAoRenomearDa409TagNomeEmUsoEnaoUm500() throws Exception {
        JsonNode tag = criarTag(admin, "Original", "AZUL");

        MockHttpServletResponse r = corridaDoNome("renomeada na corrida", true, "/tags-de-alunos/" + tag.get("id").asString(),
                corpo("Renomeada na Corrida", "AZUL", tag.get("versao").asLong()));

        assertThat(r.getStatus()).isEqualTo(409);
        assertThat(json.readTree(r.getContentAsString(StandardCharsets.UTF_8)).get("codigo").asString()).isEqualTo("TAG_NOME_EM_USO");
        assertThat(jdbc.queryForObject("select nome from tag_aluno where id = ?::uuid", String.class, tag.get("id").asString()))
                .isEqualTo("Original");
    }

    @Test
    void putSemVersaoOuComVersaoVelhaDa409() throws Exception {
        JsonNode t = criarTag(admin, "Concorrente", "AZUL");
        String rota = "/tags-de-alunos/" + t.get("id").asString();
        assertThat(api.put(rota, admin, corpo("Concorrente", "VIOLETA", null), 409).get("codigo").asString()).isEqualTo("CONFLITO_EDICAO");
        JsonNode nova = api.put(rota, admin, corpo("Concorrente", "VIOLETA", t.get("versao").asLong()), 200);
        assertThat(api.put(rota, admin, corpo("Concorrente", "CIANO", t.get("versao").asLong()), 409).get("codigo").asString())
                .isEqualTo("CONFLITO_EDICAO");
        api.put(rota, admin, corpo("Concorrente", "CIANO", nova.get("versao").asLong()), 200);
    }

    // ---- tags do aluno ----

    @Test
    void substituiAsTagsDoAlunoEEIdempotente() throws Exception {
        UUID aluno = api.criarAluno(admin, "Aluno Fictício");
        UUID retorno = tagId(admin, "Retorno", "AZUL");
        UUID online = tagId(admin, "Online", "VIOLETA");
        UUID avaliacao = tagId(admin, "Avaliação", "CIANO");

        JsonNode dois = marcar(admin, aluno, 200, retorno, online);
        assertThat(nomes(dois)).containsExactly("Online", "Retorno"); // em ordem de nome
        assertThat(dois.get(0).propertyNames()).containsExactlyInAnyOrder("id", "nome", "cor");
        assertThat(auditorias("ALUNO_TAGS_ALTERADAS")).isEqualTo(1);

        // O mesmo conjunto (em outra ordem, até repetido) não grava nem audita.
        marcar(admin, aluno, 200, online, retorno, online);
        assertThat(auditorias("ALUNO_TAGS_ALTERADAS")).isEqualTo(1);

        // Substitui: sai uma, entra outra.
        assertThat(nomes(marcar(admin, aluno, 200, avaliacao, online))).containsExactly("Avaliação", "Online");
        assertThat(auditorias("ALUNO_TAGS_ALTERADAS")).isEqualTo(2);
        JsonNode ficha = api.get("/alunos/" + aluno, admin, 200);
        assertThat(nomes(ficha.get("tags"))).containsExactly("Avaliação", "Online");
        assertThat(ficha.get("tags").get(0).get("cor").asString()).isEqualTo("CIANO");

        // Vazio tira todas; de novo vazio não audita.
        assertThat(marcar(admin, aluno, 200).size()).isZero();
        assertThat(api.get("/alunos/" + aluno, admin, 200).get("tags").size()).isZero();
        marcar(admin, aluno, 200);
        assertThat(auditorias("ALUNO_TAGS_ALTERADAS")).isEqualTo(3);
        // As tags continuam na lista da consultoria.
        assertThat(api.get("/tags-de-alunos", admin, 200).size()).isEqualTo(3);
        api.put("/alunos/" + aluno + "/tags", admin, Map.of(), 400); // sem tagIds
    }

    @Test
    void limiteDeDezTagsPorAluno() throws Exception {
        UUID aluno = api.criarAluno(admin, "Aluno Fictício");
        List<UUID> tags = new ArrayList<>();
        for (int i = 0; i < 11; i++) {
            tags.add(tagId(admin, "Tag " + i, "AZUL"));
        }
        marcar(admin, aluno, 200, tags.subList(0, 10).toArray(UUID[]::new));
        JsonNode erro = marcar(admin, aluno, 422, tags.toArray(UUID[]::new));
        assertThat(erro.get("codigo").asString()).isEqualTo("TAGS_LIMITE");
        assertThat(campos(erro)).containsExactly("tagIds");
        assertThat(ligacoes(aluno)).isEqualTo(10); // nada mudou
        // Repetido não conta duas vezes.
        List<UUID> comRepetidas = new ArrayList<>(tags.subList(0, 10));
        comRepetidas.addAll(tags.subList(0, 5));
        marcar(admin, aluno, 200, comRepetidas.toArray(UUID[]::new));
    }

    @Test
    void alunoAnonimizadoRecusaTagNova() throws Exception {
        UUID aluno = api.criarAluno(admin, "Aluno Fictício a Anonimizar");
        UUID tag = tagId(admin, "Retorno", "AZUL");
        api.patch("/alunos/" + aluno + "/situacao", admin, Map.of("ativo", false), 200);
        api.post("/alunos/" + aluno + "/anonimizar", admin, Map.of("nomeConfirmado", "Aluno Fictício a Anonimizar"), 200);
        assertThat(marcar(admin, aluno, 409, tag).get("codigo").asString()).isEqualTo("ALUNO_ANONIMIZADO");
    }

    // ---- isolamento ----

    @Test
    void outraConsultoriaRecebe404EmTodasAsRotas() throws Exception {
        JsonNode outro = api.novoTreinador();
        UUID alunoDeles = api.criarAluno(outro, "Aluno de Outra Consultoria");
        JsonNode tagDeles = criarTag(outro, "Da outra", "AZUL");
        UUID tagDelesId = UUID.fromString(tagDeles.get("id").asString());
        UUID meuAluno = api.criarAluno(admin, "Meu Aluno");
        UUID minhaTag = tagId(admin, "Minha", "AZUL");

        api.put("/tags-de-alunos/" + tagDelesId, admin, corpo("Roubada", "AZUL", tagDeles.get("versao").asLong()), 404);
        api.delete("/tags-de-alunos/" + tagDelesId + "?versao=" + tagDeles.get("versao").asLong(), admin, 404);
        marcar(admin, alunoDeles, 404, minhaTag); // aluno de outra consultoria
        marcar(admin, meuAluno, 404, tagDelesId); // tag de outra consultoria
        marcar(admin, meuAluno, 404, minhaTag, tagDelesId); // uma boa e uma de fora: nada é gravado
        assertThat(ligacoes(meuAluno)).isZero();
        marcar(admin, meuAluno, 404, UUID.randomUUID()); // inexistente
        api.get("/alunos?tag=" + tagDelesId, admin, 404);
        api.get("/alunos?tag=" + minhaTag + "&tag=" + tagDelesId, admin, 404);
        // Nada do outro lado mudou, e a lista de cada um só tem as suas.
        assertThat(nomes(api.get("/tags-de-alunos", admin, 200))).containsExactly("Minha");
        assertThat(nomes(api.get("/tags-de-alunos", outro, 200))).containsExactly("Da outra");
        assertThat(api.get("/tags-de-alunos", outro, 200).get(0).get("versao").asLong()).isEqualTo(tagDeles.get("versao").asLong());
        // A ficha de um aluno de outra consultoria nem existe para mim.
        api.get("/alunos/" + alunoDeles, admin, 404);
    }

    // ---- filtro ----

    @Test
    void filtroPorTagEOuDentroEEComOsDemais() throws Exception {
        UUID a = api.criarAluno(admin, "Ana Fictícia");
        UUID b = api.criarAluno(admin, "Beto Fictício");
        UUID c = api.criarAluno(admin, "Caio Fictício");
        api.criarAluno(admin, "Duda Fictícia"); // sem tag
        UUID um = tagId(admin, "Um", "AZUL");
        UUID dois = tagId(admin, "Dois", "VIOLETA");
        tagId(admin, "Sem aluno", "CIANO");
        marcar(admin, a, 200, um);
        marcar(admin, b, 200, dois);
        marcar(admin, c, 200, um, dois);

        assertThat(nomesDosAlunos(api.get("/alunos?tag=" + um, admin, 200))).containsExactly("Ana Fictícia", "Caio Fictício");
        // OU dentro do filtro, sem duplicar quem tem as duas.
        JsonNode ou = api.get("/alunos?tag=" + um + "&tag=" + dois, admin, 200);
        assertThat(nomesDosAlunos(ou)).containsExactly("Ana Fictícia", "Beto Fictício", "Caio Fictício");
        assertThat(ou.get("total").asLong()).isEqualTo(3);
        // E com os demais filtros: busca, situação e responsável.
        assertThat(nomesDosAlunos(api.get("/alunos?tag=" + um + "&tag=" + dois + "&busca=beto", admin, 200))).containsExactly("Beto Fictício");
        api.patch("/alunos/" + c + "/situacao", admin, Map.of("ativo", false), 200);
        assertThat(nomesDosAlunos(api.get("/alunos?tag=" + um, admin, 200))).containsExactly("Ana Fictícia");
        assertThat(nomesDosAlunos(api.get("/alunos?tag=" + um + "&situacao=TODOS", admin, 200)))
                .containsExactly("Ana Fictícia", "Caio Fictício");
        assertThat(nomesDosAlunos(api.get("/alunos?tag=" + um + "&meus=true", admin, 200))).containsExactly("Ana Fictícia");
        assertThat(nomesDosAlunos(api.get("/alunos?tag=" + um + "&responsavel=nenhum", admin, 200))).isEmpty();
        // Tag sem aluno: lista vazia. Valor em branco é ignorado.
        UUID vazia = UUID.fromString(api.get("/tags-de-alunos", admin, 200).get(1).get("id").asString());
        assertThat(api.get("/alunos?tag=" + vazia, admin, 200).get("total").asLong()).isZero();
        assertThat(api.get("/alunos?tag=", admin, 200).get("total").asLong()).isEqualTo(3); // Ana, Beto e Duda (Caio está inativo)
        // Malformado: 400 FILTRO_INVALIDO, sem repetir o valor.
        JsonNode ruim = api.get("/alunos?tag=isto-nao-e-um-id", admin, 400);
        assertThat(ruim.get("codigo").asString()).isEqualTo("FILTRO_INVALIDO");
        assertThat(ruim.toString()).doesNotContain("isto-nao-e-um-id");
        api.get("/alunos?tag=" + um + "&tag=xyz", admin, 400);
    }

    @Test
    void listaDeAlunosTrazAsTagsSemNMaisUm() throws Exception {
        UUID retorno = tagId(admin, "Retorno", "AZUL");
        UUID online = tagId(admin, "Online", "VIOLETA");
        UUID sem = api.criarAluno(admin, "Aluno Sem Tag");
        UUID um = api.criarAluno(admin, "Aluno Com Uma");
        marcar(admin, um, 200, retorno);

        SessionFactory fabrica = emf.unwrap(SessionFactory.class);
        fabrica.getStatistics().setStatisticsEnabled(true);
        api.get("/alunos", admin, 200); // aquece (primeira chamada carrega o que for preguiçoso)
        long antes = fabrica.getStatistics().getPrepareStatementCount();
        JsonNode pequena = api.get("/alunos", admin, 200);
        long comPoucos = fabrica.getStatistics().getPrepareStatementCount() - antes;

        for (int i = 0; i < 6; i++) {
            UUID extra = api.criarAluno(admin, "Aluno Extra " + i);
            marcar(admin, extra, 200, i % 2 == 0 ? new UUID[]{retorno, online} : new UUID[]{online});
        }
        api.get("/alunos", admin, 200);
        antes = fabrica.getStatistics().getPrepareStatementCount();
        JsonNode grande = api.get("/alunos", admin, 200);
        long comMuitos = fabrica.getStatistics().getPrepareStatementCount() - antes;
        fabrica.getStatistics().setStatisticsEnabled(false);

        assertThat(comMuitos).as("consultas com 9 alunos x com 2: as tags vêm em lote").isEqualTo(comPoucos);
        assertThat(grande.get("itens").size()).isEqualTo(8);
        // Cada item traz as suas, em ordem de nome, e quem não tem vem com lista vazia.
        for (JsonNode item : pequena.get("itens")) {
            if (item.get("id").asString().equals(sem.toString())) {
                assertThat(item.get("tags").size()).isZero();
            } else {
                assertThat(item.get("id").asString()).isEqualTo(um.toString());
                assertThat(nomes(item.get("tags"))).containsExactly("Retorno");
                assertThat(item.get("tags").get(0).get("cor").asString()).isEqualTo("AZUL");
            }
        }
        long comAsDuas = 0;
        for (JsonNode item : grande.get("itens")) {
            if (item.get("nome").asString().startsWith("Aluno Extra") && item.get("tags").size() == 2) {
                assertThat(nomes(item.get("tags"))).containsExactly("Online", "Retorno");
                comAsDuas++;
            }
        }
        assertThat(comAsDuas).isEqualTo(3);
    }

    // ---- permissões ----

    @Test
    void lerComAlunoLerEGravarComAlunoAlterar() throws Exception {
        UUID aluno = api.criarAluno(admin, "Aluno Fictício");
        JsonNode tag = criarTag(admin, "Retorno", "AZUL");
        UUID tagId = UUID.fromString(tag.get("id").asString());
        marcar(admin, aluno, 200, tagId);

        JsonNode leitor = membro("Leitor", Set.of("ALUNO_LER"));
        assertThat(nomes(api.get("/tags-de-alunos", leitor, 200))).containsExactly("Retorno");
        assertThat(nomes(api.get("/alunos/" + aluno, leitor, 200).get("tags"))).containsExactly("Retorno");
        assertThat(nomes(api.get("/alunos", leitor, 200).get("itens").get(0).get("tags"))).containsExactly("Retorno");
        api.get("/alunos?tag=" + tagId, leitor, 200);
        api.post("/tags-de-alunos", leitor, corpo("Nova", "AZUL", null), 403);
        api.put("/tags-de-alunos/" + tagId, leitor, corpo("Renomeada", "AZUL", tag.get("versao").asLong()), 403);
        api.delete("/tags-de-alunos/" + tagId, leitor, 403);
        api.put("/alunos/" + aluno + "/tags", leitor, Map.of("tagIds", List.of()), 403);

        JsonNode editor = membro("Editor", Set.of("ALUNO_LER", "ALUNO_ALTERAR"));
        JsonNode nova = criarTag(editor, "Do editor", "VIOLETA");
        marcar(editor, aluno, 200, tagId, UUID.fromString(nova.get("id").asString()));
        api.put("/tags-de-alunos/" + tagId, editor, corpo("Renomeada", "AZUL", tag.get("versao").asLong()), 200);

        // Sem permissão de aluno nada se lê nem se grava; sem login, 401; o aluno (papel ALUNO) não passa.
        JsonNode semAluno = membro("Sem aluno", Set.of("BIBLIOTECA_LER"));
        api.get("/tags-de-alunos", semAluno, 403);
        api.post("/tags-de-alunos", semAluno, corpo("Nova", "AZUL", null), 403);
        api.get("/tags-de-alunos", null, 401);
        JsonNode loginDoAluno = api.convidarEEntrar(admin, aluno);
        api.get("/tags-de-alunos", loginDoAluno, 403);
        api.post("/tags-de-alunos", loginDoAluno, corpo("Nova", "AZUL", null), 403);
        api.put("/alunos/" + aluno + "/tags", loginDoAluno, Map.of("tagIds", List.of()), 403);
        api.get("/alunos/" + aluno, loginDoAluno, 403);
    }

    // ---- LGPD ----

    @Test
    void exportacaoLevaOsNomesDasTags() throws Exception {
        UUID aluno = api.criarAluno(admin, "Aluno Fictício");
        marcar(admin, aluno, 200, tagId(admin, SIGILO, "AZUL"), tagId(admin, "Online", "VIOLETA"));
        JsonNode exportacao = api.get("/alunos/" + aluno + "/exportacao", admin, 200);
        List<String> itens = new ArrayList<>();
        exportacao.get("tags").get("itens").forEach(n -> itens.add(n.asString()));
        assertThat(itens).containsExactly("Online", SIGILO);
        assertThat(exportacao.get("tags").get("truncado").asBoolean()).isFalse();
        assertThat(exportacao.get("secoesOmitidas").toString()).doesNotContain("\"tags\"");
        // O cadastro da mesma exportação já traz as tags da ficha.
        assertThat(nomes(exportacao.get("cadastro").get("tags"))).containsExactly("Online", SIGILO);
    }

    @Test
    void anonimizarApagaALigacaoEMantemATagDaConsultoria() throws Exception {
        UUID aluno = api.criarAluno(admin, "Aluno Fictício a Anonimizar");
        UUID outroAluno = api.criarAluno(admin, "Outro Aluno Fictício");
        UUID tag = tagId(admin, SIGILO, "AZUL");
        marcar(admin, aluno, 200, tag);
        marcar(admin, outroAluno, 200, tag);
        assertThat(api.get("/tags-de-alunos", admin, 200).get(0).get("totalAlunos").asLong()).isEqualTo(2);

        api.patch("/alunos/" + aluno + "/situacao", admin, Map.of("ativo", false), 200);
        JsonNode anonimizado = api.post("/alunos/" + aluno + "/anonimizar", admin,
                Map.of("nomeConfirmado", "Aluno Fictício a Anonimizar"), 200);
        assertThat(anonimizado.get("tags").size()).isZero();
        assertThat(ligacoes(aluno)).isZero();
        assertThat(ligacoes(outroAluno)).isEqualTo(1);
        JsonNode lista = api.get("/tags-de-alunos", admin, 200);
        assertThat(nomes(lista)).containsExactly(SIGILO); // a tag fica
        assertThat(lista.get(0).get("totalAlunos").asLong()).isEqualTo(1);
        assertThat(api.get("/alunos/" + aluno, admin, 200).get("tags").size()).isZero();
        assertThat(api.get("/alunos/" + aluno + "/exportacao", admin, 200).get("tags").get("itens").size()).isZero();
    }

    @Test
    void excluirMinhaContaApagaALigacaoEMantemATag() throws Exception {
        UUID aluno = api.criarAluno(admin, "Aluno Fictício que Sai");
        UUID tag = tagId(admin, "Retorno", "AZUL");
        marcar(admin, aluno, 200, tag);
        JsonNode loginDoAluno = api.convidarEEntrar(admin, aluno);
        api.post("/aluno/conta/excluir", loginDoAluno, Map.of("senha", ApiDeTeste.SENHA, "confirmacao", "EXCLUIR"), 204);
        assertThat(ligacoes(aluno)).isZero();
        assertThat(nomes(api.get("/tags-de-alunos", admin, 200))).containsExactly("Retorno");
        assertThat(api.get("/tags-de-alunos", admin, 200).get(0).get("totalAlunos").asLong()).isZero();
    }

    @Test
    void oAlunoNuncaVeAsTags() throws Exception {
        UUID aluno = api.criarAluno(admin, "Aluno Fictício");
        marcar(admin, aluno, 200, tagId(admin, SIGILO, "AZUL"));
        JsonNode loginDoAluno = api.convidarEEntrar(admin, aluno);
        for (String rota : new String[]{"/eu", "/aluno/painel", "/aluno/meus-dados", "/aluno/pastas", "/aluno/mobilidade",
                "/aluno/avaliacoes-fisicas", "/aluno/foto-perfil", "/aluno/comunidade", "/aluno/compromissos", "/aluno/anamnese"}) {
            var resposta = mvc.perform(MockMvcRequestBuilders.get(rota).header("X-Treinos-Cliente", "nativo")
                    .header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(loginDoAluno))).andReturn().getResponse();
            String texto = resposta.getContentAsString(StandardCharsets.UTF_8);
            assertThat(texto).as(rota).doesNotContain(SIGILO).doesNotContain("\"tags\"");
        }
        // O login do aluno também não leva nada disso.
        assertThat(loginDoAluno.toString()).doesNotContain(SIGILO).doesNotContain("\"tags\"");
    }

    @Test
    void auditoriaELogNuncaTemONomeDaTag() throws Exception {
        UUID aluno = api.criarAluno(admin, "Aluno Fictício");
        JsonNode tag = criarTag(admin, SIGILO, "AZUL");
        marcar(admin, aluno, 200, UUID.fromString(tag.get("id").asString()));
        api.put("/tags-de-alunos/" + tag.get("id").asString(), admin, corpo(SIGILO + " 2", "VIOLETA", tag.get("versao").asLong()), 200);
        api.post("/tags-de-alunos", admin, corpo(SIGILO + " 2", "AZUL", null), 409);
        api.post("/tags-de-alunos", admin, corpo("", "AZUL", null), 422);
        api.delete("/tags-de-alunos/" + tag.get("id").asString(), admin, 204);

        assertThat(auditorias("TAG_ALUNO_CRIADA")).isEqualTo(1);
        assertThat(auditorias("TAG_ALUNO_ALTERADA")).isEqualTo(1);
        assertThat(auditorias("TAG_ALUNO_APAGADA")).isEqualTo(1);
        assertThat(auditorias("ALUNO_TAGS_ALTERADAS")).isEqualTo(1);
        nadaVazou(SIGILO, "Sigilosa", "Marcadora");
    }
}
