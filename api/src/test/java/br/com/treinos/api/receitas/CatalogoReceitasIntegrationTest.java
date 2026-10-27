package br.com.treinos.api.receitas;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.consultoria.ConfiguracaoConsultoria;
import br.com.treinos.api.treino.ConteudoTreino;
import br.com.treinos.api.treino.ConteudoTreino.ExercicioPlano;
import br.com.treinos.api.treino.ConteudoTreino.Serie;
import br.com.treinos.api.treino.ConteudoTreino.Sessao;
import db.migration.V026__receitas_do_catalogo;
import db.migration.V034__receitas_de_exemplo;
import org.flywaydb.core.api.configuration.Configuration;
import org.flywaydb.core.api.migration.Context;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import javax.sql.DataSource;
import java.sql.Connection;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * A V026 cria as seis receitas do catálogo e a V034 as duas de exemplo; nenhuma duplica nome que já existe, e cada uma
 * publica sem erro.
 */
@AutoConfigureMockMvc
class CatalogoReceitasIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private DataSource dataSource;

    @Test
    void criaOndeFaltaENaoDuplicaNomeExistente() throws Exception {
        var api = new ApiDeTeste(mvc, json);
        var treinador = api.novoTreinador();
        UUID consultoria = consultoriaDe(treinador);
        jdbc.update("delete from receita where consultoria_id = ? and tipo = 'SERIES' and nome in (?, ?, ?, ?, ?, ?)",
                consulta(consultoria));
        assertThat(quantas(consultoria)).isZero();
        rodarV026();
        assertThat(quantas(consultoria)).isEqualTo(6);

        jdbc.update("delete from receita where consultoria_id = ? and tipo = 'SERIES' and nome = ?", consultoria, "Pirâmide crescente");
        jdbc.update("insert into receita (id, consultoria_id, tipo, nome, descricao, conteudo, ordem) values (?, ?, 'SERIES', ?, ?, cast(? as jsonb), ?)",
                UUID.randomUUID(), consultoria, "Pirâmide crescente", "Personalizada.", "{\"series\":[]}", 50);
        rodarV026();
        assertThat(quantasDoNome(consultoria, "Pirâmide crescente")).isEqualTo(1);
        assertThat(jdbc.queryForObject("select descricao from receita where consultoria_id = ? and tipo = 'SERIES' and nome = ?",
                String.class, consultoria, "Pirâmide crescente")).isEqualTo("Personalizada.");
        assertThat(quantas(consultoria)).isEqualTo(6);
    }

    @Test
    void cadaReceitaDoCatalogoPublicaSemErro() throws Exception {
        var api = new ApiDeTeste(mvc, json);
        var treinador = api.novoTreinador();
        UUID aluno = api.criarAluno(treinador, "Aluno fictício");
        for (ReceitasPadrao.Padrao receita : ReceitasPadrao.doCatalogo()) {
            ReceitaSeries series = (ReceitaSeries) receita.conteudo();
            String tecnica = series.series().getFirst().tecnica().tipo();
            ConteudoTreino conteudo = planoCom(series.series(), tecnica);
            JsonNode plano = api.post("/alunos/" + aluno + "/planos-treino", treinador, Map.of("titulo", "Plano de teste"), 200);
            String id = plano.path("plano").path("id").asString();
            var salvo = api.put("/planos-treino/" + id + "/rascunho", treinador,
                    ApiDeTeste.rascunho("Plano de teste", conteudo, plano.path("plano").path("versao").asLong()), 200);
            api.post("/planos-treino/" + id + "/publicar", treinador,
                    Map.of("versao", salvo.path("plano").path("versao").asLong(), "confirmarAvisos", false), 200);
        }
    }

    @Test
    void v034CriaOsExemplosOndeFaltaENaoDuplicaNemMexeNoDoTreinador() throws Exception {
        var api = new ApiDeTeste(mvc, json);
        var treinador = api.novoTreinador();
        UUID consultoria = consultoriaDe(treinador);
        assertThat(exemplosDe(consultoria)).isEqualTo(2);
        jdbc.update("delete from receita where consultoria_id = ? and tipo = 'SERIES' and nome in (?, ?)",
                consultoria, ReceitasPadrao.NOMES_DOS_EXEMPLOS.get(0), ReceitasPadrao.NOMES_DOS_EXEMPLOS.get(1));
        jdbc.update("insert into receita (id, consultoria_id, tipo, nome, descricao, conteudo, ordem) values (?, ?, 'SERIES', ?, ?, cast(? as jsonb), ?)",
                UUID.randomUUID(), consultoria, "Receita do treinador", "Minha.", "{\"series\":[]}", 500);
        assertThat(exemplosDe(consultoria)).isZero();
        long antes = jdbc.queryForObject("select count(*) from receita where consultoria_id = ?", Long.class, consultoria);

        rodarV034();
        assertThat(exemplosDe(consultoria)).isEqualTo(2);
        assertThat(jdbc.queryForObject("select count(*) from receita where consultoria_id = ?", Long.class, consultoria))
                .isEqualTo(antes + 2);
        assertThat(jdbc.queryForList("select ordem from receita where consultoria_id = ? and tipo = 'SERIES' and nome in (?, ?) order by ordem",
                Integer.class, consultoria, ReceitasPadrao.NOMES_DOS_EXEMPLOS.get(0), ReceitasPadrao.NOMES_DOS_EXEMPLOS.get(1)))
                .containsExactly(501, 502);
        assertThat(jdbc.queryForObject("select descricao from receita where consultoria_id = ? and nome = 'Receita do treinador'",
                String.class, consultoria)).isEqualTo("Minha.");

        // Nome que o treinador já tem (inclusive personalizado) não é duplicado nem alterado.
        jdbc.update("update receita set descricao = 'Personalizada.' where consultoria_id = ? and tipo = 'SERIES' and nome = ?",
                consultoria, ReceitasPadrao.NOMES_DOS_EXEMPLOS.get(1));
        rodarV034();
        assertThat(exemplosDe(consultoria)).isEqualTo(2);
        assertThat(jdbc.queryForObject("select descricao from receita where consultoria_id = ? and tipo = 'SERIES' and nome = ?",
                String.class, consultoria, ReceitasPadrao.NOMES_DOS_EXEMPLOS.get(1))).isEqualTo("Personalizada.");
    }

    @Test
    void cadaExemploPublicaSemErro() throws Exception {
        var api = new ApiDeTeste(mvc, json);
        var treinador = api.novoTreinador();
        UUID aluno = api.criarAluno(treinador, "Aluno fictício");
        for (ReceitasPadrao.Padrao receita : ReceitasPadrao.exemplos()) {
            ReceitaSeries series = (ReceitaSeries) receita.conteudo();
            ConteudoTreino conteudo = planoCom(series.series(), ConteudoTreino.CLUSTER);
            JsonNode plano = api.post("/alunos/" + aluno + "/planos-treino", treinador, Map.of("titulo", "Plano de teste"), 200);
            String id = plano.path("plano").path("id").asString();
            var salvo = api.put("/planos-treino/" + id + "/rascunho", treinador,
                    ApiDeTeste.rascunho("Plano de teste", conteudo, plano.path("plano").path("versao").asLong()), 200);
            api.post("/planos-treino/" + id + "/publicar", treinador,
                    Map.of("versao", salvo.path("plano").path("versao").asLong(), "confirmarAvisos", false), 200);
        }
    }

    private long exemplosDe(UUID consultoria) {
        return jdbc.queryForObject("select count(*) from receita where consultoria_id = ? and tipo = 'SERIES' and nome in (?, ?)",
                Long.class, consultoria, ReceitasPadrao.NOMES_DOS_EXEMPLOS.get(0), ReceitasPadrao.NOMES_DOS_EXEMPLOS.get(1));
    }

    private void rodarV034() throws Exception {
        try (Connection conexao = dataSource.getConnection()) {
            new V034__receitas_de_exemplo().migrate(new Context() {
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

    private static List<String> nomes() {
        return ReceitasPadrao.NOMES_DO_CATALOGO;
    }

    private UUID consultoriaDe(JsonNode treinador) {
        return jdbc.queryForObject("select consultoria_id from usuario where id = ?", UUID.class,
                UUID.fromString(treinador.path("usuario").path("id").asString()));
    }

    private long quantas(UUID consultoria) {
        return jdbc.queryForObject("select count(*) from receita where consultoria_id = ? and tipo = 'SERIES' and nome in (?, ?, ?, ?, ?, ?)",
                Long.class, consulta(consultoria));
    }

    private long quantasDoNome(UUID consultoria, String nome) {
        return jdbc.queryForObject("select count(*) from receita where consultoria_id = ? and tipo = 'SERIES' and nome = ?",
                Long.class, consultoria, nome);
    }

    private Object[] consulta(UUID consultoria) {
        List<Object> args = new ArrayList<>();
        args.add(consultoria);
        args.addAll(nomes());
        return args.toArray();
    }

    private ConteudoTreino planoCom(List<Serie> series, String tecnica) {
        ConfiguracaoConsultoria base = ConfiguracaoConsultoria.padrao();
        List<ConfiguracaoConsultoria.TecnicaDaMetodologia> tecnicas = new ArrayList<>(base.tecnicas());
        if (tecnicas.stream().noneMatch(t -> t.tipo().equals(tecnica))) {
            tecnicas.add(new ConfiguracaoConsultoria.TecnicaDaMetodologia(tecnica, tecnica, "Explicação fictícia.", null));
        }
        ConfiguracaoConsultoria config = new ConfiguracaoConsultoria(base.tipos(), tecnicas, base.combinacoes(),
                base.arredondamentoKg(), "", "");
        List<Serie> comUid = new ArrayList<>();
        for (Serie s : series) {
            comUid.add(s.uid() == null ? s.comUid(UUID.randomUUID()) : s);
        }
        ExercicioPlano exercicio = new ExercicioPlano(UUID.randomUUID(), null, "Supino fictício", "LIVRE", null, null, true, "kg", comUid);
        List<Sessao> sessoes = List.of(
                new Sessao(UUID.randomUUID(), "Treino A", 1, "TREINO", null, null, null, List.of(exercicio)),
                new Sessao(UUID.randomUUID(), "Descanso", 7, "DESCANSO", null, null, null, List.of()));
        return new ConteudoTreino(null, null, sessoes)
                .comMetodologia(new ConteudoTreino.Metodologia(null, "Metodologia fictícia", config));
    }

    private void rodarV026() throws Exception {
        try (Connection conexao = dataSource.getConnection()) {
            new V026__receitas_do_catalogo().migrate(new Context() {
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
}
