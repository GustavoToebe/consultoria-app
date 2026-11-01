package br.com.treinos.api.importacao.completa;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.conta.ContaLocalRepositorio;
import br.com.treinos.api.conta.DireitosLocais;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMultipartHttpServletRequestBuilder;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Prévia, confirmação e "Desfazer" da planilha completa pelas rotas, com a planilha fictícia do treinador gerada no teste.
 * Cada teste tem a própria consultoria; as consultas diretas filtram pelo id da importação.
 */
@AutoConfigureMockMvc
@TestPropertySource(properties = "treinos.plano.aplicar=true")
class PlanilhaCompletaGravacaoIntegrationTest extends AbstractIntegrationTest {

    private static final String BASE = "/importacoes/planilha-completa/";
    private static final byte[] PLANILHA = PlanilhaDeTeste.xlsx(PlanilhaDeTeste.abasDoTreinador());

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private ContaLocalRepositorio contas;

    private ApiDeTeste api;
    private JsonNode treinador;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        treinador = api.novoTreinador();
    }

    private JsonNode enviar(JsonNode login, String acao, String respostas, String hash, int esperado) throws Exception {
        return enviar(PLANILHA, login, acao, respostas, hash, esperado);
    }

    private JsonNode enviar(byte[] planilha, JsonNode login, String acao, String respostas, String hash, int esperado)
            throws Exception {
        MockMultipartHttpServletRequestBuilder pedido = multipart(BASE + acao)
                .file(new MockMultipartFile("arquivo", "planilha.xlsx", "application/octet-stream", planilha));
        if (respostas != null) {
            pedido.file(new MockMultipartFile("respostas", "", "application/json", respostas.getBytes(StandardCharsets.UTF_8)));
        }
        if (hash != null) {
            pedido.param("hash", hash);
        }
        pedido.header("X-Treinos-Cliente", "nativo");
        pedido.header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(login));
        String texto = mvc.perform(pedido).andExpect(status().is(esperado)).andReturn().getResponse()
                .getContentAsString(StandardCharsets.UTF_8);
        return texto.isBlank() ? json.nullNode() : json.readTree(texto);
    }

    private JsonNode desfazer(JsonNode login, String id, int esperado) throws Exception {
        String texto = mvc.perform(post("/importacoes/" + id + "/desfazer").header("X-Treinos-Cliente", "nativo")
                        .header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(login)))
                .andExpect(status().is(esperado)).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        return texto.isBlank() ? json.nullNode() : json.readTree(texto);
    }

    private JsonNode confirmar(JsonNode login) throws Exception {
        JsonNode previa = enviar(login, "previa", null, null, 200);
        return enviar(login, "confirmar", null, previa.path("hash").asString(), 200);
    }

    private int contar(String tabela, String importacao, String filtro) {
        return jdbc.queryForObject("select count(*) from " + tabela + " where importacao_id = ?::uuid" + filtro, Integer.class,
                importacao);
    }

    private static JsonNode parte(JsonNode desfeita, String tipo) {
        for (JsonNode p : desfeita.path("partes")) {
            if (tipo.equals(p.path("tipo").asString())) {
                return p;
            }
        }
        throw new AssertionError("Parte ausente: " + tipo);
    }

    private JsonNode membroCom(Set<String> permissoes) throws Exception {
        String perfil = api.post("/perfis", treinador, Map.of("nome", "Perfil fictício " + UUID.randomUUID(),
                "permissoes", permissoes), 200).path("id").asString();
        JsonNode convite = api.post("/usuarios/convites", treinador, Map.of("nome", "Membro Fictício",
                "email", ApiDeTeste.emailUnico("membro"), "perfilId", perfil), 200);
        return api.post("/publico/convites-equipe/aceitar", null, Map.of("codigo", convite.path("codigo").asString(),
                "senha", ApiDeTeste.SENHA), 200);
    }

    @Test
    void previaNaoGravaEConfirmarCriaTudoEmRascunho() throws Exception {
        JsonNode previa = enviar(treinador, "previa", null, null, 200);
        JsonNode c = previa.path("criacao");
        assertThat(c.path("alunosNovos").asInt()).isEqualTo(5);
        assertThat(c.path("pesos").asInt()).isEqualTo(2);
        assertThat(c.path("exercicios").asInt()).isEqualTo(2);
        assertThat(c.path("pastas").asInt()).isEqualTo(2);
        assertThat(c.path("treinos").asInt()).isEqualTo(1);
        assertThat(c.path("dietas").asInt()).isEqualTo(2);
        assertThat(previa.path("hash").asString()).hasSize(64);
        assertThat(previa.path("partesPuladas").size()).isZero();
        for (String proibido : new String[] {"Aluno Um", "um@example.com", "80.5", "Remédio Fictício", "Observação geral"}) {
            assertThat(previa.toString()).as(proibido).doesNotContain(proibido);
        }
        assertThat(api.get("/alunos", treinador, 200).path("total").asInt()).isZero();

        JsonNode feito = enviar(treinador, "confirmar", null, previa.path("hash").asString(), 200);
        String id = feito.path("importacaoId").asString();
        assertThat(feito.path("situacao").asString()).isEqualTo("CONCLUIDA_COM_ERROS");
        assertThat(api.get("/alunos", treinador, 200).path("total").asInt()).isEqualTo(5);
        assertThat(contar("aluno", id, "")).isEqualTo(5);
        assertThat(contar("registro_peso", id, "")).isEqualTo(2);
        assertThat(contar("exercicio", id, "")).isEqualTo(2);
        assertThat(contar("pasta_plano", id, "")).isEqualTo(2);
        // Nada publicado: os planos ficam em rascunho, sem versão.
        assertThat(contar("plano_treino", id, " and versao_publicada = 0 and publicado_em is null and not ativo")).isEqualTo(1);
        assertThat(contar("plano_dieta", id, " and versao_publicada = 0 and publicado_em is null and not ativo")).isEqualTo(2);
        assertThat(jdbc.queryForObject("select count(*) from plano_treino_versao v join plano_treino p on p.id = v.plano_id "
                + "where p.importacao_id = ?::uuid", Integer.class, id)).isZero();
        // O treino liga aos exercícios criados pela própria importação.
        String remada = jdbc.queryForObject("select id::text from exercicio where importacao_id = ?::uuid and nome = ?",
                String.class, id, "Remada fictícia");
        String rascunho = jdbc.queryForObject("select rascunho::text from plano_treino where importacao_id = ?::uuid",
                String.class, id);
        assertThat(rascunho).contains(remada);
        assertThat(jdbc.queryForObject("select count(*) from auditoria where acao = 'IMPORTACAO_CONCLUIDA' "
                + "and entidade_id = ?::uuid", Integer.class, id)).isEqualTo(1);
        assertThat(api.get("/importacoes/" + id, treinador, 200).path("nomeArquivo").asString()).isEqualTo(".xlsx");
    }

    @Test
    void hashDiferenteNaoGrava() throws Exception {
        JsonNode previa = enviar(treinador, "previa", null, null, 200);
        JsonNode erro = enviar(treinador, "confirmar", null, "hash-errado", 409);
        assertThat(erro.path("codigo").asString()).isEqualTo("PREVIA_DESATUALIZADA");
        // Respostas trocadas depois da prévia também mudam o hash.
        enviar(treinador, "confirmar", "{\"abas\":[{\"indice\":6,\"tipo\":\"IGNORAR\"}]}", previa.path("hash").asString(), 409);
        JsonNode invalida = enviar(treinador, "previa", "{\"abas\":[{\"indice\":6,\"tipo\":\"XPTO\"}]}", null, 400);
        assertThat(invalida.path("codigo").asString()).isEqualTo("RESPOSTAS_INVALIDAS");
        assertThat(api.get("/alunos", treinador, 200).path("total").asInt()).isZero();
    }

    @Test
    void permissaoFaltandoPulaAParte() throws Exception {
        JsonNode membro = membroCom(Set.of("ALUNO_LER", "ALUNO_ALTERAR"));
        JsonNode previa = enviar(membro, "previa", null, null, 200);
        List<String> puladas = new java.util.ArrayList<>();
        previa.path("partesPuladas").forEach(p -> puladas.add(p.path("parte").asString()));
        assertThat(puladas).contains("PESOS", "EXERCICIOS", "TREINO", "DIETA");
        JsonNode feito = enviar(membro, "confirmar", null, previa.path("hash").asString(), 200);
        String id = feito.path("importacaoId").asString();
        assertThat(contar("aluno", id, "")).isEqualTo(5);
        assertThat(contar("registro_peso", id, "")).isZero();
        assertThat(contar("exercicio", id, "")).isZero();
        assertThat(contar("pasta_plano", id, "")).isZero();

        // Sem ALUNO_ALTERAR a rota nem abre.
        enviar(membroCom(Set.of("ALUNO_LER")), "previa", null, null, 403);
    }

    @Test
    void limiteDoPlanoDeixaOsAlunosQueSobramDeFora() throws Exception {
        UUID consultoria = jdbc.queryForObject("select consultoria_id from usuario where id = ?::uuid", UUID.class,
                treinador.path("usuario").path("id").asString());
        contas.gravarDireitos(new DireitosLocais(consultoria, UUID.randomUUID(), 1, "ATIVA", true, null, null, "PAGO", "Pago",
                Map.of("alunos_ativos", 2L), List.of("MOBILIDADE", "PDF", "EQUIPE"), Instant.now()));
        JsonNode previa = enviar(treinador, "previa", null, null, 200);
        assertThat(previa.path("criacao").path("alunosNovos").asInt()).isEqualTo(2);
        assertThat(previa.path("problemasPorTipo").path("LIMITE_DO_PLANO").asInt()).isEqualTo(3);
        enviar(treinador, "confirmar", null, previa.path("hash").asString(), 200);
        assertThat(api.get("/alunos", treinador, 200).path("total").asInt()).isEqualTo(2);
    }

    @Test
    void desfazerSemNadaTocadoApagaTudo() throws Exception {
        String id = confirmar(treinador).path("importacaoId").asString();
        JsonNode d = desfazer(treinador, id, 200);
        assertThat(parte(d, "ALUNO").path("apagados").asInt()).isEqualTo(5);
        assertThat(parte(d, "PESO").path("apagados").asInt()).isEqualTo(2);
        assertThat(parte(d, "EXERCICIO").path("apagados").asInt()).isEqualTo(2);
        assertThat(parte(d, "PASTA").path("apagados").asInt()).isEqualTo(2);
        assertThat(parte(d, "PLANO_TREINO").path("apagados").asInt()).isEqualTo(1);
        assertThat(parte(d, "PLANO_DIETA").path("apagados").asInt()).isEqualTo(2);
        assertThat(d.path("ficaram").size()).isZero();
        assertThat(api.get("/alunos", treinador, 200).path("total").asInt()).isZero();
        assertThat(jdbc.queryForObject("select count(*) from auditoria where acao = 'IMPORTACAO_DESFEITA' "
                + "and entidade_id = ?::uuid", Integer.class, id)).isEqualTo(1);

        // De novo: nada a apagar, nenhum evento novo.
        JsonNode outra = desfazer(treinador, id, 200);
        assertThat(parte(outra, "ALUNO").path("apagados").asInt()).isZero();
        assertThat(jdbc.queryForObject("select count(*) from auditoria where acao = 'IMPORTACAO_DESFEITA' "
                + "and entidade_id = ?::uuid", Integer.class, id)).isEqualTo(1);
    }

    @Test
    void desfazerDeixaOQueFoiTocadoEDizPorque() throws Exception {
        String id = confirmar(treinador).path("importacaoId").asString();
        // O treino do Aluno Um foi publicado; o Aluno Quatro já entrou no app.
        jdbc.update("update plano_treino set versao_publicada = 1, publicado_em = now() where importacao_id = ?::uuid", id);
        UUID quatro = jdbc.queryForObject("select id from aluno where importacao_id = ?::uuid and nome = ?", UUID.class, id,
                "Aluno Quatro");
        api.convidarEEntrar(treinador, quatro);

        JsonNode d = desfazer(treinador, id, 200);
        assertThat(parte(d, "PLANO_TREINO").path("motivos").path("PUBLICADO").asInt()).isEqualTo(1);
        assertThat(parte(d, "PLANO_DIETA").path("apagados").asInt()).isEqualTo(2);
        assertThat(parte(d, "PASTA").path("motivos").path("COM_PLANOS").asInt()).isEqualTo(1);
        assertThat(parte(d, "PASTA").path("apagados").asInt()).isEqualTo(1);
        assertThat(parte(d, "PESO").path("apagados").asInt()).isEqualTo(2);
        // Os dois exercícios estão no treino que ficou.
        assertThat(parte(d, "EXERCICIO").path("motivos").path("EM_USO").asInt()).isEqualTo(2);
        JsonNode alunos = parte(d, "ALUNO");
        assertThat(alunos.path("apagados").asInt()).isEqualTo(3);
        assertThat(alunos.path("motivos").path("COM_ACESSO").asInt()).isEqualTo(1);
        assertThat(alunos.path("motivos").path("EM_USO").asInt()).isEqualTo(1); // o Aluno Um, que ainda tem a pasta
        assertThat(d.toString()).doesNotContain("Aluno Um").doesNotContain("Aluno Quatro");
        assertThat(contar("plano_treino", id, "")).isEqualTo(1);
        assertThat(contar("aluno", id, "")).isEqualTo(2);
    }

    @Test
    void outraConsultoriaNaoDesfaz() throws Exception {
        String id = confirmar(treinador).path("importacaoId").asString();
        desfazer(api.novoTreinador(), id, 404);
        desfazer(treinador, UUID.randomUUID().toString(), 404);
        assertThat(contar("aluno", id, "")).isEqualTo(5);
    }

    // ----------------------------------------------------------------------------------- fase 2 (01/11)

    /** Uma aba por aluno (o nome do aluno no nome da aba) e, na mesma planilha, uma aba com dois alunos em blocos. */
    private static byte[] planilhaPorAluno() {
        Map<String, List<List<Object>>> abas = new java.util.LinkedHashMap<>();
        abas.put("Ana Fictícia", List.of(
                PlanilhaDeTeste.linha("Treino A"),
                PlanilhaDeTeste.linha("Exercício", "Séries", "Repetições", "Descanso"),
                PlanilhaDeTeste.linha("Supino fictício", 4, "8-12", "90s"),
                PlanilhaDeTeste.linha("Treino B"),
                PlanilhaDeTeste.linha("Exercício", "Séries", "Repetições", "Descanso"),
                PlanilhaDeTeste.linha("Remada fictícia", 3, "12-10-8", "1 min")));
        abas.put("Treinos", List.of(
                PlanilhaDeTeste.linha("Aluno: Bruno Inventado"),
                PlanilhaDeTeste.linha("Exercício", "Prescrição"),
                PlanilhaDeTeste.linha("Agachamento fictício", "4x10 RIR 2"),
                PlanilhaDeTeste.linha("Aluno: Carla Exemplo"),
                PlanilhaDeTeste.linha("Exercício", "Prescrição"),
                PlanilhaDeTeste.linha("Prancha fictícia", "3x30s")));
        return PlanilhaDeTeste.xlsx(abas);
    }

    @Test
    void umaAbaPorAlunoEBlocosCriamOsAlunosPeloNomeEODesfazerApaga() throws Exception {
        byte[] planilha = planilhaPorAluno();
        JsonNode analise = enviar(planilha, treinador, "analisar", null, null, 200);
        assertThat(analise.path("abas").get(0).path("formato").asString()).isEqualTo("UM_ALUNO");
        assertThat(analise.path("abas").get(1).path("formato").asString()).isEqualTo("BLOCOS");
        assertThat(analise.path("abas").get(1).path("blocos").get(1).path("situacao").asString()).isEqualTo("NOVO");

        JsonNode previa = enviar(planilha, treinador, "previa", null, null, 200);
        assertThat(previa.path("criacao").path("alunosNovos").asInt()).isEqualTo(3);
        assertThat(previa.path("criacao").path("pastas").asInt()).isEqualTo(3);
        JsonNode feito = enviar(planilha, treinador, "confirmar", null, previa.path("hash").asString(), 200);
        String id = feito.path("importacaoId").asString();
        assertThat(contar("aluno", id, "")).isEqualTo(3);
        assertThat(contar("plano_treino", id, " and versao_publicada = 0 and publicado_em is null")).isEqualTo(3);
        String rascunho = jdbc.queryForObject("select p.rascunho::text from plano_treino p join aluno a on a.id = p.aluno_id "
                + "where p.importacao_id = ?::uuid and a.nome = ?", String.class, id, "Ana Fictícia");
        assertThat(rascunho).contains("\"descansoSegundos\":90").contains("Treino A").contains("Treino B");
        // O histórico não guarda o nome do aluno que está no nome da aba.
        assertThat(jdbc.queryForObject("select erros::text from importacao where id = ?::uuid", String.class, id))
                .doesNotContain("Ana Fictícia");

        JsonNode d = desfazer(treinador, id, 200);
        assertThat(parte(d, "ALUNO").path("apagados").asInt()).isEqualTo(3);
        assertThat(parte(d, "PLANO_TREINO").path("apagados").asInt()).isEqualTo(3);
        assertThat(api.get("/alunos", treinador, 200).path("total").asInt()).isZero();
    }
}
