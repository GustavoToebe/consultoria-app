package br.com.treinos.api.pagamentos;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.web.Fuso;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * D10: contratar com início no passado. {@code gerarMesesAnteriores} desligado (ou ausente) grava o início como digitado e
 * começa a cobrar no mês corrente; ligado gera desde o início. A prévia
 * ({@code POST /contratacoes/previa-de-geracao}) diz quantas nascem em aberto e o total, sem gravar nada, e bate com o que
 * contratar de fato gera. As datas são relativas a "hoje" (Brasília), sem depender do dia em que o teste roda. Dados fictícios.
 */
@AutoConfigureMockMvc
class ContratarNoPassadoIntegrationTest extends AbstractIntegrationTest {

    private static final String PREVIA = "/contratacoes/previa-de-geracao";

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;

    private final LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
    private ApiDeTeste api;
    private JsonNode admin;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
    }

    private String plano(String periodicidade, Integer minimoMeses) throws Exception {
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("nome", "Plano do passado " + UUID.randomUUID());
        corpo.put("valorCentavos", 10_000);
        corpo.put("periodicidade", periodicidade);
        if (minimoMeses != null) {
            corpo.put("tempoMinimoMeses", minimoMeses);
        }
        return api.post("/financeiro/planos", admin, corpo, 200).get("id").asString();
    }

    private UUID aluno() throws Exception {
        return api.criarAluno(admin, "Aluno Fictício " + UUID.randomUUID());
    }

    /** Corpo do contratar; {@code anteriores} nulo = campo ausente. */
    private Map<String, Object> corpo(String plano, LocalDate inicio, Boolean anteriores, Boolean primeiroPago) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("planoComercialId", plano);
        m.put("inicio", inicio.toString());
        m.put("diaVencimento", hoje.getDayOfMonth());
        if (anteriores != null) {
            m.put("gerarMesesAnteriores", anteriores);
        }
        if (primeiroPago != null) {
            m.put("primeiroPeriodoPago", primeiroPago);
        }
        return m;
    }

    private JsonNode previa(UUID aluno, Map<String, Object> corpo) throws Exception {
        Map<String, Object> m = new LinkedHashMap<>(corpo);
        m.put("alunoId", aluno.toString());
        return api.post(PREVIA, admin, m, 200);
    }

    private JsonNode contratar(UUID aluno, Map<String, Object> corpo) throws Exception {
        return api.post("/alunos/" + aluno + "/contratacoes", admin, corpo, 200);
    }

    /** Competências geradas, em ordem crescente, como {@code AAAA-MM}. */
    private List<String> meses(UUID aluno) throws Exception {
        List<String> lista = new ArrayList<>();
        api.get("/alunos/" + aluno + "/cobrancas", admin, 200)
                .forEach(c -> lista.add(0, YearMonth.from(LocalDate.parse(c.get("competencia").asString())).toString()));
        return lista;
    }

    private long abertas(UUID aluno) throws Exception {
        long n = 0;
        for (JsonNode c : api.get("/alunos/" + aluno + "/cobrancas", admin, 200)) {
            if ("ABERTA".equals(c.get("situacao").asString())) {
                n++;
            }
        }
        return n;
    }

    @Test
    void desligadoGravaOInicioComoDigitadoECobraSoOMesCorrente() throws Exception {
        UUID aluno = aluno();
        LocalDate inicio = hoje.minusMonths(3);

        JsonNode contratacao = contratar(aluno, corpo(plano("MENSAL", 6), inicio, false, null));

        assertThat(contratacao.get("inicio").asString()).isEqualTo(inicio.toString());
        assertThat(contratacao.get("minimoAte").asString()).as("o mínimo conta do início digitado")
                .isEqualTo(inicio.plusMonths(6).toString());
        assertThat(meses(aluno)).containsExactly(YearMonth.from(hoje).toString());
        assertThat(api.get("/alunos/" + aluno + "/cobrancas", admin, 200).get(0).get("vencimento").asString())
                .isEqualTo(hoje.toString());
    }

    @Test
    void campoAusenteValeFalso() throws Exception {
        UUID aluno = aluno();

        contratar(aluno, corpo(plano("MENSAL", null), hoje.minusMonths(3), null, null));

        assertThat(meses(aluno)).containsExactly(YearMonth.from(hoje).toString());
    }

    @Test
    void ligadoGeraDesdeOInicioAteOPrimeiroVencimentoDeHojeEmDiante() throws Exception {
        UUID aluno = aluno();
        LocalDate inicio = hoje.minusMonths(3);

        contratar(aluno, corpo(plano("MENSAL", null), inicio, true, null));

        assertThat(meses(aluno)).containsExactly(YearMonth.from(inicio).toString(), YearMonth.from(inicio.plusMonths(1)).toString(),
                YearMonth.from(inicio.plusMonths(2)).toString(), YearMonth.from(hoje).toString());
        assertThat(abertas(aluno)).isEqualTo(4);
    }

    @Test
    void inicioNoMesCorrenteOuNoFuturoNaoMudaComOInterruptor() throws Exception {
        for (boolean ligado : new boolean[] {false, true}) {
            UUID noMes = aluno();
            contratar(noMes, corpo(plano("MENSAL", null), hoje, ligado, null));
            assertThat(meses(noMes)).as("início hoje, ligado=" + ligado).containsExactly(YearMonth.from(hoje).toString());

            UUID futuro = aluno();
            contratar(futuro, corpo(plano("MENSAL", null), hoje.plusMonths(2), ligado, null));
            assertThat(meses(futuro)).as("início futuro, ligado=" + ligado)
                    .containsExactly(YearMonth.from(hoje.plusMonths(2)).toString());
        }
    }

    @Test
    void planoTrimestralComecaNoPeriodoQueCobreOMesCorrenteSemSairDaGrade() throws Exception {
        UUID aluno = aluno();
        LocalDate inicio = hoje.minusMonths(7);

        contratar(aluno, corpo(plano("TRIMESTRAL", null), inicio, false, null));

        // Grade do início: -7, -4, -1, +2 meses. O período que cobre o mês corrente começou em -1; ele já venceu, então segue o +2.
        assertThat(meses(aluno)).containsExactly(YearMonth.from(hoje.minusMonths(1)).toString(),
                YearMonth.from(hoje.plusMonths(2)).toString());
    }

    @Test
    void previaDesligadaMostraSoOMesCorrenteELigadaTodosOsMesesComTotalDoServidor() throws Exception {
        UUID aluno = aluno();
        String plano = plano("MENSAL", null);
        LocalDate inicio = hoje.minusMonths(3);

        JsonNode desligada = previa(aluno, corpo(plano, inicio, false, null));
        assertThat(desligada.get("quantidade").asInt()).isEqualTo(1);
        assertThat(desligada.get("totalCentavos").asLong()).isEqualTo(10_000);
        assertThat(desligada.get("primeiraCompetencia").asString()).isEqualTo(YearMonth.from(hoje).toString());
        assertThat(desligada.get("ultimaCompetencia").asString()).isEqualTo(YearMonth.from(hoje).toString());

        JsonNode ligada = previa(aluno, corpo(plano, inicio, true, null));
        assertThat(ligada.propertyNames()).containsExactlyInAnyOrder("quantidade", "totalCentavos", "primeiraCompetencia",
                "ultimaCompetencia");
        assertThat(ligada.get("quantidade").asInt()).isEqualTo(4);
        assertThat(ligada.get("totalCentavos").asLong()).isEqualTo(40_000);
        assertThat(ligada.get("primeiraCompetencia").asString()).isEqualTo(YearMonth.from(inicio).toString());
        assertThat(ligada.get("ultimaCompetencia").asString()).isEqualTo(YearMonth.from(hoje).toString());

        // Só leitura: nada foi criado.
        assertThat(api.get("/alunos/" + aluno + "/cobrancas", admin, 200)).isEmpty();
        assertThat(api.get("/alunos/" + aluno + "/contratacoes", admin, 200)).isEmpty();
    }

    @Test
    void previaUsaOValorDigitadoEBateComOQueContratarGera() throws Exception {
        UUID aluno = aluno();
        String plano = plano("MENSAL", null);
        Map<String, Object> corpo = corpo(plano, hoje.minusMonths(3), true, null);
        corpo.put("valorCentavos", 12_345);
        corpo.put("motivoValor", "Desconto fictício");

        JsonNode previa = previa(aluno, corpo);
        contratar(aluno, corpo);

        List<String> geradas = meses(aluno);
        assertThat(previa.get("quantidade").asInt()).isEqualTo(geradas.size()).isEqualTo(abertas(aluno));
        assertThat(previa.get("totalCentavos").asLong()).isEqualTo(12_345L * geradas.size());
        assertThat(previa.get("primeiraCompetencia").asString()).isEqualTo(geradas.get(0));
        assertThat(previa.get("ultimaCompetencia").asString()).isEqualTo(geradas.get(geradas.size() - 1));
    }

    @Test
    void previaDoTrimestralBateComOContratar() throws Exception {
        UUID aluno = aluno();
        Map<String, Object> corpo = corpo(plano("TRIMESTRAL", null), hoje.minusMonths(7), false, null);

        JsonNode previa = previa(aluno, corpo);
        contratar(aluno, corpo);

        List<String> geradas = meses(aluno);
        assertThat(previa.get("quantidade").asInt()).isEqualTo(geradas.size()).isEqualTo(2);
        assertThat(previa.get("primeiraCompetencia").asString()).isEqualTo(geradas.get(0));
        assertThat(previa.get("ultimaCompetencia").asString()).isEqualTo(geradas.get(1));
    }

    @Test
    void primeiroPeriodoPagoNaoEntraNaPreviaDasAbertas() throws Exception {
        UUID aluno = aluno();
        String plano = plano("MENSAL", null);
        LocalDate inicio = hoje.minusMonths(3);

        JsonNode ligada = previa(aluno, corpo(plano, inicio, true, true));
        assertThat(ligada.get("quantidade").asInt()).isEqualTo(3);
        assertThat(ligada.get("primeiraCompetencia").asString()).isEqualTo(YearMonth.from(inicio.plusMonths(1)).toString());

        JsonNode desligada = previa(aluno, corpo(plano, inicio, false, true));
        assertThat(desligada.get("quantidade").asInt()).isZero();
        assertThat(desligada.get("totalCentavos").asLong()).isZero();
        assertThat(desligada.get("primeiraCompetencia").isNull()).isTrue();
        assertThat(desligada.get("ultimaCompetencia").isNull()).isTrue();

        contratar(aluno, corpo(plano, inicio, true, true));
        assertThat(abertas(aluno)).isEqualTo(3);
    }

    @Test
    void previaRecusaPlanoEAlunoInexistentesEOutraConsultoriaEInicioForaDaFaixa() throws Exception {
        UUID aluno = aluno();
        String plano = plano("MENSAL", null);
        Map<String, Object> semPlano = new LinkedHashMap<>(corpo(UUID.randomUUID().toString(), hoje, false, null));
        semPlano.put("alunoId", aluno.toString());
        api.post(PREVIA, admin, semPlano, 404);

        JsonNode outro = api.novoTreinador();
        Map<String, Object> deOutro = new LinkedHashMap<>(corpo(plano, hoje, false, null));
        deOutro.put("alunoId", aluno.toString());
        api.post(PREVIA, outro, deOutro, 404);

        Map<String, Object> antigo = new LinkedHashMap<>(corpo(plano, hoje.minusYears(11), true, null));
        antigo.put("alunoId", aluno.toString());
        JsonNode erro = api.post(PREVIA, admin, antigo, 422);
        assertThat(erro.get("codigo").asString()).isEqualTo("CONTRATACAO_INVALIDA");
        assertThat(erro.get("fieldErrors").get(0).get("field").asString()).isEqualTo("inicio");
    }

    @Test
    void previaPedeFinanceiroAlterar() throws Exception {
        UUID aluno = aluno();
        String plano = plano("MENSAL", null);
        String perfil = api.post("/perfis", admin, Map.of("nome", "Perfil leitor " + UUID.randomUUID(),
                "permissoes", Set.of("ALUNO_LER", "FINANCEIRO_LER")), 200).get("id").asString();
        JsonNode convite = api.post("/usuarios/convites", admin,
                Map.of("nome", "Leitor", "email", ApiDeTeste.emailUnico("leitor"), "perfilId", perfil), 200);
        JsonNode leitor = api.post("/publico/convites-equipe/aceitar", null,
                Map.of("codigo", convite.get("codigo").asString(), "senha", ApiDeTeste.SENHA), 200);
        Map<String, Object> corpo = new LinkedHashMap<>(corpo(plano, hoje, false, null));
        corpo.put("alunoId", aluno.toString());

        api.post(PREVIA, leitor, corpo, 403);
    }
}
