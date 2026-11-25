package br.com.treinos.api.vitrine;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.equipe.CatalogoPermissoes;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * Categorias da vitrine (V099): CRUD com auditoria de resumo fixo, nome repetido sem caixa nem acento, teto de 30 (também sob
 * corrida), ordem pela lista completa, categoria no item (404 se de outra consultoria), excluir deixando os itens sem categoria,
 * isolamento (404), permissões e a ordem que o aluno vê. A vitrine desligada está em {@link VitrineDesligadaIntegrationTest}. Cada
 * teste nasce com consultoria própria (banco compartilhado) e só dados fictícios.
 */
@AutoConfigureMockMvc
class VitrineCategoriasIntegrationTest extends AbstractIntegrationTest {

    private static final String CATEGORIAS = "/vitrine/categorias";
    private static final String ITENS = "/vitrine/itens";

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;

    private ApiDeTeste api;
    private JsonNode admin;
    private UUID aluno;
    private JsonNode loginAluno;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        aluno = api.criarAluno(admin, "Aluno Fictício Categorias");
        loginAluno = api.convidarEEntrar(admin, aluno);
    }

    // ---- ajudantes ----

    private JsonNode categoria(JsonNode login, String nome) throws Exception {
        return api.post(CATEGORIAS, login, Map.of("nome", nome), 201);
    }

    private JsonNode categoria(String nome) throws Exception {
        return categoria(admin, nome);
    }

    private static UUID id(JsonNode no) {
        return UUID.fromString(no.get("id").asString());
    }

    private static Map<String, Object> item(String nome, UUID categoria) {
        Map<String, Object> c = new LinkedHashMap<>();
        c.put("nome", nome);
        c.put("tipo", "FISICO");
        c.put("precoCentavos", 10_000L);
        c.put("ativo", true);
        c.put("categoriaId", categoria);
        return c;
    }

    private JsonNode criarItem(String nome, UUID categoria) throws Exception {
        return api.post(ITENS, admin, item(nome, categoria), 200);
    }

    private List<UUID> ids(JsonNode lista) {
        List<UUID> ids = new ArrayList<>();
        lista.forEach(i -> ids.add(id(i)));
        return ids;
    }

    private List<String> nomes(JsonNode lista) {
        List<String> nomes = new ArrayList<>();
        lista.forEach(i -> nomes.add(i.get("nome").asString()));
        return nomes;
    }

    private int contar(String sql, Object... args) {
        return jdbc.queryForObject(sql, Integer.class, args);
    }

    private int auditorias(String acao) {
        return contar("select count(*) from auditoria where acao = ? and consultoria_id = ?", acao, consultoria());
    }

    private UUID consultoria() {
        return jdbc.queryForObject("select consultoria_id from aluno where id = ?", UUID.class, aluno);
    }

    private static boolean nulo(JsonNode no) {
        return no.isNull() || no.isMissingNode();
    }

    private JsonNode membro(Set<String> permissoes) throws Exception {
        String perfil = api.post("/perfis", admin,
                Map.of("nome", "Perfil " + UUID.randomUUID(), "permissoes", CatalogoPermissoes.comDependencias(permissoes)), 200)
                .get("id").asString();
        JsonNode convite = api.post("/usuarios/convites", admin,
                Map.of("nome", "Membro fictício", "email", ApiDeTeste.emailUnico("membro"), "perfilId", perfil), 200);
        return api.post("/publico/convites-equipe/aceitar", null,
                Map.of("codigo", convite.get("codigo").asString(), "senha", ApiDeTeste.SENHA), 200);
    }

    // ---- CRUD e auditoria ----

    @Test
    void criaListaRenomeiaEApagaComAuditoriaDeResumoFixo() throws Exception {
        JsonNode livros = categoria("  Livros fictícios  ");
        assertThat(livros.get("nome").asString()).isEqualTo("Livros fictícios");
        assertThat(livros.get("ordem").asInt()).isZero();
        assertThat(livros.get("quantidade").asLong()).isZero();
        JsonNode videos = categoria("Vídeos fictícios");
        assertThat(videos.get("ordem").asInt()).isEqualTo(1);

        JsonNode lista = api.get(CATEGORIAS, admin, 200);
        assertThat(ids(lista)).containsExactly(id(livros), id(videos));

        JsonNode renomeada = api.put(CATEGORIAS + "/" + id(livros), admin, Map.of("nome", "Livros e e-books fictícios"), 200);
        assertThat(renomeada.get("nome").asString()).isEqualTo("Livros e e-books fictícios");
        assertThat(renomeada.get("ordem").asInt()).isZero();
        // O mesmo nome de novo não grava nem audita.
        api.put(CATEGORIAS + "/" + id(livros), admin, Map.of("nome", "Livros e e-books fictícios"), 200);
        assertThat(auditorias("VITRINE_CATEGORIA_RENOMEADA")).isEqualTo(1);

        api.delete(CATEGORIAS + "/" + id(videos), admin, 204);
        assertThat(ids(api.get(CATEGORIAS, admin, 200))).containsExactly(id(livros));
        // Apagar de novo (ou id que nunca existiu) é 404, como o item.
        api.delete(CATEGORIAS + "/" + id(videos), admin, 404);
        api.delete(CATEGORIAS + "/" + UUID.randomUUID(), admin, 404);
        api.put(CATEGORIAS + "/" + id(videos), admin, Map.of("nome", "Qualquer"), 404);

        assertThat(auditorias("VITRINE_CATEGORIA_CRIADA")).isEqualTo(2);
        assertThat(auditorias("VITRINE_CATEGORIA_EXCLUIDA")).isEqualTo(1);
        List<String> resumos = jdbc.queryForList("select resumo from auditoria where acao like 'VITRINE_CATEGORIA_%' and consultoria_id = ?",
                String.class, consultoria());
        assertThat(resumos).hasSize(4).allSatisfy(r -> assertThat(r)
                .doesNotContain("Livros").doesNotContain("Vídeos").doesNotContain("fictício"));
    }

    // ---- validação ----

    @Test
    void nomeInvalidoDa422ComCampoESemRepetirOValor() throws Exception {
        JsonNode vazio = api.post(CATEGORIAS, admin, Map.of("nome", "   "), 422);
        assertThat(vazio.get("codigo").asString()).isEqualTo("VITRINE_CATEGORIA_INVALIDA");
        assertThat(vazio.get("fieldErrors").get(0).get("field").asString()).isEqualTo("nome");
        assertThat(vazio.get("fieldErrors").get(0).get("message").asString()).isEqualTo("Informe o nome da categoria.");

        String longo = "Segredo" + "x".repeat(40);
        JsonNode grande = api.post(CATEGORIAS, admin, Map.of("nome", longo), 422);
        assertThat(grande.get("fieldErrors").get(0).get("field").asString()).isEqualTo("nome");
        assertThat(grande.toString()).doesNotContain("Segredo");
        // 40 passa; 41 não.
        categoria("N".repeat(40));
        api.post(CATEGORIAS, admin, Map.of("nome", "M".repeat(41)), 422);

        api.post(CATEGORIAS, admin, Map.of("nome", "com\ncontrole"), 422);
        api.post(CATEGORIAS, admin, new LinkedHashMap<String, Object>(), 422);
        // Renomear também confere o nome.
        JsonNode ok = categoria("Nome válido fictício");
        api.put(CATEGORIAS + "/" + id(ok), admin, Map.of("nome", ""), 422);
        assertThat(api.get(CATEGORIAS, admin, 200)).hasSize(2);
    }

    @Test
    void nomeRepetidoComOutraCaixaOuAcentoDa409ComCampoEOutraConsultoriaPodeRepetir() throws Exception {
        JsonNode videos = categoria("Vídeo Aulas");
        JsonNode livros = categoria("Livros");
        for (String repetido : new String[]{"video aulas", "VÍDEO  AULAS", "Video  aulas "}) {
            JsonNode erro = api.post(CATEGORIAS, admin, Map.of("nome", repetido), 409);
            assertThat(erro.get("codigo").asString()).isEqualTo("VITRINE_CATEGORIA_DUPLICADA");
            assertThat(erro.get("fieldErrors").get(0).get("field").asString()).isEqualTo("nome");
            assertThat(erro.get("fieldErrors").get(0).get("message").asString()).isEqualTo("Já existe uma categoria com esse nome.");
            assertThat(erro.toString()).doesNotContain(repetido.strip());
        }
        // Renomear para o nome de outra: 409; para o próprio nome com outra caixa e acento: vale.
        api.put(CATEGORIAS + "/" + id(livros), admin, Map.of("nome", "vídeo aulas"), 409);
        JsonNode mesma = api.put(CATEGORIAS + "/" + id(videos), admin, Map.of("nome", "VIDEO AULAS"), 200);
        assertThat(mesma.get("nome").asString()).isEqualTo("VIDEO AULAS");
        assertThat(api.get(CATEGORIAS, admin, 200)).hasSize(2);

        // Outra consultoria tem a lista dela.
        categoria(api.novoTreinador(), "Vídeo Aulas");
    }

    @Test
    void nomeComEspacoInvisivelOuNaoQuebravelNaoCriaCategoriaEmBrancoNemEscapaDaUnicidade() throws Exception {
        // U+00A0, U+2007, U+202F e U+200B (formatação) não saem no strip() sozinho.
        for (String invisivel : new String[]{" ", "  ", "​", "  ​ "}) {
            JsonNode erro = api.post(CATEGORIAS, admin, Map.of("nome", invisivel), 422);
            assertThat(erro.get("fieldErrors").get(0).get("field").asString()).isEqualTo("nome");
        }
        assertThat(api.get(CATEGORIAS, admin, 200)).isEmpty();
        JsonNode livros = categoria("Livros");
        for (String repetido : new String[]{"Livros ", " Livros", "Livros​", "Livros ​"}) {
            api.post(CATEGORIAS, admin, Map.of("nome", repetido), 409);
        }
        // O nome gravado sai sem os invisíveis nas pontas.
        JsonNode criada = categoria(" Vídeos​");
        assertThat(criada.get("nome").asString()).isEqualTo("Vídeos");
        api.put(CATEGORIAS + "/" + id(criada), admin, Map.of("nome", "Livros "), 409);
        assertThat(api.get(CATEGORIAS, admin, 200)).hasSize(2);
        assertThat(id(livros)).isNotNull();
    }

    // ---- teto ----

    @Test
    void tetoDe30CategoriasPorConsultoria() throws Exception {
        JsonNode primeira = null;
        for (int i = 0; i < VitrineCategoriaService.LIMITE_DE_CATEGORIAS; i++) {
            JsonNode criada = categoria("Categoria fictícia " + i);
            primeira = primeira == null ? criada : primeira;
        }
        JsonNode erro = api.post(CATEGORIAS, admin, Map.of("nome", "Categoria de mais"), 409);
        assertThat(erro.get("codigo").asString()).isEqualTo("VITRINE_CATEGORIAS_LIMITE");
        assertThat(api.get(CATEGORIAS, admin, 200)).hasSize(30);

        // Outra consultoria tem o teto dela.
        categoria(api.novoTreinador(), "Categoria de outra consultoria");

        // Apagar abre vaga.
        api.delete(CATEGORIAS + "/" + id(primeira), admin, 204);
        categoria("Categoria depois do teto");
    }

    @Test
    void criacoesAoMesmoTempoRespeitamOTetoEDaoOrdensDiferentes() throws Exception {
        for (int i = 0; i < 25; i++) {
            categoria("Categoria fictícia " + i);
        }
        String bearer = ApiDeTeste.bearer(admin);
        int tentativas = 10;
        ExecutorService pool = Executors.newFixedThreadPool(tentativas);
        CountDownLatch largada = new CountDownLatch(1);
        List<Future<Integer>> resultados = new ArrayList<>();
        try {
            for (int i = 0; i < tentativas; i++) {
                String corpo = json.writeValueAsString(Map.of("nome", "Corrida fictícia " + i));
                Callable<Integer> tarefa = () -> {
                    largada.await();
                    return mvc.perform(post(CATEGORIAS).header(HttpHeaders.AUTHORIZATION, bearer).header("X-Treinos-Cliente", "nativo")
                            .contentType(MediaType.APPLICATION_JSON).content(corpo)).andReturn().getResponse().getStatus();
                };
                resultados.add(pool.submit(tarefa));
            }
            largada.countDown();
            int criadas = 0;
            int recusadas = 0;
            for (Future<Integer> r : resultados) {
                int status = r.get();
                criadas += status == 201 ? 1 : 0;
                recusadas += status == 409 ? 1 : 0;
            }
            assertThat(criadas).isEqualTo(5);
            assertThat(recusadas).isEqualTo(5);
        } finally {
            pool.shutdownNow();
        }
        JsonNode lista = api.get(CATEGORIAS, admin, 200);
        assertThat(lista).hasSize(30);
        assertThat(lista.valueStream().map(c -> c.get("ordem").asInt()).distinct().count()).isEqualTo(30);
    }

    // ---- ordem ----

    @Test
    void ordemExigeAListaCompletaERenumeraEAudita() throws Exception {
        UUID a = id(categoria("A fictícia"));
        UUID b = id(categoria("B fictícia"));
        UUID c = id(categoria("C fictícia"));
        assertThat(ids(api.get(CATEGORIAS, admin, 200))).containsExactly(a, b, c);

        api.put(CATEGORIAS + "/ordem", admin, Map.of("ids", List.of(c, a, b)), 204);
        JsonNode lista = api.get(CATEGORIAS, admin, 200);
        assertThat(ids(lista)).containsExactly(c, a, b);
        assertThat(lista.valueStream().map(n -> n.get("ordem").asInt()).toList()).containsExactly(0, 1, 2);
        assertThat(auditorias("VITRINE_CATEGORIAS_REORDENADAS")).isEqualTo(1);
        // A mesma ordem não grava nem audita.
        api.put(CATEGORIAS + "/ordem", admin, Map.of("ids", List.of(c, a, b)), 204);
        assertThat(auditorias("VITRINE_CATEGORIAS_REORDENADAS")).isEqualTo(1);

        // Lista incompleta ou com id desconhecido: 409; repetida ou ausente: 422. Nada muda.
        assertThat(api.put(CATEGORIAS + "/ordem", admin, Map.of("ids", List.of(a, b)), 409).get("codigo").asString())
                .isEqualTo("CONFLITO_EDICAO");
        api.put(CATEGORIAS + "/ordem", admin, Map.of("ids", List.of(a, b, c, UUID.randomUUID())), 409);
        api.put(CATEGORIAS + "/ordem", admin, Map.of("ids", List.of()), 409);
        assertThat(api.put(CATEGORIAS + "/ordem", admin, Map.of("ids", List.of(a, a, b)), 422).get("codigo").asString())
                .isEqualTo("VITRINE_CATEGORIA_INVALIDA");
        api.put(CATEGORIAS + "/ordem", admin, new LinkedHashMap<String, Object>(), 422);
        assertThat(ids(api.get(CATEGORIAS, admin, 200))).containsExactly(c, a, b);
    }

    // ---- categoria no item ----

    @Test
    void itemLevaACategoriaAListaSegueACategoriaDepoisOItemESemCategoriaPorUltimo() throws Exception {
        UUID livros = id(categoria("Livros"));
        UUID videos = id(categoria("Vídeos"));
        JsonNode soltoAntes = criarItem("Solto 1", null);
        JsonNode emVideos = criarItem("Vídeo 1", videos);
        criarItem("Livro 1", livros);
        criarItem("Vídeo 2", videos);
        criarItem("Solto 2", null);
        criarItem("Livro 2", livros);

        assertThat(nulo(soltoAntes.path("categoriaId"))).isTrue();
        assertThat(nulo(soltoAntes.path("categoriaNome"))).isTrue();
        assertThat(emVideos.get("categoriaId").asString()).isEqualTo(videos.toString());
        assertThat(emVideos.get("categoriaNome").asString()).isEqualTo("Vídeos");

        // Categorias na ordem (Livros, Vídeos), dentro de cada uma a ordem do item, sem categoria por último.
        JsonNode lista = api.get(ITENS, admin, 200);
        assertThat(nomes(lista)).containsExactly("Livro 1", "Livro 2", "Vídeo 1", "Vídeo 2", "Solto 1", "Solto 2");
        assertThat(lista.get(0).get("categoriaNome").asString()).isEqualTo("Livros");
        assertThat(nulo(lista.get(5).path("categoriaId"))).isTrue();

        // Quantidade por categoria (itens ativos e inativos).
        Map<String, Object> inativo = item("Livro 3 inativo", livros);
        inativo.put("ativo", false);
        api.post(ITENS, admin, inativo, 200);
        JsonNode contagens = api.get(CATEGORIAS, admin, 200);
        assertThat(contagens.get(0).get("quantidade").asLong()).isEqualTo(3);
        assertThat(contagens.get(1).get("quantidade").asLong()).isEqualTo(2);

        // Reordenar as categorias reordena a lista dos itens.
        api.put(CATEGORIAS + "/ordem", admin, Map.of("ids", List.of(videos, livros)), 204);
        assertThat(nomes(api.get(ITENS, admin, 200))).startsWith("Vídeo 1", "Vídeo 2", "Livro 1");

        // Trocar a categoria do item, e tirar (o PUT grava o estado inteiro: sem categoriaId = sem categoria).
        Map<String, Object> troca = item("Vídeo 1", livros);
        troca.put("versao", emVideos.get("versao").asLong());
        JsonNode trocado = api.put(ITENS + "/" + id(emVideos), admin, troca, 200);
        assertThat(trocado.get("categoriaNome").asString()).isEqualTo("Livros");
        Map<String, Object> tira = item("Vídeo 1", null);
        tira.put("versao", trocado.get("versao").asLong());
        JsonNode tirado = api.put(ITENS + "/" + id(emVideos), admin, tira, 200);
        assertThat(nulo(tirado.path("categoriaId"))).isTrue();
        assertThat(nulo(tirado.path("categoriaNome"))).isTrue();
    }

    @Test
    void categoriaDeOutraConsultoriaOuInexistenteNoItemDa422IgualENadaMuda() throws Exception {
        JsonNode outro = api.novoTreinador();
        UUID deOutro = id(categoria(outro, "Categoria da outra"));
        UUID minha = id(categoria("Minha categoria"));

        // A mesma resposta (422 em categoriaId, mensagem fixa) para outra consultoria e para inexistente: nunca revela a diferença.
        JsonNode alheia = api.post(ITENS, admin, item("Item com categoria alheia", deOutro), 422);
        JsonNode inexistente = api.post(ITENS, admin, item("Item com categoria inexistente", UUID.randomUUID()), 422);
        assertThat(alheia.get("codigo").asString()).isEqualTo("VITRINE_ITEM_INVALIDO");
        assertThat(alheia.get("fieldErrors").get(0).get("field").asString()).isEqualTo("categoriaId");
        assertThat(alheia.get("fieldErrors").get(0).get("message").asString()).isEqualTo("Categoria não encontrada.");
        assertThat(inexistente.get("fieldErrors").toString()).isEqualTo(alheia.get("fieldErrors").toString());
        assertThat(inexistente.get("message").asString()).isEqualTo(alheia.get("message").asString());
        assertThat(api.get(ITENS, admin, 200)).isEmpty();

        JsonNode criado = criarItem("Item fictício", minha);
        Map<String, Object> troca = item("Item fictício", deOutro);
        troca.put("versao", criado.get("versao").asLong());
        assertThat(api.put(ITENS + "/" + id(criado), admin, troca, 422).get("fieldErrors").get(0).get("field").asString()).isEqualTo("categoriaId");
        JsonNode depois = api.get(ITENS, admin, 200).get(0);
        assertThat(depois.get("categoriaId").asString()).isEqualTo(minha.toString());
        assertThat(depois.get("versao").asLong()).isEqualTo(criado.get("versao").asLong());
    }

    // ---- excluir ----

    @Test
    void excluirACategoriaDeixaOsItensSemCategoriaENaoApagaItem() throws Exception {
        UUID livros = id(categoria("Livros"));
        UUID videos = id(categoria("Vídeos"));
        UUID livro1 = id(criarItem("Livro 1", livros));
        UUID livro2 = id(criarItem("Livro 2", livros));
        UUID video = id(criarItem("Vídeo 1", videos));

        api.delete(CATEGORIAS + "/" + livros, admin, 204);

        JsonNode lista = api.get(ITENS, admin, 200);
        assertThat(lista).hasSize(3);
        Map<UUID, JsonNode> porId = new LinkedHashMap<>();
        lista.forEach(i -> porId.put(id(i), i));
        assertThat(nulo(porId.get(livro1).path("categoriaId"))).isTrue();
        assertThat(nulo(porId.get(livro2).path("categoriaNome"))).isTrue();
        assertThat(porId.get(video).get("categoriaId").asString()).isEqualTo(videos.toString());
        // Com categoria primeiro, os soltos depois.
        assertThat(id(lista.get(0))).isEqualTo(video);
        assertThat(contar("select count(*) from vitrine_item where id in (?, ?, ?) and consultoria_id = ?", livro1, livro2, video,
                consultoria())).isEqualTo(3);
        JsonNode contagens = api.get(CATEGORIAS, admin, 200);
        assertThat(contagens).hasSize(1);
        assertThat(contagens.get(0).get("quantidade").asLong()).isEqualTo(1);
        // O aluno vê os itens apagados da categoria sem categoria.
        assertThat(nulo(api.get("/aluno/vitrine", loginAluno, 200).get(1).path("categoria"))).isTrue();
    }

    // ---- outra consultoria ----

    @Test
    void outraConsultoriaDa404EmTodasAsRotasENaoEnxergaAsCategorias() throws Exception {
        UUID minha = id(categoria("Minha categoria isolada"));
        UUID segunda = id(categoria("Segunda isolada"));
        JsonNode outro = api.novoTreinador();

        api.put(CATEGORIAS + "/" + minha, outro, Map.of("nome", "Tentativa fictícia"), 404);
        api.delete(CATEGORIAS + "/" + minha, outro, 404);
        assertThat(api.get(CATEGORIAS, outro, 200)).isEmpty();
        // A lista que ele manda na ordem não bate com a dele (vazia): 409, e a minha ordem não muda.
        api.put(CATEGORIAS + "/ordem", outro, Map.of("ids", List.of(segunda, minha)), 409);
        // Nem como categoria de item (422 em categoriaId, igual ao inexistente).
        api.post(ITENS, outro, item("Item de outra consultoria", minha), 422);

        JsonNode lista = api.get(CATEGORIAS, admin, 200);
        assertThat(ids(lista)).containsExactly(minha, segunda);
        assertThat(lista.get(0).get("nome").asString()).isEqualTo("Minha categoria isolada");
    }

    // ---- aluno ----

    @Test
    void alunoVeSoOsAtivosComACategoriaNaOrdemDefinida() throws Exception {
        UUID livros = id(categoria("Livros"));
        UUID videos = id(categoria("Vídeos"));
        UUID soInativos = id(categoria("Só inativos"));
        criarItem("Solto", null);
        criarItem("Vídeo A", videos);
        criarItem("Livro A", livros);
        criarItem("Vídeo B", videos);
        Map<String, Object> inativo = item("Item inativo", soInativos);
        inativo.put("ativo", false);
        api.post(ITENS, admin, inativo, 200);

        JsonNode lista = api.get("/aluno/vitrine", loginAluno, 200);
        assertThat(nomes(lista)).containsExactly("Livro A", "Vídeo A", "Vídeo B", "Solto");
        JsonNode categoria = lista.get(0).get("categoria");
        assertThat(categoria.get("id").asString()).isEqualTo(livros.toString());
        assertThat(categoria.get("nome").asString()).isEqualTo("Livros");
        assertThat(categoria.get("ordem").asInt()).isZero();
        assertThat(lista.get(1).get("categoria").get("ordem").asInt()).isEqualTo(1);
        assertThat(nulo(lista.get(3).path("categoria"))).isTrue();
        // A categoria do item inativo não aparece para o aluno.
        assertThat(lista.toString()).doesNotContain("Só inativos");

        api.put(CATEGORIAS + "/ordem", admin, Map.of("ids", List.of(videos, soInativos, livros)), 204);
        assertThat(nomes(api.get("/aluno/vitrine", loginAluno, 200))).containsExactly("Vídeo A", "Vídeo B", "Livro A", "Solto");
        // O aluno não usa as rotas de categoria da equipe.
        api.get(CATEGORIAS, loginAluno, 403);
        api.post(CATEGORIAS, loginAluno, Map.of("nome", "Tentativa do aluno"), 403);
    }

    // ---- permissões ----

    @Test
    void permissoesLerEAlterarSaoSeparadas() throws Exception {
        UUID existente = id(categoria("Categoria fictícia permissões"));

        JsonNode leitor = membro(Set.of("VITRINE_LER"));
        assertThat(api.get(CATEGORIAS, leitor, 200)).hasSize(1);
        api.post(CATEGORIAS, leitor, Map.of("nome", "Tentativa"), 403);
        api.put(CATEGORIAS + "/" + existente, leitor, Map.of("nome", "Tentativa"), 403);
        api.delete(CATEGORIAS + "/" + existente, leitor, 403);
        api.put(CATEGORIAS + "/ordem", leitor, Map.of("ids", List.of(existente)), 403);
        assertThat(api.get(CATEGORIAS, admin, 200)).hasSize(1);

        api.get(CATEGORIAS, membro(Set.of("TREINO_LER")), 403);

        // ALTERAR puxa LER (comDependencias): o membro cria e apaga.
        JsonNode alterador = membro(Set.of("VITRINE_ALTERAR"));
        UUID criada = id(api.post(CATEGORIAS, alterador, Map.of("nome", "Criada pelo membro"), 201));
        api.delete(CATEGORIAS + "/" + criada, alterador, 204);
    }
}
