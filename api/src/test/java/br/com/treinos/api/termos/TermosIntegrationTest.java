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
    }

    @Test
    void aceitarGravaVersaoEDataESaiDaPendenciaSemDuplicar() throws Exception {
        String usuarioId = treinador.get("usuario").get("id").asString();
        api.post("/termos/aceite", treinador, Map.of("versao", Termos.VERSAO), 200);
        api.post("/termos/aceite", treinador, Map.of("versao", Termos.VERSAO), 200);

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
    void semLoginNaoLeNemAceita() throws Exception {
        api.get("/termos", null, 401);
        api.post("/termos/aceite", null, Map.of("versao", Termos.VERSAO), 401);
    }
}
