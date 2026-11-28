package br.com.treinos.api.termos;

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

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Aceite do termo de uso e do aviso de privacidade: treinador e aluno, versão e idempotência. */
@AutoConfigureMockMvc
class TermosIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JsonMapper json;
    @Autowired
    private JdbcTemplate jdbc;

    private ApiDeTeste api;
    private JsonNode treinador;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        treinador = api.novoTreinador();
    }

    @Test
    void usuarioNovoTemOsTermosPendentesEOsTextosSaoRascunho() throws Exception {
        JsonNode eu = api.get("/eu", treinador, 200);
        assertThat(eu.get("termosPendentes").asBoolean()).isTrue();
        assertThat(eu.get("termosVersao").asString()).isEqualTo(Termos.VERSAO);

        JsonNode termos = api.get("/termos", treinador, 200);
        assertThat(termos.get("aceito").asBoolean()).isFalse();
        assertThat(termos.get("rascunho").asBoolean()).isTrue();
        assertThat(termos.get("documentos")).hasSize(2);
        assertThat(termos.get("documentos").get(0).get("id").asString()).isEqualTo("TERMO_USO");
        JsonNode aviso = termos.get("documentos").get(1);
        assertThat(aviso.get("id").asString()).isEqualTo("AVISO_PRIVACIDADE");
        assertThat(aviso.get("texto").asString()).contains("Canadá");
        assertThat(termos.get("aceitoEm").isNull()).isTrue();
        // O aviso de rascunho é só o campo `rascunho` (o app da equipe mostra o selo): nunca no texto.
        assertThat(termos.get("documentos").toString()).doesNotContain("RASCUNHO", "{{", "CONTATO DA CONSULTORIA");
    }

    @Test
    void contatoDoTermoVemDaConsultoriaDaSessaoParaTreinadorEAluno() throws Exception {
        UUID alunoId = api.criarAluno(treinador, "Aluno Fictício");
        JsonNode aluno = api.convidarEEntrar(treinador, alunoId);
        String nome = api.get("/consultoria", treinador, 200).get("marca").get("nome").asString();

        // Sem WhatsApp nem e-mail: o nome e "fale com o seu treinador pelo app".
        assertThat(contato(aluno)).contains("**Consultoria:** " + nome, "Fale com o seu treinador pelo app.")
                .doesNotContain("PREENCHER", "WhatsApp");

        gravarContato(Map.of("whatsapp", "(45) 99999-8888", "emailResponderPara", "contato@teste.local"));
        for (JsonNode quem : new JsonNode[] {aluno, treinador}) {
            assertThat(contato(quem)).contains("**Consultoria:** " + nome, "**WhatsApp:** (45) 99999-8888",
                    "**E-mail:** contato@teste.local").doesNotContain("Fale com o seu treinador pelo app.");
        }
        // Outra consultoria não vê o contato desta.
        JsonNode outro = api.novoTreinador();
        assertThat(contato(outro)).doesNotContain("99999-8888", "contato@teste.local");
    }

    private String contato(JsonNode quem) throws Exception {
        String texto = api.get("/termos", quem, 200).get("documentos").get(0).get("texto").asString();
        return texto.substring(texto.indexOf("## 8. Contato"));
    }

    private void gravarContato(Map<String, Object> contato) throws Exception {
        JsonNode atual = api.get("/consultoria", treinador, 200);
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("nome", atual.get("marca").get("nome").asString());
        corpo.put("corPrimaria", atual.get("marca").get("corPrimaria").asString());
        corpo.put("fonteTitulo", "PADRAO");
        corpo.put("temaPadrao", "CLARO");
        corpo.put("versao", atual.get("versao").asLong());
        corpo.putAll(contato);
        api.put("/consultoria/marca", treinador, corpo, 200);
    }

    @Test
    void aceitarGravaVersaoEDataESaiDaPendenciaSemDuplicar() throws Exception {
        String usuarioId = treinador.get("usuario").get("id").asString();
        JsonNode primeiro = api.post("/termos/aceite", treinador, Map.of("versao", Termos.VERSAO), 200);
        // A resposta do próprio aceite já traz a data (lida do banco, não da entidade recém-gravada).
        assertThat(primeiro.get("aceitoEm").isNull()).isFalse();
        JsonNode segundo = api.post("/termos/aceite", treinador, Map.of("versao", Termos.VERSAO), 200);
        assertThat(segundo.get("aceitoEm").asString()).isEqualTo(primeiro.get("aceitoEm").asString());

        assertThat(api.get("/eu", treinador, 200).get("termosPendentes").asBoolean()).isFalse();
        assertThat(api.get("/termos", treinador, 200).get("aceito").asBoolean()).isTrue();
        assertThat(jdbc.queryForObject("select count(*) from aceite_termo where usuario_id = ?::uuid and versao = ?"
                + " and aceito_em is not null", Integer.class, usuarioId, Termos.VERSAO)).isEqualTo(1);
        // A auditoria registra uma vez só e sem conteúdo.
        assertThat(jdbc.queryForObject("select count(*) from auditoria where usuario_id = ?::uuid"
                + " and acao = 'TERMOS_ACEITOS'", Integer.class, usuarioId)).isEqualTo(1);
    }

    @Test
    void versaoDiferenteDaVigenteEhRecusada() throws Exception {
        JsonNode erro = api.post("/termos/aceite", treinador, Map.of("versao", "1999-01-01"), 409);
        assertThat(erro.get("codigo").asString()).isEqualTo("TERMOS_DESATUALIZADOS");
        assertThat(api.get("/eu", treinador, 200).get("termosPendentes").asBoolean()).isTrue();
        api.post("/termos/aceite", treinador, Map.of("versao", ""), 400);
    }

    @Test
    void alunoTambemAceitaEOAceiteNaoVazaEntreUsuarios() throws Exception {
        UUID alunoId = api.criarAluno(treinador, "Aluno Fictício");
        JsonNode aluno = api.convidarEEntrar(treinador, alunoId);

        assertThat(api.get("/eu", aluno, 200).get("termosPendentes").asBoolean()).isTrue();
        api.post("/termos/aceite", aluno, Map.of("versao", Termos.VERSAO), 200);
        assertThat(api.get("/eu", aluno, 200).get("termosPendentes").asBoolean()).isFalse();
        // O aceite do aluno não vale para o treinador.
        assertThat(api.get("/eu", treinador, 200).get("termosPendentes").asBoolean()).isTrue();
    }

    @Test
    void rotaPublicaDaOsMesmosTextosSemLoginESemNadaDoUsuarioNemOContato() throws Exception {
        gravarContato(Map.of("whatsapp", "(45) 98888-7777", "emailResponderPara", "publico@teste.local"));
        JsonNode logado = api.get("/termos", treinador, 200);
        var resposta = mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/publico/termos"))
                .andReturn().getResponse();
        assertThat(resposta.getStatus()).isEqualTo(200);
        assertThat(resposta.getHeader("Cache-Control")).isEqualTo("max-age=300, public");
        JsonNode publico = json.readTree(resposta.getContentAsString());
        assertThat(publico.get("versao").asString()).isEqualTo(Termos.VERSAO);
        assertThat(publico.get("rascunho").asBoolean()).isEqualTo(logado.get("rascunho").asBoolean());
        // Os dois documentos só mudam no contato (o público não leva o da consultoria) e nunca trazem a nota interna.
        String termoPublico = publico.get("documentos").get(0).get("texto").asString();
        assertThat(termoPublico).endsWith("## 8. Contato\nFale com o seu treinador pelo app.");
        for (JsonNode d : publico.get("documentos")) {
            assertThat(d.get("texto").asString()).doesNotContain("98888-7777", "publico@teste.local", "PREENCHER", "{{", "RASCUNHO",
                    "REVISAR COM ADVOGADO", "base legal da transferência");
            assertSemColcheteDeModelo(d);
        }
        assertThat(logado.get("documentos").get(0).get("texto").asString()).contains("98888-7777");
        assertThat(logado.get("documentos").get(1).get("texto").asString()).contains("98888-7777");
        assertThat(publico.has("aceito")).isFalse();
        assertThat(publico.has("aceitoEm")).isFalse();
        assertThat(publico.has("notasInternas")).isFalse();
    }

    @Test
    void notaInternaDoAdvogadoSoVaiParaAEquipeENuncaNoTextoDoAluno() throws Exception {
        UUID alunoId = api.criarAluno(treinador, "Aluno Fictício");
        JsonNode aluno = api.convidarEEntrar(treinador, alunoId);

        JsonNode doAluno = api.get("/termos", aluno, 200);
        assertThat(doAluno.get("notasInternas")).isEmpty();
        // O PDF do app é montado só com estes textos: sem a nota aqui, sem a nota no PDF.
        for (JsonNode d : doAluno.get("documentos")) {
            assertThat(d.get("texto").asString()).doesNotContain("REVISAR COM ADVOGADO", "base legal da transferência", "RASCUNHO");
            assertSemColcheteDeModelo(d);
        }
        JsonNode aceite = api.post("/termos/aceite", aluno, Map.of("versao", Termos.VERSAO), 200);
        assertThat(aceite.get("notasInternas")).isEmpty();
        assertThat(aceite.get("documentos").toString()).doesNotContain("REVISAR COM ADVOGADO", "base legal da transferência");

        JsonNode daEquipe = api.get("/termos", treinador, 200);
        assertThat(daEquipe.get("notasInternas")).hasSize(1);
        JsonNode nota = daEquipe.get("notasInternas").get(0);
        assertThat(nota.get("documentoId").asString()).isEqualTo("AVISO_PRIVACIDADE");
        assertThat(nota.get("texto").asString()).isEqualTo("base legal da transferência internacional");
        // Mesmo para a equipe a nota não entra no texto: fica só na lista à parte.
        assertThat(daEquipe.get("documentos").toString()).doesNotContain("REVISAR COM ADVOGADO");
    }

    private static void assertSemColcheteDeModelo(JsonNode documento) {
        assertThat(ContatoDosTermosTest.COLCHETE_DE_MODELO.matcher(documento.get("texto").asString()).find())
                .as("colchete de modelo ou marcador em %s", documento.get("id").asString()).isFalse();
    }

    @Test
    void semLoginNaoLeNemAceita() throws Exception {
        api.get("/termos", null, 401);
        api.post("/termos/aceite", null, Map.of("versao", Termos.VERSAO), 401);
    }
}
