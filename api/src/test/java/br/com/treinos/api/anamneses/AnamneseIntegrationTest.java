package br.com.treinos.api.anamneses;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.equipe.CatalogoPermissoes;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import br.com.treinos.api.fotos.FotosDeTeste;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.awt.Color;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Anamnese: finalidade do questionário, atribuição ao aluno, resposta logada, condição, revisão, dispensa, isolamento e
 * anonimização. Só dados fictícios (perguntas genéricas, nada de saúde real).
 */
@AutoConfigureMockMvc
class AnamneseIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate banco;
    private ApiDeTeste api;
    private JsonNode treinador;
    private UUID aluno;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        treinador = api.novoTreinador();
        aluno = api.criarAluno(treinador, "Aluno Fictício Anamnese");
    }

    // ---- apoio ----

    /** Conteúdo fictício: sim/não que controla um texto obrigatório, data no passado, grade e aceite. */
    private static Map<String, Object> conteudo(String rotuloDoTexto) {
        Map<String, Object> pratica = Map.of("id", "pratica", "tipo", "SIM_NAO", "rotulo", "Pratica alguma atividade?", "obrigatoria", true);
        Map<String, Object> qual = new LinkedHashMap<>();
        qual.put("id", "qual");
        qual.put("tipo", "TEXTO");
        qual.put("rotulo", rotuloDoTexto);
        qual.put("obrigatoria", true);
        qual.put("mostrarSe", Map.of("perguntaId", "pratica", "valores", List.of("sim")));
        Map<String, Object> data = Map.of("id", "data", "tipo", "DATA", "rotulo", "Data fictícia", "obrigatoria", false, "somentePassado", true);
        Map<String, Object> grade = Map.of("id", "grade", "tipo", "GRADE", "rotulo", "Grade fictícia", "obrigatoria", true,
                "linhas", List.of(Map.of("id", "l1", "rotulo", "Linha 1"), Map.of("id", "l2", "rotulo", "Linha 2")),
                "colunas", List.of(Map.of("id", "c1", "rotulo", "Nunca"), Map.of("id", "c2", "rotulo", "Sempre")));
        Map<String, Object> aceite = Map.of("id", "aceite", "tipo", "ACEITE", "rotulo", "Regras", "obrigatoria", true,
                "texto", "Texto fictício das regras.", "declaracao", "Li e concordo.");
        Map<String, Object> info = Map.of("id", "info", "tipo", "INFORMATIVO", "rotulo", "Leia antes", "texto", "Orientação fictícia.");
        return Map.of("instrucoes", List.of(), "secoes", List.of(
                Map.of("uid", "s1", "titulo", "Geral", "perguntas", List.of(info, pratica, qual, data, grade, aceite))));
    }

    private JsonNode anamnesePublicada(JsonNode quem, String nome, String rotuloDoTexto) throws Exception {
        JsonNode q = api.post("/questionarios", quem, Map.of("nome", nome, "origem", "VAZIO", "finalidade", "ANAMNESE"), 200);
        assertThat(q.path("finalidade").asString()).isEqualTo("ANAMNESE");
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("nome", nome);
        corpo.put("conteudo", conteudo(rotuloDoTexto));
        corpo.put("versao", q.path("versao").asLong());
        JsonNode salvo = api.put("/questionarios/" + q.path("id").asString(), quem, corpo, 200);
        // Anamnese sem pergunta de peso não pede confirmação de aviso.
        return api.post("/questionarios/" + q.path("id").asString() + "/publicar", quem,
                Map.of("versao", salvo.path("versao").asLong(), "confirmarAvisos", false), 200);
    }

    private JsonNode atribuir(JsonNode quem, UUID alunoId, JsonNode q, int status) throws Exception {
        return api.post("/alunos/" + alunoId + "/anamneses", quem, Map.of("questionarioId", q.path("id").asString()), status);
    }

    private JsonNode enviar(JsonNode loginAluno, JsonNode a, Map<String, Object> respostas, int status) throws Exception {
        return api.post("/aluno/anamnese/" + a.path("id").asString() + "/enviar", loginAluno,
                Map.of("questionarioVersaoId", a.path("questionarioVersaoId").asString(), "respostas", respostas), status);
    }

    private static Map<String, Object> respostasValidas() {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("pratica", false);
        r.put("qual", "não deveria ficar");
        r.put("data", "2000-01-01");
        r.put("grade", Map.of("l1", "c1", "l2", "c2"));
        r.put("aceite", true);
        return r;
    }

    private JsonNode membro(Set<String> permissoes) throws Exception {
        String perfil = api.post("/perfis", treinador,
                Map.of("nome", "Perfil " + UUID.randomUUID(), "permissoes", permissoes), 200).get("id").asString();
        JsonNode convite = api.post("/usuarios/convites", treinador,
                Map.of("nome", "Membro fictício", "email", ApiDeTeste.emailUnico("membro"), "perfilId", perfil), 200);
        return api.post("/publico/convites-equipe/aceitar", null,
                Map.of("codigo", convite.get("codigo").asString(), "senha", ApiDeTeste.SENHA), 200);
    }

    private int auditorias(String acao) {
        UUID consultoria = banco.queryForObject("select consultoria_id from aluno where id=?", UUID.class, aluno);
        return banco.queryForObject("select count(*) from auditoria where consultoria_id=? and acao=?", Integer.class, consultoria, acao);
    }

    // ---- testes ----

    @Test
    void finalidadeSeparaListasOpcoesEPadraoEAnamneseNaoVaiParaOAluno() throws Exception {
        JsonNode q = anamnesePublicada(treinador, "Anamnese fictícia", "Qual?");
        assertThat(api.get("/questionarios?finalidade=ANAMNESE", treinador, 200).valueStream()
                .map(x -> x.path("id").asString())).containsExactly(q.path("id").asString());
        assertThat(api.get("/questionarios", treinador, 200).valueStream()
                .map(x -> x.path("id").asString())).doesNotContain(q.path("id").asString());
        assertThat(api.get("/questionarios/opcoes?finalidade=ANAMNESE", treinador, 200)).hasSize(1);
        // Atualização e anamnese têm cada uma o seu padrão: definir o da anamnese não tira o de atualização.
        api.post("/questionarios/" + q.path("id").asString() + "/padrao", treinador, null, 200);
        assertThat(api.get("/questionarios", treinador, 200).valueStream().filter(x -> x.path("padrao").asBoolean())).hasSize(1);
        // Aluno e pasta só escolhem questionário de atualização.
        api.put("/alunos/" + aluno + "/questionario", treinador, Map.of("questionarioId", q.path("id").asString()), 409);
        // Anamnese não nasce da fábrica de atualização.
        api.post("/questionarios", treinador, Map.of("nome", "Da fábrica", "origem", "FABRICA", "finalidade", "ANAMNESE"), 400);
    }

    @Test
    void atribuiUmaPendentePorAlunoComVersaoFixaEEnvioIdempotente() throws Exception {
        JsonNode q = anamnesePublicada(treinador, "Anamnese fictícia", "Qual?");
        JsonNode a = atribuir(treinador, aluno, q, 200);
        assertThat(a.path("situacao").asString()).isEqualTo("PENDENTE");
        assertThat(a.path("questionarioVersaoNumero").asInt()).isEqualTo(1);
        atribuir(treinador, aluno, q, 409);
        assertThat(auditorias("ANAMNESE_ATRIBUIDA")).isEqualTo(1);

        // O treinador publica v2: a atribuição continua presa à v1.
        JsonNode detalheQ = api.get("/questionarios/" + q.path("id").asString(), treinador, 200);
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("nome", detalheQ.path("nome").asString());
        corpo.put("conteudo", conteudo("Qual mudou?"));
        corpo.put("versao", detalheQ.path("versao").asLong());
        JsonNode salvo = api.put("/questionarios/" + q.path("id").asString(), treinador, corpo, 200);
        api.post("/questionarios/" + q.path("id").asString() + "/publicar", treinador,
                Map.of("versao", salvo.path("versao").asLong(), "confirmarAvisos", false), 200);

        JsonNode login = api.convidarEEntrar(treinador, aluno);
        JsonNode doAluno = api.get("/aluno/anamnese", login, 200);
        assertThat(doAluno.path("id").asString()).isEqualTo(a.path("id").asString());
        assertThat(doAluno.path("questionarioVersaoNumero").asInt()).isEqualTo(1);
        assertThat(doAluno.path("questionarioNome").isNull()).isTrue();
        assertThat(doAluno.path("modelo").toString()).contains("Qual?").doesNotContain("Qual mudou?");

        // Versão errada: 409. Obrigatória faltando: 422 com o campo.
        api.post("/aluno/anamnese/" + a.path("id").asString() + "/enviar", login,
                Map.of("questionarioVersaoId", UUID.randomUUID().toString(), "respostas", respostasValidas()), 409);
        Map<String, Object> semAceite = new LinkedHashMap<>(respostasValidas());
        semAceite.remove("aceite");
        JsonNode erro = enviar(login, a, semAceite, 422);
        assertThat(erro.path("codigo").asString()).isEqualTo("ANAMNESE_INVALIDA");

        // Condição: "pratica" = não esconde "qual"; a resposta dele é descartada (nunca vira "não").
        JsonNode enviada = enviar(login, a, respostasValidas(), 200);
        assertThat(enviada.path("situacao").asString()).isEqualTo("ENVIADA");
        assertThat(enviada.path("respostas").has("qual")).isFalse();
        assertThat(enviada.path("respostas").path("pratica").asBoolean(true)).isFalse();
        assertThat(auditorias("ANAMNESE_ENVIADA")).isEqualTo(1);

        // Reenviar (clique duplo, rede que caiu): 200 sem mudar nada nem auditar de novo.
        Map<String, Object> outras = new LinkedHashMap<>(respostasValidas());
        outras.put("pratica", true);
        outras.put("qual", "outra coisa");
        JsonNode reenviada = enviar(login, a, outras, 200);
        assertThat(reenviada.path("respostas")).isEqualTo(enviada.path("respostas"));
        assertThat(auditorias("ANAMNESE_ENVIADA")).isEqualTo(1);

        // Revisar: idempotente, auditado uma vez; nova atribuição volta a ser possível.
        JsonNode atual = api.get("/anamneses/" + a.path("id").asString(), treinador, 200);
        JsonNode revisada = api.post("/anamneses/" + a.path("id").asString() + "/revisar", treinador,
                Map.of("versao", atual.path("versao").asLong()), 200);
        assertThat(revisada.path("situacao").asString()).isEqualTo("REVISADA");
        assertThat(revisada.path("revisadaPorNome").isNull()).isFalse();
        api.post("/anamneses/" + a.path("id").asString() + "/revisar", treinador, Map.of("versao", 0), 200);
        assertThat(auditorias("ANAMNESE_REVISADA")).isEqualTo(1);
        atribuir(treinador, aluno, q, 200);
        assertThat(api.get("/alunos/" + aluno + "/anamneses", treinador, 200)).hasSize(2);
    }

    @Test
    void dispensaComMotivoEPermiteNovaAtribuicao() throws Exception {
        JsonNode q = anamnesePublicada(treinador, "Anamnese fictícia", "Qual?");
        JsonNode a = atribuir(treinador, aluno, q, 200);
        api.post("/anamneses/" + a.path("id").asString() + "/dispensar", treinador,
                Map.of("motivo", "Motivo fictício", "versao", a.path("versao").asLong() + 7), 409);
        JsonNode dispensada = api.post("/anamneses/" + a.path("id").asString() + "/dispensar", treinador,
                Map.of("motivo", "Motivo fictício", "versao", a.path("versao").asLong()), 200);
        assertThat(dispensada.path("situacao").asString()).isEqualTo("DISPENSADA");
        assertThat(dispensada.path("dispensaMotivo").asString()).isEqualTo("Motivo fictício");
        assertThat(auditorias("ANAMNESE_DISPENSADA")).isEqualTo(1);
        // Dispensada não se revisa nem se envia; o aluno não a vê.
        api.post("/anamneses/" + a.path("id").asString() + "/revisar", treinador,
                Map.of("versao", dispensada.path("versao").asLong()), 409);
        JsonNode login = api.convidarEEntrar(treinador, aluno);
        api.get("/aluno/anamnese", login, 404);
        enviar(login, a, respostasValidas(), 409);
        atribuir(treinador, aluno, q, 200);
        assertThat(api.get("/aluno/anamnese", login, 200).path("situacao").asString()).isEqualTo("PENDENTE");
    }

    @Test
    void outraConsultoriaEOutroAlunoRecebem404() throws Exception {
        JsonNode q = anamnesePublicada(treinador, "Anamnese fictícia", "Qual?");
        JsonNode a = atribuir(treinador, aluno, q, 200);

        JsonNode outro = api.novoTreinador();
        api.get("/anamneses/" + a.path("id").asString(), outro, 404);
        api.get("/alunos/" + aluno + "/anamneses", outro, 404);
        atribuir(outro, aluno, q, 404);
        api.post("/anamneses/" + a.path("id").asString() + "/dispensar", outro, Map.of("motivo", "x", "versao", 0), 404);
        // Questionário de outra consultoria também não serve.
        UUID alunoDoOutro = api.criarAluno(outro, "Outro Aluno Fictício");
        atribuir(outro, alunoDoOutro, q, 404);

        // Outro aluno da mesma consultoria não envia nem vê a anamnese alheia.
        UUID segundo = api.criarAluno(treinador, "Segundo Aluno Fictício");
        JsonNode loginSegundo = api.convidarEEntrar(treinador, segundo);
        enviar(loginSegundo, a, respostasValidas(), 404);
        api.get("/aluno/anamnese", loginSegundo, 404);
    }

    @Test
    void permissoesDaEquipe() throws Exception {
        JsonNode q = anamnesePublicada(treinador, "Anamnese fictícia", "Qual?");
        JsonNode a = atribuir(treinador, aluno, q, 200);

        JsonNode soLer = membro(CatalogoPermissoes.comDependencias(Set.of("ANAMNESE_LER")));
        api.get("/alunos/" + aluno + "/anamneses", soLer, 200);
        api.get("/anamneses/" + a.path("id").asString(), soLer, 200);
        api.post("/anamneses/" + a.path("id").asString() + "/dispensar", soLer, Map.of("motivo", "x", "versao", 0), 403);
        atribuir(soLer, aluno, q, 403);

        JsonNode semSensivel = membro(Set.of("ALUNO_LER"));
        api.get("/alunos/" + aluno + "/anamneses", semSensivel, 403);
        api.get("/anamneses/" + a.path("id").asString(), semSensivel, 403);

        // Quem envia anamnese vê as opções de anamnese mesmo sem gerir questionários.
        JsonNode altera = membro(CatalogoPermissoes.comDependencias(Set.of("ANAMNESE_ALTERAR")));
        api.get("/questionarios/opcoes?finalidade=ANAMNESE", altera, 200);
        api.get("/questionarios?finalidade=ANAMNESE", altera, 403);
        api.post("/anamneses/" + a.path("id").asString() + "/dispensar", altera,
                Map.of("motivo", "Motivo fictício", "versao", a.path("versao").asLong()), 200);

        // Os perfis padrão de Treinador e Nutricionista têm as duas permissões; o Assistente, nenhuma.
        UUID consultoria = banco.queryForObject("select consultoria_id from aluno where id=?", UUID.class, aluno);
        assertThat(banco.queryForList("select codigo from perfil_permissao where perfil_id=md5(?::text || ':Treinador')::uuid",
                String.class, consultoria)).contains("ANAMNESE_LER", "ANAMNESE_ALTERAR");
        assertThat(banco.queryForList("select codigo from perfil_permissao where perfil_id=md5(?::text || ':Nutricionista')::uuid",
                String.class, consultoria)).contains("ANAMNESE_LER", "ANAMNESE_ALTERAR");
        assertThat(banco.queryForList("select codigo from perfil_permissao where perfil_id=md5(?::text || ':Assistente')::uuid",
                String.class, consultoria)).doesNotContain("ANAMNESE_LER", "ANAMNESE_ALTERAR");
    }

    @Test
    void questionarioComAnamneseNaoSeExcluiENemArquivadoSeAtribui() throws Exception {
        JsonNode q = anamnesePublicada(treinador, "Anamnese fictícia", "Qual?");
        atribuir(treinador, aluno, q, 200);
        api.delete("/questionarios/" + q.path("id").asString(), treinador, 409);
        api.post("/questionarios/" + q.path("id").asString() + "/arquivar", treinador, null, 200);
        UUID outroAluno = api.criarAluno(treinador, "Outro Aluno Fictício");
        atribuir(treinador, outroAluno, q, 409);
        JsonNode rascunho = api.post("/questionarios", treinador,
                Map.of("nome", "Nunca publicada", "origem", "VAZIO", "finalidade", "ANAMNESE"), 200);
        atribuir(treinador, outroAluno, rascunho, 409);
    }

    @Test
    void exportacaoLevaEAnonimizacaoApagaAsRespostas() throws Exception {
        JsonNode q = anamnesePublicada(treinador, "Anamnese fictícia", "Qual?");
        JsonNode a = atribuir(treinador, aluno, q, 200);
        JsonNode login = api.convidarEEntrar(treinador, aluno);
        enviar(login, a, respostasValidas(), 200);

        JsonNode exportacao = api.get("/alunos/" + aluno + "/exportacao", treinador, 200);
        assertThat(exportacao.path("anamneses").path("itens")).hasSize(1);
        assertThat(exportacao.path("anamneses").path("itens").get(0).path("respostas").path("aceite").asBoolean()).isTrue();

        api.patch("/alunos/" + aluno + "/situacao", treinador, Map.of("ativo", false), 200);
        api.post("/alunos/" + aluno + "/anonimizar", treinador, Map.of("nomeConfirmado", "Aluno Fictício Anamnese"), 200);
        JsonNode depois = api.get("/anamneses/" + a.path("id").asString(), treinador, 200);
        assertThat(depois.path("respostas").isEmpty()).isTrue();
        assertThat(depois.path("situacao").asString()).isEqualTo("ENVIADA");
        // Anonimizado não recebe anamnese nova.
        atribuir(treinador, aluno, q, 409);
    }

    private MvcResult subirImagem(JsonNode quem, byte[] bytes, int esperado) throws Exception {
        return mvc.perform(multipart("/questionarios/imagens")
                        .file(new MockMultipartFile("arquivo", "qualquer.jpg", "image/jpeg", bytes))
                        .header("X-Treinos-Cliente", "nativo")
                        .header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(quem)))
                .andExpect(status().is(esperado)).andReturn();
    }

    private int statusDaImagem(String caminho, JsonNode quem) throws Exception {
        return mvc.perform(MockMvcRequestBuilders.get(caminho)
                        .header("X-Treinos-Cliente", "nativo")
                        .header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(quem)))
                .andReturn().getResponse().getStatus();
    }

    /** Revisão de segurança (19/10): as imagens ficam no banco, então cada consultoria tem um teto de envios por dia. */
    @Test
    void imagensDoQuestionarioTemTetoDiarioPorConsultoria() throws Exception {
        UUID consultoria = banco.queryForObject("select consultoria_id from usuario where id = ?::uuid", UUID.class,
                treinador.path("usuario").path("id").asString());
        banco.update("insert into questionario_imagem (id, consultoria_id, tipo, bytes, tamanho) select gen_random_uuid(), ?, "
                + "'image/png', '\\x00'::bytea, 1 from generate_series(1, 100)", consultoria);
        byte[] jpeg = FotosDeTeste.jpeg(Color.BLUE, 200, false);
        JsonNode erro = api.ler(subirImagem(treinador, jpeg, 422));
        assertThat(erro.path("codigo").asString()).isEqualTo("IMAGENS_LIMITE_DIARIO");
        assertThat(banco.queryForObject("select count(*) from questionario_imagem where consultoria_id = ?", Long.class,
                consultoria)).isEqualTo(100);
        // O teto é de cada consultoria, e as de mais de um dia não contam.
        subirImagem(api.novoTreinador(), jpeg, 200);
        banco.update("update questionario_imagem set criada_em = now() - interval '25 hours' where consultoria_id = ?", consultoria);
        subirImagem(treinador, jpeg, 200);
    }

    @Test
    void imagemDaPerguntaSemMetadadosEVistaSoPorQuemPode() throws Exception {
        byte[] jpeg = FotosDeTeste.jpeg(Color.BLUE, 200, false);
        String id = api.ler(subirImagem(treinador, jpeg, 200)).path("id").asString();
        // Não é imagem: 422. Acima de 1600 px: 422.
        subirImagem(treinador, "não sou imagem".getBytes(java.nio.charset.StandardCharsets.UTF_8), 422);
        subirImagem(treinador, FotosDeTeste.jpeg(Color.RED, 1700, false), 422);

        JsonNode outro = api.novoTreinador();
        assertThat(statusDaImagem("/questionarios/imagens/" + id, treinador)).isEqualTo(200);
        assertThat(statusDaImagem("/questionarios/imagens/" + id, outro)).isEqualTo(404);

        // Publicar com imagem inexistente: 422 no caminho dela.
        JsonNode q = api.post("/questionarios", treinador, Map.of("nome", "Com imagem", "origem", "VAZIO", "finalidade", "ANAMNESE"), 200);
        Map<String, Object> pergunta = new LinkedHashMap<>(Map.of("id", "info", "tipo", "INFORMATIVO", "rotulo", "Veja",
                "imagemId", UUID.randomUUID().toString()));
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("nome", "Com imagem");
        corpo.put("conteudo", Map.of("instrucoes", List.of(), "secoes", List.of(Map.of("uid", "s1", "titulo", "A",
                "perguntas", List.of(pergunta, Map.of("id", "t", "tipo", "TEXTO", "rotulo", "Texto"))))));
        corpo.put("versao", q.path("versao").asLong());
        JsonNode salvo = api.put("/questionarios/" + q.path("id").asString(), treinador, corpo, 200);
        JsonNode erro = api.post("/questionarios/" + q.path("id").asString() + "/publicar", treinador,
                Map.of("versao", salvo.path("versao").asLong(), "confirmarAvisos", true), 422);
        assertThat(erro.toString()).contains("secoes[0].perguntas[0].imagemId");

        pergunta.put("imagemId", id);
        corpo.put("versao", salvo.path("versao").asLong());
        salvo = api.put("/questionarios/" + q.path("id").asString(), treinador, corpo, 200);
        JsonNode publicado = api.post("/questionarios/" + q.path("id").asString() + "/publicar", treinador,
                Map.of("versao", salvo.path("versao").asLong(), "confirmarAvisos", true), 200);

        // O aluno só vê depois que recebe a anamnese que cita a imagem.
        JsonNode login = api.convidarEEntrar(treinador, aluno);
        assertThat(statusDaImagem("/aluno/questionarios/imagens/" + id, login)).isEqualTo(404);
        atribuir(treinador, aluno, publicado, 200);
        assertThat(statusDaImagem("/aluno/questionarios/imagens/" + id, login)).isEqualTo(200);
        // A versão publicada cita a imagem: a limpeza das órfãs não a apaga, mesmo velha.
        banco.update("update questionario_imagem set criada_em = now() - interval '3 days' where id = ?::uuid", id);
        JsonNode outroQ = api.post("/questionarios", treinador, Map.of("nome", "Gatilho", "origem", "VAZIO"), 200);
        api.delete("/questionarios/" + outroQ.path("id").asString(), treinador, 204);
        assertThat(statusDaImagem("/questionarios/imagens/" + id, treinador)).isEqualTo(200);
        // A que ninguém cita e passou de um dia sai.
        String orfa = api.ler(subirImagem(treinador, jpeg, 200)).path("id").asString();
        banco.update("update questionario_imagem set criada_em = now() - interval '3 days' where id = ?::uuid", orfa);
        JsonNode gatilho = api.post("/questionarios", treinador, Map.of("nome", "Gatilho 2", "origem", "VAZIO"), 200);
        api.delete("/questionarios/" + gatilho.path("id").asString(), treinador, 204);
        assertThat(statusDaImagem("/questionarios/imagens/" + orfa, treinador)).isEqualTo(404);
    }

    @Test
    void fotoDaAnamneseSobePendenteELigaNoEnvio() throws Exception {
        JsonNode q = api.post("/questionarios", treinador, Map.of("nome", "Com fotos", "origem", "VAZIO", "finalidade", "ANAMNESE"), 200);
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("nome", "Com fotos");
        corpo.put("conteudo", Map.of("instrucoes", List.of(), "secoes", List.of(Map.of("uid", "s1", "titulo", "A",
                "perguntas", List.of(Map.of("id", "fotos", "tipo", "FOTOS", "rotulo", "Fotos fictícias", "obrigatoria", true))))));
        corpo.put("versao", q.path("versao").asLong());
        JsonNode salvo = api.put("/questionarios/" + q.path("id").asString(), treinador, corpo, 200);
        JsonNode publicado = api.post("/questionarios/" + q.path("id").asString() + "/publicar", treinador,
                Map.of("versao", salvo.path("versao").asLong(), "confirmarAvisos", true), 200);
        JsonNode a = atribuir(treinador, aluno, publicado, 200);
        JsonNode login = api.convidarEEntrar(treinador, aluno);

        MvcResult r = mvc.perform(multipart("/aluno/fotos")
                        .file(new MockMultipartFile("arquivo", "x.jpg", "image/jpeg", FotosDeTeste.jpeg(Color.GREEN, 300, false)))
                        .param("anamneseId", a.path("id").asString())
                        .header("X-Treinos-Cliente", "nativo")
                        .header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(login)))
                .andExpect(status().is(200)).andReturn();
        String foto = api.ler(r).path("id").asString();
        // Sem pasta nem anamnese, ou com as duas: 400.
        mvc.perform(multipart("/aluno/fotos")
                        .file(new MockMultipartFile("arquivo", "x.jpg", "image/jpeg", FotosDeTeste.jpeg(Color.GREEN, 300, false)))
                        .header("X-Treinos-Cliente", "nativo")
                        .header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(login)))
                .andExpect(status().is(400));

        assertThat(statusDaImagem("/anamneses/" + a.path("id").asString() + "/fotos/" + foto, treinador)).isEqualTo(404);
        JsonNode enviada = enviar(login, a, Map.of("fotos", List.of(foto)), 200);
        assertThat(enviada.path("respostas").path("fotos").get(0).asString()).isEqualTo(foto);
        assertThat(statusDaImagem("/anamneses/" + a.path("id").asString() + "/fotos/" + foto, treinador)).isEqualTo(200);
        // A foto enviada não se apaga pelo aluno.
        api.delete("/aluno/fotos/" + foto, login, 409);
    }
}
