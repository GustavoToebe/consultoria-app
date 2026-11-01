package br.com.treinos.api.questionarios;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.web.Fuso;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** API de gestão dos questionários de atualização. Dados fictícios; nada de conteúdo clínico. */
@AutoConfigureMockMvc
class QuestionariosIntegrationTest extends AbstractIntegrationTest {

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
        aluno = api.criarAluno(treinador, "Aluno Fictício Questionário");
    }

    // ---- apoio ----

    private JsonNode criar(String nome, String origem) throws Exception {
        return api.post("/questionarios", treinador, Map.of("nome", nome, "origem", origem), 200);
    }

    private JsonNode publicar(JsonNode q, boolean confirmar, int status) throws Exception {
        return api.post("/questionarios/" + q.path("id").asString() + "/publicar", treinador,
                Map.of("versao", q.path("versao").asLong(), "confirmarAvisos", confirmar), status);
    }

    /** Questionário da fábrica já publicado (v1). */
    private JsonNode publicado(String nome) throws Exception {
        JsonNode q = criar(nome, "FABRICA");
        return publicar(q, false, 200);
    }

    private JsonNode salvar(JsonNode q, JsonNode rascunho, int status) throws Exception {
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("nome", q.path("nome").asString());
        corpo.put("conteudo", rascunho);
        corpo.put("versao", q.path("versao").asLong());
        return api.put("/questionarios/" + q.path("id").asString(), treinador, corpo, status);
    }

    private static JsonNode pergunta(ObjectNode rascunho, String id) {
        return rascunho.path("secoes").valueStream().flatMap(s -> s.path("perguntas").valueStream())
                .filter(p -> id.equals(p.path("id").asString())).findFirst().orElseThrow();
    }

    private UUID consultoria() {
        return banco.queryForObject("select consultoria_id from aluno where id=?", UUID.class, aluno);
    }

    private int auditorias(String acao) {
        return banco.queryForObject("select count(*) from auditoria where consultoria_id=? and acao=?",
                Integer.class, consultoria(), acao);
    }

    private String pasta() throws Exception {
        LocalDate fim = LocalDate.now(Fuso.BRASILIA);
        return api.post("/alunos/" + aluno + "/pastas", treinador,
                Map.of("titulo", "Período fictício", "inicio", fim.minusDays(27), "fim", fim), 200).path("id").asString();
    }

    /** Pasta com treino publicado: a atualização do aluno fica ABERTA e aceita envio. */
    private String pastaComTreino() throws Exception {
        String pasta = pasta();
        JsonNode criado = api.post("/alunos/" + aluno + "/planos-treino", treinador,
                Map.of("titulo", "Treino fictício", "pastaId", pasta), 200);
        String id = criado.path("plano").path("id").asString();
        JsonNode salvo = api.put("/planos-treino/" + id + "/rascunho", treinador,
                ApiDeTeste.rascunho("Treino fictício", ApiDeTeste.treino().conteudo(),
                        criado.path("plano").path("versao").asLong()), 200);
        api.post("/planos-treino/" + id + "/publicar", treinador,
                Map.of("versao", salvo.path("plano").path("versao").asLong(), "confirmarAvisos", true), 200);
        return pasta;
    }

    private JsonNode membro(Set<String> permissoes) throws Exception {
        String perfil = api.post("/perfis", treinador,
                Map.of("nome", "Perfil " + UUID.randomUUID(), "permissoes", permissoes), 200).get("id").asString();
        JsonNode convite = api.post("/usuarios/convites", treinador,
                Map.of("nome", "Membro fictício", "email", ApiDeTeste.emailUnico("membro"), "perfilId", perfil), 200);
        return api.post("/publico/convites-equipe/aceitar", null,
                Map.of("codigo", convite.get("codigo").asString(), "senha", ApiDeTeste.SENHA), 200);
    }

    // ---- rascunho ----

    @Test
    void criaVazioSalvaRascunhoNormalizadoERecusaVersaoAntigaENomeRepetido() throws Exception {
        JsonNode q = criar("Check-in fictício", "VAZIO");
        assertThat(q.path("versaoPublicada").asInt()).isZero();
        assertThat(q.path("padrao").asBoolean()).isFalse();
        assertThat(q.path("rascunho").path("secoes")).hasSize(1);

        ObjectNode rascunho = (ObjectNode) q.path("rascunho").deepCopy();
        Map<String, Object> pergunta = Map.of("id", "energia", "tipo", "NOTA", "rotulo", "Energia");
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("nome", "Check-in fictício");
        corpo.put("conteudo", Map.of("instrucoes", List.of(), "secoes", List.of(
                Map.of("uid", rascunho.path("secoes").get(0).path("uid").asString(), "titulo", "Geral",
                        "perguntas", List.of(pergunta)))));
        corpo.put("versao", q.path("versao").asLong());
        JsonNode salvo = api.put("/questionarios/" + q.path("id").asString(), treinador, corpo, 200);
        JsonNode p = salvo.path("rascunho").path("secoes").get(0).path("perguntas").get(0);
        assertThat(p.path("obrigatoria").asBoolean(true)).isFalse();
        assertThat(salvo.path("rascunho").path("formato").asInt()).isEqualTo(2);
        assertThat(salvo.path("versao").asLong()).isGreaterThan(q.path("versao").asLong());

        // Mesma versão de novo: outra pessoa já salvou.
        assertThat(api.put("/questionarios/" + q.path("id").asString(), treinador, corpo, 409).path("codigo").asString())
                .isEqualTo("CONFLITO_EDICAO");
        // Nome ocupado (sem caixa) entre ativos.
        assertThat(api.post("/questionarios", treinador, Map.of("nome", "CHECK-IN FICTÍCIO", "origem", "VAZIO"), 409)
                .path("codigo").asString()).isEqualTo("QUESTIONARIO_NOME_EM_USO");
        assertThat(auditorias("QUESTIONARIO_CRIADO")).isEqualTo(1);
    }

    @Test
    void rascunhoGrandeDemaisDa422() throws Exception {
        JsonNode q = criar("Enorme fictício", "VAZIO");
        String texto = "x".repeat(80);
        List<Object> secoes = new ArrayList<>();
        for (int s = 0; s < 8; s++) {
            List<Object> perguntas = new ArrayList<>();
            for (int i = 0; i < 40; i++) {
                perguntas.add(Map.of("id", "p" + s + "_" + i, "tipo", "ESCOLHA_UNICA", "rotulo", "r".repeat(200),
                        "ajuda", "a".repeat(300), "opcoes", List.of(Map.of("id", "a", "rotulo", texto),
                                Map.of("id", "b", "rotulo", texto), Map.of("id", "c", "rotulo", texto))));
            }
            secoes.add(Map.of("uid", "s" + s, "titulo", "Seção", "perguntas", perguntas));
        }
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("nome", "Enorme fictício");
        corpo.put("conteudo", Map.of("instrucoes", List.of(), "secoes", secoes));
        corpo.put("versao", q.path("versao").asLong());
        assertThat(api.put("/questionarios/" + q.path("id").asString(), treinador, corpo, 422).path("codigo").asString())
                .isEqualTo("QUESTIONARIO_GRANDE_DEMAIS");
    }

    @Test
    void salvarRascunhoNaoEAuditadoEArquivadoNaoEdita() throws Exception {
        JsonNode q = criar("Auditoria fictícia", "FABRICA");
        JsonNode salvo = salvar(q, q.path("rascunho"), 200);
        assertThat(auditorias("QUESTIONARIO_CRIADO")).isEqualTo(1);
        assertThat(banco.queryForObject("select count(*) from auditoria where consultoria_id=? and acao like 'QUESTIONARIO%'",
                Integer.class, consultoria())).isEqualTo(1);
        api.post("/questionarios/" + q.path("id").asString() + "/arquivar", treinador, null, 200);
        JsonNode atual = api.get("/questionarios/" + q.path("id").asString(), treinador, 200);
        assertThat(salvar(atual, salvo.path("rascunho"), 409).path("codigo").asString()).isEqualTo("QUESTIONARIO_ARQUIVADO");
        assertThat(publicar(atual, true, 409).path("codigo").asString()).isEqualTo("QUESTIONARIO_ARQUIVADO");
    }

    // ---- publicar ----

    @Test
    void publicaV1EV2EAVersaoPublicadaNaoMuda() throws Exception {
        JsonNode v1 = publicado("Publicado fictício");
        assertThat(v1.path("versaoPublicada").asInt()).isEqualTo(1);
        assertThat(v1.path("alteradoDesdePublicacao").asBoolean()).isFalse();
        assertThat(v1.path("versoes")).hasSize(1);

        ObjectNode rascunho = (ObjectNode) v1.path("rascunho").deepCopy();
        ((ObjectNode) pergunta(rascunho, "sono")).put("rotulo", "Como foi o sono?");
        JsonNode editado = salvar(v1, rascunho, 200);
        assertThat(editado.path("alteradoDesdePublicacao").asBoolean()).isTrue();
        assertThat(editado.path("versaoPublicada").asInt()).isEqualTo(1);

        JsonNode v2 = publicar(editado, false, 200);
        assertThat(v2.path("versaoPublicada").asInt()).isEqualTo(2);
        assertThat(v2.path("alteradoDesdePublicacao").asBoolean()).isFalse();
        assertThat(v2.path("versoes")).hasSize(2);
        assertThat(v2.path("versoes").get(1).path("publicadoEm").isNull()).isFalse();
        assertThat(v2.path("publicadoEm").isNull()).isFalse();
        assertThat(auditorias("QUESTIONARIO_PUBLICADO")).isEqualTo(2);

        // A versão publicada é imutável no banco (trigger), mesmo para quem tem acesso direto.
        assertThatThrownBy(() -> banco.update("update questionario_versao set numero = 9 where questionario_id = ?",
                UUID.fromString(v2.path("id").asString()))).isInstanceOf(DataAccessException.class);
        assertThat(banco.queryForObject("select count(*) from questionario_versao where questionario_id=? and numero=1",
                Integer.class, UUID.fromString(v2.path("id").asString()))).isEqualTo(1);
    }

    @Test
    void duasPublicacoesComAMesmaVersaoPublicamUmaVezEADemoraRecebeConflito() throws Exception {
        JsonNode q = criar("Concorrente fictício", "FABRICA");
        String corpo = json.writeValueAsString(Map.of("versao", q.path("versao").asLong(), "confirmarAvisos", true));
        CountDownLatch largada = new CountDownLatch(1);
        Callable<String> publicar = () -> {
            largada.await();
            var resposta = mvc.perform(MockMvcRequestBuilders.post("/questionarios/" + q.path("id").asString() + "/publicar")
                    .header("X-Treinos-Cliente", "nativo").header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(treinador))
                    .contentType(MediaType.APPLICATION_JSON).content(corpo)).andReturn().getResponse();
            String texto = resposta.getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
            return resposta.getStatus() + (resposta.getStatus() == 200 ? "" : ":" + json.readTree(texto).path("codigo").asString());
        };
        var executor = Executors.newFixedThreadPool(2);
        try {
            var a = executor.submit(publicar);
            var b = executor.submit(publicar);
            largada.countDown();
            assertThat(List.of(a.get(), b.get())).containsExactlyInAnyOrder("200", "409:CONFLITO_EDICAO");
        } finally {
            executor.shutdownNow();
        }
        assertThat(api.get("/questionarios/" + q.path("id").asString(), treinador, 200).path("versoes")).hasSize(1);
    }

    @Test
    void publicarComErrosDa422ComOsCaminhosENaoPublica() throws Exception {
        JsonNode q = criar("Inválido fictício", "VAZIO");
        JsonNode erro = publicar(q, true, 422);
        assertThat(erro.path("codigo").asString()).isEqualTo("QUESTIONARIO_INVALIDO");
        assertThat(erro.path("fieldErrors").valueStream().map(f -> f.path("field").asString()))
                .contains("secoes[0].perguntas");
        assertThat(api.get("/questionarios/" + q.path("id").asString(), treinador, 200).path("versaoPublicada").asInt())
                .isZero();
        assertThat(auditorias("QUESTIONARIO_PUBLICADO")).isZero();
    }

    @Test
    void validarDevolveErrosEAvisosSemPublicar() throws Exception {
        JsonNode q = criar("Validar fictício", "VAZIO");
        JsonNode r = api.post("/questionarios/" + q.path("id").asString() + "/validar", treinador, null, 200);
        assertThat(r.path("erros")).isNotEmpty();
        assertThat(api.get("/questionarios/" + q.path("id").asString(), treinador, 200).path("versaoPublicada").asInt())
                .isZero();
    }

    @Test
    void oTipoDeUmIdJaPublicadoNaoMuda() throws Exception {
        JsonNode v1 = publicado("Tipo fictício");
        ObjectNode rascunho = (ObjectNode) v1.path("rascunho").deepCopy();
        ((ObjectNode) pergunta(rascunho, "sono")).put("tipo", "TEXTO");
        JsonNode editado = salvar(v1, rascunho, 200);
        JsonNode erro = publicar(editado, true, 422);
        assertThat(erro.path("codigo").asString()).isEqualTo("QUESTIONARIO_INVALIDO");
        assertThat(erro.path("fieldErrors").valueStream().map(f -> f.path("field").asString()))
                .anyMatch(f -> f.matches("secoes\\[\\d+]\\.perguntas\\[\\d+]\\.tipo"));
        assertThat(api.get("/questionarios/" + v1.path("id").asString(), treinador, 200).path("versaoPublicada").asInt())
                .isEqualTo(1);
    }

    @Test
    void avisoExigeConfirmacao() throws Exception {
        JsonNode q = criar("Sem peso fictício", "VAZIO");
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("nome", "Sem peso fictício");
        corpo.put("conteudo", Map.of("instrucoes", List.of(), "secoes", List.of(Map.of("uid", "s1", "titulo", "Geral",
                "perguntas", List.of(Map.of("id", "energia", "tipo", "NOTA", "rotulo", "Energia", "obrigatoria", true))))));
        corpo.put("versao", q.path("versao").asLong());
        JsonNode salvo = api.put("/questionarios/" + q.path("id").asString(), treinador, corpo, 200);
        assertThat(publicar(salvo, false, 422).path("codigo").asString()).isEqualTo("CONFIRMAR_AVISOS");
        assertThat(publicar(salvo, true, 200).path("versaoPublicada").asInt()).isEqualTo(1);
    }

    // ---- padrão, duplicar, arquivar, excluir ----

    @Test
    void soUmPadraoEOPadraoNaoSaiDeCena() throws Exception {
        JsonNode inicial = api.get("/questionarios", treinador, 200);
        assertThat(inicial).hasSize(1);
        assertThat(inicial.get(0).path("padrao").asBoolean()).isTrue();
        String padraoId = inicial.get(0).path("id").asString();

        JsonNode naoPublicado = criar("Rascunho fictício", "VAZIO");
        assertThat(api.post("/questionarios/" + naoPublicado.path("id").asString() + "/padrao", treinador, null, 409)
                .path("codigo").asString()).isEqualTo("QUESTIONARIO_NAO_PUBLICADO");

        JsonNode outro = publicado("Novo padrão fictício");
        JsonNode troca = api.post("/questionarios/" + outro.path("id").asString() + "/padrao", treinador, null, 200);
        assertThat(troca.path("padrao").asBoolean()).isTrue();
        api.post("/questionarios/" + outro.path("id").asString() + "/padrao", treinador, null, 200);
        assertThat(banco.queryForObject("select count(*) from questionario where consultoria_id=? and padrao and finalidade='ATUALIZACAO'",
                Integer.class, consultoria())).isEqualTo(1);
        assertThat(api.get("/questionarios/" + padraoId, treinador, 200).path("padrao").asBoolean()).isFalse();
        // A segunda chamada em "outro" (já é o padrão) responde 200 e não audita.
        assertThat(auditorias("QUESTIONARIO_PADRAO_ALTERADO")).isEqualTo(1);

        String atual = outro.path("id").asString();
        assertThat(api.post("/questionarios/" + atual + "/arquivar", treinador, null, 409).path("codigo").asString())
                .isEqualTo("QUESTIONARIO_PADRAO");
        assertThat(api.delete("/questionarios/" + atual, treinador, 409).path("codigo").asString())
                .isEqualTo("QUESTIONARIO_PADRAO");
    }

    @Test
    void duplicaComNomeNovoNaoPublicadoENaoPadrao() throws Exception {
        JsonNode origem = publicado("Origem fictícia");
        JsonNode c1 = api.post("/questionarios/" + origem.path("id").asString() + "/duplicar", treinador, null, 200);
        JsonNode c2 = api.post("/questionarios/" + origem.path("id").asString() + "/duplicar", treinador, null, 200);
        assertThat(c1.path("nome").asString()).isEqualTo("Origem fictícia (cópia)");
        assertThat(c2.path("nome").asString()).isEqualTo("Origem fictícia (cópia 2)");
        assertThat(c1.path("versaoPublicada").asInt()).isZero();
        assertThat(c1.path("padrao").asBoolean()).isFalse();
        assertThat(c1.path("rascunho")).isEqualTo(origem.path("rascunho"));
        assertThat(auditorias("QUESTIONARIO_DUPLICADO")).isEqualTo(2);
    }

    @Test
    void duplicarNomeLongoCabeNos120Caracteres() throws Exception {
        String nome = "N".repeat(120);
        JsonNode origem = criar(nome, "VAZIO");
        JsonNode copia = api.post("/questionarios/" + origem.path("id").asString() + "/duplicar", treinador, null, 200);
        assertThat(copia.path("nome").asString()).hasSize(120).endsWith(" (cópia)");
    }

    @Test
    void arquivaDesarquivaEOpcoesSoTrazemPublicados() throws Exception {
        JsonNode a = publicado("Alfa fictício");
        criar("Beta rascunho", "VAZIO");
        List<String> opcoes = api.get("/questionarios/opcoes", treinador, 200).valueStream()
                .map(o -> o.path("nome").asString()).toList();
        assertThat(opcoes).containsExactly("Padrão", "Alfa fictício");

        api.post("/questionarios/" + a.path("id").asString() + "/arquivar", treinador, null, 200);
        assertThat(api.get("/questionarios", treinador, 200).valueStream().map(o -> o.path("nome").asString()))
                .doesNotContain("Alfa fictício");
        assertThat(api.get("/questionarios?arquivados=true", treinador, 200).valueStream()
                .map(o -> o.path("nome").asString())).containsExactly("Alfa fictício");
        assertThat(api.get("/questionarios/opcoes", treinador, 200).valueStream().map(o -> o.path("nome").asString()))
                .doesNotContain("Alfa fictício");

        // "todos": ativos e arquivados juntos (o padrão primeiro); valor desconhecido = 400 sem repetir o valor.
        assertThat(api.get("/questionarios?arquivados=todos", treinador, 200).valueStream()
                .map(o -> o.path("nome").asString()).toList()).containsExactly("Padrão", "Alfa fictício", "Beta rascunho");
        JsonNode erro = api.get("/questionarios?arquivados=talvez", treinador, 400);
        assertThat(erro.path("codigo").asString()).isEqualTo("FILTRO_INVALIDO");
        assertThat(erro.toString()).doesNotContain("talvez");
        assertThat(api.get("/questionarios?arquivados=todos", api.novoTreinador(), 200).valueStream()
                .map(o -> o.path("nome").asString())).doesNotContain("Alfa fictício");

        // Nome ocupado por um ativo: não desarquiva.
        criar("Alfa fictício", "VAZIO");
        assertThat(api.post("/questionarios/" + a.path("id").asString() + "/desarquivar", treinador, null, 409)
                .path("codigo").asString()).isEqualTo("QUESTIONARIO_NOME_EM_USO");
        assertThat(auditorias("QUESTIONARIO_ARQUIVADO")).isEqualTo(1);
        assertThat(auditorias("QUESTIONARIO_DESARQUIVADO")).isZero();
    }

    @Test
    void desarquivarAuditaSoQuandoMuda() throws Exception {
        JsonNode q = publicado("Volta fictício");
        String id = q.path("id").asString();
        // Já ativo: 200 sem evento.
        api.post("/questionarios/" + id + "/desarquivar", treinador, null, 200);
        assertThat(auditorias("QUESTIONARIO_DESARQUIVADO")).isZero();

        api.post("/questionarios/" + id + "/arquivar", treinador, null, 200);
        api.post("/questionarios/" + id + "/desarquivar", treinador, null, 200);
        assertThat(auditorias("QUESTIONARIO_DESARQUIVADO")).isEqualTo(1);
        api.post("/questionarios/" + id + "/desarquivar", treinador, null, 200);
        assertThat(auditorias("QUESTIONARIO_DESARQUIVADO")).isEqualTo(1);
    }

    @Test
    void excluirSemUsoApagaEAlunoEPastaVoltamParaNulo() throws Exception {
        JsonNode q = publicado("Efêmero fictício");
        String pasta = pasta();
        api.put("/alunos/" + aluno + "/questionario", treinador, Map.of("questionarioId", q.path("id").asString()), 200);
        api.put("/pastas/" + pasta + "/questionario", treinador, Map.of("questionarioId", q.path("id").asString()), 200);
        JsonNode lista = api.get("/questionarios", treinador, 200);
        JsonNode uso = lista.valueStream().filter(i -> i.path("id").asString().equals(q.path("id").asString()))
                .findFirst().orElseThrow().path("uso");
        assertThat(uso.path("alunos").asLong()).isEqualTo(1);
        assertThat(uso.path("pastas").asLong()).isEqualTo(1);
        assertThat(uso.path("envios").asLong()).isZero();

        api.delete("/questionarios/" + q.path("id").asString(), treinador, 204);
        api.get("/questionarios/" + q.path("id").asString(), treinador, 404);
        assertThat(api.get("/alunos/" + aluno, treinador, 200).path("questionarioId").isNull()).isTrue();
        assertThat(banco.queryForObject("select questionario_id from pasta_plano where id=?", UUID.class,
                UUID.fromString(pasta))).isNull();
        assertThat(auditorias("QUESTIONARIO_EXCLUIDO")).isEqualTo(1);
    }

    @Test
    void questionarioJaRespondidoNaoSeExcluiMasSeArquiva() throws Exception {
        JsonNode q = publicado("Respondido fictício");
        String pasta = pastaComTreino();
        JsonNode loginAluno = api.convidarEEntrar(treinador, aluno);
        api.put("/alunos/" + aluno + "/questionario", treinador, Map.of("questionarioId", q.path("id").asString()), 200);
        JsonNode vigente = api.get("/aluno/atualizacao", loginAluno, 200);
        // O nome é do treinador: a rota do aluno nunca o traz; a do treinador, sim.
        assertThat(vigente.path("questionarioNome").isNull()).isTrue();
        assertThat(api.get("/alunos/" + aluno + "/atualizacao", treinador, 200).path("questionarioNome").asString())
                .isEqualTo("Respondido fictício");
        api.post("/aluno/atualizacao/enviar", loginAluno, Map.of("pastaId", pasta,
                "questionarioVersaoId", vigente.path("questionarioVersaoId").asString(),
                "respostas", Map.of("peso", 80.5, "sono", 7, "alim_desempenho", 8, "treino_desempenho", 6)), 200);

        assertThat(api.delete("/questionarios/" + q.path("id").asString(), treinador, 409).path("codigo").asString())
                .isEqualTo("QUESTIONARIO_EM_USO");
        JsonNode uso = api.get("/questionarios/" + q.path("id").asString(), treinador, 200).path("uso");
        assertThat(uso.path("envios").asLong()).isEqualTo(1);
        api.post("/questionarios/" + q.path("id").asString() + "/arquivar", treinador, null, 200);
        // Arquivado depois do envio: a atualização enviada continua mostrando a versão que o aluno respondeu.
        assertThat(api.get("/alunos/" + aluno + "/atualizacao", treinador, 200).path("questionarioNome").asString())
                .isEqualTo("Respondido fictício");
    }

    @Test
    void descricaoDaSecaoEscalaDaNotaEVariasFotosSaoGuardadasEValemNoEnvio() throws Exception {
        JsonNode q = criar("Escala fictícia", "FABRICA");
        ObjectNode rascunho = (ObjectNode) q.path("rascunho").deepCopy();
        ObjectNode secao = (ObjectNode) rascunho.path("secoes").get(0);
        secao.put("descricao", "**Leia** com calma.\n__Responda__ tudo.");
        ((ObjectNode) pergunta(rascunho, "sono")).put("min", 1).put("max", 5).put("rotuloMin", "Péssimo").put("rotuloMax", "Ótimo");
        var perguntas = (tools.jackson.databind.node.ArrayNode) secao.path("perguntas");
        perguntas.addObject().put("id", "frente").put("tipo", "FOTOS").put("rotulo", "Foto de frente").put("max", 2);
        perguntas.addObject().put("id", "lado").put("tipo", "FOTOS").put("rotulo", "Foto de lado");
        JsonNode salvo = salvar(q, rascunho, 200);
        JsonNode guardado = salvo.path("rascunho");
        assertThat(guardado.path("secoes").get(0).path("descricao").asString()).isEqualTo("**Leia** com calma.\n__Responda__ tudo.");
        JsonNode sono = pergunta((ObjectNode) guardado, "sono");
        assertThat(sono.path("min").asInt()).isEqualTo(1);
        assertThat(sono.path("max").asInt()).isEqualTo(5);
        assertThat(sono.path("rotuloMin").asString()).isEqualTo("Péssimo");
        assertThat(sono.path("rotuloMax").asString()).isEqualTo("Ótimo");
        assertThat(pergunta((ObjectNode) guardado, "frente").path("max").asInt()).isEqualTo(2);
        JsonNode publicadoV1 = publicar(salvo, true, 200);
        assertThat(publicadoV1.path("versaoPublicada").asInt()).isEqualTo(1);

        String pasta = pastaComTreino();
        JsonNode loginAluno = api.convidarEEntrar(treinador, aluno);
        api.put("/alunos/" + aluno + "/questionario", treinador, Map.of("questionarioId", q.path("id").asString()), 200);
        JsonNode vigente = api.get("/aluno/atualizacao", loginAluno, 200);
        String versao = vigente.path("questionarioVersaoId").asString();
        JsonNode recusado = api.post("/aluno/atualizacao/enviar", loginAluno, Map.of("pastaId", pasta, "questionarioVersaoId", versao,
                "respostas", Map.of("peso", 80.5, "sono", 7, "alim_desempenho", 8, "treino_desempenho", 6)), 422);
        assertThat(recusado.path("fieldErrors").valueStream().map(f -> f.path("field").asString())).containsExactly("sono");
        api.post("/aluno/atualizacao/enviar", loginAluno, Map.of("pastaId", pasta, "questionarioVersaoId", versao,
                "respostas", Map.of("peso", 80.5, "sono", 5, "alim_desempenho", 8, "treino_desempenho", 6)), 200);
    }

    @Test
    void seteFotosEEscalaForaDaRegraNaoPublicam() throws Exception {
        JsonNode q = criar("Fotos demais fictício", "FABRICA");
        ObjectNode rascunho = (ObjectNode) q.path("rascunho").deepCopy();
        ((ObjectNode) pergunta(rascunho, "sono")).put("max", 11);
        var perguntas = (tools.jackson.databind.node.ArrayNode) rascunho.path("secoes").get(0).path("perguntas");
        for (int i = 1; i <= 7; i++) {
            perguntas.addObject().put("id", "foto" + i).put("tipo", "FOTOS").put("rotulo", "Foto " + i);
        }
        JsonNode erro = publicar(salvar(q, rascunho, 200), true, 422);
        assertThat(erro.path("fieldErrors").valueStream().map(f -> f.path("field").asString()).toList())
                .anyMatch(c -> c.endsWith(".max")).anyMatch(c -> c.endsWith(".tipo"));
    }

    // ---- escolha no aluno e na pasta ----

    @Test
    void arquivarFazAResolucaoCairNoPadraoEDesarquivarVolta() throws Exception {
        JsonNode q = publicado("Escolhido fictício");
        pastaComTreino();
        JsonNode loginAluno = api.convidarEEntrar(treinador, aluno);
        JsonNode escolhido = api.put("/alunos/" + aluno + "/questionario", treinador,
                Map.of("questionarioId", q.path("id").asString()), 200);
        assertThat(escolhido.path("questionarioId").asString()).isEqualTo(q.path("id").asString());
        assertThat(api.get("/alunos/" + aluno + "/atualizacao", treinador, 200).path("questionarioNome").asString())
                .isEqualTo("Escolhido fictício");
        api.post("/questionarios/" + q.path("id").asString() + "/arquivar", treinador, null, 200);
        assertThat(api.get("/alunos/" + aluno + "/atualizacao", treinador, 200).path("questionarioNome").asString())
                .isEqualTo("Padrão");
        api.post("/questionarios/" + q.path("id").asString() + "/desarquivar", treinador, null, 200);
        assertThat(api.get("/alunos/" + aluno + "/atualizacao", treinador, 200).path("questionarioNome").asString())
                .isEqualTo("Escolhido fictício");
        assertThat(api.get("/aluno/atualizacao", loginAluno, 200).path("questionarioNome").isNull()).isTrue();
    }

    @Test
    void escolhaRecusaArquivadoENaoPublicadoEAceitaNulo() throws Exception {
        String pasta = pasta();
        JsonNode rascunho = criar("Rascunho escolha", "VAZIO");
        JsonNode arquivado = publicado("Arquivado escolha");
        api.post("/questionarios/" + arquivado.path("id").asString() + "/arquivar", treinador, null, 200);
        for (JsonNode q : List.of(rascunho, arquivado)) {
            String corpo = q.path("id").asString();
            assertThat(api.put("/alunos/" + aluno + "/questionario", treinador, Map.of("questionarioId", corpo), 409)
                    .path("codigo").asString()).isEqualTo("QUESTIONARIO_INDISPONIVEL");
            assertThat(api.put("/pastas/" + pasta + "/questionario", treinador, Map.of("questionarioId", corpo), 409)
                    .path("codigo").asString()).isEqualTo("QUESTIONARIO_INDISPONIVEL");
        }
        JsonNode bom = publicado("Bom escolha");
        JsonNode daPasta = api.put("/pastas/" + pasta + "/questionario", treinador,
                Map.of("questionarioId", bom.path("id").asString()), 200);
        assertThat(daPasta.path("questionarioId").asString()).isEqualTo(bom.path("id").asString());
        assertThat(api.put("/pastas/" + pasta + "/questionario", treinador, new LinkedHashMap<String, Object>(), 200)
                .path("questionarioId").isNull()).isTrue();
        assertThat(auditorias("PASTA_QUESTIONARIO_ALTERADO")).isEqualTo(2);
        assertThat(auditorias("ALUNO_QUESTIONARIO_ALTERADO")).isZero();
    }

    @Test
    void replicarAPastaNaoCopiaAEscolhaDeQuestionario() throws Exception {
        String pasta = pasta();
        JsonNode q = publicado("Replicar fictício");
        api.put("/pastas/" + pasta + "/questionario", treinador, Map.of("questionarioId", q.path("id").asString()), 200);
        LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
        JsonNode copia = api.post("/pastas/" + pasta + "/replicar", treinador,
                Map.of("titulo", "Cópia fictícia", "inicio", hoje.plusDays(1), "fim", hoje.plusDays(28)), 200);
        assertThat(copia.path("questionarioId").isNull()).isTrue();
    }

    // ---- permissões ----

    @Test
    void permissoesDeLerEAlterarEAsOpcoesDoSeletor() throws Exception {
        JsonNode q = publicado("Permissões fictício");
        String id = q.path("id").asString();
        JsonNode soLer = membro(Set.of("QUESTIONARIO_LER"));
        api.get("/questionarios", soLer, 200);
        api.get("/questionarios/" + id, soLer, 200);
        api.get("/questionarios/opcoes", soLer, 200);
        api.post("/questionarios", soLer, Map.of("nome", "Nada", "origem", "VAZIO"), 403);
        api.post("/questionarios/" + id + "/publicar", soLer, Map.of("versao", 0, "confirmarAvisos", true), 403);
        api.post("/questionarios/" + id + "/duplicar", soLer, null, 403);
        api.post("/questionarios/" + id + "/padrao", soLer, null, 403);
        api.post("/questionarios/" + id + "/arquivar", soLer, null, 403);
        api.delete("/questionarios/" + id, soLer, 403);

        JsonNode quemAltera = membro(CatalogoDependencias.comLer("QUESTIONARIO_ALTERAR"));
        api.post("/questionarios", quemAltera, Map.of("nome", "Do membro", "origem", "VAZIO"), 200);

        // Quem só atribui questionário vê as opções, mas não a gestão.
        JsonNode soAtribui = membro(Set.of("ALUNO_LER", "ALUNO_ALTERAR"));
        api.get("/questionarios/opcoes", soAtribui, 200);
        api.get("/questionarios", soAtribui, 403);
        api.get("/questionarios/" + id, soAtribui, 403);
        api.put("/alunos/" + aluno + "/questionario", soAtribui, Map.of("questionarioId", id), 200);
        api.put("/pastas/" + UUID.randomUUID() + "/questionario", soAtribui, new LinkedHashMap<String, Object>(), 403);

        JsonNode semNada = membro(Set.of("ALUNO_LER"));
        api.get("/questionarios/opcoes", semNada, 403);
        api.get("/questionarios", semNada, 403);
        api.put("/alunos/" + aluno + "/questionario", semNada, new LinkedHashMap<String, Object>(), 403);
    }

    /** Atalho para montar o conjunto de permissões de um membro de teste respeitando as dependências do catálogo. */
    private static final class CatalogoDependencias {
        static Set<String> comLer(String codigo) {
            return br.com.treinos.api.equipe.CatalogoPermissoes.comDependencias(Set.of(codigo));
        }
    }
}
