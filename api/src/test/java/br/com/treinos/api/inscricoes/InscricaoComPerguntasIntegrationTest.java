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
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * "Quero ser aluno" com as perguntas do treinador (docs/planos/inscricao-com-perguntas-proprias.md, D2 a D9): o padrão de
 * inscrição que nasce com a consultoria, a publicação que recusa os tipos de fora (D5), a imagem (D6) e o destino no
 * cadastro, a página pública só com o necessário, o envio validado pela versão (409 com a versão velha, 422 sem a
 * obrigatória), os campos fixos escondidos (D4), o isolamento entre consultorias, o detalhe do CRM, a exportação, a
 * retenção, a anonimização e a auditoria sem o que a pessoa respondeu. Só dados fictícios.
 */
@AutoConfigureMockMvc
class InscricaoComPerguntasIntegrationTest extends AbstractIntegrationTest {

    private static final String RESPOSTA = "Resposta fictícia que não pode ir à auditoria";

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate banco;
    @Autowired private InscricaoRetencao retencao;

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

    private String abrirLink(JsonNode login) throws Exception {
        JsonNode atual = api.get("/inscricoes/configuracao", login, 200);
        Map<String, Object> corpo = new HashMap<>();
        corpo.put("aberta", true);
        corpo.put("versao", atual.path("versao").isNull() ? null : atual.path("versao").asLong());
        return api.put("/inscricoes/configuracao", login, corpo, 200).path("codigo").asString();
    }

    private static Map<String, Object> inscricao(String nome) {
        Map<String, Object> corpo = new HashMap<>();
        corpo.put("nome", nome);
        corpo.put("whatsapp", "11987654321");
        return corpo;
    }

    private JsonNode pagina(String codigo) throws Exception {
        return api.get("/publico/inscricoes/" + codigo, null, 200);
    }

    private JsonNode unica(JsonNode login) throws Exception {
        JsonNode lista = api.get("/inscricoes?situacao=TODAS", login, 200);
        assertThat(lista.path("total").asLong()).isEqualTo(1);
        return lista.path("itens").get(0);
    }

    private static Map<String, Object> pergunta(String id, String tipo, Object... extras) {
        Map<String, Object> p = new LinkedHashMap<>();
        p.put("id", id);
        p.put("tipo", tipo);
        p.put("rotulo", "Pergunta fictícia " + id);
        for (int i = 0; i < extras.length; i += 2) p.put((String) extras[i], extras[i + 1]);
        return p;
    }

    private static List<Map<String, String>> opcoes(String... ids) {
        return java.util.Arrays.stream(ids).map(id -> Map.of("id", id, "rotulo", "Opção " + id)).toList();
    }

    /** Questionário de inscrição em branco com as perguntas dadas (rascunho salvo, não publicado). */
    private JsonNode rascunhoDeInscricao(JsonNode login, String nome, List<Map<String, Object>> perguntas) throws Exception {
        JsonNode q = api.post("/questionarios", login, Map.of("nome", nome, "origem", "VAZIO", "finalidade", "INSCRICAO"), 200);
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("nome", nome);
        corpo.put("conteudo", Map.of("instrucoes", List.of(), "secoes", List.of(Map.of(
                "uid", q.path("rascunho").path("secoes").get(0).path("uid").asString(), "titulo", "Sobre você",
                "perguntas", perguntas))));
        corpo.put("versao", q.path("versao").asLong());
        return api.put("/questionarios/" + q.path("id").asString(), login, corpo, 200);
    }

    private JsonNode publicar(JsonNode login, JsonNode q, int status) throws Exception {
        return api.post("/questionarios/" + q.path("id").asString() + "/publicar", login,
                Map.of("versao", q.path("versao").asLong(), "confirmarAvisos", true), status);
    }

    /** Publica e define como padrão de inscrição. */
    private JsonNode novoPadrao(JsonNode login, String nome, List<Map<String, Object>> perguntas) throws Exception {
        JsonNode publicado = publicar(login, rascunhoDeInscricao(login, nome, perguntas), 200);
        return api.post("/questionarios/" + publicado.path("id").asString() + "/padrao", login, null, 200);
    }

    private static boolean semValor(JsonNode campo) {
        return campo.isNull() || campo.isMissingNode();
    }

    private List<String> campos(JsonNode erro) {
        return erro.path("fieldErrors").valueStream().map(f -> f.path("field").asString()).toList();
    }

    // ---- padrão e publicação ----

    @Test
    void consultoriaNasceComOPadraoDeInscricaoPublicadoEAPaginaMostraSoONecessario() throws Exception {
        UUID consultoria = consultoriaDe(admin);
        assertThat(banco.queryForObject("select count(*) from questionario where consultoria_id = ? and finalidade = 'INSCRICAO'"
                + " and padrao and versao_publicada = 1 and not arquivado", Integer.class, consultoria)).isEqualTo(1);
        JsonNode lista = api.get("/questionarios?finalidade=INSCRICAO", admin, 200);
        assertThat(lista).hasSize(1);
        assertThat(lista.get(0).path("padrao").asBoolean()).isTrue();
        // Não aparece entre os de atualização nem nas opções do aluno e da pasta.
        assertThat(api.get("/questionarios/opcoes", admin, 200).valueStream()
                .map(q -> q.path("id").asString())).doesNotContain(lista.get(0).path("id").asString());

        String codigo = abrirLink(admin);
        JsonNode pagina = pagina(codigo);
        assertThat(pagina.path("campos").valueStream().map(JsonNode::asString))
                .containsExactly("EMAIL", "SEXO", "OBJETIVO", "INTERESSE", "MODALIDADE", "PREVISAO_INICIO", "ORIGEM");
        JsonNode perguntas = pagina.path("perguntas");
        assertThat(perguntas.propertyNames()).containsExactlyInAnyOrder("versaoId", "conteudo");
        JsonNode observacao = perguntas.path("conteudo").path("secoes").get(0).path("perguntas").get(0);
        assertThat(observacao.path("id").asString()).isEqualTo("observacao");
        assertThat(observacao.path("tipo").asString()).isEqualTo("TEXTO_LONGO");
        // Nada interno: nem o nome do questionário.
        assertThat(pagina.toString()).doesNotContain(lista.get(0).path("nome").asString());
    }

    @Test
    void publicacaoRecusaTiposDeForaImagemDestinoEAjudaAutomatica() throws Exception {
        JsonNode proibidos = rascunhoDeInscricao(admin, "Inscrição proibida fictícia", List.of(
                pergunta("f", "FOTOS"), pergunta("e", "ENDERECO"), pergunta("peso", "PESO"),
                pergunta("nd", "NOTAS_POR_DIA", "dias", List.of(1)), pergunta("da", "DATA_AUTOMATICA"),
                pergunta("img", "ESCOLHA_UNICA", "imagemId", "0b6f9a1e-5c3d-4e2a-9f7b-1a2b3c4d5e6f", "opcoes", opcoes("a", "b")),
                pergunta("obj", "TEXTO", "destino", "OBJETIVO"),
                pergunta("aj", "TEXTO", "ajudaAutomatica", "MEDIA_DIAS_TREINO")));
        JsonNode erro = publicar(admin, proibidos, 422);
        assertThat(erro.path("codigo").asString()).isEqualTo("QUESTIONARIO_INVALIDO");
        assertThat(campos(erro)).contains("secoes[0].perguntas[0].tipo", "secoes[0].perguntas[1].tipo",
                "secoes[0].perguntas[2].tipo", "secoes[0].perguntas[3].tipo", "secoes[0].perguntas[4].tipo",
                "secoes[0].perguntas[5].imagemId", "secoes[0].perguntas[6].destino",
                "secoes[0].perguntas[7].ajudaAutomatica");
        // Validar mostra os mesmos erros sem publicar.
        JsonNode validacao = api.post("/questionarios/" + proibidos.path("id").asString() + "/validar", admin, null, 200);
        assertThat(validacao.path("erros")).isNotEmpty();
        // Não há modelo da plataforma para a inscrição.
        api.post("/questionarios", admin, Map.of("nome", "Fábrica fictícia", "origem", "FABRICA", "finalidade", "INSCRICAO"), 400);
        // Questionário de inscrição não serve para o aluno nem para a anamnese.
        UUID aluno = api.criarAluno(admin, "Aluno Fictício Inscrição");
        JsonNode valido = novoPadrao(admin, "Inscrição válida fictícia", List.of(pergunta("t", "TEXTO")));
        api.put("/alunos/" + aluno + "/questionario", admin, Map.of("questionarioId", valido.path("id").asString()), 409);
    }

    // ---- envio ----

    @Test
    void envioValidaPelaVersaoRecusaAVelhaEAObrigatoriaEGravaAsRespostas() throws Exception {
        String codigo = abrirLink(admin);
        String versaoAntiga = pagina(codigo).path("perguntas").path("versaoId").asString();
        novoPadrao(admin, "Inscrição com obrigatória fictícia", List.of(
                pergunta("treina", "SIM_NAO", "obrigatoria", true),
                pergunta("onde", "TEXTO", "obrigatoria", true, "mostrarSe", Map.of("perguntaId", "treina", "valores", List.of("sim"))),
                pergunta("horario", "ESCOLHA_UNICA", "opcoes", opcoes("manha", "noite"))));
        JsonNode pagina = pagina(codigo);
        String versao = pagina.path("perguntas").path("versaoId").asString();
        assertThat(versao).isNotEqualTo(versaoAntiga);

        // Versão que a página mostrou antes da troca: 409 e nada é gravado.
        Map<String, Object> velha = inscricao("Pessoa Fictícia Velha");
        velha.put("questionarioVersaoId", versaoAntiga);
        velha.put("respostas", Map.of("observacao", "x"));
        assertThat(api.post("/publico/inscricoes/" + codigo, null, velha, 409).path("codigo").asString())
                .isEqualTo("PERGUNTAS_ALTERADAS");
        // Respostas sem versão também.
        Map<String, Object> semVersao = inscricao("Pessoa Fictícia Sem Versão");
        semVersao.put("respostas", Map.of("treina", false));
        api.post("/publico/inscricoes/" + codigo, null, semVersao, 409);
        // Sem a obrigatória: 422 no id da pergunta, sem repetir valor.
        Map<String, Object> faltando = inscricao("Pessoa Fictícia Faltando");
        faltando.put("questionarioVersaoId", versao);
        faltando.put("respostas", Map.of("treina", true));
        JsonNode erro = api.post("/publico/inscricoes/" + codigo, null, faltando, 422);
        assertThat(erro.path("codigo").asString()).isEqualTo("INSCRICAO_INVALIDA");
        assertThat(campos(erro)).containsExactly("onde");
        // Nem enviar nada passa (a obrigatória continua obrigatória).
        api.post("/publico/inscricoes/" + codigo, null, inscricao("Pessoa Fictícia Vazia"), 422);
        assertThat(api.get("/inscricoes?situacao=TODAS", admin, 200).path("total").asLong()).isZero();

        // Certo: a pergunta escondida pela condição é descartada; a resposta fica com a versão fixada.
        Map<String, Object> certo = inscricao("Pessoa Fictícia Certa");
        certo.put("questionarioVersaoId", versao);
        certo.put("respostas", Map.of("treina", false, "onde", "Some daqui", "horario", "noite"));
        api.post("/publico/inscricoes/" + codigo, null, certo, 202);
        JsonNode detalhe = api.get("/inscricoes/" + unica(admin).path("id").asString(), admin, 200);
        JsonNode respostas = detalhe.path("respostas");
        assertThat(respostas.path("questionarioVersaoId").asString()).isEqualTo(versao);
        assertThat(respostas.path("respostas").path("treina").asBoolean(true)).isFalse();
        assertThat(respostas.path("respostas").path("horario").asString()).isEqualTo("noite");
        assertThat(respostas.path("respostas").has("onde")).isFalse();
        assertThat(respostas.path("modelo").path("secoes").get(0).path("perguntas")).hasSize(3);
    }

    @Test
    void camposEscondidosSaemDaPaginaESaoIgnoradosNoEnvio() throws Exception {
        String codigo = abrirLink(admin);
        JsonNode config = api.get("/inscricoes/configuracao", admin, 200);
        // Versão velha: 409.
        api.put("/inscricoes/configuracao/campos-ocultos", admin,
                Map.of("camposOcultos", List.of("EMAIL"), "versao", config.path("versao").asLong() + 7), 409);
        // Valor fora da lista fechada (nome e WhatsApp nunca se escondem): 400.
        api.put("/inscricoes/configuracao/campos-ocultos", admin,
                Map.of("camposOcultos", List.of("NOME"), "versao", config.path("versao").asLong()), 400);
        // Sem INSCRICAO_ALTERAR (Nutricionista): 403.
        JsonNode outro = api.novoTreinador();
        perfil(outro, "Nutricionista");
        api.put("/inscricoes/configuracao/campos-ocultos", outro, Map.of("camposOcultos", List.of(), "versao", 0), 403);

        JsonNode salvo = api.put("/inscricoes/configuracao/campos-ocultos", admin,
                Map.of("camposOcultos", List.of("SEXO", "EMAIL", "ORIGEM", "OBJETIVO"), "versao", config.path("versao").asLong()), 200);
        assertThat(salvo.path("camposOcultos").valueStream().map(JsonNode::asString))
                .containsExactly("EMAIL", "SEXO", "OBJETIVO", "ORIGEM");
        assertThat(pagina(codigo).path("campos").valueStream().map(JsonNode::asString))
                .containsExactly("INTERESSE", "MODALIDADE", "PREVISAO_INICIO");

        Map<String, Object> corpo = inscricao("Pessoa Fictícia Escondida");
        corpo.put("email", "escondida-" + UUID.randomUUID() + "@teste.local");
        corpo.put("objetivo", "Objetivo fictício escondido");
        corpo.put("sexo", "FEMININO");
        corpo.put("origem", "INSTAGRAM");
        corpo.put("interesse", "TREINO");
        api.post("/publico/inscricoes/" + codigo, null, corpo, 202);
        JsonNode detalhe = api.get("/inscricoes/" + unica(admin).path("id").asString(), admin, 200);
        assertThat(semValor(detalhe.path("email"))).isTrue();
        assertThat(semValor(detalhe.path("objetivo"))).isTrue();
        assertThat(semValor(detalhe.path("sexo"))).isTrue();
        assertThat(semValor(detalhe.path("origemInformada"))).isTrue();
        assertThat(detalhe.path("interesse").asString()).isEqualTo("TREINO");

        // Lista vazia volta a mostrar tudo.
        api.put("/inscricoes/configuracao/campos-ocultos", admin,
                Map.of("camposOcultos", List.of(), "versao", salvo.path("versao").asLong()), 200);
        assertThat(pagina(codigo).path("campos")).hasSize(7);
    }

    @Test
    void outraConsultoriaNaoVeOQuestionarioNemUsaAVersaoDela() throws Exception {
        JsonNode outro = api.novoTreinador();
        String codigoA = abrirLink(admin);
        String codigoB = abrirLink(outro);
        String versaoB = pagina(codigoB).path("perguntas").path("versaoId").asString();
        String questionarioA = api.get("/questionarios?finalidade=INSCRICAO", admin, 200).get(0).path("id").asString();
        api.get("/questionarios/" + questionarioA, outro, 404);
        api.put("/inscricoes/configuracao/campos-ocultos", outro,
                Map.of("camposOcultos", List.of("EMAIL"), "versao", api.get("/inscricoes/configuracao", outro, 200)
                        .path("versao").asLong()), 200);
        // A escolha de B não muda a página de A.
        assertThat(pagina(codigoA).path("campos")).hasSize(7);
        // A versão de B no link de A não é a do padrão de A: 409, nada gravado.
        Map<String, Object> corpo = inscricao("Pessoa Fictícia Cruzada");
        corpo.put("questionarioVersaoId", versaoB);
        corpo.put("respostas", Map.of("observacao", "x"));
        api.post("/publico/inscricoes/" + codigoA, null, corpo, 409);
        assertThat(api.get("/inscricoes?situacao=TODAS", admin, 200).path("total").asLong()).isZero();
    }

    // ---- uso, privacidade e auditoria ----

    @Test
    void questionarioQueRecebeuInscricaoNaoSeExcluiEContaComoEnvio() throws Exception {
        String codigo = abrirLink(admin);
        JsonNode primeiro = novoPadrao(admin, "Inscrição usada fictícia", List.of(pergunta("t", "TEXTO")));
        Map<String, Object> corpo = inscricao("Pessoa Fictícia Uso");
        corpo.put("questionarioVersaoId", pagina(codigo).path("perguntas").path("versaoId").asString());
        corpo.put("respostas", Map.of("t", "Texto fictício"));
        api.post("/publico/inscricoes/" + codigo, null, corpo, 202);
        novoPadrao(admin, "Inscrição seguinte fictícia", List.of(pergunta("u", "TEXTO")));

        String id = primeiro.path("id").asString();
        assertThat(api.get("/questionarios?finalidade=INSCRICAO", admin, 200).valueStream()
                .filter(q -> q.path("id").asString().equals(id)).findFirst().orElseThrow()
                .path("uso").path("envios").asLong()).isEqualTo(1);
        assertThat(api.delete("/questionarios/" + id, admin, 409).path("codigo").asString()).isEqualTo("QUESTIONARIO_EM_USO");
        // O detalhe continua lendo a versão respondida, mesmo com outro padrão.
        assertThat(api.get("/inscricoes/" + unica(admin).path("id").asString(), admin, 200)
                .path("respostas").path("respostas").path("t").asString()).isEqualTo("Texto fictício");
    }

    @Test
    void aceiteNaoCopiaAsRespostasExportacaoLevaEAnonimizacaoApaga() throws Exception {
        UUID consultoria = consultoriaDe(admin);
        String codigo = abrirLink(admin);
        Map<String, Object> corpo = inscricao("Aluna Fictícia Respostas");
        corpo.put("questionarioVersaoId", pagina(codigo).path("perguntas").path("versaoId").asString());
        corpo.put("respostas", Map.of("observacao", RESPOSTA));
        api.post("/publico/inscricoes/" + codigo, null, corpo, 202);
        String id = unica(admin).path("id").asString();
        String alunoId = api.post("/inscricoes/" + id + "/aceitar", admin,
                Map.of("convidar", false, "versao", api.get("/inscricoes/" + id, admin, 200).path("versao").asLong()), 200)
                .path("alunoId").asString();

        // O aceite não leva as respostas para o cadastro.
        assertThat(api.get("/alunos/" + alunoId, admin, 200).toString()).doesNotContain(RESPOSTA);
        // A exportação leva, com a versão respondida.
        JsonNode item = api.get("/alunos/" + alunoId + "/exportacao", admin, 200).path("inscricao").path("itens").get(0);
        assertThat(item.path("respostas").path("observacao").asString()).isEqualTo(RESPOSTA);
        // A auditoria nunca guarda o que a pessoa respondeu.
        assertThat(banco.queryForObject("select count(*) from auditoria where consultoria_id = ? and resumo like ?",
                Integer.class, consultoria, "%" + RESPOSTA + "%")).isZero();

        api.patch("/alunos/" + alunoId + "/situacao", admin, Map.of("ativo", false), 200);
        api.post("/alunos/" + alunoId + "/anonimizar", admin, Map.of("nomeConfirmado", "Aluna Fictícia Respostas"), 200);
        assertThat(banco.queryForObject("select count(*) from inscricao where consultoria_id = ? and respostas is not null",
                Integer.class, consultoria)).isZero();
    }

    @Test
    void retencaoApagaARecusadaComAsRespostas() throws Exception {
        UUID consultoria = consultoriaDe(admin);
        String codigo = abrirLink(admin);
        Map<String, Object> corpo = inscricao("Pessoa Fictícia Retida");
        corpo.put("questionarioVersaoId", pagina(codigo).path("perguntas").path("versaoId").asString());
        corpo.put("respostas", Map.of("observacao", RESPOSTA));
        api.post("/publico/inscricoes/" + codigo, null, corpo, 202);
        String id = unica(admin).path("id").asString();
        Instant velho = Instant.now().minus(Duration.ofDays(181));
        banco.update("update inscricao set situacao = 'RECUSADA', atualizada_em = ?, ultima_atividade_em = ? where id = ?::uuid",
                Timestamp.from(velho), Timestamp.from(velho), id);
        retencao.limpar(Instant.now().minus(InscricaoRetencao.PRAZO));
        assertThat(banco.queryForObject("select count(*) from inscricao where consultoria_id = ?", Integer.class, consultoria))
                .isZero();
    }
}
