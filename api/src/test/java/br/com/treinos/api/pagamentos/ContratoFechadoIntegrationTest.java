package br.com.treinos.api.pagamentos;

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

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static br.com.treinos.api.pagamentos.ContratoDeTeste.HOJE;
import static br.com.treinos.api.pagamentos.ContratoDeTeste.corpo;
import static br.com.treinos.api.pagamentos.ContratoDeTeste.entrada;
import static br.com.treinos.api.pagamentos.ContratoDeTeste.parcela;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * Contratar nos modos fechados (V098, {@code docs/planos/contrato-fechado.md}): a entrada e as parcelas nascem como cobranças
 * ligadas à contratação, a soma fecha com o total, a sobra de centavos fica na última parcela (a conta da renegociação), a entrada
 * pode nascer paga, o recorrente segue como era e nada gera mensalidade nem encerra a contratação. Só dados fictícios.
 */
@AutoConfigureMockMvc
class ContratoFechadoIntegrationTest extends AbstractIntegrationTest {

    private static final String PREVIA = "/contratacoes/previa-do-contrato";

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private RotinaDeGeracaoDeCobrancas rotina;

    private ApiDeTeste api;
    private JsonNode admin;
    private ContratoDeTeste contrato;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        contrato = new ContratoDeTeste(api, admin);
    }

    private static Map<String, Object> pedidoDaPrevia(Long total, Map<String, Object> entrada, Integer quantidade, LocalDate primeiro,
                                                      List<Map<String, Object>> parcelas) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("modoCobranca", "PARCELADO_FIXO");
        m.put("valorTotalCentavos", total);
        m.put("entrada", entrada);
        m.put("quantidade", quantidade);
        m.put("primeiroVencimento", primeiro == null ? null : primeiro.toString());
        m.put("parcelas", parcelas);
        return m;
    }

    private static List<Map<String, Object>> daPrevia(JsonNode previa) {
        List<Map<String, Object>> parcelas = new java.util.ArrayList<>();
        for (JsonNode l : previa.get("parcelas")) {
            if (!l.get("numero").isNull()) {
                parcelas.add(parcela(LocalDate.parse(l.get("vencimento").asString()), l.get("valorCentavos").asLong()));
            }
        }
        return parcelas;
    }

    private static long soma(List<JsonNode> cobrancas) {
        return cobrancas.stream().mapToLong(c -> c.get("valorCentavos").asLong()).sum();
    }

    @Test
    void entradaMaisDuasParcelasIguaisSomamOTotalELigamAContratacao() throws Exception {
        UUID aluno = contrato.aluno();
        JsonNode plano = contrato.plano("TRIMESTRAL");
        Map<String, Object> entrada = entrada(20_000, HOJE, false, null);

        JsonNode previa = api.post(PREVIA, admin, pedidoDaPrevia(100_000L, entrada, 2, HOJE.plusMonths(1), null), 200);
        assertThat(previa.get("somaCentavos").asLong()).isEqualTo(100_000);
        assertThat(previa.get("fecha").asBoolean()).isTrue();
        assertThat(previa.get("diferencaCentavos").asLong()).isZero();
        assertThat(previa.get("parcelas")).hasSize(3);
        assertThat(previa.get("parcelas").get(0).get("descricao").asString()).isEqualTo("Entrada");
        assertThat(previa.get("parcelas").get(0).get("numero").isNull()).isTrue();
        assertThat(previa.get("parcelas").get(1).get("descricao").asString()).isEqualTo("Parcela 1/2");
        assertThat(previa.get("parcelas").get(2).get("valorCentavos").asLong()).isEqualTo(40_000);

        JsonNode criada = contrato.contratar(aluno, corpo(plano, "PARCELADO_FIXO", 100_000L, entrada, daPrevia(previa)), 200);

        JsonNode bloco = criada.get("contrato");
        assertThat(bloco.get("modo").asString()).isEqualTo("PARCELADO_FIXO");
        assertThat(bloco.get("valorTotalCentavos").asLong()).isEqualTo(100_000);
        assertThat(bloco.get("pagoCentavos").asLong()).isZero();
        assertThat(bloco.get("saldoCentavos").asLong()).isEqualTo(100_000);
        assertThat(bloco.get("limiteDeLancamentoCentavos").asLong()).isZero();
        assertThat(bloco.get("cobrancasTotal").asInt()).isEqualTo(3);
        assertThat(bloco.get("vencidas").asInt()).isZero();
        assertThat(bloco.get("maisAntigaVencida").isNull()).isTrue();
        assertThat(criada.get("valorCentavos").asLong()).isEqualTo(100_000);
        assertThat(criada.get("situacao").asString()).isEqualTo("ATIVA");

        List<JsonNode> todas = contrato.cobrancas(aluno);
        assertThat(todas).hasSize(3);
        assertThat(soma(todas)).isEqualTo(100_000);
        List<JsonNode> entradas = contrato.doTipo(aluno, "AVULSA");
        assertThat(entradas).hasSize(1);
        assertThat(entradas.get(0).get("descricao").asString()).isEqualTo("Entrada");
        assertThat(entradas.get(0).get("situacao").asString()).isEqualTo("ABERTA");
        List<JsonNode> parcelas = contrato.doTipo(aluno, "RENEGOCIACAO");
        assertThat(parcelas).extracting(p -> p.get("descricao").asString()).containsExactlyInAnyOrder("Parcela 1/2", "Parcela 2/2");
        for (JsonNode c : todas) {
            assertThat(c.get("contratacaoId").asString()).isEqualTo(criada.get("id").asString());
        }
        assertThat(parcelas.get(0).get("acordoId").isNull()).isFalse();
        // O acordo do contrato não renegociou nada e carrega a contratação; nenhuma mensalidade nasce.
        Map<String, Object> acordo = jdbc.queryForMap("select renegociadas, parcelas, total_centavos, contratacao_id::text as contratacao "
                + "from acordo_de_cobranca where aluno_id = ?::uuid", aluno.toString());
        assertThat(((Number) acordo.get("renegociadas")).intValue()).isZero();
        assertThat(((Number) acordo.get("parcelas")).intValue()).isEqualTo(2);
        assertThat(((Number) acordo.get("total_centavos")).longValue()).isEqualTo(80_000);
        assertThat(acordo.get("contratacao")).isEqualTo(criada.get("id").asString());
        assertThat(contrato.doTipo(aluno, "MENSALIDADE")).isEmpty();
        assertThat(criada.get("minimoAte").isNull()).isTrue();
    }

    @Test
    void parcelasDesiguaisLevamASobraDeCentavosNaUltima() throws Exception {
        UUID aluno = contrato.aluno();
        JsonNode plano = contrato.plano("MENSAL");

        JsonNode previa = api.post(PREVIA, admin, pedidoDaPrevia(10_001L, null, 3, HOJE.plusDays(5), null), 200);
        List<Long> valores = previa.get("parcelas").valueStream().map(p -> p.get("valorCentavos").asLong()).toList();
        assertThat(valores).containsExactly(3_333L, 3_333L, 3_335L);
        assertThat(previa.get("fecha").asBoolean()).isTrue();

        // A tela pode editar as parcelas: o servidor só confere a soma.
        List<Map<String, Object>> editadas = List.of(parcela(HOJE.plusDays(5), 5_000), parcela(HOJE.plusMonths(1), 5_001));
        assertThat(api.post(PREVIA, admin, pedidoDaPrevia(10_001L, null, null, null, editadas), 200).get("fecha").asBoolean()).isTrue();
        contrato.contratar(aluno, corpo(plano, "PARCELADO_FIXO", 10_001L, null, editadas), 200);

        List<JsonNode> parcelas = contrato.doTipo(aluno, "RENEGOCIACAO");
        assertThat(soma(parcelas)).isEqualTo(10_001);
        assertThat(parcelas).extracting(p -> p.get("valorCentavos").asLong()).containsExactlyInAnyOrder(5_000L, 5_001L);
        assertThat(contrato.doTipo(aluno, "AVULSA")).isEmpty();
    }

    @Test
    void somaDivergenteDa422PorCampoSemRepetirValorENaPreviaSoDizQueNaoFecha() throws Exception {
        UUID aluno = contrato.aluno();
        JsonNode plano = contrato.plano("MENSAL");
        List<Map<String, Object>> parcelas = List.of(parcela(HOJE.plusDays(3), 4_000), parcela(HOJE.plusMonths(1), 4_000));

        JsonNode erro = contrato.contratar(aluno, corpo(plano, "PARCELADO_FIXO", 10_000L, entrada(1_000, HOJE, false, null), parcelas), 422);
        assertThat(erro.get("codigo").asString()).isEqualTo("CONTRATO_INVALIDO");
        assertThat(erro.get("fieldErrors").get(0).get("field").asString()).isEqualTo("parcelas");
        assertThat(ContratoDeTeste.mensagens(erro)).doesNotContain("10000").doesNotContain("4000");
        assertThat(contrato.cobrancas(aluno)).isEmpty();
        assertThat(api.get("/alunos/" + aluno + "/contratacoes", admin, 200)).isEmpty();

        JsonNode previa = api.post(PREVIA, admin, pedidoDaPrevia(10_000L, entrada(1_000, HOJE, false, null), null, null, parcelas), 200);
        assertThat(previa.get("somaCentavos").asLong()).isEqualTo(9_000);
        assertThat(previa.get("fecha").asBoolean()).isFalse();
        assertThat(previa.get("diferencaCentavos").asLong()).isEqualTo(1_000);
        // A prévia não grava nada.
        assertThat(contrato.cobrancas(aluno)).isEmpty();
    }

    @Test
    void entradaJaPagaNasceBaixadaESomaNoPagoSemEncerrarAContratacao() throws Exception {
        UUID aluno = contrato.aluno();
        JsonNode plano = contrato.plano("TRIMESTRAL");
        List<Map<String, Object>> parcelas = List.of(parcela(HOJE.plusMonths(1), 8_000));

        JsonNode criada = contrato.contratar(aluno, corpo(plano, "PARCELADO_FIXO", 10_000L,
                entrada(2_000, HOJE, true, "PIX_DIRETO"), parcelas), 200);

        JsonNode entrada = contrato.doTipo(aluno, "AVULSA").get(0);
        assertThat(entrada.get("situacao").asString()).isEqualTo("PAGA");
        assertThat(entrada.get("forma").asString()).isEqualTo("PIX_DIRETO");
        assertThat(entrada.get("pagoEm").asString()).isEqualTo(HOJE.toString());
        JsonNode bloco = criada.get("contrato");
        assertThat(bloco.get("pagoCentavos").asLong()).isEqualTo(2_000);
        assertThat(bloco.get("saldoCentavos").asLong()).isEqualTo(8_000);
        assertThat(bloco.get("cobrancasPagas").asInt()).isEqualTo(1);

        // Quitar o contrato inteiro não o encerra (D6): o saldo zera e a contratação segue ATIVA.
        contrato.baixar(contrato.doTipo(aluno, "RENEGOCIACAO").get(0));
        JsonNode quitado = contrato.contratacao(aluno);
        assertThat(quitado.get("contrato").get("saldoCentavos").asLong()).isZero();
        assertThat(quitado.get("contrato").get("pagoCentavos").asLong()).isEqualTo(10_000);
        assertThat(quitado.get("situacao").asString()).isEqualTo("ATIVA");
    }

    @Test
    void planoDeParcelaUnicaNaoEncerraAoPagarAEntrada() throws Exception {
        UUID aluno = contrato.aluno();
        JsonNode plano = contrato.plano("PARCELA_UNICA");

        contrato.contratar(aluno, corpo(plano, "SALDO_ABERTO", 50_000L, entrada(10_000, HOJE, true, null), null), 200);

        assertThat(contrato.contratacao(aluno).get("situacao").asString()).isEqualTo("ATIVA");
        assertThat(contrato.contratacao(aluno).get("contrato").get("pagoCentavos").asLong()).isEqualTo(10_000);
    }

    @Test
    void planoCobradoPelaKiwifyNaoAceitaContratoFechado() throws Exception {
        UUID aluno = contrato.aluno();
        JsonNode plano = contrato.plano("MENSAL");
        jdbc.update("update plano_comercial set kiwify_assinatura = true where id = ?::uuid", plano.get("id").asString());

        JsonNode erro = contrato.contratar(aluno, corpo(plano, "SALDO_ABERTO", 10_000L, null, null), 422);

        assertThat(erro.get("codigo").asString()).isEqualTo("CONTRATO_INVALIDO");
        assertThat(erro.get("fieldErrors").get(0).get("field").asString()).isEqualTo("modoCobranca");
        assertThat(api.get("/alunos/" + aluno + "/contratacoes", admin, 200)).isEmpty();
    }

    @Test
    void camposInvalidosDaoUm422PorCampo() throws Exception {
        UUID aluno = contrato.aluno();
        JsonNode plano = contrato.plano("MENSAL");
        List<Map<String, Object>> treze = new java.util.ArrayList<>();
        for (int i = 0; i < 13; i++) {
            treze.add(parcela(HOJE.plusMonths(i), 100));
        }

        assertThat(campos(contrato.contratar(aluno, corpo(plano, "SALDO_ABERTO", 0L, null, null), 422)))
                .containsExactly("valorTotalCentavos");
        assertThat(campos(contrato.contratar(aluno, corpo(plano, "PARCELADO_FIXO", 1_300L, null, treze), 422))).contains("parcelas");
        assertThat(campos(contrato.contratar(aluno, corpo(plano, "PARCELADO_FIXO", 1_000L, null, List.of()), 422))).contains("parcelas");
        assertThat(campos(contrato.contratar(aluno, corpo(plano, "PARCELADO_FIXO", 100L,
                null, List.of(parcela(LocalDate.of(1990, 1, 1), 100))), 422))).containsExactly("parcelas[0].vencimento");
        assertThat(campos(contrato.contratar(aluno, corpo(plano, "PARCELADO_FIXO", 100L,
                null, List.of(parcela(HOJE.plusDays(1), 0))), 422))).contains("parcelas[0].valorCentavos");
        // Entrada acima do total e sem data; campo do outro modo.
        assertThat(campos(contrato.contratar(aluno, corpo(plano, "SALDO_ABERTO", 1_000L, entrada(2_000, HOJE, false, null), null), 422)))
                .containsExactly("entrada.valorCentavos");
        Map<String, Object> semData = entrada(500, HOJE, false, null);
        semData.remove("data");
        assertThat(campos(contrato.contratar(aluno, corpo(plano, "SALDO_ABERTO", 1_000L, semData, null), 422)))
                .containsExactly("entrada.data");
        assertThat(campos(contrato.contratar(aluno, corpo(plano, "SALDO_ABERTO", 1_000L, null,
                List.of(parcela(HOJE.plusDays(1), 1_000))), 422))).containsExactly("parcelas");
        // Recorrente com campo de contrato.
        Map<String, Object> recorrente = new LinkedHashMap<>(corpo(plano, "RECORRENTE", 1_000L, null, null));
        recorrente.put("diaVencimento", 5);
        assertThat(campos(contrato.contratar(aluno, recorrente, 422))).containsExactly("valorTotalCentavos");
        assertThat(api.get("/alunos/" + aluno + "/contratacoes", admin, 200)).isEmpty();
    }

    private static List<String> campos(JsonNode erro) {
        assertThat(erro.get("codigo").asString()).isEqualTo("CONTRATO_INVALIDO");
        return erro.get("fieldErrors").valueStream().map(f -> f.get("field").asString()).toList();
    }

    @Test
    void recorrenteSegueComoEraSemBlocoDeContrato() throws Exception {
        UUID aluno = contrato.aluno();
        JsonNode plano = contrato.plano("MENSAL");
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("planoComercialId", plano.get("id").asString());
        corpo.put("inicio", HOJE.toString());
        corpo.put("diaVencimento", HOJE.getDayOfMonth());

        JsonNode criada = contrato.contratar(aluno, corpo, 200);

        assertThat(criada.get("contrato").isNull()).isTrue();
        assertThat(contrato.doTipo(aluno, "MENSALIDADE")).isNotEmpty();
        assertThat(jdbc.queryForObject("select modo_cobranca from contratacao_aluno where id = ?::uuid", String.class,
                criada.get("id").asString())).isEqualTo("RECORRENTE");
        // Sem o dia do vencimento o recorrente é recusado.
        UUID outro = contrato.aluno();
        corpo.remove("diaVencimento");
        assertThat(api.post("/alunos/" + outro + "/contratacoes", admin, corpo, 422).get("fieldErrors").get(0).get("field").asString())
                .isEqualTo("diaVencimento");
    }

    @Test
    void aRotinaDiariaNaoGeraMensalidadeParaContratoFechadoEAVigenciaEUmCicloSo() throws Exception {
        UUID aluno = contrato.aluno();
        JsonNode plano = contrato.plano("TRIMESTRAL");
        JsonNode criada = contrato.contratar(aluno, corpo(plano, "SALDO_ABERTO", 30_000L, entrada(5_000, HOJE, false, null), null), 200);
        UUID consultoria = jdbc.queryForObject("select consultoria_id from contratacao_aluno where id = ?::uuid", UUID.class,
                criada.get("id").asString());

        rotina.rodarNa(consultoria, HOJE.plusMonths(7));

        assertThat(contrato.doTipo(aluno, "MENSALIDADE")).isEmpty();
        assertThat(contrato.cobrancas(aluno)).hasSize(1);
        assertThat(criada.get("terminoVigencia").asString()).isEqualTo(HOJE.plusMonths(3).toString());
        assertThat(criada.get("diasRestantesVigencia").asLong()).isPositive();
    }

    @Test
    void renegociarARecusaCobrancaDoContratoEODesfazerARecusaOAcordoDele() throws Exception {
        UUID aluno = contrato.aluno();
        JsonNode plano = contrato.plano("MENSAL");
        contrato.contratar(aluno, corpo(plano, "PARCELADO_FIXO", 10_000L, entrada(2_000, HOJE, false, null),
                List.of(parcela(HOJE.plusMonths(1), 8_000))), 200);
        JsonNode entrada = contrato.doTipo(aluno, "AVULSA").get(0);
        JsonNode parcela = contrato.doTipo(aluno, "RENEGOCIACAO").get(0);

        for (JsonNode c : List.of(entrada, parcela)) {
            Map<String, Object> corpo = new LinkedHashMap<>();
            corpo.put("itens", List.of(Map.of("cobrancaId", c.get("id").asString(), "versao", c.get("versao").asLong())));
            corpo.put("acrescimoCentavos", 0);
            corpo.put("descontoCentavos", 0);
            corpo.put("parcelas", 1);
            corpo.put("primeiroVencimento", HOJE.plusDays(10).toString());
            assertThat(api.post("/cobrancas/renegociar/previa", admin, corpo, 409).get("codigo").asString())
                    .isEqualTo("COBRANCA_NAO_RENEGOCIAVEL");
        }
        JsonNode recusa = api.post("/cobrancas/acordos/" + parcela.get("acordoId").asString() + "/desfazer", admin,
                Map.of("motivo", "Teste"), 409);
        assertThat(recusa.get("codigo").asString()).isEqualTo("ACORDO_NAO_DESFAZIVEL");
        assertThat(contrato.doTipo(aluno, "RENEGOCIACAO").get(0).get("situacao").asString()).isEqualTo("ABERTA");
    }

    /** Inativar com contrato fechado vigente é recusado e nada muda (o detalhe está em {@code InativarComContratoFechadoIntegrationTest}). */
    @Test
    void inativarRecusaOContratoFechadoVigenteENaoMudaNada() throws Exception {
        UUID aluno = contrato.aluno();
        contrato.contratar(aluno, corpo(contrato.plano("MENSAL"), "PARCELADO_FIXO", 10_000L, entrada(2_000, HOJE.plusDays(3), false, null),
                List.of(parcela(HOJE.plusMonths(1), 8_000))), 200);

        assertThat(api.patch("/alunos/" + aluno + "/situacao", admin, Map.of("ativo", false), 409).get("codigo").asString())
                .isEqualTo("CONTRATO_FECHADO_VIGENTE");

        assertThat(contrato.doTipo(aluno, "AVULSA").get(0).get("situacao").asString()).isEqualTo("ABERTA");
        assertThat(contrato.doTipo(aluno, "RENEGOCIACAO").get(0).get("situacao").asString()).isEqualTo("ABERTA");
        assertThat(contrato.contratacao(aluno).get("situacao").asString()).isEqualTo("ATIVA");
    }

    @Test
    void alterarRecusaContratoFechadoENaoMudaNadaEORecorrenteSegueIgual() throws Exception {
        UUID aluno = contrato.aluno();
        JsonNode criada = contrato.contratar(aluno, corpo(contrato.plano("MENSAL"), "SALDO_ABERTO", 10_000L, null, null), 200);
        Map<String, Object> pedido = new LinkedHashMap<>();
        pedido.put("valorCentavos", 20_000);
        pedido.put("motivoValor", "Teste");
        pedido.put("diaVencimento", 7);
        pedido.put("versao", criada.get("versao").asLong());

        JsonNode erro = api.put("/contratacoes/" + criada.get("id").asString(), admin, pedido, 409);

        assertThat(erro.get("codigo").asString()).isEqualTo("CONTRATO_FECHADO_NAO_ALTERA");
        assertThat(ContratoDeTeste.mensagens(erro)).contains("Contrato fechado não se altera por aqui: encerre o contrato.");
        assertThat(ContratoDeTeste.mensagens(erro)).doesNotContain("20000");
        JsonNode depois = contrato.contratacao(aluno);
        assertThat(depois.get("valorCentavos").asLong()).isEqualTo(10_000);
        assertThat(depois.get("contrato").get("valorTotalCentavos").asLong()).isEqualTo(10_000);
        assertThat(depois.get("versao").asLong()).isEqualTo(criada.get("versao").asLong());

        // O recorrente altera como sempre.
        UUID outro = contrato.aluno();
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("planoComercialId", contrato.plano("MENSAL").get("id").asString());
        corpo.put("inicio", HOJE.toString());
        corpo.put("diaVencimento", HOJE.getDayOfMonth());
        JsonNode recorrente = contrato.contratar(outro, corpo, 200);
        Map<String, Object> altera = new LinkedHashMap<>();
        altera.put("valorCentavos", 12_000);
        altera.put("motivoValor", "Desconto fictício");
        altera.put("diaVencimento", 9);
        altera.put("versao", recorrente.get("versao").asLong());
        assertThat(api.put("/contratacoes/" + recorrente.get("id").asString(), admin, altera, 200).get("valorCentavos").asLong())
                .isEqualTo(12_000);
    }

    @Test
    void pausarERetomarRecusamContratoFechadoENaoMudaNadaEORecorrenteSegueIgual() throws Exception {
        UUID aluno = contrato.aluno();
        JsonNode criada = contrato.contratar(aluno, corpo(contrato.plano("MENSAL"), "SALDO_ABERTO", 10_000L, null, null), 200);
        String base = "/contratacoes/" + criada.get("id").asString();
        Map<String, Object> versao = Map.of("versao", criada.get("versao").asLong());

        for (String acao : List.of("pausar", "retomar")) {
            JsonNode erro = api.post(base + "/" + acao, admin, versao, 409);
            assertThat(erro.get("codigo").asString()).isEqualTo("CONTRATO_FECHADO_NAO_ALTERA");
            assertThat(ContratoDeTeste.mensagens(erro)).contains("Contrato fechado não se pausa nem se retoma: encerre o contrato.");
        }
        JsonNode depois = contrato.contratacao(aluno);
        assertThat(depois.get("situacao").asString()).isEqualTo("ATIVA");
        assertThat(depois.get("versao").asLong()).isEqualTo(criada.get("versao").asLong());

        // O recorrente pausa, retoma e repete como sempre.
        UUID outro = contrato.aluno();
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("planoComercialId", contrato.plano("MENSAL").get("id").asString());
        corpo.put("inicio", HOJE.toString());
        corpo.put("diaVencimento", HOJE.getDayOfMonth());
        JsonNode recorrente = contrato.contratar(outro, corpo, 200);
        String caminho = "/contratacoes/" + recorrente.get("id").asString();
        assertThat(api.post(caminho + "/retomar", admin, Map.of("versao", recorrente.get("versao").asLong()), 200)
                .get("situacao").asString()).isEqualTo("ATIVA");
        JsonNode pausada = api.post(caminho + "/pausar", admin, Map.of("versao", recorrente.get("versao").asLong()), 200);
        assertThat(pausada.get("situacao").asString()).isEqualTo("PAUSADA");
        api.post(caminho + "/pausar", admin, Map.of("versao", pausada.get("versao").asLong()), 200);
        assertThat(api.post(caminho + "/retomar", admin, Map.of("versao", pausada.get("versao").asLong()), 200)
                .get("situacao").asString()).isEqualTo("ATIVA");
    }

    @Test
    void parcelaDepoisDoFimDoContratoPassa() throws Exception {
        // Plano de 3 meses em 6x é venda normal: só valem 1 a 12 parcelas, a soma e os limites de valor.
        JsonNode plano = contrato.plano("TRIMESTRAL");
        UUID aluno = contrato.aluno();
        List<Map<String, Object>> seis = new ArrayList<>();
        for (int i = 1; i <= 6; i++) {
            seis.add(parcela(HOJE.plusMonths(i), 1_000));
        }

        contrato.contratar(aluno, corpo(plano, "PARCELADO_FIXO", 6_000L, null, seis), 200);
        assertThat(contrato.doTipo(aluno, "RENEGOCIACAO")).hasSize(6);
    }

    @Test
    void aPreviaAceitaParcelaDepoisDoFimEIgnoraPlanoEInicioQueOAppAindaMande() throws Exception {
        String planoId = contrato.plano("MENSAL").get("id").asString();
        // Mensal: o contrato acaba em 1 mês e 3 parcelas mensais passam do fim; a divisão automática aceita.
        Map<String, Object> divisao = pedidoDaPrevia(9_000L, null, 3, HOJE.plusDays(3), null);
        assertThat(api.post(PREVIA, admin, divisao, 200).get("parcelas")).hasSize(3);
        // Campos que saíram do contrato da prévia: o app antigo ainda os manda e não pode dar erro.
        divisao.put("planoComercialId", planoId);
        divisao.put("inicio", HOJE.toString());
        assertThat(api.post(PREVIA, admin, divisao, 200).get("fecha").asBoolean()).isTrue();
        // Lista editada com parcela depois do fim.
        Map<String, Object> editada = pedidoDaPrevia(9_000L, null, null, null,
                List.of(parcela(HOJE.plusDays(3), 4_000), parcela(HOJE.plusMonths(6), 5_000)));
        assertThat(api.post(PREVIA, admin, editada, 200).get("fecha").asBoolean()).isTrue();
    }

    @Test
    void asParcelasSaemOrdenadasPorVencimentoAntesDeRotularNaPreviaENoContratar() throws Exception {
        UUID aluno = contrato.aluno();
        JsonNode plano = contrato.plano("TRIMESTRAL");
        List<Map<String, Object>> desordenadas = List.of(parcela(HOJE.plusMonths(2), 3_000), parcela(HOJE.plusDays(5), 1_000),
                parcela(HOJE.plusMonths(1), 2_000));

        JsonNode previa = api.post(PREVIA, admin, pedidoDaPrevia(6_000L, null, null, null, desordenadas), 200);
        assertThat(previa.get("parcelas").valueStream().map(p -> p.get("descricao").asString()).toList())
                .containsExactly("Parcela 1/3", "Parcela 2/3", "Parcela 3/3");
        assertThat(previa.get("parcelas").valueStream().map(p -> p.get("valorCentavos").asLong()).toList())
                .containsExactly(1_000L, 2_000L, 3_000L);

        contrato.contratar(aluno, corpo(plano, "PARCELADO_FIXO", 6_000L, null, desordenadas), 200);
        assertThat(contrato.doTipo(aluno, "RENEGOCIACAO")).allSatisfy(c -> {
            long valor = c.get("valorCentavos").asLong();
            String rotulo = c.get("descricao").asString();
            assertThat(rotulo).isEqualTo(valor == 1_000 ? "Parcela 1/3" : valor == 2_000 ? "Parcela 2/3" : "Parcela 3/3");
        });
    }

    @Test
    void semFinanceiroAlterarAPreviaDoContratoDa403() throws Exception {
        JsonNode leitor = contrato.membro(java.util.Set.of("FINANCEIRO_LER", "ALUNO_LER"));

        api.post(PREVIA, leitor, pedidoDaPrevia(9_000L, null, 2, HOJE.plusDays(3), null), 403);
        api.post(PREVIA, admin, pedidoDaPrevia(9_000L, null, 2, HOJE.plusDays(3), null), 200);
    }

    @Test
    void oAlunoVeOTotalOContratoFechadoEOProximoVencimentoDoContrato() throws Exception {
        UUID aluno = contrato.aluno();
        contrato.contratar(aluno, corpo(contrato.plano("TRIMESTRAL"), "PARCELADO_FIXO", 90_000L,
                entrada(10_000, HOJE.minusDays(3), false, null),
                List.of(parcela(HOJE.plusMonths(1), 40_000), parcela(HOJE.plusDays(10), 40_000))), 200);
        JsonNode login = api.convidarEEntrar(admin, aluno);

        JsonNode meu = api.get("/aluno/financeiro", login, 200);

        JsonNode plano = meu.get("plano");
        assertThat(plano.get("valorCentavos").asLong()).isEqualTo(90_000);
        assertThat(plano.get("contratoFechado").asBoolean()).isTrue();
        assertThat(plano.get("proximoVencimento").asString()).as("o menor a vencer de hoje em diante")
                .isEqualTo(HOJE.plusDays(10).toString());
        assertThat(meu.get("abertas")).hasSize(3);
        assertThat(meu.get("abertas")).allSatisfy(c -> assertThat(c.get("doContrato").asBoolean()).isTrue());
        assertThat(meu.toString()).as("o aluno nunca vê o saldo").doesNotContain("saldo").doesNotContain("limiteDeLancamento");

        // Só uma vencida em aberto: o próximo é o da mais antiga aberta.
        UUID outro = contrato.aluno();
        contrato.contratar(outro, corpo(contrato.plano("MENSAL"), "SALDO_ABERTO", 20_000L,
                entrada(5_000, HOJE.minusDays(4), false, null), null), 200);
        JsonNode soVencida = api.get("/aluno/financeiro", api.convidarEEntrar(admin, outro), 200);
        assertThat(soVencida.get("plano").get("proximoVencimento").asString()).isEqualTo(HOJE.minusDays(4).toString());
    }

    @Test
    void oRecorrenteDoAlunoSegueIgualSemMarcaDeContrato() throws Exception {
        UUID aluno = contrato.aluno();
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("planoComercialId", contrato.plano("MENSAL").get("id").asString());
        corpo.put("inicio", HOJE.toString());
        corpo.put("diaVencimento", HOJE.getDayOfMonth());
        contrato.contratar(aluno, corpo, 200);

        JsonNode meu = api.get("/aluno/financeiro", api.convidarEEntrar(admin, aluno), 200);

        assertThat(meu.get("plano").get("contratoFechado").asBoolean()).isFalse();
        assertThat(meu.get("plano").get("valorCentavos").asLong()).isEqualTo(10_000);
        assertThat(meu.get("plano").get("proximoVencimento").asString()).isEqualTo(HOJE.toString());
        assertThat(meu.get("abertas")).isNotEmpty().allSatisfy(c -> assertThat(c.get("doContrato").asBoolean()).isFalse());
    }

    @Test
    void contratoDeOutraConsultoriaNaoApareceNemNaPrevia() throws Exception {
        UUID aluno = contrato.aluno();
        contrato.contratar(aluno, corpo(contrato.plano("MENSAL"), "SALDO_ABERTO", 9_000L, null, null), 200);
        JsonNode outro = api.novoTreinador();

        api.get("/alunos/" + aluno + "/contratacoes", outro, 404);
        api.get("/alunos/" + aluno + "/cobrancas", outro, 404);
    }
}
