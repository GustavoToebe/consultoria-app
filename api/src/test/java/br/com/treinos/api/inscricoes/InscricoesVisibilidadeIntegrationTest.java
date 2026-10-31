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

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Análise 4, B8 (30/10): "o cadastro enviado pelo formulário sumiu". Trava, caso a caso, onde a inscrição fica e em
 * qual tela ela aparece: a lista padrão só traz as abertas, a busca respeita a situação, "Meus" respeita o responsável,
 * reabrir mantém a data original, a retenção conta do encerramento, e o envio público que não grava responde com erro
 * (nunca com sucesso). Cada teste roda numa consultoria nova, então as consultas olham só os dados do próprio teste. Só
 * dados fictícios.
 */
@AutoConfigureMockMvc
class InscricoesVisibilidadeIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate banco;
    @Autowired private InscricaoRetencao retencao;

    private ApiDeTeste api;
    private JsonNode admin;
    private String codigo;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        codigo = abrirLink(admin, null);
    }

    // ---- auxiliares ----

    private static String usuarioId(JsonNode login) {
        return login.path("usuario").path("id").asString();
    }

    private UUID consultoriaDe(JsonNode login) {
        return banco.queryForObject("select consultoria_id from usuario where id = ?::uuid", UUID.class, usuarioId(login));
    }

    private String abrirLink(JsonNode login, String responsavelId) throws Exception {
        JsonNode atual = api.get("/inscricoes/configuracao", login, 200);
        Map<String, Object> corpo = new HashMap<>();
        corpo.put("aberta", true);
        corpo.put("responsavelId", responsavelId);
        corpo.put("texto", null);
        corpo.put("versao", atual.path("versao").isNull() ? null : atual.path("versao").asLong());
        return api.put("/inscricoes/configuracao", login, corpo, 200).path("codigo").asString();
    }

    private static Map<String, Object> corpo(String nome, String whatsapp, String email) {
        Map<String, Object> corpo = new HashMap<>();
        corpo.put("nome", nome);
        corpo.put("whatsapp", whatsapp);
        corpo.put("email", email);
        return corpo;
    }

    private static Map<String, Object> mapa(Object... pares) {
        Map<String, Object> m = new HashMap<>();
        for (int k = 0; k < pares.length; k += 2) m.put((String) pares[k], pares[k + 1]);
        return m;
    }

    /** Envia pelo link público (202) e devolve o id da inscrição, achada pelo e-mail único do próprio teste. */
    private String inscrever(Map<String, Object> corpo) throws Exception {
        JsonNode resposta = api.post("/publico/inscricoes/" + codigo, null, corpo, 202);
        assertThat(resposta.propertyNames()).containsExactly("mensagem");
        JsonNode achadas = api.get("/inscricoes?situacao=TODAS&busca=" + corpo.get("email"), admin, 200);
        assertThat(achadas.path("total").asLong()).isGreaterThanOrEqualTo(1);
        return achadas.path("itens").get(0).path("id").asString();
    }

    private String inscrever(String nome, String whatsapp) throws Exception {
        return inscrever(corpo(nome, whatsapp, ApiDeTeste.emailUnico("interessado")));
    }

    private JsonNode detalhe(String id) throws Exception {
        return api.get("/inscricoes/" + id, admin, 200);
    }

    private long versao(String id) throws Exception {
        return detalhe(id).path("versao").asLong();
    }

    private void aceitar(String id) throws Exception {
        api.post("/inscricoes/" + id + "/aceitar", admin, mapa("convidar", false, "versao", versao(id)), 200);
    }

    private void encerrar(String id, String situacao) throws Exception {
        api.post("/inscricoes/" + id + "/encerrar", admin, mapa("situacao", situacao, "motivo", "PRECO", "versao", versao(id)), 200);
    }

    private List<String> ids(String consulta, JsonNode login) throws Exception {
        List<String> ids = new ArrayList<>();
        api.get("/inscricoes" + consulta, login, 200).path("itens").forEach(i -> ids.add(i.path("id").asString()));
        return ids;
    }

    private List<String> ids(String consulta) throws Exception {
        return ids(consulta, admin);
    }

    private long total(String consulta) throws Exception {
        return api.get("/inscricoes" + consulta, admin, 200).path("total").asLong();
    }

    private long quantas(UUID consultoria) {
        Long n = banco.queryForObject("select count(*) from inscricao where consultoria_id = ?", Long.class, consultoria);
        return n == null ? 0 : n;
    }

    /** Segundo membro ativo da equipe (perfil do administrador), para ser outro responsável. */
    private JsonNode outroMembro() throws Exception {
        String perfilId = api.get("/eu", admin, 200).path("perfil").path("id").asString();
        JsonNode convite = api.post("/usuarios/convites", admin, mapa("nome", "Membro Teste",
                "email", ApiDeTeste.emailUnico("membro"), "perfilId", perfilId), 200);
        return api.post("/publico/convites-equipe/aceitar", null,
                mapa("codigo", convite.path("codigo").asString(), "senha", ApiDeTeste.SENHA), 200);
    }

    private void envelhecer(String id, Duration idade) {
        Timestamp antes = Timestamp.from(Instant.now().minus(idade));
        banco.update("update inscricao set criada_em = ?, atualizada_em = ?, ultima_atividade_em = ? where id = ?::uuid",
                antes, antes, antes, id);
    }

    // ---- casos 3 e 4: a busca respeita a situação; o filtro padrão são as abertas ----

    @Test
    void listaPadraoEBuscaSoTrazemAsAbertasEAsContagensDizemOndeAEncerradaEsta() throws Exception {
        String emailJoao = ApiDeTeste.emailUnico("joao.teste");
        String emailLuiza = ApiDeTeste.emailUnico("luiza.teste");
        String maria = inscrever("Maria Teste Ávila", "11987650011");
        String joao = inscrever(corpo("João Teste Recusado", "11987650012", emailJoao));
        String luiza = inscrever(corpo("Luiza Teste Aberta", "11987650013", emailLuiza));
        aceitar(maria);
        encerrar(joao, "RECUSADA");

        // Sem filtro, a lista traz só as abertas: a aceita e a recusada saem sem aviso (é o desenho do filtro).
        assertThat(ids("")).containsExactly(luiza);
        assertThat(ids("?situacao=ABERTAS")).containsExactly(luiza);
        assertThat(ids("?situacao=TODAS")).containsExactly(luiza, joao, maria);
        assertThat(ids("?situacao=ACEITA")).containsExactly(maria);
        assertThat(ids("?situacao=RECUSADA")).containsExactly(joao);

        // A busca respeita a situação: no filtro padrão ela NÃO acha a aceita nem a recusada...
        assertThat(total("?busca=maria teste avila")).isZero();
        assertThat(total("?busca=" + emailJoao.toUpperCase(java.util.Locale.ROOT))).isZero();
        assertThat(total("?busca=0012")).isZero();
        // ...mas acha em "Todas" ou na situação certa (nome sem acento e em maiúsculas, e-mail em maiúsculas, WhatsApp).
        assertThat(ids("?situacao=TODAS&busca=MARIA TESTE AVILA")).containsExactly(maria);
        assertThat(ids("?situacao=ACEITA&busca=maria")).containsExactly(maria);
        assertThat(ids("?situacao=TODAS&busca=" + emailJoao.toUpperCase(java.util.Locale.ROOT))).containsExactly(joao);
        assertThat(ids("?situacao=RECUSADA&busca=(11) 98765-0012")).containsExactly(joao);
        assertThat(ids("?situacao=DESISTIU&busca=joao")).isEmpty();
        // Uma aberta é achada por nome, e-mail e WhatsApp, com ou sem máscara, no filtro padrão.
        assertThat(ids("?busca=LUIZA")).containsExactly(luiza);
        assertThat(ids("?busca=" + emailLuiza.toUpperCase(java.util.Locale.ROOT))).containsExactly(luiza);
        assertThat(ids("?busca=(11) 98765-0013")).containsExactly(luiza);
        assertThat(ids("?busca=11987650013")).containsExactly(luiza);
        assertThat(ids("?busca=0013")).containsExactly(luiza);
        assertThat(total("?busca=013")).isZero(); // menos de 4 dígitos não busca WhatsApp

        // As contagens usam a mesma busca e mostram onde a encerrada está: é o que a tela exibe nos chips de situação.
        JsonNode daBusca = api.get("/inscricoes/contagens?busca=maria", admin, 200);
        assertThat(daBusca.path("abertas").asLong()).isZero();
        assertThat(daBusca.path("porSituacao").path("ACEITA").asLong()).isEqualTo(1);
        assertThat(daBusca.path("todas").asLong()).isEqualTo(1);
        JsonNode geral = api.get("/inscricoes/contagens", admin, 200);
        assertThat(geral.path("abertas").asLong()).isEqualTo(1);
        assertThat(geral.path("porSituacao").path("ACEITA").asLong()).isEqualTo(1);
        assertThat(geral.path("porSituacao").path("RECUSADA").asLong()).isEqualTo(1);
        assertThat(geral.path("todas").asLong()).isEqualTo(3);
    }

    @Test
    void buscaPeloWhatsappAchaComEmSemMascaraEComCodigoDoPais() throws Exception {
        String id = inscrever("Pessoa Teste Whatsapp", "11987650021");
        assertThat(detalhe(id).path("whatsapp").asString()).isEqualTo("(11) 98765-0021");
        for (String busca : List.of("(11) 98765-0021", "11987650021", "98765-0021", "0021",
                "+55 11 98765-0021", "5511987650021", "+55 (11) 98765-0021")) {
            assertThat(ids("?busca=" + busca)).as("busca por %s", busca).containsExactly(id);
        }
    }

    // ---- caso 2: mesmo e-mail e mesmo WhatsApp ----

    @Test
    void mesmoEmailEWhatsappEnviadosDeNovoCriamOutraInscricaoComAvisoSemEsconderAPrimeira() throws Exception {
        String email = ApiDeTeste.emailUnico("repetida");
        String primeira = inscrever(corpo("Maria Teste Primeira", "11987650031", email));
        // Segundo envio: mesmo WhatsApp e e-mail (em maiúsculas). O interessado recebe a mesma resposta neutra.
        api.post("/publico/inscricoes/" + codigo, null, corpo("Maria Teste Segunda", "(11) 98765-0031", email.toUpperCase(java.util.Locale.ROOT)), 202);

        assertThat(total("?situacao=TODAS")).isEqualTo(2);
        List<String> abertas = ids("");
        assertThat(abertas).hasSize(2).contains(primeira);
        for (JsonNode i : api.get("/inscricoes", admin, 200).path("itens")) {
            assertThat(i.path("duplicidade").path("outrasInscricoesAbertas").asInt()).isEqualTo(1);
            assertThat(i.path("situacao").asString()).isEqualTo("NOVA");
        }
        // Nada substituído: a primeira segue com o próprio nome e a segunda aparece acima dela (mais nova primeiro).
        assertThat(detalhe(primeira).path("nome").asString()).isEqualTo("Maria Teste Primeira");
        assertThat(abertas.getLast()).isEqualTo(primeira);
        assertThat(api.get("/inscricoes/contagens", admin, 200).path("abertas").asLong()).isEqualTo(2);
    }

    // ---- caso 4: responsável, "Meus" e "Sem responsável" ----

    @Test
    void inscricaoDeOutroResponsavelSaiDeMeusEResponsavelDesativadoSaiDeSemResponsavel() throws Exception {
        JsonNode outro = outroMembro();
        String outroId = usuarioId(outro);
        codigo = abrirLink(admin, outroId);
        String doOutro = inscrever("Pessoa Teste do Outro", "11987650041");

        assertThat(ids("?meus=true")).isEmpty();
        assertThat(ids("?meus=true&situacao=TODAS")).isEmpty();
        assertThat(ids("?meus=true", outro)).containsExactly(doOutro);
        assertThat(ids("?responsavel=" + outroId)).containsExactly(doOutro);
        assertThat(ids("?responsavel=nenhum")).isEmpty();
        assertThat(ids("")).containsExactly(doOutro);
        assertThat(api.get("/inscricoes/contagens?meus=true", admin, 200).path("todas").asLong()).isZero();

        // Responsável padrão desativado antes do envio: a inscrição entra sem responsável (nunca perdida).
        banco.update("update usuario set ativo = false where id = ?::uuid", outroId);
        String semResponsavel = inscrever("Pessoa Teste Sem Dono", "11987650042");
        assertThat(detalhe(semResponsavel).path("responsavelId").isNull()).isTrue();
        assertThat(ids("?responsavel=nenhum")).containsExactly(semResponsavel);
        assertThat(ids("")).containsExactlyInAnyOrder(doOutro, semResponsavel);
        // Já gravada com o responsável que depois foi desativado: continua na lista geral e no filtro dele; só some de
        // "Sem responsável" e de "Meus" de quem não é ele.
        assertThat(ids("?responsavel=" + outroId)).containsExactly(doOutro);
        assertThat(detalhe(doOutro).path("responsavelId").asString()).isEqualTo(outroId);
    }

    // ---- caso 5: aceite ----

    @Test
    void aceiteComEmailDeAlunoExistenteDeixaAInscricaoNaListaAbertaEAceiteRepetidoNaoMexeNaAceita() throws Exception {
        UUID consultoria = consultoriaDe(admin);
        String email = ApiDeTeste.emailUnico("ja-aluno");
        api.post("/alunos", admin, mapa("nome", "Aluno Teste Antigo", "email", email), 200);
        String conflito = inscrever(corpo("Pessoa Teste Conflito", "11987650051", email.toUpperCase(java.util.Locale.ROOT)));
        long versaoAntes = versao(conflito);
        Long alunosAntes = banco.queryForObject("select count(*) from aluno where consultoria_id = ?", Long.class, consultoria);

        JsonNode recusa = api.post("/inscricoes/" + conflito + "/aceitar", admin, mapa("convidar", false, "versao", versaoAntes), 409);
        assertThat(recusa.path("codigo").asString()).isEqualTo("ALUNO_JA_EXISTE");
        assertThat(ids("")).containsExactly(conflito);
        assertThat(ids("?situacao=ACEITA")).isEmpty();
        assertThat(detalhe(conflito).path("situacao").asString()).isEqualTo("NOVA");
        assertThat(versao(conflito)).isEqualTo(versaoAntes);
        assertThat(banco.queryForObject("select count(*) from aluno where consultoria_id = ?", Long.class, consultoria))
                .isEqualTo(alunosAntes);

        // Aceite normal: sai da lista aberta, entra em "Aceitas"; o segundo aceite é 409 e nada muda.
        String normal = inscrever("Pessoa Teste Normal", "11987650052");
        aceitar(normal);
        assertThat(ids("")).containsExactly(conflito);
        assertThat(ids("?situacao=ACEITA")).containsExactly(normal);
        JsonNode repetido = api.post("/inscricoes/" + normal + "/aceitar", admin, mapa("convidar", false, "versao", versao(normal)), 409);
        assertThat(repetido.path("codigo").asString()).isEqualTo("INSCRICAO_JA_ACEITA");
        assertThat(ids("?situacao=ACEITA")).containsExactly(normal);
        assertThat(banco.queryForObject("select count(*) from aluno where consultoria_id = ?", Long.class, consultoria))
                .isEqualTo(alunosAntes + 1);
    }

    // ---- casos 6 e 9: reabrir mantém a data original; a lista pagina, mais nova primeiro ----

    @Test
    void reabrirVoltaParaAListaAbertaNaPosicaoDaDataOriginal() throws Exception {
        String antiga = inscrever("Pessoa Teste Antiga", "11987650061");
        envelhecer(antiga, Duration.ofHours(2));
        String nova = inscrever("Pessoa Teste Nova", "11987650062");
        encerrar(antiga, "DESISTIU");
        String criadaEm = detalhe(antiga).path("criadaEm").asString();

        assertThat(ids("")).containsExactly(nova);
        assertThat(ids("?situacao=DESISTIU")).containsExactly(antiga);

        api.post("/inscricoes/" + antiga + "/reabrir", admin, mapa("motivo", "Voltou a chamar.", "versao", versao(antiga)), 200);
        JsonNode reaberta = detalhe(antiga);
        assertThat(reaberta.path("ciclo").asInt()).isEqualTo(2);
        assertThat(reaberta.path("situacao").asString()).isEqualTo("EM_CONTATO");
        assertThat(reaberta.path("criadaEm").asString()).isEqualTo(criadaEm);
        // Volta para a lista aberta, mas ordenada pela data de entrada: fica abaixo da mais nova, não no topo.
        assertThat(ids("")).containsExactly(nova, antiga);
        assertThat(ids("?situacao=DESISTIU")).isEmpty();

        // Aceita não reabre.
        aceitar(nova);
        api.post("/inscricoes/" + nova + "/reabrir", admin, mapa("motivo", "x", "versao", versao(nova)), 409);
        assertThat(ids("")).containsExactly(antiga);
    }

    @Test
    void listaPaginaDe30EOCadastroNovoFicaNaPrimeiraPagina() throws Exception {
        UUID consultoria = consultoriaDe(admin);
        banco.update("insert into inscricao (id, consultoria_id, nome, whatsapp, criada_em) select gen_random_uuid(), ?, "
                + "'Pessoa Teste ' || g, '(11) 98765-4321', now() - interval '1 day' from generate_series(1, 31) g", consultoria);
        String nova = inscrever("Pessoa Teste Recem Chegada", "11987650071");

        JsonNode primeira = api.get("/inscricoes", admin, 200);
        assertThat(primeira.path("total").asLong()).isEqualTo(32);
        assertThat(primeira.path("itens")).hasSize(30);
        assertThat(primeira.path("itens").get(0).path("id").asString()).isEqualTo(nova);
        JsonNode segunda = api.get("/inscricoes?pagina=1", admin, 200);
        assertThat(segunda.path("itens")).hasSize(2);
        assertThat(api.get("/inscricoes?pagina=2", admin, 200).path("itens")).isEmpty();
        assertThat(api.get("/inscricoes?tamanho=1000", admin, 200).path("itens")).hasSize(32);
    }

    // ---- caso 7: retenção ----

    @Test
    void retencaoContaDoEncerramentoEUmaAbertaVelhaNuncaESaiDaLista() throws Exception {
        UUID consultoria = consultoriaDe(admin);
        String id = inscrever("Pessoa Teste Antiga Demais", "11987650081");
        envelhecer(id, Duration.ofDays(200));
        Instant limite = Instant.now().minus(InscricaoRetencao.PRAZO);

        // Aberta e parada há 200 dias: a retenção só apaga recusada ou desistente.
        retencao.limpar(limite);
        assertThat(ids("")).containsExactly(id);

        // Encerrar agora é atividade: o prazo de 180 dias conta do encerramento, não da entrada.
        encerrar(id, "RECUSADA");
        retencao.limpar(limite);
        assertThat(ids("?situacao=TODAS")).containsExactly(id);

        // Reabrir também renova; só encerrada e parada há mais de 180 dias é apagada.
        envelhecer(id, Duration.ofDays(181));
        assertThat(quantas(consultoria)).isEqualTo(1);
        retencao.limpar(limite);
        assertThat(quantas(consultoria)).isZero();
        api.get("/inscricoes/" + id, admin, 404);
    }

    // ---- caso 1 e 10: envio público que não grava responde com erro claro, nunca com sucesso ----

    @Test
    void envioQueNaoGravaResponde4xxComMensagemEnadaFicaGravado() throws Exception {
        UUID consultoria = consultoriaDe(admin);
        // WhatsApp inválido: 400 com a mensagem; e-mail inválido: 400 com o campo; nome em branco: 400.
        JsonNode whatsapp = api.post("/publico/inscricoes/" + codigo, null, corpo("Pessoa Teste", "123", null), 400);
        assertThat(whatsapp.path("message").asString()).contains("Telefone inválido");
        JsonNode email = api.post("/publico/inscricoes/" + codigo, null, corpo("Pessoa Teste", "11987650091", "sem-arroba"), 400);
        assertThat(email.path("fieldErrors").toString()).contains("email");
        api.post("/publico/inscricoes/" + codigo, null, corpo(" ", "11987650091", null), 400);
        assertThat(quantas(consultoria)).isZero();

        // Link desligado e código trocado: 404 com a mensagem do link, nada gravado.
        String antigo = codigo;
        codigo = api.post("/inscricoes/configuracao/novo-link", admin,
                mapa("versao", api.get("/inscricoes/configuracao", admin, 200).path("versao").asLong()), 200).path("codigo").asString();
        assertThat(api.post("/publico/inscricoes/" + antigo, null, corpo("Pessoa Teste", "11987650091", null), 404)
                .path("message").asString()).contains("Link de inscrição inválido");
        JsonNode atual = api.get("/inscricoes/configuracao", admin, 200);
        api.put("/inscricoes/configuracao", admin, mapa("aberta", false, "responsavelId", null, "texto", null,
                "versao", atual.path("versao").asLong()), 200);
        api.post("/publico/inscricoes/" + codigo, null, corpo("Pessoa Teste", "11987650091", null), 404);
        assertThat(quantas(consultoria)).isZero();
    }
}
