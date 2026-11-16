package br.com.treinos.api.vitrine;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.auth.LimiteTentativas;
import br.com.treinos.api.equipe.CatalogoPermissoes;
import br.com.treinos.api.fotos.FotosDeTeste;
import br.com.treinos.api.web.Fuso;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.MemoryCacheImageOutputStream;
import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Vitrine da consultoria (F1.1): CRUD com versão, isolamento (404), permissões, teto de itens, preço vigente, validação, ordem,
 * foto e o que o aluno vê. Cada teste nasce com consultoria própria (banco compartilhado) e só dados fictícios.
 */
@AutoConfigureMockMvc
class VitrineIntegrationTest extends AbstractIntegrationTest {

    private static final String ITENS = "/vitrine/itens";

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private LimiteTentativas limite;

    private ApiDeTeste api;
    private JsonNode admin;
    private UUID aluno;
    private JsonNode loginAluno;
    private final LocalDate hoje = LocalDate.now(Fuso.BRASILIA);

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        aluno = api.criarAluno(admin, "Aluno Fictício Vitrine");
        loginAluno = api.convidarEEntrar(admin, aluno);
    }

    // ---- ajudantes ----

    private static Map<String, Object> corpo(String nome) {
        Map<String, Object> c = new LinkedHashMap<>();
        c.put("nome", nome);
        c.put("tipo", "FISICO");
        c.put("precoCentavos", 10_000L);
        c.put("ativo", true);
        return c;
    }

    private JsonNode criar(String nome) throws Exception {
        return api.post(ITENS, admin, corpo(nome), 200);
    }

    private UUID id(JsonNode item) {
        return UUID.fromString(item.get("id").asString());
    }

    private int contar(String sql, Object... args) {
        return jdbc.queryForObject(sql, Integer.class, args);
    }

    private int auditorias(String acao, UUID item) {
        return contar("select count(*) from auditoria where acao = ? and entidade_id = ?", acao, item);
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

    private MvcResult enviarFoto(JsonNode login, UUID item, byte[] bytes, int esperado) throws Exception {
        return mvc.perform(multipart(HttpMethod.PUT, ITENS + "/" + item + "/foto")
                        .file(new MockMultipartFile("arquivo", "foto.jpg", "image/jpeg", bytes))
                        .header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(login)))
                .andExpect(status().is(esperado)).andReturn();
    }

    private MvcResult lerFoto(String caminho, JsonNode login, int esperado) throws Exception {
        return mvc.perform(get(caminho).header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(login)))
                .andExpect(status().is(esperado)).andReturn();
    }

    private void apagarFoto(JsonNode login, UUID item, int esperado) throws Exception {
        mvc.perform(delete(ITENS + "/" + item + "/foto").header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(login)))
                .andExpect(status().is(esperado));
    }

    private List<UUID> ordemDaLista() throws Exception {
        List<UUID> ids = new ArrayList<>();
        api.get(ITENS, admin, 200).forEach(i -> ids.add(UUID.fromString(i.get("id").asString())));
        return ids;
    }

    /** JPEG de ruído que, mesmo sem metadados, passa de 300 KB, mas cabe no limite do corpo. */
    private static byte[] jpegPesado() throws Exception {
        BufferedImage imagem = new BufferedImage(800, 800, BufferedImage.TYPE_INT_RGB);
        Random sorteio = new Random(7);
        for (int y = 0; y < 800; y++) {
            for (int x = 0; x < 800; x++) {
                imagem.setRGB(x, y, sorteio.nextInt(0x1000000));
            }
        }
        ImageWriter escritor = ImageIO.getImageWritersByFormatName("jpeg").next();
        ImageWriteParam parametros = escritor.getDefaultWriteParam();
        parametros.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
        parametros.setCompressionQuality(0.9f);
        ByteArrayOutputStream saida = new ByteArrayOutputStream();
        try (MemoryCacheImageOutputStream fluxo = new MemoryCacheImageOutputStream(saida)) {
            escritor.setOutput(fluxo);
            escritor.write(null, new IIOImage(imagem, null, null), parametros);
        } finally {
            escritor.dispose();
        }
        return saida.toByteArray();
    }

    // ---- CRUD, versão e auditoria ----

    @Test
    void criaListaAlteraEApagaComVersaoEAuditoriaDeResumoFixo() throws Exception {
        Map<String, Object> c = corpo("Planilha Fictícia 12 semanas");
        c.put("descricao", "  Texto fictício  ");
        c.put("cupom", " BEMVINDO ");
        c.put("linkUrl", "https://loja.exemplo.com.br/planilha?x=segredo");
        JsonNode criado = api.post(ITENS, admin, c, 200);
        UUID item = id(criado);
        assertThat(criado.get("ordem").asInt()).isZero();
        assertThat(criado.get("versao").asLong()).isZero();
        assertThat(criado.get("descricao").asString()).isEqualTo("Texto fictício");
        assertThat(criado.get("cupom").asString()).isEqualTo("BEMVINDO");
        assertThat(criado.get("precoVigenteCentavos").asLong()).isEqualTo(10_000L);
        assertThat(criado.get("temFoto").asBoolean()).isFalse();
        assertThat(nulo(criado.path("fotoAtualizadaEm"))).isTrue();

        JsonNode lista = api.get(ITENS, admin, 200);
        assertThat(lista).hasSize(1);
        assertThat(lista.get(0).get("id").asString()).isEqualTo(item.toString());

        Map<String, Object> novo = corpo("Planilha Fictícia 16 semanas");
        novo.put("versao", 0);
        JsonNode alterado = api.put(ITENS + "/" + item, admin, novo, 200);
        assertThat(alterado.get("nome").asString()).isEqualTo("Planilha Fictícia 16 semanas");
        assertThat(alterado.get("versao").asLong()).isEqualTo(1);
        assertThat(nulo(alterado.path("cupom"))).isTrue();

        // Versão velha, ausente: 409 e nada muda.
        novo.put("nome", "Outro nome fictício");
        assertThat(api.put(ITENS + "/" + item, admin, novo, 409).get("codigo").asString()).isEqualTo("CONFLITO_EDICAO");
        novo.remove("versao");
        assertThat(api.put(ITENS + "/" + item, admin, novo, 409).get("codigo").asString()).isEqualTo("CONFLITO_EDICAO");
        assertThat(api.get(ITENS, admin, 200).get(0).get("nome").asString()).isEqualTo("Planilha Fictícia 16 semanas");
        assertThat(api.delete(ITENS + "/" + item + "?versao=0", admin, 409).get("codigo").asString()).isEqualTo("CONFLITO_EDICAO");
        assertThat(api.delete(ITENS + "/" + item, admin, 409).get("codigo").asString()).isEqualTo("CONFLITO_EDICAO");

        api.delete(ITENS + "/" + item + "?versao=1", admin, 204);
        assertThat(api.get(ITENS, admin, 200)).isEmpty();
        novo.put("versao", 1);
        api.put(ITENS + "/" + item, admin, novo, 404);

        assertThat(auditorias("VITRINE_ITEM_CRIADO", item)).isEqualTo(1);
        assertThat(auditorias("VITRINE_ITEM_ALTERADO", item)).isEqualTo(1);
        assertThat(auditorias("VITRINE_ITEM_EXCLUIDO", item)).isEqualTo(1);
        List<String> resumos = jdbc.queryForList("select resumo from auditoria where entidade_id = ?", String.class, item);
        assertThat(resumos).hasSize(3).allSatisfy(r -> assertThat(r)
                .doesNotContain("Planilha").doesNotContain("BEMVINDO").doesNotContain("segredo").doesNotContain("loja.exemplo"));
    }

    // ---- validação ----

    @Test
    void corpoInvalidoDa422ComCampoESemRepetirOValor() throws Exception {
        Map<String, Object> c = corpo("");
        c.put("linkUrl", "http://loja.exemplo.com.br/segredo");
        c.put("cupom", "CUPOM-" + "x".repeat(40));
        c.put("precoEspecialCentavos", 20_000L);
        JsonNode erro = api.post(ITENS, admin, c, 422);
        assertThat(erro.get("codigo").asString()).isEqualTo("VITRINE_ITEM_INVALIDO");
        List<String> campos = new ArrayList<>();
        erro.get("fieldErrors").forEach(e -> campos.add(e.get("field").asString()));
        assertThat(campos).contains("nome", "linkUrl", "cupom", "precoEspecialCentavos");
        assertThat(erro.toString()).doesNotContain("segredo").doesNotContain("CUPOM-");
        assertThat(contar("select count(*) from vitrine_item where consultoria_id = ?", consultoria())).isZero();

        // Link https passa; especial com data sem especial, não.
        Map<String, Object> ok = corpo("Item fictício");
        ok.put("linkUrl", "https://loja.exemplo.com.br/x");
        api.post(ITENS, admin, ok, 200);
        Map<String, Object> semEspecial = corpo("Outro fictício");
        semEspecial.put("especialAte", hoje.toString());
        JsonNode data = api.post(ITENS, admin, semEspecial, 422);
        assertThat(data.get("fieldErrors").get(0).get("field").asString()).isEqualTo("especialAte");

        // Tipo e ativo são obrigatórios.
        Map<String, Object> semTipo = corpo("Sem tipo fictício");
        semTipo.remove("tipo");
        semTipo.remove("ativo");
        JsonNode obrigatorios = api.post(ITENS, admin, semTipo, 422);
        List<String> faltando = new ArrayList<>();
        obrigatorios.get("fieldErrors").forEach(e -> faltando.add(e.get("field").asString()));
        assertThat(faltando).containsExactlyInAnyOrder("tipo", "ativo");
    }

    // ---- preço vigente (virada do dia de Brasília) ----

    @Test
    void precoVigenteVaiDoEspecialAteOFimDoDiaDaValidade() throws Exception {
        UUID amanha = precoEspecial("Amanhã", hoje.plusDays(1));
        UUID hojeItem = precoEspecial("Hoje", hoje);
        UUID ontem = precoEspecial("Ontem", hoje.minusDays(1));
        UUID semFim = precoEspecial("Sem fim", null);

        Map<UUID, JsonNode> porId = new LinkedHashMap<>();
        api.get(ITENS, admin, 200).forEach(i -> porId.put(UUID.fromString(i.get("id").asString()), i));
        assertThat(porId.get(amanha).get("precoVigenteCentavos").asLong()).isEqualTo(8_000L);
        assertThat(porId.get(hojeItem).get("precoVigenteCentavos").asLong()).isEqualTo(8_000L);
        assertThat(porId.get(ontem).get("precoVigenteCentavos").asLong()).isEqualTo(10_000L);
        assertThat(porId.get(semFim).get("precoVigenteCentavos").asLong()).isEqualTo(8_000L);
        // A equipe sempre vê os dois preços e a data, mesmo a do especial encerrado.
        assertThat(porId.get(ontem).get("precoEspecialCentavos").asLong()).isEqualTo(8_000L);
        assertThat(porId.get(ontem).get("especialAte").asString()).isEqualTo(hoje.minusDays(1).toString());

        // O aluno só recebe a data quando o especial vale.
        Map<UUID, JsonNode> doAluno = new LinkedHashMap<>();
        api.get("/aluno/vitrine", loginAluno, 200).forEach(i -> doAluno.put(UUID.fromString(i.get("id").asString()), i));
        assertThat(doAluno.get(amanha).get("precoVigenteCentavos").asLong()).isEqualTo(8_000L);
        assertThat(doAluno.get(amanha).get("especialAte").asString()).isEqualTo(hoje.plusDays(1).toString());
        assertThat(doAluno.get(ontem).get("precoVigenteCentavos").asLong()).isEqualTo(10_000L);
        assertThat(nulo(doAluno.get(ontem).path("especialAte"))).isTrue();
        assertThat(nulo(doAluno.get(semFim).path("especialAte"))).isTrue();
        assertThat(doAluno.get(semFim).get("precoVigenteCentavos").asLong()).isEqualTo(8_000L);
    }

    private UUID precoEspecial(String nome, LocalDate ate) throws Exception {
        Map<String, Object> c = corpo(nome);
        c.put("precoEspecialCentavos", 8_000L);
        c.put("especialAte", ate == null ? null : ate.toString());
        return id(api.post(ITENS, admin, c, 200));
    }

    @Test
    void itemSemPrecoNaoTemPrecoVigente() throws Exception {
        Map<String, Object> c = corpo("Sem preço fictício");
        c.put("precoCentavos", null);
        JsonNode criado = api.post(ITENS, admin, c, 200);
        assertThat(nulo(criado.path("precoVigenteCentavos"))).isTrue();
        assertThat(nulo(api.get("/aluno/vitrine", loginAluno, 200).get(0).path("precoVigenteCentavos"))).isTrue();
    }

    // ---- teto ----

    @Test
    void tetoDe30ItensPorConsultoria() throws Exception {
        JsonNode primeiro = null;
        for (int i = 0; i < VitrineService.LIMITE_DE_ITENS; i++) {
            JsonNode criado = criar("Item fictício " + i);
            primeiro = primeiro == null ? criado : primeiro;
        }
        assertThat(api.post(ITENS, admin, corpo("Item de mais"), 409).get("codigo").asString()).isEqualTo("VITRINE_LIMITE");
        assertThat(api.get(ITENS, admin, 200)).hasSize(30);

        // Outra consultoria tem o teto dela.
        api.post(ITENS, api.novoTreinador(), corpo("Item de outra consultoria"), 200);

        // Apagar abre vaga.
        api.delete(ITENS + "/" + id(primeiro) + "?versao=" + primeiro.get("versao").asLong(), admin, 204);
        api.post(ITENS, admin, corpo("Item depois do teto"), 200);
    }

    // ---- ordem ----

    @Test
    void ordemPelaListaDeIdsRenumeraEAudita() throws Exception {
        UUID a = id(criar("A fictício"));
        UUID b = id(criar("B fictício"));
        UUID c = id(criar("C fictício"));
        assertThat(ordemDaLista()).containsExactly(a, b, c);
        assertThat(api.get(ITENS, admin, 200).get(2).get("ordem").asInt()).isEqualTo(2);

        api.put(ITENS + "/ordem", admin, Map.of("ids", List.of(a, c, b)), 204);
        assertThat(ordemDaLista()).containsExactly(a, c, b);
        assertThat(api.get(ITENS, admin, 200).get(1).get("ordem").asInt()).isEqualTo(1);
        assertThat(contar("select count(*) from auditoria where acao = 'VITRINE_ITEM_ORDEM_ALTERADA' and consultoria_id = ?",
                consultoria())).isEqualTo(1);

        // Ordem igual à gravada: sem efeito e sem outra linha de auditoria.
        api.put(ITENS + "/ordem", admin, Map.of("ids", List.of(a, c, b)), 204);
        assertThat(contar("select count(*) from auditoria where acao = 'VITRINE_ITEM_ORDEM_ALTERADA' and consultoria_id = ?",
                consultoria())).isEqualTo(1);

        // A ordem vale também para o aluno (só os ativos).
        List<String> doAluno = new ArrayList<>();
        api.get("/aluno/vitrine", loginAluno, 200).forEach(i -> doAluno.add(i.get("id").asString()));
        assertThat(doAluno).containsExactly(a.toString(), c.toString(), b.toString());

        // Faltando um, sobrando um (de outra consultoria) ou repetido: nada muda.
        assertThat(api.put(ITENS + "/ordem", admin, Map.of("ids", List.of(a, c)), 409).get("codigo").asString())
                .isEqualTo("CONFLITO_EDICAO");
        JsonNode outro = api.novoTreinador();
        UUID deOutro = id(api.post(ITENS, outro, corpo("Item de outra consultoria"), 200));
        assertThat(api.put(ITENS + "/ordem", admin, Map.of("ids", List.of(a, c, b, deOutro)), 409).get("codigo").asString())
                .isEqualTo("CONFLITO_EDICAO");
        assertThat(api.put(ITENS + "/ordem", admin, Map.of("ids", List.of(a, a, c)), 422).get("codigo").asString())
                .isEqualTo("VITRINE_ITEM_INVALIDO");
        Map<String, Object> semIds = new LinkedHashMap<>();
        semIds.put("ids", null);
        api.put(ITENS + "/ordem", admin, semIds, 422);
        assertThat(ordemDaLista()).containsExactly(a, c, b);
        assertThat(ordemDaLista()).doesNotContain(deOutro);
    }

    // ---- isolamento e permissões ----

    @Test
    void outraConsultoriaDa404ENaoEnxergaOsItens() throws Exception {
        UUID item = id(criar("Item fictício isolado"));
        enviarFoto(admin, item, FotosDeTeste.jpeg(Color.BLUE), 200);
        JsonNode outro = api.novoTreinador();
        Map<String, Object> c = corpo("Tentativa fictícia");
        c.put("versao", 0);
        api.put(ITENS + "/" + item, outro, c, 404);
        api.delete(ITENS + "/" + item + "?versao=0", outro, 404);
        enviarFoto(outro, item, FotosDeTeste.jpeg(Color.RED), 404);
        apagarFoto(outro, item, 404);
        lerFoto(ITENS + "/" + item + "/foto", outro, 404);
        assertThat(api.get(ITENS, outro, 200)).isEmpty();

        // O aluno de outra consultoria também não vê o item nem a foto.
        UUID alunoDeOutro = api.criarAluno(outro, "Aluno Fictício Outra");
        JsonNode loginDeOutro = api.convidarEEntrar(outro, alunoDeOutro);
        assertThat(api.get("/aluno/vitrine", loginDeOutro, 200)).isEmpty();
        lerFoto("/aluno/vitrine/itens/" + item + "/foto", loginDeOutro, 404);

        assertThat(api.get(ITENS, admin, 200)).hasSize(1);
        assertThat(contar("select count(*) from vitrine_item_foto where item_id = ?", item)).isEqualTo(1);
    }

    @Test
    void permissoesLerEAlterarSaoSeparadasEOAlunoNaoUsaARotaDaEquipe() throws Exception {
        UUID item = id(criar("Item fictício permissões"));
        enviarFoto(admin, item, FotosDeTeste.jpeg(Color.GREEN), 200);

        JsonNode leitor = membro(Set.of("VITRINE_LER"));
        assertThat(api.get(ITENS, leitor, 200)).hasSize(1);
        lerFoto(ITENS + "/" + item + "/foto", leitor, 200);
        Map<String, Object> c = corpo("Tentativa");
        c.put("versao", 0);
        api.post(ITENS, leitor, corpo("Tentativa"), 403);
        api.put(ITENS + "/" + item, leitor, c, 403);
        api.delete(ITENS + "/" + item + "?versao=0", leitor, 403);
        api.put(ITENS + "/ordem", leitor, Map.of("ids", List.of(item)), 403);
        enviarFoto(leitor, item, FotosDeTeste.jpeg(Color.RED), 403);
        apagarFoto(leitor, item, 403);
        assertThat(api.get(ITENS, admin, 200)).hasSize(1);

        JsonNode semVitrine = membro(Set.of("TREINO_LER"));
        api.get(ITENS, semVitrine, 403);
        lerFoto(ITENS + "/" + item + "/foto", semVitrine, 403);

        // ALTERAR puxa LER (comDependencias): o membro cria itens.
        JsonNode alterador = membro(Set.of("VITRINE_ALTERAR"));
        api.post(ITENS, alterador, corpo("Criado pelo membro"), 200);

        // Aluno nas rotas da equipe e equipe nas rotas do aluno: 403.
        api.get(ITENS, loginAluno, 403);
        api.post(ITENS, loginAluno, corpo("Tentativa do aluno"), 403);
        api.get("/aluno/vitrine", admin, 403);
    }

    @Test
    void treinadorPadraoDeConsultoriaNovaTemAsPermissoesENutricionistaEAssistenteNao() {
        UUID consultoria = consultoria();
        assertThat(contar("select count(*) from perfil_permissao pp join perfil p on p.id = pp.perfil_id"
                + " where p.consultoria_id = ? and p.nome = 'Treinador' and pp.codigo in ('VITRINE_LER', 'VITRINE_ALTERAR')",
                consultoria)).isEqualTo(2);
        assertThat(contar("select count(*) from perfil_permissao pp join perfil p on p.id = pp.perfil_id"
                + " where p.consultoria_id = ? and p.nome in ('Nutricionista', 'Assistente')"
                + " and pp.codigo in ('VITRINE_LER', 'VITRINE_ALTERAR')", consultoria)).isZero();
    }

    // ---- aluno ----

    @Test
    void alunoVeSoOsAtivosSemCamposDeEdicao() throws Exception {
        UUID ativo = id(criar("Ativo fictício"));
        Map<String, Object> c = corpo("Inativo fictício");
        c.put("ativo", false);
        UUID inativo = id(api.post(ITENS, admin, c, 200));

        JsonNode lista = api.get("/aluno/vitrine", loginAluno, 200);
        assertThat(lista).hasSize(1);
        JsonNode visto = lista.get(0);
        assertThat(visto.get("id").asString()).isEqualTo(ativo.toString());
        assertThat(visto.has("versao")).isFalse();
        assertThat(visto.has("ordem")).isFalse();
        assertThat(visto.has("ativo")).isFalse();
        assertThat(visto.get("temFoto").asBoolean()).isFalse();
        // A equipe vê os dois.
        assertThat(api.get(ITENS, admin, 200)).hasSize(2);

        // Foto: só de item ativo e que tem foto; o resto é o mesmo 404.
        lerFoto("/aluno/vitrine/itens/" + ativo + "/foto", loginAluno, 404);
        enviarFoto(admin, ativo, FotosDeTeste.jpeg(Color.ORANGE), 200);
        enviarFoto(admin, inativo, FotosDeTeste.jpeg(Color.ORANGE), 200);
        MvcResult foto = lerFoto("/aluno/vitrine/itens/" + ativo + "/foto", loginAluno, 200);
        assertThat(foto.getResponse().getContentAsByteArray()).isNotEmpty();
        assertThat(foto.getResponse().getHeader(HttpHeaders.CACHE_CONTROL)).contains("no-store");
        lerFoto("/aluno/vitrine/itens/" + inativo + "/foto", loginAluno, 404);
        lerFoto("/aluno/vitrine/itens/" + UUID.randomUUID() + "/foto", loginAluno, 404);
        assertThat(api.get("/aluno/vitrine", loginAluno, 200).get(0).get("temFoto").asBoolean()).isTrue();
    }

    // ---- foto ----

    @Test
    void fotoSemMetadadosUmaPorItemTrocaERemoveComAuditoria() throws Exception {
        UUID item = id(criar("Item fictício foto"));
        lerFoto(ITENS + "/" + item + "/foto", admin, 404);

        byte[] suja = FotosDeTeste.comMetadados(FotosDeTeste.jpeg(Color.BLUE));
        assertThat(FotosDeTeste.contem(suja, FotosDeTeste.MARCA_EXIF)).isTrue();
        JsonNode resposta = api.ler(enviarFoto(admin, item, suja, 200));
        assertThat(resposta.get("id").asString()).isEqualTo(item.toString());
        assertThat(resposta.get("temFoto").asBoolean()).isTrue();
        assertThat(resposta.get("fotoAtualizadaEm").asString()).isNotBlank();
        MvcResult baixada = lerFoto(ITENS + "/" + item + "/foto", admin, 200);
        assertThat(FotosDeTeste.contem(baixada.getResponse().getContentAsByteArray(), FotosDeTeste.MARCA_EXIF)).isFalse();
        assertThat(baixada.getResponse().getHeader(HttpHeaders.CACHE_CONTROL)).contains("no-store");
        assertThat(api.get(ITENS, admin, 200).get(0).get("temFoto").asBoolean()).isTrue();

        // Trocar substitui (uma por item).
        enviarFoto(admin, item, FotosDeTeste.jpeg(Color.GREEN), 200);
        assertThat(contar("select count(*) from vitrine_item_foto where item_id = ?", item)).isEqualTo(1);
        assertThat(auditorias("VITRINE_ITEM_FOTO_ALTERADA", item)).isEqualTo(2);
        assertThat(jdbc.queryForObject("select resumo from auditoria where acao = 'VITRINE_ITEM_FOTO_ALTERADA' and entidade_id = ? limit 1",
                String.class, item)).isEqualTo("Trocou a foto de um item da vitrine.");

        apagarFoto(admin, item, 204);
        assertThat(contar("select count(*) from vitrine_item_foto where item_id = ?", item)).isZero();
        lerFoto(ITENS + "/" + item + "/foto", admin, 404);
        assertThat(auditorias("VITRINE_ITEM_FOTO_REMOVIDA", item)).isEqualTo(1);
        // Sem foto, apagar é idempotente e não audita de novo.
        apagarFoto(admin, item, 204);
        assertThat(auditorias("VITRINE_ITEM_FOTO_REMOVIDA", item)).isEqualTo(1);
        // Item inexistente.
        enviarFoto(admin, UUID.randomUUID(), FotosDeTeste.jpeg(Color.RED), 404);
    }

    @Test
    void apagarOItemApagaAFoto() throws Exception {
        JsonNode criado = criar("Item fictício cascata");
        UUID item = id(criado);
        enviarFoto(admin, item, FotosDeTeste.jpeg(Color.BLUE), 200);
        api.delete(ITENS + "/" + item + "?versao=" + criado.get("versao").asLong(), admin, 204);
        assertThat(contar("select count(*) from vitrine_item_foto where item_id = ?", item)).isZero();
    }

    @Test
    void fotoForaDoFormatoOuDoTamanhoDa422SemGastarCota() throws Exception {
        UUID item = id(criar("Item fictício limites"));
        MvcResult texto = enviarFoto(admin, item, "não é imagem".getBytes(StandardCharsets.UTF_8), 422);
        assertThat(api.ler(texto).path("codigo").asString()).isEqualTo("FOTO_INVALIDA");
        // Acima de 1600 px é recusada, como a foto de perfil acima de 1024.
        assertThat(api.ler(enviarFoto(admin, item, FotosDeTeste.jpeg(Color.RED, 1700, false), 422)).path("codigo").asString())
                .isEqualTo("FOTO_INVALIDA");
        assertThat(api.ler(enviarFoto(admin, item, jpegPesado(), 422)).path("codigo").asString()).isEqualTo("FOTO_GRANDE_DEMAIS");
        assertThat(contar("select count(*) from vitrine_item_foto where item_id = ?", item)).isZero();
        enviarFoto(admin, item, FotosDeTeste.jpeg(Color.RED, 1600, false), 200);
    }

    @Test
    void tetoDiarioDeFotosPorConsultoriaESoOsEnviosValidosGastamCota() throws Exception {
        UUID item = id(criar("Item fictício cota"));
        UUID consultoria = consultoria();
        // Recusados antes da cota não gastam: sobram exatamente POR_DIA vagas.
        enviarFoto(admin, item, "lixo".getBytes(StandardCharsets.UTF_8), 422);
        for (int i = 0; i < FotosDaVitrineService.POR_DIA - 1; i++) {
            assertThat(limite.fotoDaVitrineCabe(consultoria, FotosDaVitrineService.POR_DIA)).as("vaga %d", i + 1).isTrue();
        }
        enviarFoto(admin, item, FotosDeTeste.jpeg(Color.RED), 200);
        JsonNode cheio = api.ler(enviarFoto(admin, item, FotosDeTeste.jpeg(Color.GREEN), 422));
        assertThat(cheio.get("codigo").asString()).isEqualTo("FOTOS_LIMITE_DIARIO");
        // Trocar e apagar não devolvem cota.
        apagarFoto(admin, item, 204);
        assertThat(api.ler(enviarFoto(admin, item, FotosDeTeste.jpeg(Color.GREEN), 422)).get("codigo").asString())
                .isEqualTo("FOTOS_LIMITE_DIARIO");

        // Outra consultoria tem o contador dela.
        JsonNode outro = api.novoTreinador();
        UUID itemDeOutro = id(api.post(ITENS, outro, corpo("Item de outra consultoria"), 200));
        enviarFoto(outro, itemDeOutro, FotosDeTeste.jpeg(Color.BLUE), 200);
    }

    // ---- chave ligada ----

    @Test
    void euTrazAChaveLigadaParaEquipeEAluno() throws Exception {
        assertThat(api.get("/eu", admin, 200).get("vitrineHabilitada").asBoolean()).isTrue();
        assertThat(api.get("/eu", loginAluno, 200).get("vitrineHabilitada").asBoolean()).isTrue();
    }
}
