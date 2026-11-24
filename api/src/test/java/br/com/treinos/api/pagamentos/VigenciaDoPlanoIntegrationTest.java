package br.com.treinos.api.pagamentos;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.web.Fuso;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Vigência da contratação ({@code terminoVigencia}, {@code diasRestantesVigencia}, {@code alertaRenovacao}) e as
 * "renovações próximas" da Visão geral, que leem a mesma regra ({@link VigenciaDoPlano}): o término é o fim do ciclo em
 * curso (exclusivo, contado da âncora), plano mensal não tem alerta e a parcela única só alerta com o fim do ciclo (início
 * + 1 mês) dentro dos 40 dias. "Hoje" é o de Brasília, como no serviço; as datas
 * do teste saem dele. Uma consultoria por teste; dados fictícios.
 */
@AutoConfigureMockMvc
class VigenciaDoPlanoIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;

    private final LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
    private ApiDeTeste api;
    private JsonNode admin;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
    }

    private JsonNode contratar(UUID aluno, String periodicidade, long valor, LocalDate inicio) throws Exception {
        Map<String, Object> plano = new LinkedHashMap<>();
        plano.put("nome", "Plano " + UUID.randomUUID());
        plano.put("valorCentavos", valor);
        plano.put("periodicidade", periodicidade);
        JsonNode p = api.post("/financeiro/planos", admin, plano, 200);
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("planoComercialId", p.get("id").asString());
        corpo.put("inicio", inicio.toString());
        corpo.put("diaVencimento", hoje.getDayOfMonth());
        return api.post("/alunos/" + aluno + "/contratacoes", admin, corpo, 200);
    }

    private JsonNode contratar(String periodicidade, long valor, LocalDate inicio) throws Exception {
        return contratar(api.criarAluno(admin, "Aluno Fictício " + UUID.randomUUID()), periodicidade, valor, inicio);
    }

    private JsonNode daLista(UUID aluno) throws Exception {
        return api.get("/alunos/" + aluno + "/contratacoes", admin, 200).get(0);
    }

    private LocalDate ancoraDe(JsonNode contratacao) {
        return jdbc.queryForObject("select ancora from contratacao_aluno where id = ?::uuid", LocalDate.class,
                contratacao.get("id").asString());
    }

    private void confereVigencia(JsonNode c, LocalDate termino, String alerta) {
        long dias = ChronoUnit.DAYS.between(hoje, termino);
        assertThat(c.get("terminoVigencia").asString()).isEqualTo(termino.toString());
        assertThat(c.get("diasRestantesVigencia").asLong()).isEqualTo(dias);
        assertThat(dias).as("nunca vencida em plano recorrente").isPositive();
        if (alerta == null) {
            JsonNode a = c.get("alertaRenovacao");
            assertThat(a == null || a.isNull()).as("sem alerta de renovação").isTrue();
        } else {
            assertThat(c.get("alertaRenovacao").asString()).isEqualTo(alerta);
        }
    }

    private JsonNode cobrancasDe(UUID aluno) throws Exception {
        return api.get("/alunos/" + aluno + "/cobrancas", admin, 200);
    }

    @Test
    void mensalContratadoHaTresMesesTerminaNoFimDoCicloCorrenteSemAlerta() throws Exception {
        UUID aluno = api.criarAluno(admin, "Aluno Fictício " + UUID.randomUUID());
        LocalDate inicio = hoje.minusMonths(3);
        JsonNode c = contratar(aluno, "MENSAL", 10_000, inicio);

        // Âncora = início: o 4º ciclo, o que corre hoje, termina em início + 4 meses (nunca "vencida").
        confereVigencia(c, inicio.plusMonths(4), null);
        confereVigencia(daLista(aluno), inicio.plusMonths(4), null);
    }

    @Test
    void anualContratadoHaTrezeMesesTerminaNoFimDoSegundoAnoEmDia() throws Exception {
        UUID aluno = api.criarAluno(admin, "Aluno Fictício " + UUID.randomUUID());
        LocalDate inicio = hoje.minusMonths(13);
        JsonNode c = contratar(aluno, "ANUAL", 120_000, inicio);

        confereVigencia(c, inicio.plusMonths(24), "EM_DIA");
        confereVigencia(daLista(aluno), inicio.plusMonths(24), "EM_DIA");
    }

    @Test
    void anualACaminhoDoFimDoCicloAlertaNaJanelaDeQuarentaDias() throws Exception {
        LocalDate inicio = hoje.minusMonths(12).plusDays(20);
        JsonNode c = contratar("ANUAL", 120_000, inicio);

        confereVigencia(c, inicio.plusMonths(12), "PROXIMO_VENCIMENTO");
        assertThat(c.get("diasRestantesVigencia").asLong()).isBetween(19L, 21L);
    }

    @Test
    void trimestralPausadoEDepoisRetomadoSemPagamentoCoberturaRecomecaDeHoje() throws Exception {
        UUID aluno = api.criarAluno(admin, "Aluno Fictício " + UUID.randomUUID());
        LocalDate inicio = hoje.minusMonths(5);
        JsonNode c = contratar(aluno, "TRIMESTRAL", 30_000, inicio);
        // 5 meses: o 2º ciclo (início + 3 a início + 6 meses) corre hoje.
        confereVigencia(c, inicio.plusMonths(6), "PROXIMO_VENCIMENTO");
        // Sem cobrança que cubra período, a retomada recomeça a contar de hoje.
        for (JsonNode cobranca : cobrancasDe(aluno)) {
            api.post("/cobrancas/" + cobranca.get("id").asString() + "/cancelar", admin,
                    Map.of("motivo", "Motivo fictício", "versao", cobranca.get("versao").asLong()), 200);
        }

        JsonNode pausada = api.post("/contratacoes/" + c.get("id").asString() + "/pausar", admin,
                Map.of("versao", c.get("versao").asLong()), 200);
        // Pausada: a mesma regra, com a âncora de antes da pausa (o código não trata o estado à parte).
        assertThat(pausada.get("situacao").asString()).isEqualTo("PAUSADA");
        confereVigencia(pausada, inicio.plusMonths(6), "PROXIMO_VENCIMENTO");

        JsonNode retomada = api.post("/contratacoes/" + c.get("id").asString() + "/retomar", admin,
                Map.of("versao", pausada.get("versao").asLong()), 200);
        assertThat(retomada.get("situacao").asString()).isEqualTo("ATIVA");
        assertThat(ancoraDe(c)).isEqualTo(hoje);
        confereVigencia(retomada, hoje.plusMonths(3), "EM_DIA");
        confereVigencia(daLista(aluno), hoje.plusMonths(3), "EM_DIA");
    }

    @Test
    void anualRetomadoDentroDoPeriodoJaCobertoTerminaNaPropriaAncora() throws Exception {
        UUID aluno = api.criarAluno(admin, "Aluno Fictício " + UUID.randomUUID());
        JsonNode c = contratar(aluno, "ANUAL", 120_000, hoje);
        confereVigencia(c, hoje.plusMonths(12), "EM_DIA");

        JsonNode pausada = api.post("/contratacoes/" + c.get("id").asString() + "/pausar", admin,
                Map.of("versao", c.get("versao").asLong()), 200);
        JsonNode retomada = api.post("/contratacoes/" + c.get("id").asString() + "/retomar", admin,
                Map.of("versao", pausada.get("versao").asLong()), 200);

        // A cobrança aberta de hoje cobre o ano: a âncora vai para o fim dele, que é o fim do ciclo em curso.
        assertThat(ancoraDe(c)).isEqualTo(hoje.plusMonths(12));
        confereVigencia(retomada, hoje.plusMonths(12), "EM_DIA");
    }

    @Test
    void contratacaoComInicioFuturoTerminaUmPeriodoDepoisDoInicio() throws Exception {
        LocalDate inicio = hoje.plusDays(10);
        confereVigencia(contratar("TRIMESTRAL", 30_000, inicio), inicio.plusMonths(3), "EM_DIA");
    }

    @Test
    void parcelaUnicaComMaisDeUmMesDeVidaNaoAlertaNemEntraNasRenovacoes() throws Exception {
        UUID aluno = api.criarAluno(admin, "Aluno Fictício " + UUID.randomUUID());
        LocalDate inicio = hoje.minusMonths(3);
        JsonNode c = contratar(aluno, "PARCELA_UNICA", 50_000, inicio);

        // O único ciclo (início + 1 mês) já passou: continua informado, mas sem alerta.
        for (JsonNode v : new JsonNode[] {c, daLista(aluno)}) {
            assertThat(v.get("terminoVigencia").asString()).isEqualTo(inicio.plusMonths(1).toString());
            assertThat(v.get("diasRestantesVigencia").asLong()).isNegative();
            JsonNode alerta = v.get("alertaRenovacao");
            assertThat(alerta == null || alerta.isNull()).as("sem alerta").isTrue();
        }
        JsonNode r = api.get("/financeiro/visao-geral", admin, 200);
        assertThat(r.get("renovacoesProximasCount").asInt()).isZero();
        assertThat(r.get("renovacoesProximasCentavos").asLong()).isZero();
        // Terminou há mais de 30 dias: também fora de "Encerraram sem renovar".
        assertThat(r.get("encerraramSemRenovarCount").asInt()).isZero();
        assertThat(r.get("encerraramSemRenovar")).isEmpty();
    }

    @Test
    void parcelaUnicaComFimDoCicloDentroDeQuarentaDiasAlertaEEntraNasRenovacoes() throws Exception {
        LocalDate inicio = hoje.minusDays(10);
        JsonNode c = contratar("PARCELA_UNICA", 60_000, inicio);

        assertThat(c.get("terminoVigencia").asString()).isEqualTo(inicio.plusMonths(1).toString());
        assertThat(c.get("diasRestantesVigencia").asLong()).isBetween(0L, 40L);
        assertThat(c.get("alertaRenovacao").asString()).isEqualTo("PROXIMO_VENCIMENTO");
        JsonNode r = api.get("/financeiro/visao-geral", admin, 200);
        assertThat(r.get("renovacoesProximasCount").asInt()).isEqualTo(1);
        assertThat(r.get("renovacoesProximasCentavos").asLong()).isEqualTo(60_000);
    }

    @Test
    void parcelaUnicaQueEncerrouHaDezDiasEntraNoGrupoEncerraramSemRenovar() throws Exception {
        UUID aluno = api.criarAluno(admin, "Aluno Fictício Encerrado");
        LocalDate inicio = hoje.minusDays(40);
        contratar(aluno, "PARCELA_UNICA", 70_000, inicio);
        LocalDate termino = inicio.plusMonths(1);
        long dias = ChronoUnit.DAYS.between(termino, hoje);
        assertThat(dias).as("o término ficou 8 a 12 dias para trás").isBetween(8L, 12L);

        JsonNode r = api.get("/financeiro/visao-geral", admin, 200);
        // Os dois grupos não se misturam: não é renovação próxima, e o contador do grupo é próprio.
        assertThat(r.get("renovacoesProximasCount").asInt()).isZero();
        assertThat(r.get("renovacoesProximasCentavos").asLong()).isZero();
        assertThat(r.get("encerraramSemRenovarCount").asInt()).isEqualTo(1);
        JsonNode item = r.get("encerraramSemRenovar").get(0);
        assertThat(item.get("alunoId").asString()).isEqualTo(aluno.toString());
        assertThat(item.get("alunoNome").asString()).isEqualTo("Aluno Fictício Encerrado");
        assertThat(item.get("terminoVigencia").asString()).isEqualTo(termino.toString());
        assertThat(item.get("valorCentavos").asLong()).isEqualTo(70_000);
        // A ficha da contratação segue sem alerta (nada de VENCIDO): "Encerrado em" é do app, pela data.
        JsonNode alerta = daLista(aluno).get("alertaRenovacao");
        assertThat(alerta == null || alerta.isNull()).isTrue();
    }

    @Test
    void parcelaUnicaQueEncerrouHaQuarentaDiasNaoEntraNoGrupo() throws Exception {
        contratar("PARCELA_UNICA", 70_000, hoje.minusDays(70));

        JsonNode r = api.get("/financeiro/visao-geral", admin, 200);
        assertThat(r.get("encerraramSemRenovarCount").asInt()).isZero();
        assertThat(r.get("encerraramSemRenovar")).isEmpty();
        assertThat(r.get("renovacoesProximasCount").asInt()).isZero();
    }

    @Test
    void parcelaUnicaEncerradaAMaoNaoEntraNoGrupoEOGrupoNaoMisturaComAsRenovacoes() throws Exception {
        JsonNode encerrada = contratar("PARCELA_UNICA", 70_000, hoje.minusDays(40));
        api.post("/contratacoes/" + encerrada.get("id").asString() + "/encerrar", admin,
                Map.of("versao", encerrada.get("versao").asLong()), 200);
        contratar("PARCELA_UNICA", 30_000, hoje.minusDays(5));   // dentro do ciclo: renovação próxima
        contratar("ANUAL", 120_000, hoje.minusMonths(12).plusDays(20)); // renovação próxima
        UUID ativa = api.criarAluno(admin, "Aluno Fictício Sem Renovar");
        contratar(ativa, "PARCELA_UNICA", 40_000, hoje.minusDays(45)); // ATIVA que passou do término

        JsonNode r = api.get("/financeiro/visao-geral", admin, 200);
        assertThat(r.get("renovacoesProximasCount").asInt()).isEqualTo(2);
        assertThat(r.get("renovacoesProximasCentavos").asLong()).isEqualTo(30_000 + 120_000);
        assertThat(r.get("encerraramSemRenovarCount").asInt()).isEqualTo(1);
        assertThat(r.get("encerraramSemRenovar").get(0).get("alunoId").asString()).isEqualTo(ativa.toString());
    }

    @Test
    void visaoGeralContaSoRenovacaoDePlanoMaiorQueUmMes() throws Exception {
        contratar("MENSAL", 10_000, hoje.minusMonths(3));            // mensal: nunca entra
        contratar("MENSAL", 11_000, hoje);                           // mensal: nunca entra
        contratar("TRIMESTRAL", 30_000, hoje.minusMonths(2));        // fecha o ciclo em ~1 mês: entra
        contratar("ANUAL", 120_000, hoje.minusMonths(13));           // fecha o ciclo em ~11 meses: não
        contratar("ANUAL", 130_000, hoje.minusMonths(12).plusDays(20)); // fecha em 20 dias: entra
        contratar("TRIMESTRAL", 31_000, hoje);                       // fecha em 3 meses: não

        JsonNode r = api.get("/financeiro/visao-geral", admin, 200);
        assertThat(r.get("renovacoesProximasCount").asInt()).isEqualTo(2);
        assertThat(r.get("renovacoesProximasCentavos").asLong()).isEqualTo(30_000 + 130_000);
        assertThat(r.get("projecaoAnualCentavos").asLong())
                .isEqualTo(12 * 10_000 + 12 * 11_000 + 4 * 30_000 + 120_000 + 130_000 + 4 * 31_000);
    }
}
