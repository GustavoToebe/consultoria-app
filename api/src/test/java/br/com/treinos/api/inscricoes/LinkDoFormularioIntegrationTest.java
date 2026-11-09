package br.com.treinos.api.inscricoes;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Link público do formulário de inscrição com uma fonte só, o próprio questionário (correções da revisão da V064, V067):
 * código sempre gerado no servidor e nunca aceito do cliente, "gerar novo link" e fechar agindo na coluna que a página
 * pública lê (o código antigo dá 404), só formulário de inscrição tem link, outra consultoria dá 404, a ação do link é de
 * {@code INSCRICAO_ALTERAR} (não de {@code QUESTIONARIO_ALTERAR}) e fica na auditoria com resumo fixo. Só dados fictícios.
 */
@AutoConfigureMockMvc
class LinkDoFormularioIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate banco;

    private ApiDeTeste api;
    private JsonNode admin;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
    }

    // ---- auxiliares ----

    private static String usuarioId(JsonNode login) {
        return login.path("usuario").path("id").asString();
    }

    private UUID consultoriaDe(JsonNode login) {
        return banco.queryForObject("select consultoria_id from usuario where id = ?::uuid", UUID.class, usuarioId(login));
    }

    private void perfil(JsonNode login, String nome) {
        banco.update("update usuario u set perfil_id = p.id from perfil p where u.id = ?::uuid "
                + "and p.consultoria_id = u.consultoria_id and p.nome = ?", usuarioId(login), nome);
    }

    /** O formulário de inscrição padrão da consultoria. */
    private String padrao(JsonNode login) throws Exception {
        return api.get("/questionarios?finalidade=INSCRICAO", login, 200).get(0).path("id").asString();
    }

    private JsonNode link(JsonNode login, String id, int status) throws Exception {
        return api.get("/questionarios/" + id + "/link", login, status);
    }

    /** Abre o link do formulário pela rota própria e devolve a configuração. */
    private JsonNode abrir(JsonNode login, String id) throws Exception {
        Map<String, Object> corpo = new HashMap<>();
        corpo.put("aberta", true);
        corpo.put("versao", link(login, id, 200).path("versao").asLong());
        return api.put("/questionarios/" + id + "/link", login, corpo, 200);
    }

    private JsonNode novoLink(JsonNode login, String id) throws Exception {
        return api.post("/questionarios/" + id + "/link/novo-link", login,
                Map.of("versao", link(login, id, 200).path("versao").asLong()), 200);
    }

    private static Map<String, Object> inscricao(String nome) {
        Map<String, Object> corpo = new HashMap<>();
        corpo.put("nome", nome);
        corpo.put("whatsapp", "11987654321");
        return corpo;
    }

    private JsonNode criar(JsonNode login, String nome, String finalidade) throws Exception {
        return api.post("/questionarios", login, Map.of("nome", nome, "origem", "VAZIO", "finalidade", finalidade), 200);
    }

    /** Salva o rascunho como está (o que o editor faz), com os campos extras dados. */
    private JsonNode salvar(JsonNode login, JsonNode q, Map<String, Object> extras, int status) throws Exception {
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("nome", q.path("nome").asString());
        corpo.put("conteudo", q.path("rascunho"));
        corpo.put("versao", q.path("versao").asLong());
        corpo.putAll(extras);
        return api.put("/questionarios/" + q.path("id").asString(), login, corpo, status);
    }

    // ---- isolamento ----

    @Test
    void linkDeOutraConsultoriaDa404EmTodasAsRotas() throws Exception {
        JsonNode outro = api.novoTreinador();
        String id = padrao(admin);
        abrir(admin, id);
        link(outro, id, 404);
        api.put("/questionarios/" + id + "/link", outro, Map.of("aberta", false, "versao", 0), 404);
        api.put("/questionarios/" + id + "/link/campos-ocultos", outro, Map.of("camposOcultos", List.of(), "versao", 0), 404);
        api.post("/questionarios/" + id + "/link/novo-link", outro, Map.of("versao", 0), 404);
        // Nada mudou para o dono.
        assertThat(link(admin, id, 200).path("aberta").asBoolean()).isTrue();
    }

    // ---- código só do servidor ----

    @Test
    void codigoVemSoDoServidorECodigoDoClienteEIgnorado() throws Exception {
        String id = padrao(admin);
        JsonNode aberto = abrir(admin, id);
        String codigo = aberto.path("codigo").asString();
        // 144 bits em base64 url-safe (24 caracteres), não os 64 bits do código antigo.
        assertThat(codigo).matches("[A-Za-z0-9_-]{24}");

        JsonNode q = api.get("/questionarios/" + id, admin, 200);
        Map<String, Object> doCliente = new HashMap<>();
        doCliente.put("codigoPublico", "CodigoEscolhidoPeloClienteFicticio1");
        doCliente.put("publicoAberto", false);
        doCliente.put("responsavelPadraoId", usuarioId(admin));
        JsonNode salvo = salvar(admin, q, doCliente, 200);
        // O salvar do editor não mexe no link: código, abertura e responsável continuam os do servidor.
        assertThat(salvo.path("codigoPublico").asString()).isEqualTo(codigo);
        assertThat(salvo.path("publicoAberto").asBoolean()).isTrue();
        assertThat(salvo.path("responsavelPadraoId").isNull()).isTrue();
        api.get("/publico/inscricoes/CodigoEscolhidoPeloClienteFicticio1", null, 404);
        api.get("/publico/inscricoes/" + codigo, null, 200);

        // Criar também não entrega código: ele nasce no primeiro "abrir".
        JsonNode novo = criar(admin, "Inscrição sem código fictícia", "INSCRICAO");
        assertThat(novo.path("codigoPublico").isNull()).isTrue();
        assertThat(link(admin, novo.path("id").asString(), 200).path("codigo").isNull()).isTrue();
    }

    @Test
    void novoLinkEFecharRevogamOCodigoAntigoNaHora() throws Exception {
        String id = padrao(admin);
        String antigo = abrir(admin, id).path("codigo").asString();
        api.get("/publico/inscricoes/" + antigo, null, 200);

        JsonNode renovado = novoLink(admin, id);
        String atual = renovado.path("codigo").asString();
        assertThat(atual).isNotEqualTo(antigo);
        // O código antigo morre de verdade (página e envio), mesmo com o formulário ainda aberto.
        api.get("/publico/inscricoes/" + antigo, null, 404);
        api.post("/publico/inscricoes/" + antigo, null, inscricao("Pessoa Fictícia Antiga"), 404);
        api.get("/publico/inscricoes/" + atual, null, 200);

        // Fechar: o código atual dá 404 e reabrir devolve o mesmo código (só "gerar novo link" troca).
        api.put("/questionarios/" + id + "/link", admin,
                Map.of("aberta", false, "versao", renovado.path("versao").asLong()), 200);
        api.get("/publico/inscricoes/" + atual, null, 404);
        api.post("/publico/inscricoes/" + atual, null, inscricao("Pessoa Fictícia Fechada"), 404);
        assertThat(abrir(admin, id).path("codigo").asString()).isEqualTo(atual);
        api.get("/publico/inscricoes/" + atual, null, 200);
        assertThat(api.get("/inscricoes?situacao=TODAS", admin, 200).path("total").asLong()).isZero();
    }

    @Test
    void codigoDaTabelaAntigaNaoAbreMaisNada() throws Exception {
        UUID consultoria = consultoriaDe(admin);
        String legado = "L" + UUID.randomUUID().toString().replace("-", "").substring(0, 23);
        banco.update("insert into inscricao_configuracao(id, consultoria_id, codigo, aberta) values (gen_random_uuid(), ?, ?, true)",
                consultoria, legado);
        api.get("/publico/inscricoes/" + legado, null, 404);
        api.post("/publico/inscricoes/" + legado, null, inscricao("Pessoa Fictícia Legado"), 404);
    }

    @Test
    void formularioArquivadoFechaOLinkENaoReabre() throws Exception {
        JsonNode q = criar(admin, "Inscrição campanha fictícia", "INSCRICAO");
        String id = q.path("id").asString();
        String codigo = abrir(admin, id).path("codigo").asString();
        api.get("/publico/inscricoes/" + codigo, null, 200);
        api.post("/questionarios/" + id + "/arquivar", admin, null, 200);
        api.get("/publico/inscricoes/" + codigo, null, 404);
        JsonNode atual = link(admin, id, 200);
        assertThat(atual.path("aberta").asBoolean()).isFalse();
        assertThat(api.put("/questionarios/" + id + "/link", admin,
                Map.of("aberta", true, "versao", atual.path("versao").asLong()), 409).path("codigo").asString())
                .isEqualTo("QUESTIONARIO_ARQUIVADO");
        // Desarquivar não recoloca o link no ar: abrir é uma ação própria.
        api.post("/questionarios/" + id + "/desarquivar", admin, null, 200);
        api.get("/publico/inscricoes/" + codigo, null, 404);
        assertThat(link(admin, id, 200).path("aberta").asBoolean()).isFalse();
    }

    // ---- só inscrição tem link ----

    @Test
    void anamneseNaoTemLinkPublico() throws Exception {
        JsonNode anamnese = criar(admin, "Anamnese fictícia", "ANAMNESE");
        String id = anamnese.path("id").asString();
        assertThat(api.put("/questionarios/" + id + "/link", admin, Map.of("aberta", true, "versao", 0), 409)
                .path("codigo").asString()).isEqualTo("LINK_SO_DA_INSCRICAO");
        api.post("/questionarios/" + id + "/link/novo-link", admin, Map.of("versao", 0), 409);
        api.put("/questionarios/" + id + "/link/campos-ocultos", admin, Map.of("camposOcultos", List.of(), "versao", 0), 409);
        assertThat(link(admin, id, 200).path("codigo").isNull()).isTrue();

        // O banco também recusa (CHECK da V067), então nem um UPDATE direto cria uma anamnese pública.
        assertThatThrownBy(() -> banco.update("update questionario set codigo_publico = ? where id = ?::uuid",
                "AnamnesePublicaFicticia0001", id)).hasMessageContaining("ck_questionario_link_so_inscricao");

        // Encadear: de anamnese não, e para anamnese também não.
        salvar(admin, anamnese, Map.of("proximoQuestionarioId", padrao(admin)), 409);
        JsonNode inscricao = api.get("/questionarios/" + padrao(admin), admin, 200);
        assertThat(salvar(admin, inscricao, Map.of("proximoQuestionarioId", id), 409).path("codigo").asString())
                .isEqualTo("QUESTIONARIO_INDISPONIVEL");
    }

    @Test
    void proximoFormularioSoApareceNaRespostaQuandoTambemEstaAberto() throws Exception {
        String codigo = abrir(admin, padrao(admin)).path("codigo").asString();
        JsonNode segundo = criar(admin, "Inscrição seguinte fictícia", "INSCRICAO");
        JsonNode primeiro = api.get("/questionarios/" + padrao(admin), admin, 200);
        JsonNode salvo = salvar(admin, primeiro, Map.of("proximoQuestionarioId", segundo.path("id").asString()), 200);
        assertThat(salvo.path("proximoQuestionarioId").asString()).isEqualTo(segundo.path("id").asString());

        // O segundo ainda está fechado (sem código): a resposta não aponta para ele.
        assertThat(api.post("/publico/inscricoes/" + codigo, null, inscricao("Pessoa Fictícia Um"), 202)
                .path("proximoQuestionarioCodigo").isNull()).isTrue();
        String codigoDoSegundo = abrir(admin, segundo.path("id").asString()).path("codigo").asString();
        assertThat(api.post("/publico/inscricoes/" + codigo, null, inscricao("Pessoa Fictícia Dois"), 202)
                .path("proximoQuestionarioCodigo").asString()).isEqualTo(codigoDoSegundo);
        // Fechou o segundo: some de novo.
        api.put("/questionarios/" + segundo.path("id").asString() + "/link", admin,
                Map.of("aberta", false, "versao", link(admin, segundo.path("id").asString(), 200).path("versao").asLong()), 200);
        assertThat(api.post("/publico/inscricoes/" + codigo, null, inscricao("Pessoa Fictícia Tres"), 202)
                .path("proximoQuestionarioCodigo").isNull()).isTrue();
    }

    // ---- permissões ----

    @Test
    void soQuestionarioAlterarNaoMexeNoLinkEOAssistenteMexe() throws Exception {
        // Nutricionista: QUESTIONARIO_ALTERAR sem INSCRICAO_LER/ALTERAR. O conteúdo ela edita; o link não.
        JsonNode nutri = api.novoTreinador();
        String idDela = padrao(nutri);
        perfil(nutri, "Nutricionista");
        link(nutri, idDela, 403);
        api.put("/questionarios/" + idDela + "/link", nutri, Map.of("aberta", true, "versao", 0), 403);
        api.put("/questionarios/" + idDela + "/link/campos-ocultos", nutri, Map.of("camposOcultos", List.of(), "versao", 0), 403);
        api.post("/questionarios/" + idDela + "/link/novo-link", nutri, Map.of("versao", 0), 403);
        salvar(nutri, api.get("/questionarios/" + idDela, nutri, 200), Map.of(), 200);

        // Assistente: INSCRICAO_ALTERAR sem QUESTIONARIO_ALTERAR. Abre, fecha e troca o link; não edita perguntas.
        JsonNode assistente = api.novoTreinador();
        String idDoAssistente = padrao(assistente);
        perfil(assistente, "Assistente");
        JsonNode aberto = abrir(assistente, idDoAssistente);
        assertThat(aberto.path("aberta").asBoolean()).isTrue();
        assertThat(novoLink(assistente, idDoAssistente).path("codigo").asString()).isNotEqualTo(aberto.path("codigo").asString());
        salvar(assistente, api.get("/questionarios/" + idDoAssistente, assistente, 200), Map.of(), 403);

        // O editor leu o formulário antes das ações do link: salvar depois não dá 409 (o link tem versão própria) e, como o
        // UPDATE leva só o que mudou, também não devolve o código velho por cima do novo.
        String id = padrao(admin);
        JsonNode lidoPeloEditor = api.get("/questionarios/" + id, admin, 200);
        abrir(admin, id);
        String codigoAtual = novoLink(admin, id).path("codigo").asString();
        JsonNode salvo = salvar(admin, lidoPeloEditor, Map.of(), 200);
        assertThat(salvo.path("codigoPublico").asString()).isEqualTo(codigoAtual);
        api.get("/publico/inscricoes/" + codigoAtual, null, 200);
    }

    // ---- auditoria ----

    @Test
    void acoesDoLinkSaoAuditadasComResumoFixoSemOCodigo() throws Exception {
        UUID consultoria = consultoriaDe(admin);
        String id = padrao(admin);
        JsonNode aberto = abrir(admin, id);
        String codigo = aberto.path("codigo").asString();
        String novo = novoLink(admin, id).path("codigo").asString();

        List<String> resumos = banco.queryForList("select resumo from auditoria where consultoria_id = ? and entidade_id = ?::uuid "
                + "and acao in ('INSCRICAO_CONFIGURACAO_ALTERADA', 'INSCRICAO_LINK_RENOVADO') order by criado_em", String.class,
                consultoria, id);
        assertThat(resumos).containsExactly("Alterou o link de inscrição.",
                "Gerou um novo link de inscrição; o anterior parou de valer.");
        assertThat(banco.queryForObject("select count(*) from auditoria where consultoria_id = ? and (resumo like ? or resumo like ?)",
                Integer.class, consultoria, "%" + codigo + "%", "%" + novo + "%")).isZero();
    }

    // ---- texto e campos ----

    @Test
    void textoECamposEscondidosSaoDoFormularioDoLink() throws Exception {
        String id = padrao(admin);
        JsonNode config = link(admin, id, 200);
        String texto = "Texto fictício de privacidade do formulário.";
        JsonNode aberto = api.put("/questionarios/" + id + "/link", admin,
                Map.of("aberta", true, "texto", texto, "versao", config.path("versao").asLong()), 200);
        String codigo = aberto.path("codigo").asString();
        JsonNode pagina = api.get("/publico/inscricoes/" + codigo, null, 200);
        // O texto de privacidade (e não a descrição interna do formulário) é o que a página mostra e que exige a ciência.
        assertThat(pagina.path("texto").asString()).isEqualTo(texto);
        assertThat(pagina.path("questionarioNome").isNull()).isTrue();
        Map<String, Object> semCiencia = inscricao("Pessoa Fictícia Sem Ciência");
        semCiencia.put("textoVersao", pagina.path("textoVersao").asString());
        assertThat(api.post("/publico/inscricoes/" + codigo, null, semCiencia, 400).path("codigo").asString())
                .isEqualTo("CIENCIA_OBRIGATORIA");

        api.put("/questionarios/" + id + "/link/campos-ocultos", admin,
                Map.of("camposOcultos", List.of("EMAIL", "ORIGEM"), "versao", aberto.path("versao").asLong()), 200);
        assertThat(api.get("/publico/inscricoes/" + codigo, null, 200).path("campos").valueStream().map(JsonNode::asString))
                .containsExactly("SEXO", "OBJETIVO", "INTERESSE", "MODALIDADE", "PREVISAO_INICIO");
        // O detalhe do formulário também traz o que o editor precisa para mostrar o estado do link.
        JsonNode detalhe = api.get("/questionarios/" + id, admin, 200);
        assertThat(detalhe.path("textoApresentacao").asString()).isEqualTo(texto);
        assertThat(detalhe.path("camposOcultos").valueStream().map(JsonNode::asString)).containsExactly("EMAIL", "ORIGEM");
    }

    // ---- destino que não faz nada ----

    @Test
    void publicarDestinoQueNaoGravaNoCadastroDa422() throws Exception {
        JsonNode q = criar(admin, "Anamnese com destino fictícia", "ANAMNESE");
        for (String destino : List.of("NOME", "EMAIL", "DATA_NASCIMENTO", "ALTURA", "OBSERVACOES")) {
            Map<String, Object> pergunta = new LinkedHashMap<>();
            pergunta.put("id", "p1");
            pergunta.put("tipo", destino.equals("ALTURA") ? "NUMERO" : destino.equals("DATA_NASCIMENTO") ? "DATA"
                    : destino.equals("EMAIL") ? "EMAIL" : destino.equals("OBSERVACOES") ? "TEXTO_LONGO" : "TEXTO");
            pergunta.put("rotulo", "Pergunta fictícia");
            pergunta.put("destino", destino);
            Map<String, Object> corpo = new LinkedHashMap<>();
            corpo.put("nome", "Anamnese com destino fictícia");
            corpo.put("conteudo", Map.of("instrucoes", List.of(), "secoes", List.of(Map.of(
                    "uid", q.path("rascunho").path("secoes").get(0).path("uid").asString(), "titulo", "Geral",
                    "perguntas", List.of(pergunta)))));
            corpo.put("versao", api.get("/questionarios/" + q.path("id").asString(), admin, 200).path("versao").asLong());
            JsonNode salvo = api.put("/questionarios/" + q.path("id").asString(), admin, corpo, 200);
            JsonNode erro = api.post("/questionarios/" + q.path("id").asString() + "/publicar", admin,
                    Map.of("versao", salvo.path("versao").asLong(), "confirmarAvisos", true), 422);
            assertThat(erro.path("codigo").asString()).isEqualTo("QUESTIONARIO_INVALIDO");
            assertThat(erro.path("fieldErrors").valueStream().map(f -> f.path("field").asString()))
                    .contains("secoes[0].perguntas[0].destino");
        }
    }
}
