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
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * A mensalidade nasce todo mês, paga ou não (D1 do plano financeiro-em-fases), pela {@link RotinaDeGeracaoDeCobrancas} chamada
 * à mão com o "hoje" do teste: três meses sem pagar são três abertas, pausada, encerrada e parcela única não geram, repetir
 * não duplica, dia 31 em mês curto e em ano bissexto. Só dados fictícios; cada teste cria a própria consultoria.
 */
@AutoConfigureMockMvc
class GeracaoMensalIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private RotinaDeGeracaoDeCobrancas rotina;

    private ApiDeTeste api;
    private JsonNode admin;
    private UUID consultoria;
    private final LocalDate hoje = LocalDate.now(Fuso.BRASILIA);

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        consultoria = jdbc.queryForObject("select consultoria_id from usuario where id = ?::uuid", UUID.class,
                admin.get("usuario").get("id").asString());
    }

    private JsonNode plano(String periodicidade) throws Exception {
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("nome", "Plano da geração " + UUID.randomUUID());
        corpo.put("valorCentavos", 10_000);
        corpo.put("periodicidade", periodicidade);
        return api.post("/financeiro/planos", admin, corpo, 200);
    }

    private JsonNode contratar(UUID aluno, String periodicidade, LocalDate inicio, int dia) throws Exception {
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("planoComercialId", plano(periodicidade).get("id").asString());
        corpo.put("inicio", inicio.toString());
        corpo.put("diaVencimento", dia);
        corpo.put("gerarMesesAnteriores", true); // estes testes cobrem a geração desde o início (D10 está em ContratarNoPassadoIntegrationTest)
        return api.post("/alunos/" + aluno + "/contratacoes", admin, corpo, 200);
    }

    private UUID aluno() throws Exception {
        return api.criarAluno(admin, "Aluno Fictício " + UUID.randomUUID());
    }

    private JsonNode cobrancas(UUID aluno) throws Exception {
        return api.get("/alunos/" + aluno + "/cobrancas", admin, 200);
    }

    /** Competências em ordem crescente. */
    private List<String> competencias(UUID aluno) throws Exception {
        List<String> lista = new ArrayList<>();
        cobrancas(aluno).forEach(c -> lista.add(0, c.get("competencia").asString()));
        return lista;
    }

    private String vencimentoDe(UUID aluno, String competencia) throws Exception {
        for (JsonNode c : cobrancas(aluno)) {
            if (competencia.equals(c.get("competencia").asString())) {
                return c.get("vencimento").asString();
            }
        }
        throw new AssertionError("Sem cobrança na competência " + competencia);
    }

    private long abertas(UUID aluno) throws Exception {
        long n = 0;
        for (JsonNode c : cobrancas(aluno)) {
            if ("ABERTA".equals(c.get("situacao").asString())) {
                n++;
            }
        }
        return n;
    }

    private JsonNode acao(String caminho, JsonNode contratacao, int versao) throws Exception {
        return api.post("/contratacoes/" + contratacao.get("id").asString() + "/" + caminho, admin,
                Map.of("versao", versao), 200);
    }

    @Test
    void tresMesesSemPagarSaoTresAbertas() throws Exception {
        UUID aluno = aluno();
        contratar(aluno, "MENSAL", hoje, hoje.getDayOfMonth());
        assertThat(cobrancas(aluno)).hasSize(1);

        var r = rotina.rodarNa(consultoria, hoje.plusMonths(2));

        assertThat(r.cobrancas()).isEqualTo(2);
        assertThat(competencias(aluno)).containsExactly(hoje.toString(), hoje.plusMonths(1).toString(),
                hoje.plusMonths(2).toString());
        assertThat(abertas(aluno)).isEqualTo(3);
    }

    @Test
    void rodarDuasVezesNoMesmoDiaNaoDuplica() throws Exception {
        UUID aluno = aluno();
        contratar(aluno, "MENSAL", hoje, hoje.getDayOfMonth());

        assertThat(rotina.rodarNa(consultoria, hoje.plusMonths(2)).cobrancas()).isEqualTo(2);
        var segunda = rotina.rodarNa(consultoria, hoje.plusMonths(2));

        assertThat(segunda.cobrancas()).isZero();
        assertThat(segunda.falhas()).isZero();
        assertThat(cobrancas(aluno)).hasSize(3);
        // O dia seguinte só acrescenta a competência cujo vencimento já passou, nunca repete as de antes.
        assertThat(rotina.rodarNa(consultoria, hoje.plusMonths(2).plusDays(1)).cobrancas()).isEqualTo(1);
        assertThat(cobrancas(aluno)).hasSize(4);
        // A rodada inteira (todas as consultorias) com o dia de verdade não mexe no que já está em dia.
        assertThat(rotina.rodar(hoje).executou()).isTrue();
        assertThat(cobrancas(aluno)).hasSize(4);
        Integer duplicadas = jdbc.queryForObject("select count(*) - count(distinct competencia) from cobranca_aluno "
                + "where consultoria_id = ? and aluno_id = ?::uuid", Integer.class, consultoria, aluno.toString());
        assertThat(duplicadas).isZero();
    }

    @Test
    void pagarOuCancelarNaoGeraENaoImpedeAGeracao() throws Exception {
        UUID aluno = aluno();
        contratar(aluno, "MENSAL", hoje, hoje.getDayOfMonth());
        JsonNode primeira = cobrancas(aluno).get(0);

        api.post("/cobrancas/" + primeira.get("id").asString() + "/cancelar", admin,
                Map.of("versao", primeira.get("versao").asLong(), "motivo", "Pulou o mês"), 200);
        assertThat(cobrancas(aluno)).hasSize(1);

        // A cancelada continua ocupando a competência: a rotina segue para a próxima, sem olhar o que aconteceu antes.
        rotina.rodarNa(consultoria, hoje.plusMonths(1));
        assertThat(competencias(aluno)).containsExactly(hoje.toString(), hoje.plusMonths(1).toString());
        assertThat(abertas(aluno)).isEqualTo(1);
    }

    @Test
    void pausadaMantemAsAbertasENaoGeraERetomarVoltaAGerar() throws Exception {
        UUID aluno = aluno();
        JsonNode contratacao = contratar(aluno, "MENSAL", hoje, hoje.getDayOfMonth());
        rotina.rodarNa(consultoria, hoje.plusMonths(1));
        assertThat(cobrancas(aluno)).hasSize(2);

        JsonNode pausada = acao("pausar", contratacao, contratacao.get("versao").asInt());
        assertThat(rotina.rodarNa(consultoria, hoje.plusMonths(4)).cobrancas()).isZero();
        assertThat(cobrancas(aluno)).hasSize(2);
        assertThat(abertas(aluno)).as("pausar mantém as abertas").isEqualTo(2);

        // Retomar começa depois do período da última aberta (a competência de hoje + 1 mês cobre até o mês seguinte).
        acao("retomar", pausada, pausada.get("versao").asInt());
        assertThat(cobrancas(aluno)).as("retomar não gera dentro de período já coberto").hasSize(2);
        rotina.rodarNa(consultoria, hoje.plusMonths(4));
        List<String> depois = competencias(aluno);
        assertThat(depois).startsWith(hoje.toString(), hoje.plusMonths(1).toString(), hoje.plusMonths(2).toString());
        assertThat(depois).hasSizeGreaterThanOrEqualTo(4).doesNotHaveDuplicates();
    }

    @Test
    void encerradaEParcelaUnicaNaoGeram() throws Exception {
        UUID encerrado = aluno();
        JsonNode contratacao = contratar(encerrado, "MENSAL", hoje, hoje.getDayOfMonth());
        acao("encerrar", contratacao, contratacao.get("versao").asInt());
        UUID unico = aluno();
        contratar(unico, "PARCELA_UNICA", hoje, hoje.getDayOfMonth());

        rotina.rodarNa(consultoria, hoje.plusMonths(6));

        assertThat(cobrancas(encerrado)).hasSize(1);
        assertThat(cobrancas(unico)).hasSize(1);
    }

    @Test
    void outraConsultoriaNaoGeraNaMinha() throws Exception {
        UUID aluno = aluno();
        contratar(aluno, "MENSAL", hoje, hoje.getDayOfMonth());
        JsonNode outro = api.novoTreinador();
        UUID outraConsultoria = jdbc.queryForObject("select consultoria_id from usuario where id = ?::uuid", UUID.class,
                outro.get("usuario").get("id").asString());

        assertThat(rotina.rodarNa(outraConsultoria, hoje.plusMonths(3)).cobrancas()).isZero();
        assertThat(cobrancas(aluno)).hasSize(1);
    }

    @Test
    void diaTrintaEUmEmFevereiroVenceNoUltimoDiaEOPeriodoNaoTemBuraco() throws Exception {
        UUID aluno = aluno();
        // O próximo 31/01 (a API aceita início até um ano à frente); fevereiro tem 28 ou 29 dias, conforme o ano.
        LocalDate inicio = hoje.withMonth(1).withDayOfMonth(31);
        if (inicio.isBefore(hoje)) {
            inicio = inicio.plusYears(1);
        }
        contratar(aluno, "MENSAL", inicio, 31);
        assertThat(cobrancas(aluno)).hasSize(1);

        assertThat(rotina.rodarNa(consultoria, inicio.plusMonths(2)).cobrancas()).isEqualTo(2);

        String fevereiro = java.time.YearMonth.of(inicio.getYear(), 2).atEndOfMonth().toString();
        String marco = LocalDate.of(inicio.getYear(), 3, 31).toString();
        assertThat(competencias(aluno)).containsExactly(inicio.toString(), fevereiro, marco);
        assertThat(vencimentoDe(aluno, fevereiro)).isEqualTo(fevereiro);
        assertThat(vencimentoDe(aluno, marco)).isEqualTo(marco);
    }

    @Test
    void diaTrintaEUmEmAnoBissextoVenceEmVinteENove() throws Exception {
        UUID aluno = aluno();
        // 2024 é bissexto e está dentro dos últimos 10 anos: contratar já gera cada mês até hoje.
        contratar(aluno, "MENSAL", LocalDate.of(2024, 1, 31), 31);

        assertThat(competencias(aluno)).startsWith("2024-01-31", "2024-02-29", "2024-03-31", "2024-04-30", "2024-05-31");
        assertThat(vencimentoDe(aluno, "2024-02-29")).isEqualTo("2024-02-29");
        assertThat(vencimentoDe(aluno, "2024-04-30")).isEqualTo("2024-04-30");
        // Em 2025 (não bissexto) fevereiro volta a 28.
        assertThat(vencimentoDe(aluno, "2025-02-28")).isEqualTo("2025-02-28");
        assertThat(competencias(aluno)).doesNotHaveDuplicates();
        // Gerada até hoje: a última tem vencimento a partir de hoje e nada falta.
        JsonNode maisNova = cobrancas(aluno).get(0);
        assertThat(LocalDate.parse(maisNova.get("vencimento").asString())).isAfterOrEqualTo(hoje);
        assertThat(rotina.rodarNa(consultoria, hoje).cobrancas()).isZero();
    }
}
