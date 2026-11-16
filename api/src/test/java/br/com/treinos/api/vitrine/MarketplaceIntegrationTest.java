package br.com.treinos.api.vitrine;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.equipe.CatalogoPermissoes;
import br.com.treinos.api.web.Fuso;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.nio.charset.StandardCharsets;
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
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Marketplace (F3.1): opt-in duplo gravado e lido pela equipe (permissões, versão, auditoria) e a lista pública entre consultorias.
 * O banco é compartilhado com o resto da suíte, então a lista é global: cada afirmação diz "contém os meus" ou "não contém os meus
 * sentinelas" (nome único por UUID), nunca o tamanho total. Só dados fictícios.
 */
@AutoConfigureMockMvc
class MarketplaceIntegrationTest extends AbstractIntegrationTest {

    private static final String ITENS = "/vitrine/itens";
    private static final String CONFIG = "/vitrine/configuracao";
    private static final String LISTA = "/publico/lojas";

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;

    private ApiDeTeste api;
    private final LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
    private final String id = UUID.randomUUID().toString().substring(0, 8);

    @BeforeEach
    void preparar() {
        api = new ApiDeTeste(mvc, json);
    }

    // ---- ajudantes ----

    /** Uma consultoria de teste: o treinador, o id dela, o código da loja e o item que cumpre tudo. */
    private record Loja(JsonNode admin, UUID consultoria, String codigo, UUID itemBom, String nomeDoItem) { }

    private UUID consultoriaDe(JsonNode login, String nomeDoAluno) throws Exception {
        UUID aluno = api.criarAluno(login, nomeDoAluno);
        return jdbc.queryForObject("select consultoria_id from aluno where id = ?", UUID.class, aluno);
    }

    private Map<String, Object> corpoItem(String nome, String tipo, boolean ativo, boolean naPagina, boolean noMarketplace) {
        Map<String, Object> c = new LinkedHashMap<>();
        c.put("nome", nome);
        c.put("tipo", tipo);
        c.put("precoCentavos", 10_000L);
        c.put("ativo", ativo);
        c.put("naPaginaPublica", naPagina);
        c.put("noMarketplace", noMarketplace);
        return c;
    }

    private UUID item(JsonNode login, Map<String, Object> corpo) throws Exception {
        return UUID.fromString(api.post(ITENS, login, corpo, 200).get("id").asString());
    }

    /**
     * Cria a consultoria com um item que cumpre tudo ("Planilha {rotulo} {id}") e liga a página e o marketplace conforme pedido.
     * Quem chama muda o que quiser depois.
     */
    private Loja loja(String rotulo, boolean paginaLigada, boolean noMarketplace) throws Exception {
        JsonNode admin = api.novoTreinador();
        UUID consultoria = consultoriaDe(admin, "Aluno Fictício " + rotulo + " " + id);
        String nome = "Planilha " + rotulo + " " + id;
        UUID bom = item(admin, corpoItem(nome, "DIGITAL", true, true, true));
        JsonNode config = api.put(CONFIG, admin, Map.of("paginaLigada", paginaLigada, "noMarketplace", noMarketplace), 200);
        return new Loja(admin, consultoria, config.get("codigo").asString(), bom, nome);
    }

    private void direitos(UUID consultoria, String situacao, boolean acessoLiberado) {
        jdbc.update("""
                insert into direitos_locais (consultoria_id, contratacao_id, versao, situacao, acesso_liberado, plano_codigo,
                    plano_nome, confirmado_em) values (?, ?, 1, ?, ?, 'PLANO_FICTICIO', 'Plano Fictício', now())""",
                consultoria, UUID.randomUUID(), situacao, acessoLiberado);
    }

    /** Todas as páginas (100 por vez) até a lista acabar; a resposta de cada uma vira um nó. */
    private List<JsonNode> todasAsPaginas() throws Exception {
        List<JsonNode> paginas = new ArrayList<>();
        for (int p = 0; p < 1000; p++) {
            JsonNode pagina = api.get(LISTA + "?pagina=" + p + "&tamanho=100", null, 200);
            if (pagina.get("lojas").isEmpty()) {
                break;
            }
            paginas.add(pagina);
        }
        return paginas;
    }

    private static Set<String> codigos(List<JsonNode> paginas) {
        Set<String> codigos = new java.util.HashSet<>();
        paginas.forEach(p -> p.get("lojas").forEach(l -> codigos.add(l.get("codigo").asString())));
        return codigos;
    }

    private static JsonNode lojaDe(List<JsonNode> paginas, String codigo) {
        for (JsonNode p : paginas) {
            for (JsonNode l : p.get("lojas")) {
                if (codigo.equals(l.get("codigo").asString())) {
                    return l;
                }
            }
        }
        return null;
    }

    private static List<String> nomesDosItens(JsonNode loja) {
        List<String> nomes = new ArrayList<>();
        loja.get("itens").forEach(i -> nomes.add(i.get("nome").asString()));
        return nomes;
    }

    private JsonNode membro(JsonNode admin, String nome, String email, Set<String> permissoes) throws Exception {
        String perfil = api.post("/perfis", admin,
                Map.of("nome", "Perfil " + UUID.randomUUID(), "permissoes", CatalogoPermissoes.comDependencias(permissoes)), 200)
                .get("id").asString();
        JsonNode convite = api.post("/usuarios/convites", admin, Map.of("nome", nome, "email", email, "perfilId", perfil), 200);
        return api.post("/publico/convites-equipe/aceitar", null,
                Map.of("codigo", convite.get("codigo").asString(), "senha", ApiDeTeste.SENHA), 200);
    }

    // ---- a lista pública ----

    @Test
    void listaTemSoQuemEntrouNosDoisLadosENuncaOsSentinelas() throws Exception {
        // A loja que aparece, com todos os dados de gente que nunca podem sair: aluno, membro da equipe e o cupom e o link do item.
        String sentinelaAluno = "SENTINELA_ALUNO_" + id;
        String sentinelaMembro = "SENTINELA_MEMBRO_" + id;
        String sentinelaEmail = "sentinela.membro." + id + "@exemplo.com.br";
        String sentinelaCupom = "CUPOMSENT" + id;
        String sentinelaLink = "https://sentinela-" + id + ".exemplo.com.br/compra";
        JsonNode admin = api.novoTreinador();
        UUID consultoria = consultoriaDe(admin, sentinelaAluno);
        membro(admin, sentinelaMembro, sentinelaEmail, Set.of("VITRINE_LER"));
        String usuarioDoMembro = jdbc.queryForObject("select id::text from usuario where email = ?", String.class, sentinelaEmail);

        Map<String, Object> bom = corpoItem("Planilha Boa " + id, "DIGITAL", true, true, true);
        bom.put("descricao", "Descrição fictícia");
        bom.put("cupom", sentinelaCupom);
        bom.put("linkUrl", sentinelaLink);
        bom.put("precoEspecialCentavos", 8_000L);
        bom.put("especialAte", hoje.plusDays(1).toString());
        UUID itemBom = item(admin, bom);
        String semOptIn = "Planilha Sem Opt-in " + id;
        String inativo = "Planilha Inativa " + id;
        String foraDaPagina = "Planilha Fora Da Página " + id;
        String fisico = "Camiseta Física " + id;
        item(admin, corpoItem(semOptIn, "DIGITAL", true, true, false));
        item(admin, corpoItem(inativo, "DIGITAL", false, true, true));
        item(admin, corpoItem(foraDaPagina, "DIGITAL", true, false, true));
        item(admin, corpoItem(fisico, "FISICO", true, false, false));
        String codigo = api.put(CONFIG, admin, Map.of("paginaLigada", true, "noMarketplace", true), 200).get("codigo").asString();

        // Consultorias que nunca aparecem: sem opt-in, página desligada, suspensas de três jeitos e sem item com opt-in.
        Loja semOptInDaConsultoria = loja("SemOptIn", true, false);
        Loja paginaDesligada = loja("PaginaOff", false, true);
        Loja bloqueada = loja("Bloqueada", true, true);
        direitos(bloqueada.consultoria(), "BLOQUEADA", false);
        Loja cancelada = loja("Cancelada", true, true);
        direitos(cancelada.consultoria(), "CANCELADA", true);
        Loja semAcesso = loja("SemAcesso", true, true);
        direitos(semAcesso.consultoria(), "ATIVA", false);
        JsonNode semItem = api.novoTreinador();
        consultoriaDe(semItem, "Aluno Fictício SemItem " + id);
        item(semItem, corpoItem("Planilha Sem Opt-in De Outra " + id, "DIGITAL", true, true, false));
        String codigoSemItem = api.put(CONFIG, semItem, Map.of("paginaLigada", true, "noMarketplace", true), 200).get("codigo").asString();
        // Com linha de direitos mas liberada, a consultoria aparece (ATIVA, TRIAL e INADIMPLENTE com acesso).
        Loja ativa = loja("Ativa", true, true);
        direitos(ativa.consultoria(), "ATIVA", true);
        Loja inadimplenteComAcesso = loja("Inadimplente", true, true);
        direitos(inadimplenteComAcesso.consultoria(), "INADIMPLENTE", true);

        MvcResult primeira = mvc.perform(get(LISTA + "?tamanho=100")).andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "max-age=60, public")).andReturn();
        assertThat(json.readTree(primeira.getResponse().getContentAsString(StandardCharsets.UTF_8)).has("total")).isTrue();

        List<JsonNode> paginas = todasAsPaginas();
        Set<String> codigos = codigos(paginas);
        assertThat(codigos).contains(codigo, ativa.codigo(), inadimplenteComAcesso.codigo())
                .doesNotContain(semOptInDaConsultoria.codigo(), paginaDesligada.codigo(), bloqueada.codigo(), cancelada.codigo(),
                        semAcesso.codigo(), codigoSemItem);

        // A loja que aparece mostra só o item que cumpre tudo, com o preço vigente decidido no servidor.
        JsonNode minha = lojaDe(paginas, codigo);
        assertThat(nomesDosItens(minha)).containsExactly("Planilha Boa " + id);
        JsonNode i = minha.get("itens").get(0);
        assertThat(i.get("id").asString()).isEqualTo(itemBom.toString());
        assertThat(i.get("tipo").asString()).isEqualTo("DIGITAL");
        assertThat(i.get("descricao").asString()).isEqualTo("Descrição fictícia");
        assertThat(i.get("precoVigenteCentavos").asLong()).isEqualTo(8_000L);
        assertThat(i.get("temFoto").asBoolean()).isFalse();
        // Projeção fechada: sem cupom, link, preço normal, validade, ordem, versão, ativo nem flags de opt-in.
        assertThat(i.propertyNames()).containsExactlyInAnyOrder("id", "nome", "descricao", "tipo", "precoVigenteCentavos", "temFoto",
                "fotoAtualizadaEm");
        assertThat(minha.propertyNames()).containsExactlyInAnyOrder("marca", "codigo", "itens");
        assertThat(minha.get("marca").propertyNames()).containsExactlyInAnyOrder("nome", "corPrimaria", "fonteTitulo", "temaPadrao",
                "logoUrl");
        assertThat(minha.get("marca").get("nome").asString())
                .isEqualTo(jdbc.queryForObject("select nome from consultoria where id = ?", String.class, consultoria));

        // Nenhum sentinela, em nenhuma página: gente, item que não cumpre tudo, cupom, link e ids internos.
        String corpo = paginas.toString();
        assertThat(corpo).doesNotContain(sentinelaAluno, sentinelaMembro, sentinelaEmail, sentinelaCupom, sentinelaLink, "sentinela-",
                semOptIn, inativo, foraDaPagina, fisico, "Planilha Sem Opt-in De Outra " + id,
                consultoria.toString(), usuarioDoMembro);
        for (Loja fora : List.of(semOptInDaConsultoria, paginaDesligada, bloqueada, cancelada, semAcesso)) {
            assertThat(corpo).doesNotContain(fora.nomeDoItem());
        }
    }

    @Test
    void quemSaiDoMarketplaceOuDesativaOItemSomeDaLista() throws Exception {
        Loja l = loja("Muda", true, true);
        assertThat(codigos(todasAsPaginas())).contains(l.codigo());

        // Desativar o único item elegível tira a consultoria da lista (sem item não há loja).
        JsonNode item = api.get(ITENS, l.admin(), 200).get(0);
        Map<String, Object> corpo = corpoItem(item.get("nome").asString(), "DIGITAL", false, true, true);
        corpo.put("versao", item.get("versao").asLong());
        JsonNode desativado = api.put(ITENS + "/" + item.get("id").asString(), l.admin(), corpo, 200);
        assertThat(codigos(todasAsPaginas())).doesNotContain(l.codigo());

        // Reativar volta; tirar o opt-in do item tira; o opt-in da consultoria desligado também.
        corpo.put("ativo", true);
        corpo.put("versao", desativado.get("versao").asLong());
        JsonNode reativado = api.put(ITENS + "/" + item.get("id").asString(), l.admin(), corpo, 200);
        assertThat(codigos(todasAsPaginas())).contains(l.codigo());
        corpo.put("noMarketplace", false);
        corpo.put("versao", reativado.get("versao").asLong());
        JsonNode semOptIn = api.put(ITENS + "/" + item.get("id").asString(), l.admin(), corpo, 200);
        assertThat(semOptIn.get("noMarketplace").asBoolean()).isFalse();
        assertThat(codigos(todasAsPaginas())).doesNotContain(l.codigo());
        corpo.put("noMarketplace", true);
        corpo.put("versao", semOptIn.get("versao").asLong());
        api.put(ITENS + "/" + item.get("id").asString(), l.admin(), corpo, 200);
        assertThat(codigos(todasAsPaginas())).contains(l.codigo());

        JsonNode config = api.get(CONFIG, l.admin(), 200);
        api.put(CONFIG, l.admin(), Map.of("paginaLigada", true, "noMarketplace", false, "versao", config.get("versao").asLong()), 200);
        assertThat(codigos(todasAsPaginas())).doesNotContain(l.codigo());
    }

    @Test
    void suspensaoEPaginaDesligadaTiramAConsultoriaSemApagarOOptIn() throws Exception {
        Loja l = loja("Suspende", true, true);
        assertThat(codigos(todasAsPaginas())).contains(l.codigo());

        direitos(l.consultoria(), "ATIVA", true);
        assertThat(codigos(todasAsPaginas())).contains(l.codigo());
        jdbc.update("update direitos_locais set situacao = 'BLOQUEADA', acesso_liberado = false where consultoria_id = ?", l.consultoria());
        assertThat(codigos(todasAsPaginas())).doesNotContain(l.codigo());
        jdbc.update("update direitos_locais set situacao = 'ATIVA', acesso_liberado = true where consultoria_id = ?", l.consultoria());
        assertThat(codigos(todasAsPaginas())).contains(l.codigo());

        JsonNode config = api.get(CONFIG, l.admin(), 200);
        api.put(CONFIG, l.admin(), Map.of("paginaLigada", false, "noMarketplace", true, "versao", config.get("versao").asLong()), 200);
        assertThat(codigos(todasAsPaginas())).doesNotContain(l.codigo());
    }

    @Test
    void logoSaiSoComoCaminhoPublicoEContatoDaConsultoriaNuncaVaza() throws Exception {
        Loja l = loja("Logo", true, true);
        String whatsapp = "5545" + (900000000 + Math.abs(id.hashCode()) % 99999999);
        String remetente = "Remetente Sentinela " + id;
        String responderPara = "responder." + id + "@sentinela.exemplo.com.br";
        jdbc.update("update consultoria set logo = ?, logo_tipo = 'image/png', logo_versao = 7, whatsapp = ?, "
                + "email_remetente_nome = ?, email_responder_para = ? where id = ?",
                new byte[] {1, 2, 3}, whatsapp, remetente, responderPara, l.consultoria());

        String bruto = mvc.perform(get(LISTA + "?tamanho=100")).andExpect(status().isOk()).andReturn().getResponse()
                .getContentAsString(StandardCharsets.UTF_8);
        assertThat(json.readTree(bruto).propertyNames()).containsExactlyInAnyOrder("lojas", "total", "pagina", "tamanho");

        List<JsonNode> paginas = todasAsPaginas();
        JsonNode minha = lojaDe(paginas, l.codigo());
        String caminho = "/publico/marcas/" + l.consultoria() + "/logo?v=7";
        assertThat(minha.get("marca").get("logoUrl").asString()).isEqualTo(caminho);

        // O id da consultoria só aparece dentro do caminho da logo (uma vez); contato e bytes nunca.
        String corpo = paginas.toString();
        assertThat(corpo.split(l.consultoria().toString(), -1)).hasSize(2);
        assertThat(corpo.replace(caminho, "")).doesNotContain(l.consultoria().toString());
        assertThat(corpo).doesNotContain(whatsapp, remetente, responderPara, id + "@sentinela");
    }

    @Test
    void fotoDoItemApareceSoComoDataENuncaComBytes() throws Exception {
        Loja l = loja("Foto", true, true);
        jdbc.update("insert into vitrine_item_foto (item_id, consultoria_id, jpeg, tamanho, atualizada_em) values (?, ?, ?, 3, now())",
                l.itemBom(), l.consultoria(), new byte[] {1, 2, 3});
        JsonNode i = lojaDe(todasAsPaginas(), l.codigo()).get("itens").get(0);
        assertThat(i.get("temFoto").asBoolean()).isTrue();
        assertThat(i.get("fotoAtualizadaEm").isNull()).isFalse();
        assertThat(i.has("jpeg")).isFalse();
    }

    // ---- paginação ----

    @Test
    void paginacaoTemTetoDeTamanhoEPaginaGiganteDaListaVazia() throws Exception {
        for (int k = 0; k < 3; k++) {
            loja("Pagina" + k, true, true);
        }
        JsonNode padrao = api.get(LISTA, null, 200);
        assertThat(padrao.get("pagina").asInt()).isZero();
        assertThat(padrao.get("tamanho").asInt()).isEqualTo(30);
        long total = padrao.get("total").asLong();
        assertThat(total).isGreaterThanOrEqualTo(3);

        JsonNode umaPorVez = api.get(LISTA + "?pagina=1&tamanho=1", null, 200);
        assertThat(umaPorVez.get("lojas")).hasSize(1);
        assertThat(umaPorVez.get("pagina").asInt()).isEqualTo(1);
        assertThat(api.get(LISTA + "?pagina=0&tamanho=1", null, 200).get("lojas").get(0).get("codigo").asString())
                .isNotEqualTo(umaPorVez.get("lojas").get(0).get("codigo").asString());

        // Tamanho: teto de 100, piso de 1; página negativa vira a primeira.
        assertThat(api.get(LISTA + "?tamanho=100000", null, 200).get("tamanho").asInt()).isEqualTo(100);
        assertThat(api.get(LISTA + "?tamanho=0", null, 200).get("tamanho").asInt()).isEqualTo(1);
        assertThat(api.get(LISTA + "?tamanho=-5", null, 200).get("tamanho").asInt()).isEqualTo(1);
        assertThat(api.get(LISTA + "?pagina=-3", null, 200).get("pagina").asInt()).isZero();

        // Página gigante: lista vazia com o total real, nunca 500.
        for (String gigante : new String[] {"1000000", "2147483647", "9223372036854775807"}) {
            JsonNode vazia = api.get(LISTA + "?pagina=" + gigante + "&tamanho=100", null, 200);
            assertThat(vazia.get("lojas")).isEmpty();
            assertThat(vazia.get("total").asLong()).isGreaterThanOrEqualTo(3);
        }
    }

    // ---- equipe: opt-in da consultoria ----

    @Test
    void optInDaConsultoriaGravaLeAudita() throws Exception {
        JsonNode admin = api.novoTreinador();
        UUID consultoria = consultoriaDe(admin, "Aluno Fictício Config " + id);
        assertThat(api.get(CONFIG, admin, 200).get("noMarketplace").asBoolean()).isFalse();

        JsonNode ligada = api.put(CONFIG, admin, Map.of("paginaLigada", true, "noMarketplace", true), 200);
        assertThat(ligada.get("noMarketplace").asBoolean()).isTrue();
        assertThat(api.get(CONFIG, admin, 200).get("noMarketplace").asBoolean()).isTrue();
        long versao = ligada.get("versao").asLong();

        // Mesmo valor não grava (a versão não sobe) nem audita.
        JsonNode igual = api.put(CONFIG, admin, Map.of("paginaLigada", true, "noMarketplace", true, "versao", versao), 200);
        assertThat(igual.get("versao").asLong()).isEqualTo(versao);

        // Ausente = falso: sai do marketplace; ligar a página e o marketplace são mudanças independentes.
        JsonNode sem = api.put(CONFIG, admin, Map.of("paginaLigada", true, "versao", versao), 200);
        assertThat(sem.get("noMarketplace").asBoolean()).isFalse();
        assertThat(sem.get("paginaLigada").asBoolean()).isTrue();
        assertThat(sem.get("versao").asLong()).isGreaterThan(versao);

        // Versão velha ou ausente: 409 e nada muda.
        assertThat(api.put(CONFIG, admin, Map.of("paginaLigada", true, "noMarketplace", true, "versao", versao), 409).get("codigo").asString())
                .isEqualTo("CONFLITO_EDICAO");
        assertThat(api.get(CONFIG, admin, 200).get("noMarketplace").asBoolean()).isFalse();

        // Auditoria de resumo fixo: uma ao entrar e uma ao sair, sem nada da consultoria.
        List<String> resumos = jdbc.queryForList(
                "select resumo from auditoria where consultoria_id = ? and acao = 'VITRINE_MARKETPLACE_ALTERADO' order by criado_em",
                String.class, consultoria);
        assertThat(resumos).containsExactly("Entrou na Vitrine de consultorias.", "Saiu da Vitrine de consultorias.");
    }

    @Test
    void permissoesDoOptIn() throws Exception {
        JsonNode admin = api.novoTreinador();
        consultoriaDe(admin, "Aluno Fictício Permissões " + id);
        JsonNode soLeitura = membro(admin, "Leitor fictício", ApiDeTeste.emailUnico("leitor"), Set.of("VITRINE_LER"));
        JsonNode semNada = membro(admin, "Sem nada fictício", ApiDeTeste.emailUnico("semnada"), Set.of("ALUNO_LER"));
        JsonNode comAlteracao = membro(admin, "Alterador fictício", ApiDeTeste.emailUnico("alterador"), Set.of("VITRINE_ALTERAR"));
        JsonNode criada = api.put(CONFIG, admin, Map.of("paginaLigada", true, "noMarketplace", false), 200);
        long versao = criada.get("versao").asLong();

        // Quem só lê vê o campo e não grava; sem a permissão nem lê.
        assertThat(api.get(CONFIG, soLeitura, 200).get("noMarketplace").asBoolean()).isFalse();
        api.put(CONFIG, soLeitura, Map.of("paginaLigada", true, "noMarketplace", true, "versao", versao), 403);
        api.get(CONFIG, semNada, 403);
        api.put(CONFIG, semNada, Map.of("paginaLigada", true, "noMarketplace", true, "versao", versao), 403);
        assertThat(api.get(CONFIG, admin, 200).get("noMarketplace").asBoolean()).isFalse();
        api.put(CONFIG, null, Map.of("paginaLigada", true, "noMarketplace", true, "versao", versao), 401);
        assertThat(api.put(CONFIG, comAlteracao, Map.of("paginaLigada", true, "noMarketplace", true, "versao", versao), 200)
                .get("noMarketplace").asBoolean()).isTrue();

        // O item: mesma permissão do resto da vitrine.
        Map<String, Object> corpo = corpoItem("Planilha Fictícia Permissão " + id, "DIGITAL", true, true, true);
        api.post(ITENS, soLeitura, corpo, 403);
        api.post(ITENS, semNada, corpo, 403);
        assertThat(api.post(ITENS, comAlteracao, corpo, 200).get("noMarketplace").asBoolean()).isTrue();
    }

    // ---- equipe: opt-in do item ----

    @Test
    void optInDoItemSoDigitalAusenteEFalsoComVersaoESemVazar() throws Exception {
        JsonNode admin = api.novoTreinador();
        UUID consultoria = consultoriaDe(admin, "Aluno Fictício Item " + id);

        JsonNode erro = api.post(ITENS, admin, corpoItem("Camiseta Fictícia " + id, "FISICO", true, false, true), 422);
        assertThat(erro.get("codigo").asString()).isEqualTo("VITRINE_ITEM_INVALIDO");
        assertThat(erro.get("fieldErrors").get(0).get("field").asString()).isEqualTo("noMarketplace");

        JsonNode criado = api.post(ITENS, admin, corpoItem("Planilha Fictícia " + id, "DIGITAL", true, true, true), 200);
        assertThat(criado.get("noMarketplace").asBoolean()).isTrue();
        UUID itemId = UUID.fromString(criado.get("id").asString());

        // Trocar para FISICO sem tirar do marketplace = 422; tirando, passa.
        Map<String, Object> troca = corpoItem("Planilha Fictícia " + id, "FISICO", true, false, true);
        troca.put("versao", criado.get("versao").asLong());
        assertThat(api.put(ITENS + "/" + itemId, admin, troca, 422).get("fieldErrors").get(0).get("field").asString())
                .isEqualTo("noMarketplace");
        troca.put("noMarketplace", false);
        assertThat(api.put(ITENS + "/" + itemId, admin, troca, 200).get("noMarketplace").asBoolean()).isFalse();

        // Versão errada = 409 e nada muda; o opt-in não aparece nas respostas do aluno nem na página pública.
        Map<String, Object> velha = corpoItem("Planilha Fictícia " + id, "DIGITAL", true, true, true);
        velha.put("versao", 99);
        api.put(ITENS + "/" + itemId, admin, velha, 409);
        assertThat(api.get(ITENS, admin, 200).get(0).get("noMarketplace").asBoolean()).isFalse();

        // Ausente = falso.
        Map<String, Object> semCampo = corpoItem("Outra Planilha Fictícia " + id, "DIGITAL", true, true, true);
        semCampo.remove("noMarketplace");
        assertThat(api.post(ITENS, admin, semCampo, 200).get("noMarketplace").asBoolean()).isFalse();
        item(admin, corpoItem("Planilha Marcada " + id, "DIGITAL", true, true, true));
        String codigo = api.put(CONFIG, admin, Map.of("paginaLigada", true, "noMarketplace", true), 200).get("codigo").asString();
        JsonNode pagina = api.get("/publico/loja/" + codigo, null, 200);
        assertThat(pagina.toString()).doesNotContain("noMarketplace");
        assertThat(jdbc.queryForObject("select count(*) from vitrine_item where consultoria_id = ?", Integer.class, consultoria))
                .isEqualTo(3);
    }

    @Test
    void bancoRecusaItemFisicoNoMarketplace() throws Exception {
        JsonNode admin = api.novoTreinador();
        UUID consultoria = consultoriaDe(admin, "Aluno Fictício Banco " + id);
        assertThatThrownBy(() -> jdbc.update("""
                insert into vitrine_item (id, consultoria_id, nome, tipo, ativo, ordem, no_marketplace)
                values (?, ?, 'Camiseta Fictícia', 'FISICO', true, 0, true)""", UUID.randomUUID(), consultoria))
                .isInstanceOf(DataIntegrityViolationException.class)
                .hasMessageContaining("ck_vitrine_item_marketplace_so_digital");
    }

    // ---- GET /eu ----

    @Test
    void euTrazMarketplaceHabilitadoParaEquipeEAluno() throws Exception {
        JsonNode admin = api.novoTreinador();
        UUID aluno = api.criarAluno(admin, "Aluno Fictício Eu " + id);
        JsonNode login = api.convidarEEntrar(admin, aluno);
        assertThat(api.get("/eu", admin, 200).get("marketplaceHabilitado").asBoolean()).isTrue();
        assertThat(api.get("/eu", login, 200).get("marketplaceHabilitado").asBoolean()).isTrue();
    }
}
