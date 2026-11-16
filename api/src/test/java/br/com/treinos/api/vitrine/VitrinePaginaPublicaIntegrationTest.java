package br.com.treinos.api.vitrine;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.equipe.CatalogoPermissoes;
import br.com.treinos.api.fotos.FotosDeTeste;
import br.com.treinos.api.web.Fuso;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.awt.Color;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Página pública da loja (F2a): configuração pela equipe (ligar, novo link, versão, permissões), a página sem login (só item ativo,
 * DIGITAL e marcado, com o preço vigente), a foto pública, o mesmo 404 para código inexistente, fora do formato e página desligada
 * e o isolamento entre consultorias. Cada teste nasce com consultorias próprias (banco compartilhado) e só dados fictícios.
 */
@AutoConfigureMockMvc
class VitrinePaginaPublicaIntegrationTest extends AbstractIntegrationTest {

    private static final String ITENS = "/vitrine/itens";
    private static final String CONFIG = "/vitrine/configuracao";

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;

    private ApiDeTeste api;
    private JsonNode admin;
    private UUID consultoria;
    private final LocalDate hoje = LocalDate.now(Fuso.BRASILIA);

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        consultoria = consultoriaDe(admin);
    }

    // ---- ajudantes ----

    private UUID consultoriaDe(JsonNode login) throws Exception {
        UUID aluno = api.criarAluno(login, "Aluno Fictício Loja " + UUID.randomUUID());
        return jdbc.queryForObject("select consultoria_id from aluno where id = ?", UUID.class, aluno);
    }

    private static Map<String, Object> corpo(String nome, String tipo, boolean naPagina, boolean ativo) {
        Map<String, Object> c = new LinkedHashMap<>();
        c.put("nome", nome);
        c.put("tipo", tipo);
        c.put("precoCentavos", 10_000L);
        c.put("ativo", ativo);
        c.put("naPaginaPublica", naPagina);
        return c;
    }

    private UUID item(JsonNode login, Map<String, Object> corpo) throws Exception {
        return UUID.fromString(api.post(ITENS, login, corpo, 200).get("id").asString());
    }

    private void foto(JsonNode login, UUID item) throws Exception {
        mvc.perform(multipart(HttpMethod.PUT, ITENS + "/" + item + "/foto")
                        .file(new MockMultipartFile("arquivo", "foto.jpg", "image/jpeg", FotosDeTeste.jpeg(Color.BLUE)))
                        .header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(login)))
                .andExpect(status().isOk());
    }

    /** Liga a página da consultoria e devolve a resposta (código e versão). */
    private JsonNode ligar(JsonNode login) throws Exception {
        return api.put(CONFIG, login, Map.of("paginaLigada", true), 200);
    }

    private JsonNode publica(String codigo, int esperado) throws Exception {
        MvcResult r = mvc.perform(get("/publico/loja/" + codigo)).andExpect(status().is(esperado)).andReturn();
        String texto = r.getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
        return texto.isBlank() ? json.nullNode() : json.readTree(texto);
    }

    private List<String> nomes(JsonNode pagina) {
        List<String> nomes = new ArrayList<>();
        pagina.get("itens").forEach(i -> nomes.add(i.get("nome").asString()));
        return nomes;
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

    // ---- página feliz ----

    @Test
    void paginaMostraSoItemAtivoDigitalEMarcadoDaPropriaConsultoria() throws Exception {
        Map<String, Object> a = corpo("Planilha Fictícia A", "DIGITAL", true, true);
        a.put("descricao", "Descrição fictícia");
        a.put("cupom", "BEMVINDO");
        a.put("linkUrl", "https://loja.exemplo.com.br/a");
        a.put("precoEspecialCentavos", 8_000L);
        a.put("especialAte", hoje.plusDays(1).toString());
        UUID itemA = item(admin, a);
        UUID inativo = item(admin, corpo("Planilha Fictícia Inativa", "DIGITAL", true, false));
        UUID naoMarcado = item(admin, corpo("Planilha Fictícia Não Marcada", "DIGITAL", false, true));
        UUID fisico = item(admin, corpo("Camiseta Fictícia", "FISICO", false, true));
        for (UUID u : List.of(itemA, inativo, naoMarcado, fisico)) {
            foto(admin, u);
        }

        // Outra consultoria, com a própria página ligada e um item marcado: nunca aparece na primeira.
        JsonNode outro = api.novoTreinador();
        UUID consultoriaOutro = consultoriaDe(outro);
        UUID itemOutro = item(outro, corpo("Planilha Fictícia De Outra", "DIGITAL", true, true));
        foto(outro, itemOutro);
        String codigoOutro = ligar(outro).get("codigo").asString();

        String codigo = ligar(admin).get("codigo").asString();
        JsonNode pagina = publica(codigo, 200);
        assertThat(nomes(pagina)).containsExactly("Planilha Fictícia A");
        JsonNode i = pagina.get("itens").get(0);
        assertThat(i.get("id").asString()).isEqualTo(itemA.toString());
        assertThat(i.get("precoCentavos").asLong()).isEqualTo(10_000L);
        assertThat(i.get("precoVigenteCentavos").asLong()).isEqualTo(8_000L);
        assertThat(i.get("especialAte").asString()).isEqualTo(hoje.plusDays(1).toString());
        assertThat(i.get("cupom").asString()).isEqualTo("BEMVINDO");
        assertThat(i.get("linkUrl").asString()).isEqualTo("https://loja.exemplo.com.br/a");
        assertThat(i.get("temFoto").asBoolean()).isTrue();
        assertThat(pagina.get("marca").get("nome").asString())
                .isEqualTo(jdbc.queryForObject("select nome from consultoria where id = ?", String.class, consultoria));
        // Nada da equipe nem id de consultoria: o item não leva ordem, versão, tipo nem ativo, e a marca não leva id.
        assertThat(i.propertyNames()).doesNotContain("ordem", "versao", "tipo", "ativo", "naPaginaPublica", "consultoriaId");
        assertThat(pagina.get("marca").propertyNames()).doesNotContain("id");
        // O id da consultoria só aparece, se aparecer, dentro do logoUrl (a rota pública da logo já o leva); nunca nos itens.
        assertThat(pagina.get("itens").toString()).doesNotContain(consultoria.toString()).doesNotContain(consultoriaOutro.toString());

        // Foto: só do item da página; inativo, não marcado, físico e item de outra consultoria dão 404.
        assertThat(foto(codigo, itemA, 200).getResponse().getContentType()).isEqualTo("image/jpeg");
        for (UUID u : List.of(inativo, naoMarcado, fisico, itemOutro)) {
            foto(codigo, u, 404);
        }
        foto(codigo, UUID.randomUUID(), 404);
        // O mesmo item, pelo código da outra consultoria, também não vaza.
        foto(codigoOutro, itemA, 404);
        assertThat(nomes(publica(codigoOutro, 200))).containsExactly("Planilha Fictícia De Outra");
    }

    @Test
    void itemMarcadoQueDepoisFicaInativoSomeDaPagina() throws Exception {
        JsonNode criado = api.post(ITENS, admin, corpo("Planilha Fictícia Que Sai", "DIGITAL", true, true), 200);
        String codigo = ligar(admin).get("codigo").asString();
        assertThat(nomes(publica(codigo, 200))).containsExactly("Planilha Fictícia Que Sai");

        Map<String, Object> desativar = corpo("Planilha Fictícia Que Sai", "DIGITAL", true, false);
        desativar.put("versao", criado.get("versao").asLong());
        api.put(ITENS + "/" + criado.get("id").asString(), admin, desativar, 200);

        assertThat(nomes(publica(codigo, 200))).isEmpty();
        foto(codigo, UUID.fromString(criado.get("id").asString()), 404);
    }

    @Test
    void bancoRecusaItemFisicoNaPaginaPublica() {
        assertThatThrownBy(() -> jdbc.update("""
                insert into vitrine_item (id, consultoria_id, nome, tipo, ativo, ordem, na_pagina_publica)
                values (?, ?, 'Camiseta Fictícia', 'FISICO', true, 0, true)""", UUID.randomUUID(), consultoria))
                .isInstanceOf(DataIntegrityViolationException.class)
                .hasMessageContaining("ck_vitrine_item_pagina_so_digital");
    }

    private MvcResult foto(String codigo, UUID item, int esperado) throws Exception {
        return mvc.perform(get("/publico/loja/" + codigo + "/itens/" + item + "/foto")).andExpect(status().is(esperado)).andReturn();
    }

    @Test
    void precoEspecialVencidoNaoApareceComoVigente() throws Exception {
        Map<String, Object> c = corpo("Planilha Fictícia Vencida", "DIGITAL", true, true);
        c.put("precoEspecialCentavos", 8_000L);
        c.put("especialAte", hoje.minusDays(1).toString());
        item(admin, c);
        JsonNode i = publica(ligar(admin).get("codigo").asString(), 200).get("itens").get(0);
        assertThat(i.get("precoVigenteCentavos").asLong()).isEqualTo(10_000L);
        assertThat(i.get("precoCentavos").asLong()).isEqualTo(10_000L);
        assertThat(i.path("especialAte").isNull()).isTrue();
    }

    // ---- 404 igual ----

    @Test
    void codigoInexistenteForaDoFormatoEPaginaDesligadaDaoOMesmo404() throws Exception {
        item(admin, corpo("Planilha Fictícia", "DIGITAL", true, true));
        JsonNode ligada = ligar(admin);
        String codigo = ligada.get("codigo").asString();
        publica(codigo, 200);

        JsonNode desligada = api.put(CONFIG, admin, Map.of("paginaLigada", false, "versao", ligada.get("versao").asLong()), 200);
        assertThat(desligada.get("paginaLigada").asBoolean()).isFalse();
        JsonNode umaDesligada = publica(codigo, 404);

        JsonNode inexistente = publica("A".repeat(24), 404);
        JsonNode foraDoFormato = publica("curto", 404);
        for (JsonNode outro : List.of(inexistente, foraDoFormato)) {
            assertThat(outro.get("codigo").asString()).isEqualTo(umaDesligada.get("codigo").asString());
            assertThat(outro.get("message").asString()).isEqualTo(umaDesligada.get("message").asString());
        }
        foto(codigo, UUID.randomUUID(), 404);
    }

    // ---- equipe: configuração, versão e novo link ----

    @Test
    void configuracaoComVersaoELinkNovoInvalidaOAntigo() throws Exception {
        JsonNode vazia = api.get(CONFIG, admin, 200);
        assertThat(vazia.get("paginaLigada").asBoolean()).isFalse();
        assertThat(vazia.get("codigo").isNull()).isTrue();
        assertThat(vazia.get("versao").isNull()).isTrue();

        // Sem linha só a versão ausente cria; com versão inventada, 409.
        assertThat(api.put(CONFIG, admin, Map.of("paginaLigada", true, "versao", 5), 409).get("codigo").asString())
                .isEqualTo("CONFLITO_EDICAO");
        assertThat(api.get(CONFIG, admin, 200).get("versao").isNull()).isTrue();
        // paginaLigada é obrigatório.
        assertThat(api.put(CONFIG, admin, Map.of(), 422).get("fieldErrors").get(0).get("field").asString()).isEqualTo("paginaLigada");

        JsonNode ligada = ligar(admin);
        String antigo = ligada.get("codigo").asString();
        assertThat(ligada.get("paginaLigada").asBoolean()).isTrue();
        assertThat(antigo).hasSize(24);
        assertThat(api.get(CONFIG, admin, 200).get("codigo").asString()).isEqualTo(antigo);
        publica(antigo, 200);

        // Versão velha ou ausente: 409 e nada muda.
        long versao = ligada.get("versao").asLong();
        assertThat(api.put(CONFIG, admin, Map.of("paginaLigada", false), 409).get("codigo").asString()).isEqualTo("CONFLITO_EDICAO");
        assertThat(api.put(CONFIG, admin, Map.of("paginaLigada", false, "versao", versao + 1), 409).get("codigo").asString())
                .isEqualTo("CONFLITO_EDICAO");
        assertThat(api.post(CONFIG + "/novo-link", admin, Map.of(), 409).get("codigo").asString()).isEqualTo("CONFLITO_EDICAO");
        assertThat(api.get(CONFIG, admin, 200).get("paginaLigada").asBoolean()).isTrue();

        // Ligar ao mesmo valor não grava (a versão não sobe).
        JsonNode igual = api.put(CONFIG, admin, Map.of("paginaLigada", true, "versao", versao), 200);
        assertThat(igual.get("versao").asLong()).isEqualTo(versao);

        // Novo link: o código muda, o estado fica e o antigo deixa de abrir.
        JsonNode novo = api.post(CONFIG + "/novo-link", admin, Map.of("versao", versao), 200);
        assertThat(novo.get("codigo").asString()).hasSize(24).isNotEqualTo(antigo);
        assertThat(novo.get("paginaLigada").asBoolean()).isTrue();
        assertThat(novo.get("versao").asLong()).isGreaterThan(versao);
        publica(antigo, 404);
        publica(novo.get("codigo").asString(), 200);
        // Renovar com a versão já usada dá 409.
        api.post(CONFIG + "/novo-link", admin, Map.of("versao", versao), 409);

        // Auditoria de resumo fixo, sem o código.
        List<String> resumos = jdbc.queryForList(
                "select resumo from auditoria where consultoria_id = ? and acao in ('VITRINE_PAGINA_ALTERADA', 'VITRINE_LINK_RENOVADO')",
                String.class, consultoria);
        assertThat(resumos).hasSize(2).allSatisfy(r -> assertThat(r).doesNotContain(antigo).doesNotContain(novo.get("codigo").asString()));
    }

    @Test
    void primeiroLinkSemLigarCriaLinhaDesligada() throws Exception {
        JsonNode novo = api.post(CONFIG + "/novo-link", admin, Map.of(), 200);
        assertThat(novo.get("paginaLigada").asBoolean()).isFalse();
        publica(novo.get("codigo").asString(), 404);
    }

    // ---- item: só DIGITAL na página ----

    @Test
    void soItemDigitalVaiParaAPaginaEOCampoVoltaNaResposta() throws Exception {
        JsonNode erro = api.post(ITENS, admin, corpo("Camiseta Fictícia", "FISICO", true, true), 422);
        assertThat(erro.get("codigo").asString()).isEqualTo("VITRINE_ITEM_INVALIDO");
        assertThat(erro.get("fieldErrors").get(0).get("field").asString()).isEqualTo("naPaginaPublica");
        assertThat(jdbc.queryForObject("select count(*) from vitrine_item where consultoria_id = ?", Integer.class, consultoria)).isZero();

        JsonNode criado = api.post(ITENS, admin, corpo("Planilha Fictícia", "DIGITAL", true, true), 200);
        assertThat(criado.get("naPaginaPublica").asBoolean()).isTrue();
        UUID id = UUID.fromString(criado.get("id").asString());

        // Trocar para FISICO sem tirar da página = 422; tirando, passa.
        Map<String, Object> troca = corpo("Planilha Fictícia", "FISICO", true, true);
        troca.put("versao", 0);
        assertThat(api.put(ITENS + "/" + id, admin, troca, 422).get("fieldErrors").get(0).get("field").asString())
                .isEqualTo("naPaginaPublica");
        troca.put("naPaginaPublica", false);
        assertThat(api.put(ITENS + "/" + id, admin, troca, 200).get("naPaginaPublica").asBoolean()).isFalse();

        // Ausente = falso, e a lista da equipe traz o campo.
        Map<String, Object> semCampo = corpo("Outra Planilha Fictícia", "DIGITAL", true, true);
        semCampo.remove("naPaginaPublica");
        assertThat(api.post(ITENS, admin, semCampo, 200).get("naPaginaPublica").asBoolean()).isFalse();
        assertThat(api.get(ITENS, admin, 200).get(0).has("naPaginaPublica")).isTrue();
    }

    // ---- permissões ----

    @Test
    void permissoesDaConfiguracao() throws Exception {
        JsonNode soLeitura = membro(Set.of("VITRINE_LER"));
        JsonNode semNada = membro(Set.of("ALUNO_LER"));
        JsonNode comAlteracao = membro(Set.of("VITRINE_ALTERAR"));

        JsonNode ligada = ligar(admin);
        long versao = ligada.get("versao").asLong();

        assertThat(api.get(CONFIG, soLeitura, 200).get("codigo").asString()).isEqualTo(ligada.get("codigo").asString());
        api.put(CONFIG, soLeitura, Map.of("paginaLigada", false, "versao", versao), 403);
        api.post(CONFIG + "/novo-link", soLeitura, Map.of("versao", versao), 403);
        api.get(CONFIG, semNada, 403);
        api.put(CONFIG, semNada, Map.of("paginaLigada", false, "versao", versao), 403);
        api.post(CONFIG + "/novo-link", semNada, Map.of("versao", versao), 403);
        assertThat(api.get(CONFIG, admin, 200).get("paginaLigada").asBoolean()).isTrue();

        // VITRINE_ALTERAR depende de LER no catálogo: quem altera também lê.
        assertThat(api.put(CONFIG, comAlteracao, Map.of("paginaLigada", false, "versao", versao), 200).get("paginaLigada").asBoolean())
                .isFalse();
        // Sem login: nada da equipe.
        api.get(CONFIG, null, 401);
        api.put(CONFIG, null, Map.of("paginaLigada", true), 401);
    }
}
