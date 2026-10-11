package br.com.treinos.api.conta;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** GET /minha-conta e /minha-conta/consumo: permissão, isolamento por consultoria, prévia e contagem real. */
@AutoConfigureMockMvc
class ContaIntegrationTest extends AbstractIntegrationTest {
    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private SeedContaDemo seed;

    private UUID consultoria(JsonNode login) {
        return jdbc.queryForObject("select consultoria_id from usuario where id = ?::uuid", UUID.class,
                login.path("usuario").path("id").asString());
    }

    private void perfil(JsonNode login, String nome) {
        jdbc.update("update usuario u set perfil_id = p.id from perfil p where u.id = ?::uuid "
                + "and p.consultoria_id = u.consultoria_id and p.nome = ?", login.path("usuario").path("id").asString(), nome);
    }

    private static JsonNode item(JsonNode consumo, String codigo) {
        return consumo.path("itens").valueStream().filter(i -> codigo.equals(i.path("codigo").asString())).findFirst()
                .orElseThrow();
    }

    @Test
    void semDadosResponde404ComCodigo() throws Exception {
        var api = new ApiDeTeste(mvc, json);
        var login = api.novoTreinador();
        assertThat(api.get("/minha-conta", login, 404).path("codigo").asString()).isEqualTo("CONTA_NAO_ENCONTRADA");
    }

    @Test
    void administradorVeContaComPreviaECobrancasComVencida() throws Exception {
        var api = new ApiDeTeste(mvc, json);
        var login = api.novoTreinador();
        seed.semear(consultoria(login), "Consultoria Fictícia");

        JsonNode conta = api.get("/minha-conta", login, 200);
        assertThat(conta.path("previa").asBoolean()).isTrue();
        assertThat(conta.path("cliente").path("nome").asString()).isEqualTo("Consultoria Fictícia");
        assertThat(conta.path("contratacao").path("planoNome").asString()).isEqualTo("Profissional");
        assertThat(conta.path("cobrancas")).hasSize(6);
        long vencidas = conta.path("cobrancas").valueStream().filter(c -> c.path("vencida").asBoolean()).count();
        assertThat(vencidas).isEqualTo(1);
        // Mais recente primeiro.
        assertThat(conta.path("cobrancas").get(0).path("competenciaInicio").asString())
                .isGreaterThan(conta.path("cobrancas").get(5).path("competenciaInicio").asString());
    }

    @Test
    void semContaLerNegaAsDuasRotas() throws Exception {
        var api = new ApiDeTeste(mvc, json);
        var login = api.novoTreinador();
        seed.semear(consultoria(login), "Consultoria Fictícia");
        for (String nome : new String[] {"Treinador", "Nutricionista", "Assistente"}) {
            perfil(login, nome);
            assertThat(api.get("/minha-conta", login, 403).path("codigo").asString()).isEqualTo("PERMISSAO_NEGADA");
            api.get("/minha-conta/consumo", login, 403);
        }
        perfil(login, "Administrador");
        api.get("/minha-conta", login, 200);
    }

    @Test
    void outraConsultoriaNuncaVeDadosDeQuemNaoE() throws Exception {
        var api = new ApiDeTeste(mvc, json);
        var dona = api.novoTreinador();
        var outra = api.novoTreinador();
        seed.semear(consultoria(dona), "Consultoria da Dona");

        api.get("/minha-conta", outra, 404);
        assertThat(api.get("/minha-conta/consumo", outra, 200).path("planoNome").isNull()).isTrue();
        assertThat(api.get("/minha-conta", dona, 200).path("cliente").path("nome").asString())
                .isEqualTo("Consultoria da Dona");
    }

    @Test
    void consumoContaAlunosAtivosEMembrosReaisContraOsLimites() throws Exception {
        var api = new ApiDeTeste(mvc, json);
        var login = api.novoTreinador();
        UUID consultoria = consultoria(login);
        seed.semear(consultoria, "Consultoria Fictícia");
        api.criarAluno(login, "Aluno Fictício Um");
        api.criarAluno(login, "Aluno Fictício Dois");

        JsonNode consumo = api.get("/minha-conta/consumo", login, 200);
        assertThat(consumo.path("planoNome").asString()).isEqualTo("Profissional");
        JsonNode alunos = item(consumo, "alunos_ativos");
        assertThat(alunos.path("usado").asLong()).isEqualTo(2);
        assertThat(alunos.path("limite").asLong()).isEqualTo(150);
        assertThat(alunos.path("disponivel").asLong()).isEqualTo(148);
        assertThat(alunos.path("estado").asString()).isEqualTo("DISPONIVEL");
        JsonNode equipe = item(consumo, "membros_equipe");
        assertThat(equipe.path("usado").asLong()).isEqualTo(1);
        assertThat(equipe.path("limite").asLong()).isEqualTo(5);

        jdbc.update("update direitos_locais set limites = '{\"alunos_ativos\": 2}'::jsonb where consultoria_id = ?", consultoria);
        consumo = api.get("/minha-conta/consumo", login, 200);
        assertThat(item(consumo, "alunos_ativos").path("estado").asString()).isEqualTo("ATINGIDO");
        assertThat(item(consumo, "alunos_ativos").path("disponivel").asLong()).isZero();
        JsonNode semLimite = item(consumo, "membros_equipe");
        assertThat(semLimite.path("limite").isNull()).isTrue();
        assertThat(semLimite.path("disponivel").isNull()).isTrue();
        assertThat(semLimite.path("estado").asString()).isEqualTo("SEM_LIMITE_CONFIGURADO");
    }

    @Test
    void consumoSemDireitosMostraUsoSemLimite() throws Exception {
        var api = new ApiDeTeste(mvc, json);
        var login = api.novoTreinador();
        api.criarAluno(login, "Aluno Fictício");
        JsonNode consumo = api.get("/minha-conta/consumo", login, 200);
        JsonNode alunos = item(consumo, "alunos_ativos");
        assertThat(alunos.path("usado").asLong()).isEqualTo(1);
        assertThat(alunos.path("limite").isNull()).isTrue();
        assertThat(alunos.path("estado").asString()).isEqualTo("SEM_LIMITE_CONFIGURADO");
    }
}
