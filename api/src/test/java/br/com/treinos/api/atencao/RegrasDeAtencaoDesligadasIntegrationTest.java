package br.com.treinos.api.atencao;

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

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Com {@code TREINOS_REGRAS_ATENCAO_HABILITADO=false}: as rotas dão 503, o {@code GET /eu} avisa o app, nada é avaliado no envio
 * (mesmo com regra ativa no banco), a lista e o detalhe trazem os pontos nulos e o {@code comAtencao} é ignorado.
 */
@AutoConfigureMockMvc
class RegrasDeAtencaoDesligadasIntegrationTest extends AbstractIntegrationTest {

    @DynamicPropertySource
    static void desligar(DynamicPropertyRegistry registro) {
        registro.add("treinos.regras-atencao.habilitado", () -> "false");
    }

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate banco;

    @Test
    void rotasDao503ENadaEAvaliado() throws Exception {
        ApiDeTeste api = new ApiDeTeste(mvc, json);
        JsonNode treinador = api.novoTreinador();
        assertThat(api.get("/eu", treinador, 200).path("regrasAtencaoHabilitada").asBoolean()).isFalse();
        for (JsonNode erro : new JsonNode[] {api.get("/regras-de-atencao", treinador, 503),
                api.put("/regras-de-atencao", treinador, Map.of("versao", 0, "regras", List.of()), 503),
                api.get("/alunos/" + UUID.randomUUID() + "/regras-de-atencao", treinador, 503),
                api.put("/alunos/" + UUID.randomUUID() + "/regras-de-atencao/" + UUID.randomUUID(), treinador, Map.of("ativa", false), 503),
                api.delete("/alunos/" + UUID.randomUUID() + "/regras-de-atencao/" + UUID.randomUUID(), treinador, 503)}) {
            assertThat(erro.path("codigo").asString()).isEqualTo("REGRAS_ATENCAO_INDISPONIVEIS");
        }

        UUID consultoria = banco.queryForObject("select consultoria_id from usuario where id = ?::uuid", UUID.class,
                treinador.path("usuario").path("id").asString());
        UUID questionario = UUID.randomUUID();
        UUID versao = UUID.randomUUID();
        banco.update("insert into questionario(id,consultoria_id,nome,rascunho,versao_publicada,publicado_em) values (?,?,?,?::jsonb,1,now())",
                questionario, consultoria, "Questionário fictício " + questionario, RegrasDeAtencaoIntegrationTest.CONTEUDO);
        banco.update("insert into questionario_versao(id,consultoria_id,questionario_id,numero,conteudo) values (?,?,?,1,?::jsonb)",
                versao, consultoria, questionario, RegrasDeAtencaoIntegrationTest.CONTEUDO);
        // Regra ativa gravada antes de a chave desligar: com ela desligada, não vale.
        banco.update("insert into regra_de_atencao(id,consultoria_id,tipo,pergunta_id,ativa) values (?,?,'SIM','dor',true)",
                UUID.randomUUID(), consultoria);

        UUID aluno = api.criarAluno(treinador, "Aluno Fictício Desligado");
        JsonNode login = api.convidarEEntrar(treinador, aluno);
        banco.update("update aluno set questionario_id = ? where id = ?", questionario, aluno);
        LocalDate fim = LocalDate.now(Fuso.BRASILIA);
        String pasta = api.post("/alunos/" + aluno + "/pastas", treinador,
                Map.of("titulo", "Período fictício", "inicio", fim.minusDays(27), "fim", fim), 200).path("id").asString();
        JsonNode criado = api.post("/alunos/" + aluno + "/planos-treino", treinador, Map.of("titulo", "Treino fictício", "pastaId", pasta), 200);
        String plano = criado.path("plano").path("id").asString();
        JsonNode salvo = api.put("/planos-treino/" + plano + "/rascunho", treinador,
                ApiDeTeste.rascunho("Treino fictício", ApiDeTeste.treino().conteudo(), criado.path("plano").path("versao").asLong()), 200);
        api.post("/planos-treino/" + plano + "/publicar", treinador,
                Map.of("versao", salvo.path("plano").path("versao").asLong(), "confirmarAvisos", true), 200);

        // O responsável (o treinador) tem token: mesmo assim, sem a chave, nada entra na fila do push.
        banco.update("insert into push_token (id, consultoria_id, usuario_id, token, plataforma) values (?, ?, ?::uuid, ?, 'ANDROID')",
                UUID.randomUUID(), consultoria, treinador.path("usuario").path("id").asString(),
                "ExponentPushToken[" + UUID.randomUUID().toString().replace("-", "") + "]");
        String id = api.post("/aluno/atualizacao/enviar", login, Map.of("pastaId", pasta, "questionarioVersaoId", versao.toString(),
                "respostas", Map.of("dor", true)), 200).path("id").asString();
        assertThat(banco.queryForObject("select count(*) from atualizacao_atencao where consultoria_id = ? and atualizacao_id = ?::uuid",
                Long.class, consultoria, id)).isZero();
        assertThat(banco.queryForObject("select count(*) from push_envio where consultoria_id = ? and tipo = 'ATUALIZACAO_ATENCAO'",
                Long.class, consultoria)).isZero();
        assertThat(api.get("/atualizacoes/" + id, treinador, 200).path("atencao").isNull()).isTrue();
        JsonNode lista = api.get("/atualizacoes?situacao=PARA_REVISAR&comAtencao=true", treinador, 200);
        assertThat(lista).hasSize(1);
        assertThat(lista.get(0).path("pontosDeAtencao").isNull()).isTrue();
        assertThat(api.get("/atualizacoes/contagens?comAtencao=true", treinador, 200).path("PARA_REVISAR").asLong()).isEqualTo(1);

        // LGPD com a chave desligada: o fato gravado antes (quando estava ligada) sai na exportação e "Excluir minha conta" o apaga.
        banco.update("insert into atualizacao_atencao(id,consultoria_id,atualizacao_id,tipo,pergunta_id) values (?,?,?::uuid,'SIM','dor')",
                UUID.randomUUID(), consultoria, id);
        JsonNode exportada = api.get("/alunos/" + aluno + "/exportacao", treinador, 200).path("atualizacoes").path("itens").get(0);
        assertThat(exportada.path("atencao")).hasSize(1);
        assertThat(exportada.path("atencao").get(0).path("tipo").asString()).isEqualTo("SIM");
        assertThat(exportada.path("atencao").get(0).path("perguntaId").asString()).isEqualTo("dor");
        api.post("/aluno/conta/excluir", login, Map.of("senha", ApiDeTeste.SENHA, "confirmacao", "EXCLUIR"), 204);
        assertThat(banco.queryForObject("select count(*) from atualizacao_atencao where consultoria_id = ? and atualizacao_id = ?::uuid",
                Long.class, consultoria, id)).isZero();
        assertThat(banco.queryForObject("select count(*) from atualizacao where id = ?::uuid", Long.class, id)).isEqualTo(1);
    }
}
