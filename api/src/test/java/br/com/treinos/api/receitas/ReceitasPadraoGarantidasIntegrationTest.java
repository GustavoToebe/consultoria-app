package br.com.treinos.api.receitas;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.consultoria.ConfiguracaoConsultoria;
import br.com.treinos.api.tenant.TenantContext;
import db.migration.V024__contrato_de_series_e_tecnicas;
import org.flywaydb.core.api.configuration.Configuration;
import org.flywaydb.core.api.migration.Context;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.json.JsonMapper;

import javax.sql.DataSource;

import java.sql.Connection;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/** {@code garantirPadrao}: sem duplicar com chamadas juntas e sem recriar o que o treinador apagou ao convidar a equipe. */
@AutoConfigureMockMvc
class ReceitasPadraoGarantidasIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private ReceitaService receitas;
    @Autowired private DataSource dataSource;

    private long receitasDe(UUID consultoria) {
        return jdbc.queryForObject("select count(*) from receita where consultoria_id = ?", Long.class, consultoria);
    }

    @Test
    void chamadasJuntasCriamCadaReceitaUmaVezSo() throws Exception {
        var api = new ApiDeTeste(mvc, json);
        var treinador = api.novoTreinador();
        UUID consultoria = jdbc.queryForObject("select consultoria_id from usuario where id = ?", UUID.class,
                UUID.fromString(treinador.path("usuario").path("id").asString()));
        jdbc.update("delete from receita where consultoria_id = ?", consultoria);
        var inicio = new CountDownLatch(1);
        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            var primeira = executor.submit(() -> garantir(inicio, consultoria));
            var segunda = executor.submit(() -> garantir(inicio, consultoria));
            inicio.countDown();
            primeira.get(30, TimeUnit.SECONDS);
            segunda.get(30, TimeUnit.SECONDS);
        }
        assertThat(receitasDe(consultoria)).isEqualTo((long) ReceitasPadrao.todas().size());
        assertThat(jdbc.queryForObject("select count(*) from receita where consultoria_id = ? and tipo = 'METODOLOGIA'",
                Long.class, consultoria)).isEqualTo(1L);
    }

    private Object garantir(CountDownLatch inicio, UUID consultoria) throws InterruptedException {
        inicio.await();
        return TenantContext.executarComo(consultoria, () -> {
            receitas.garantirPadrao();
            return null;
        });
    }

    /**
     * A V024 apaga o formato antigo (planos, versões e os modelos de treino, inclusive o que o treinador criou) e recria as
     * receitas padrão com a regra do {@code garantirPadrao}: só o que falta, e sem duplicar ao repetir. A dieta fica.
     */
    @Test
    void migrationV024ApagaOFormatoAntigoERecriaAsReceitasDeTreinoSemDuplicar() throws Exception {
        var api = new ApiDeTeste(mvc, json);
        var treinador = api.novoTreinador();
        UUID consultoria = jdbc.queryForObject("select consultoria_id from usuario where id = ?", UUID.class,
                UUID.fromString(treinador.path("usuario").path("id").asString()));
        UUID aluno = api.criarAluno(treinador, "Aluno fictício");
        api.publicarTreino(treinador, aluno, ApiDeTeste.treino().conteudo());
        api.post("/receitas", treinador, Map.of("tipo", "SERIES", "nome", "Série do treinador", "conteudo", Map.of("series",
                java.util.List.of(Map.of("tipo", "WORKING", "repsMin", 3, "repsMax", 6,
                        "carga", Map.of("modo", "CARGA_TRABALHO"))))), 200);
        assertThat(jdbc.queryForObject("select count(*) from plano_treino where consultoria_id = ?", Long.class, consultoria))
                .isPositive();
        jdbc.update("delete from receita where consultoria_id = ? and tipo = 'METODOLOGIA'", consultoria);
        long dieta = jdbc.queryForObject("select count(*) from receita where consultoria_id = ? and tipo in "
                + "('PLANO_DIETA', 'REFEICAO')", Long.class, consultoria);
        assertThat(dieta).isPositive();

        rodarV024();
        assertThat(jdbc.queryForObject("select count(*) from plano_treino where consultoria_id = ?", Long.class, consultoria))
                .isZero();
        assertThat(jdbc.queryForObject("select count(*) from plano_treino_versao where consultoria_id = ?", Long.class,
                consultoria)).isZero();
        assertThat(jdbc.queryForObject("select count(*) from receita where consultoria_id = ? and nome = 'Série do treinador'",
                Long.class, consultoria)).isZero();
        assertThat(receitasDe(consultoria)).isEqualTo((long) ReceitasPadrao.todas().size());
        assertThat(jdbc.queryForObject("select count(*) from receita where consultoria_id = ? and tipo in "
                + "('PLANO_DIETA', 'REFEICAO')", Long.class, consultoria)).isEqualTo(dieta);
        rodarV024();
        assertThat(receitasDe(consultoria)).isEqualTo((long) ReceitasPadrao.todas().size());
        String metodologia = jdbc.queryForObject(
                "select conteudo from receita where consultoria_id = ? and tipo = 'METODOLOGIA'", String.class, consultoria);
        assertThat(json.readValue(metodologia, ConfiguracaoConsultoria.class)).isEqualTo(ConfiguracaoConsultoria.padrao());
        assertThat(jdbc.queryForObject("select count(*) from receita where consultoria_id = ? and ordem = 0", Long.class,
                consultoria)).isZero();
        // Nenhuma receita de séries do padrão usa o contrato antigo (tipo por nome, intensidade, tipo Cardio).
        assertThat(jdbc.queryForObject("select count(*) from receita where consultoria_id = ? and (conteudo::text like "
                + "'%intensidade%' or conteudo::text like '%\"Cardio\"%')", Long.class, consultoria)).isZero();
    }

    private void rodarV024() throws Exception {
        // A V024 apaga as versões de treino do formato antigo; a V035 (sessao_concluida) nasceu depois e aponta para elas, então
        // numa base já cheia as sessões concluídas (de outros testes que dividem o banco) saem antes, como a V024 faz com execucao_serie.
        jdbc.update("delete from sessao_concluida");
        try (Connection conexao = dataSource.getConnection()) {
            new V024__contrato_de_series_e_tecnicas().migrate(new Context() {
                @Override
                public Configuration getConfiguration() {
                    return null;
                }

                @Override
                public Connection getConnection() {
                    return conexao;
                }
            });
        }
    }

    @Test
    void conviteDeEquipeComumNaoRecriaReceitaApagada() throws Exception {
        var api = new ApiDeTeste(mvc, json);
        var treinador = api.novoTreinador();
        UUID consultoria = jdbc.queryForObject("select consultoria_id from usuario where id = ?", UUID.class,
                UUID.fromString(treinador.path("usuario").path("id").asString()));
        jdbc.update("delete from receita where id = (select id from receita where consultoria_id = ? and tipo = 'PLANO_DIETA' limit 1)",
                consultoria);
        long antes = receitasDe(consultoria);
        assertThat(antes).isEqualTo(ReceitasPadrao.todas().size() - 1L);
        UUID perfil = UUID.fromString(api.get("/eu", treinador, 200).path("perfil").path("id").asString());
        var convite = api.post("/usuarios/convites", treinador, Map.of("nome", "Membro fictício",
                "email", ApiDeTeste.emailUnico("membro"), "perfilId", perfil), 200);
        api.post("/publico/convites-equipe/aceitar", null,
                Map.of("codigo", convite.path("codigo").asString(), "senha", ApiDeTeste.SENHA), 200);
        assertThat(receitasDe(consultoria)).isEqualTo(antes);
    }
}
