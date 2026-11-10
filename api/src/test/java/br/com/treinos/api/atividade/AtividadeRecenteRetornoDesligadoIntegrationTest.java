package br.com.treinos.api.atividade;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Com {@code TREINOS_RETORNO_HABILITADO=false} (o padrão de produção) a rota da atividade recente continua respondendo, mas o
 * treino concluído fica de fora: o app esconde o "concluir treino" e o feed não pode mostrar o que a tela não mostra.
 * Classe própria porque a chave só se desliga na subida do contexto (a suíte a liga).
 */
@AutoConfigureMockMvc
class AtividadeRecenteRetornoDesligadoIntegrationTest extends AbstractIntegrationTest {
    @DynamicPropertySource
    static void desligarORetorno(DynamicPropertyRegistry registry) {
        registry.add("treinos.retorno.habilitado", () -> "false");
    }

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate banco;

    @Test
    void retornoDesligadoEscondeOTreinoConcluidoEMantemOResto() throws Exception {
        ApiDeTeste api = new ApiDeTeste(mvc, json);
        JsonNode admin = api.novoTreinador();
        UUID aluno = api.criarAluno(admin, "Aluno Fictício Retorno " + UUID.randomUUID());
        UUID consultoria = banco.queryForObject("select consultoria_id from aluno where id=?", UUID.class, aluno);
        UUID usuario = UUID.fromString(admin.path("usuario").path("id").asString());
        Timestamp agora = Timestamp.from(Instant.now());
        UUID plano = UUID.randomUUID(), versao = UUID.randomUUID();
        banco.update("insert into plano_treino(id,consultoria_id,aluno_id,titulo,rascunho,publicado_em,versao_publicada) "
                + "values (?,?,?,'Título fictício','{}'::jsonb,?,1)", plano, consultoria, aluno, agora);
        banco.update("insert into plano_treino_versao(id,consultoria_id,plano_id,numero,titulo,conteudo,publicado_em,publicado_por) "
                + "values (?,?,?,1,'Título fictício','{}'::jsonb,?,?)", versao, consultoria, plano, agora, usuario);
        banco.update("insert into sessao_concluida(id,consultoria_id,aluno_id,plano_versao_id,sessao_uid,data,concluida,resultado,"
                + "alterado_no_aparelho_em) values (?,?,?,?,?,?,true,'COMPLETA',?)",
                UUID.randomUUID(), consultoria, aluno, versao, UUID.randomUUID(), LocalDate.of(2026, 6, 1), agora);

        JsonNode itens = api.get("/alunos/" + aluno + "/atividade-recente", admin, 200).path("itens");
        assertThat(itens.valueStream().map(i -> i.path("tipo").asString()).toList()).containsExactly("PLANO_PUBLICADO");
    }
}
