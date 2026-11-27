package br.com.treinos.api.contratos;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.web.Fuso;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * A guarda do contrato assinado (D16) roda com {@code TREINOS_CONTRATOS_HABILITADO=false}: a chave só fecha as rotas, e quem saiu da
 * consultoria tem de ter o contrato apagado ao fim da guarda de qualquer jeito. Com o módulo desligado não há como gerar contrato pela
 * API, então o assinado antigo é gravado direto por JDBC (como o que ficou de quando a chave estava ligada).
 */
@AutoConfigureMockMvc
class GuardaDoContratoAssinadoDesligadoIntegrationTest extends AbstractIntegrationTest {

    private static final LocalDate HOJE = LocalDate.now(Fuso.BRASILIA);

    @DynamicPropertySource
    static void desligar(DynamicPropertyRegistry registro) {
        registro.add("treinos.contratos.habilitado", () -> "false");
    }

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private GuardaDoContratoAssinado guarda;

    @Test
    void rodaComAChaveDeContratosDesligada() throws Exception {
        ApiDeTeste api = new ApiDeTeste(mvc, json);
        JsonNode admin = api.novoTreinador();
        UUID consultoria = jdbc.queryForObject("select consultoria_id from usuario where id = ?::uuid", UUID.class,
                admin.get("usuario").get("id").asString());
        UUID aluno = api.criarAluno(admin, "Aluno Fictício " + UUID.randomUUID());
        String usuarioDoAluno = api.convidarEEntrar(admin, aluno).get("usuario").get("id").asString();
        assertThat(api.get("/eu", admin, 200).get("contratosHabilitados").asBoolean()).isFalse();

        UUID contrato = UUID.randomUUID();
        jdbc.update("insert into contrato_aluno (id, consultoria_id, aluno_id, origem, titulo, texto, sha256, signatario, situacao, "
                + "pedido_id, assinado_em, assinado_por_usuario_id, assinante_nome, assinante_ip, assinante_agente) "
                + "values (?::uuid, ?::uuid, ?::uuid, 'MODELO', 'Contrato antigo', 'Texto fictício', ?, 'ALUNO', 'ASSINADO', "
                + "?::uuid, now() - interval '6 years', ?::uuid, 'Aluno Fictício', '203.0.113.7', 'agente-de-teste')",
                contrato.toString(), consultoria.toString(), aluno.toString(), "a".repeat(64), UUID.randomUUID().toString(), usuarioDoAluno);
        jdbc.update("insert into contrato_arquivo (contrato_id, consultoria_id, bytes) values (?::uuid, ?::uuid, ?)",
                contrato.toString(), consultoria.toString(), "%PDF-1.4 fictício".getBytes(StandardCharsets.UTF_8));
        jdbc.update("update aluno set anonimizado_em = now() where id = ?::uuid", aluno.toString());

        assertThat(guarda.rodarNa(consultoria, HOJE)).isEqualTo(1);

        Map<String, Object> linha = jdbc.queryForMap("select * from contrato_aluno where id = ?::uuid", contrato.toString());
        assertThat(linha.get("texto")).isNull();
        assertThat(linha.get("assinante_nome")).isNull();
        assertThat(linha.get("apagado_em")).isNotNull();
        assertThat(linha.get("sha256")).isEqualTo("a".repeat(64));
        assertThat(jdbc.queryForObject("select count(*) from contrato_arquivo where contrato_id = ?::uuid", Integer.class,
                contrato.toString())).isZero();
    }
}
