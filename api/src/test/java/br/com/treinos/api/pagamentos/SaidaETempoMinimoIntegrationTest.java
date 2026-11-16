package br.com.treinos.api.pagamentos;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.web.Fuso;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Saída antes do tempo mínimo e cobrança de saída (plano {@code docs/planos/saida-e-tempo-minimo.md}), ponta a ponta pela
 * API: plano com mínimo, prévia, as quatro opções, travas, inativar x anonimizar, painel, CSV, WhatsApp e os índices do
 * banco. Só dados fictícios; cada teste cria a própria consultoria.
 */
@AutoConfigureMockMvc
class SaidaETempoMinimoIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;

    private ApiDeTeste api;
    private JsonNode admin;
    private final LocalDate hoje = LocalDate.now(Fuso.BRASILIA);

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
    }

    // ---- ajudantes ----

    private JsonNode plano(long valor, String periodicidade, Integer minimoMeses, String regra) throws Exception {
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("nome", "Plano da saída " + UUID.randomUUID());
        corpo.put("valorCentavos", valor);
        corpo.put("periodicidade", periodicidade);
        corpo.put("tempoMinimoMeses", minimoMeses);
        corpo.put("regraDeSaida", regra);
        return api.post("/financeiro/planos", admin, corpo, 200);
    }

    private UUID aluno() throws Exception {
        return api.criarAluno(admin, "Aluno Fictício " + UUID.randomUUID());
    }

    private JsonNode contratarHoje(UUID aluno, JsonNode plano) throws Exception {
        return api.post("/alunos/" + aluno + "/contratacoes", admin, Map.of("planoComercialId",
                plano.get("id").asString(), "inicio", hoje.toString(), "diaVencimento", hoje.getDayOfMonth()), 200);
    }

    /** Aluno com plano mensal de R$ 100,00 e mínimo de 3 meses, contratado hoje: 1 mensalidade aberta e 2 ainda não geradas. */
    private JsonNode contratacaoComMinimo(UUID aluno) throws Exception {
        return contratarHoje(aluno, plano(10000, "MENSAL", 3, "Multa combinada de três mensalidades."));
    }

    private JsonNode cobrancas(UUID aluno) throws Exception {
        return api.get("/alunos/" + aluno + "/cobrancas", admin, 200);
    }

    private JsonNode doTipo(UUID aluno, String tipo) throws Exception {
        for (JsonNode c : cobrancas(aluno)) {
            if (tipo.equals(c.get("tipo").asString())) {
                return c;
            }
        }
        throw new AssertionError("Sem cobrança do tipo pedido.");
    }

    private long quantas(UUID aluno, String tipo, String situacao) throws Exception {
        return cobrancas(aluno).valueStream()
                .filter(c -> tipo.equals(c.get("tipo").asString()) && situacao.equals(c.get("situacao").asString())).count();
    }

    private JsonNode previa(JsonNode contratacao) throws Exception {
        return api.get("/contratacoes/" + contratacao.get("id").asString() + "/previa-de-encerramento", admin, 200);
    }

    private JsonNode encerrar(JsonNode contratacao, Map<String, Object> saida, int esperado) throws Exception {
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("versao", contratacao.get("versao").asLong());
        corpo.put("saida", saida);
        return api.post("/contratacoes/" + contratacao.get("id").asString() + "/encerrar", admin, corpo, esperado);
    }

    private static Map<String, Object> saida(String opcao, Long valor, List<String> cancelar) {
        Map<String, Object> s = new LinkedHashMap<>();
        s.put("opcao", opcao);
        s.put("valorCentavos", valor);
        s.put("cobrancasACancelar", cancelar);
        return s;
    }

    private JsonNode opcao(JsonNode previa, String nome) {
        return previa.get("opcoes").valueStream().filter(o -> nome.equals(o.get("opcao").asString())).findFirst().orElseThrow();
    }

    private static String codigo(JsonNode erro) {
        return erro.path("codigo").asString();
    }

    // ---- plano e contratação ----

    @Test
    void planoGuardaMinimoERegraEContratarCopiaOFimDoMinimo() throws Exception {
        JsonNode plano = plano(10000, "MENSAL", 3, "Cobrar o que falta.");
        assertThat(plano.get("tempoMinimoMeses").asInt()).isEqualTo(3);
        assertThat(plano.get("regraDeSaida").asString()).isEqualTo("Cobrar o que falta.");

        UUID aluno = aluno();
        JsonNode contratacao = contratarHoje(aluno, plano);
        assertThat(contratacao.get("minimoAte").asString()).isEqualTo(hoje.plusMonths(3).toString());

        // O plano alterado depois não muda a contratação (como o valor); a contratação ajusta o próprio mínimo.
        Map<String, Object> edicao = new LinkedHashMap<>();
        edicao.put("nome", plano.get("nome").asString());
        edicao.put("valorCentavos", 10000);
        edicao.put("periodicidade", "MENSAL");
        edicao.put("tempoMinimoMeses", 12);
        edicao.put("versao", plano.get("versao").asLong());
        api.put("/financeiro/planos/" + plano.get("id").asString(), admin, edicao, 200);
        assertThat(api.get("/alunos/" + aluno + "/contratacoes", admin, 200).get(0).get("minimoAte").asString())
                .isEqualTo(hoje.plusMonths(3).toString());

        Map<String, Object> alterar = new LinkedHashMap<>();
        alterar.put("valorCentavos", 10000);
        alterar.put("diaVencimento", hoje.getDayOfMonth());
        alterar.put("minimoAte", hoje.plusMonths(6).toString());
        alterar.put("versao", contratacao.get("versao").asLong());
        JsonNode alterada = api.put("/contratacoes/" + contratacao.get("id").asString(), admin, alterar, 200);
        assertThat(alterada.get("minimoAte").asString()).isEqualTo(hoje.plusMonths(6).toString());
        alterar.put("minimoAte", hoje.plusMonths(61).toString());
        alterar.put("versao", alterada.get("versao").asLong());
        assertThat(codigo(api.put("/contratacoes/" + contratacao.get("id").asString(), admin, alterar, 422)))
                .isEqualTo("CONTRATACAO_INVALIDA");
    }

    @Test
    void planoRecusaMinimoForaDosLimitesEEmParcelaUnica() throws Exception {
        for (Object invalido : new Object[] {0, 61}) {
            Map<String, Object> corpo = Map.of("nome", "Plano " + UUID.randomUUID(), "valorCentavos", 10000,
                    "periodicidade", "MENSAL", "tempoMinimoMeses", invalido);
            assertThat(codigo(api.post("/financeiro/planos", admin, corpo, 422))).isEqualTo("PLANO_INVALIDO");
        }
        Map<String, Object> unica = Map.of("nome", "Plano " + UUID.randomUUID(), "valorCentavos", 10000,
                "periodicidade", "PARCELA_UNICA", "tempoMinimoMeses", 3);
        assertThat(codigo(api.post("/financeiro/planos", admin, unica, 422))).isEqualTo("PLANO_INVALIDO");
        Map<String, Object> regraLonga = Map.of("nome", "Plano " + UUID.randomUUID(), "valorCentavos", 10000,
                "periodicidade", "MENSAL", "regraDeSaida", "x".repeat(501));
        assertThat(codigo(api.post("/financeiro/planos", admin, regraLonga, 422))).isEqualTo("PLANO_INVALIDO");
    }

    // ---- prévia e encerrar ----

    @Test
    void previaMostraAContaEFaltamCancelaAMensalidadeECriaASaidaSemGerarOutraMensalidade() throws Exception {
        UUID aluno = aluno();
        JsonNode contratacao = contratacaoComMinimo(aluno);
        JsonNode mensalidade = doTipo(aluno, "MENSALIDADE");

        JsonNode previa = previa(contratacao);
        assertThat(previa.get("mesesQueFaltam").asInt()).isEqualTo(3);
        assertThat(previa.get("aVencerNoMinimo").get("quantidade").asInt()).isEqualTo(1);
        // A única aberta cabe no mínimo e é cancelada: nada continua aberto.
        assertThat(previa.get("aVencerQueFicam").get("quantidade").asInt()).isZero();
        assertThat(previa.get("aVencerQueFicam").get("valorCentavos").asLong()).isZero();
        assertThat(previa.get("mesesNaoGerados").asInt()).isEqualTo(2);
        assertThat(previa.get("regraDeSaida").asString()).isEqualTo("Multa combinada de três mensalidades.");
        assertThat(previa.get("cobrancasACancelar").get(0).asString()).isEqualTo(mensalidade.get("id").asString());
        JsonNode faltam = opcao(previa, "FALTAM");
        assertThat(faltam.get("disponivel").asBoolean()).isTrue();
        assertThat(faltam.get("valorCentavos").asLong()).isEqualTo(30000);
        // Já existe a mensalidade do mês vigente: "mês vigente" não vale.
        assertThat(opcao(previa, "VIGENTE").get("disponivel").asBoolean()).isFalse();
        assertThat(opcao(previa, "OUTRO").get("disponivel").asBoolean()).isTrue();

        // Valor ou lista de cobranças diferentes do que o servidor calcula: 409, e nada muda.
        assertThat(codigo(encerrar(contratacao, saida("FALTAM", 29999L, List.of(mensalidade.get("id").asString())), 409)))
                .isEqualTo("VALOR_DA_SAIDA_MUDOU");
        assertThat(codigo(encerrar(contratacao, saida("FALTAM", 30000L, List.of()), 409))).isEqualTo("VALOR_DA_SAIDA_MUDOU");
        assertThat(quantas(aluno, "MENSALIDADE", "ABERTA")).isEqualTo(1);

        JsonNode encerrada = encerrar(contratacao, saida("FALTAM", 30000L, List.of(mensalidade.get("id").asString())), 200);
        assertThat(encerrada.get("situacao").asString()).isEqualTo("ENCERRADA");
        assertThat(quantas(aluno, "MENSALIDADE", "CANCELADA")).isEqualTo(1);
        assertThat(quantas(aluno, "MENSALIDADE", "ABERTA")).isZero();
        JsonNode saida = doTipo(aluno, "SAIDA");
        assertThat(saida.get("situacao").asString()).isEqualTo("ABERTA");
        assertThat(saida.get("valorCentavos").asLong()).isEqualTo(30000);
        assertThat(saida.get("vencimento").asString()).isEqualTo(hoje.toString());

        // Encerrada: não há mais o que prever nem encerrar com saída.
        assertThat(codigo(api.get("/contratacoes/" + contratacao.get("id").asString() + "/previa-de-encerramento", admin, 409)))
                .isEqualTo("CONTRATACAO_ENCERRADA");
        assertThat(codigo(encerrar(encerrada, saida("OUTRO", 5000L, null), 409))).isEqualTo("CONTRATACAO_ENCERRADA");

        // Pagar a saída não gera mensalidade nova (a contratação acabou).
        JsonNode paga = api.post("/cobrancas/" + saida.get("id").asString() + "/baixa-manual", admin,
                Map.of("data", hoje.toString(), "forma", "PIX_DIRETO", "versao", saida.get("versao").asLong()), 200);
        assertThat(paga.get("situacao").asString()).isEqualTo("PAGA");
        assertThat(quantas(aluno, "MENSALIDADE", "ABERTA")).isZero();
    }

    @Test
    void opcaoVigenteCobraUmMesQuandoNaoHaMensalidadeDoMesEOutroValorVemDoCorpo() throws Exception {
        UUID aluno = aluno();
        contratacaoComMinimo(aluno);
        // Sem a mensalidade do mês vigente (cancelada pelo treinador), "mês vigente" passa a valer.
        JsonNode mensalidade = doTipo(aluno, "MENSALIDADE");
        api.post("/cobrancas/" + mensalidade.get("id").asString() + "/cancelar", admin,
                Map.of("motivo", "Motivo fictício", "versao", mensalidade.get("versao").asLong()), 200);
        JsonNode atual = api.get("/alunos/" + aluno + "/contratacoes", admin, 200).get(0);
        JsonNode previa = previa(atual);
        assertThat(opcao(previa, "VIGENTE").get("disponivel").asBoolean()).isTrue();
        assertThat(opcao(previa, "VIGENTE").get("valorCentavos").asLong()).isEqualTo(10000);

        // Valores fora dos limites: 422 sem repetir o número.
        for (Long invalido : new Long[] {0L, -1L, 100_000_001L}) {
            JsonNode erro = encerrar(atual, saida("OUTRO", invalido, null), 422);
            assertThat(codigo(erro)).isEqualTo("CONTRATACAO_INVALIDA");
            assertThat(erro.toString()).doesNotContain("100000001");
        }
        Map<String, Object> passado = saida("OUTRO", 5000L, null);
        passado.put("vencimento", hoje.minusDays(1).toString());
        assertThat(codigo(encerrar(atual, passado, 422))).isEqualTo("CONTRATACAO_INVALIDA");
        Map<String, Object> longe = saida("OUTRO", 5000L, null);
        longe.put("vencimento", hoje.plusYears(1).plusDays(1).toString());
        assertThat(codigo(encerrar(atual, longe, 422))).isEqualTo("CONTRATACAO_INVALIDA");

        Map<String, Object> corpo = saida("OUTRO", 12345L, null);
        corpo.put("vencimento", hoje.plusDays(10).toString());
        encerrar(atual, corpo, 200);
        JsonNode saida = doTipo(aluno, "SAIDA");
        assertThat(saida.get("valorCentavos").asLong()).isEqualTo(12345);
        assertThat(saida.get("vencimento").asString()).isEqualTo(hoje.plusDays(10).toString());
    }

    @Test
    void naoCobrarEncerraMantendoAsAbertasEOutroConvivComAMensalidadeDeMesmaCompetencia() throws Exception {
        UUID semSaida = aluno();
        JsonNode primeira = contratacaoComMinimo(semSaida);
        encerrar(primeira, saida("NAO_COBRAR", null, null), 200);
        assertThat(quantas(semSaida, "MENSALIDADE", "ABERTA")).isEqualTo(1);
        assertThat(jdbc.queryForObject("select count(*) from cobranca_aluno where aluno_id = ?::uuid and tipo = 'SAIDA'",
                Integer.class, semSaida.toString())).isZero();

        UUID aluno = aluno();
        JsonNode contratacao = contratacaoComMinimo(aluno);
        encerrar(contratacao, saida("OUTRO", 5000L, null), 200);
        // A mensalidade aberta e a saída têm a mesma competência: o índice único é só das mensalidades.
        assertThat(quantas(aluno, "MENSALIDADE", "ABERTA")).isEqualTo(1);
        assertThat(quantas(aluno, "SAIDA", "ABERTA")).isEqualTo(1);

        // Cancelar a saída não gera mensalidade (a contratação acabou); a mensalidade que já havia continua sendo uma só.
        JsonNode saida = doTipo(aluno, "SAIDA");
        api.post("/cobrancas/" + saida.get("id").asString() + "/cancelar", admin,
                Map.of("motivo", "Motivo fictício", "versao", saida.get("versao").asLong()), 200);
        assertThat(quantas(aluno, "MENSALIDADE", "ABERTA")).isEqualTo(1);

        // Só uma saída viva por contratação, também no banco (e a cancelada deixa a vaga).
        UUID contratacaoId = UUID.fromString(contratacao.get("id").asString());
        assertThat(jdbc.queryForObject("select count(*) from cobranca_aluno where contratacao_id = ?::uuid and tipo = 'SAIDA'",
                Integer.class, contratacaoId.toString())).isEqualTo(1);
        UUID aluno2 = aluno();
        JsonNode c2 = contratacaoComMinimo(aluno2);
        encerrar(c2, saida("OUTRO", 5000L, null), 200);
        UUID vivaId = UUID.fromString(doTipo(aluno2, "SAIDA").get("id").asString());
        assertThatThrownBy(() -> jdbc.execute((java.sql.Connection con) -> {
            try (var s = con.createStatement()) {
                s.execute("create temp table copia_saida as select * from cobranca_aluno where id = '" + vivaId + "'");
                try {
                    s.execute("update copia_saida set id = gen_random_uuid()");
                    s.execute("insert into cobranca_aluno select * from copia_saida");
                } finally {
                    s.execute("drop table copia_saida");
                }
            }
            return null;
        })).isInstanceOf(Exception.class).hasMessageContaining("ux_cobranca_saida_viva");
    }

    @Test
    void semMinimoAMensalidadeAVencerContinuaAbertaNoGrupoNovoDaPrevia() throws Exception {
        UUID aluno = aluno();
        JsonNode previa = previa(contratarHoje(aluno, plano(10000, "MENSAL", null, null)));
        // Vence hoje (ainda não é vencida) e nenhuma opção a cancela: fica no grupo novo, com valor.
        assertThat(previa.get("aVencerQueFicam").get("quantidade").asInt()).isEqualTo(1);
        assertThat(previa.get("aVencerQueFicam").get("valorCentavos").asLong()).isEqualTo(10000);
        assertThat(previa.get("aVencerNoMinimo").get("quantidade").asInt()).isZero();
        assertThat(previa.get("vencidas").get("quantidade").asInt()).isZero();
        assertThat(opcao(previa, "FALTAM").get("disponivel").asBoolean()).isFalse();
    }

    @Test
    void parcelaUnicaNaoTemCobrancaDeSaida() throws Exception {
        UUID aluno = aluno();
        JsonNode contratacao = contratarHoje(aluno, plano(50000, "PARCELA_UNICA", null, null));
        JsonNode previa = previa(contratacao);
        assertThat(opcao(previa, "OUTRO").get("disponivel").asBoolean()).isFalse();
        assertThat(opcao(previa, "FALTAM").get("disponivel").asBoolean()).isFalse();
        assertThat(codigo(encerrar(contratacao, saida("OUTRO", 5000L, null), 422))).isEqualTo("CONTRATACAO_INVALIDA");
    }

    @Test
    void outraConsultoriaNaoVeNemEncerraComSaida() throws Exception {
        UUID aluno = aluno();
        JsonNode contratacao = contratacaoComMinimo(aluno);
        JsonNode outro = api.novoTreinador();
        api.get("/contratacoes/" + contratacao.get("id").asString() + "/previa-de-encerramento", outro, 404);
        api.get("/alunos/" + aluno + "/resumo-da-saida", outro, 404);
        api.post("/contratacoes/" + contratacao.get("id").asString() + "/encerrar", outro,
                Map.of("versao", 0, "saida", saida("OUTRO", 5000L, null)), 404);
    }

    // ---- inativar x anonimizar ----

    @Test
    void inativarMantemAsVencidasEASaidaECancelaSoAMensalidadeAVencerEAnonimizarCancelaTudo() throws Exception {
        String nome = "Rita Fictícia da Saída";
        UUID aluno = api.criarAluno(admin, nome);
        JsonNode contratacao = contratacaoComMinimo(aluno);
        JsonNode resumo = api.get("/alunos/" + aluno + "/resumo-da-saida", admin, 200);
        assertThat(resumo.get("aCancelar").get("quantidade").asInt()).isEqualTo(1);
        assertThat(resumo.get("mesesQueFaltam").asInt()).isEqualTo(3);

        // Saída OUTRO deixa a mensalidade aberta; a mensalidade passa a vencida e a saída segue com vencimento futuro.
        JsonNode corpo = encerrar(contratacao, saida("OUTRO", 7000L, null), 200);
        assertThat(corpo.get("situacao").asString()).isEqualTo("ENCERRADA");
        JsonNode mensalidade = doTipo(aluno, "MENSALIDADE");
        jdbc.update("update cobranca_aluno set vencimento = ?::date where id = ?::uuid", hoje.minusDays(5).toString(),
                mensalidade.get("id").asString());

        api.patch("/alunos/" + aluno + "/situacao", admin, Map.of("ativo", false), 200);
        assertThat(quantas(aluno, "MENSALIDADE", "ABERTA")).isEqualTo(1);
        assertThat(quantas(aluno, "SAIDA", "ABERTA")).isEqualTo(1);
        // A vencida e a saída de quem saiu entram nos inadimplentes só quando vencidas: aqui, a mensalidade.
        assertThat(api.get("/financeiro/inadimplentes", admin, 200).get("itens")).hasSize(1);

        // Inativo: sem link (409), com mensagem do WhatsApp só para a vencida e a saída, e sem link do app.
        JsonNode saida = doTipo(aluno, "SAIDA");
        assertThat(codigo(api.post("/cobrancas/" + saida.get("id").asString() + "/link", admin, Map.of(), 409)))
                .isEqualTo("COBRANCA_SEM_LINK");
        assertThat(codigo(api.post("/cobrancas/" + mensalidade.get("id").asString() + "/link", admin, Map.of(), 409)))
                .isEqualTo("ALUNO_INATIVO");
        JsonNode zap = api.get("/cobrancas/" + saida.get("id").asString() + "/lembretes", admin, 200);
        assertThat(zap.get("whatsapp").get("mensagem").asString()).containsIgnoringCase("saída")
                .doesNotContainIgnoringCase("mensalidade").doesNotContain("/aluno/conta");
        JsonNode zapVencida = api.get("/cobrancas/" + mensalidade.get("id").asString() + "/lembretes", admin, 200);
        assertThat(zapVencida.get("whatsapp").get("mensagem").asString()).contains("ainda está em aberto")
                .doesNotContain("/aluno/conta");

        api.post("/alunos/" + aluno + "/anonimizar", admin, Map.of("nomeConfirmado", nome), 200);
        assertThat(quantas(aluno, "MENSALIDADE", "ABERTA")).isZero();
        assertThat(quantas(aluno, "SAIDA", "ABERTA")).isZero();
        JsonNode anonimo = api.get("/cobrancas/" + saida.get("id").asString() + "/lembretes", admin, 200);
        assertThat(anonimo.get("whatsapp").isNull()).isTrue();
        // Anonimizar cancela tudo: sem cobrança aberta nem aluno com nome, não há mensagem.
        assertThat(anonimo.get("motivoSemWhatsapp").asString()).isEqualTo("COBRANCA_NAO_ABERTA");
    }

    // ---- aluno inativo: o que a equipe ainda pode fazer com o que ficou em aberto ----

    /** A mensalidade passa a vencida (vence há {@code dias} dias); a versão não muda. */
    private void vencer(JsonNode cobranca, int dias) {
        jdbc.update("update cobranca_aluno set vencimento = ?::date where id = ?::uuid", hoje.minusDays(dias).toString(),
                cobranca.get("id").asString());
    }

    private void inativar(UUID aluno) throws Exception {
        api.patch("/alunos/" + aluno + "/situacao", admin, Map.of("ativo", false), 200);
    }

    private static Map<String, Object> motivo(JsonNode cobranca) {
        return Map.of("motivo", "Motivo fictício", "versao", cobranca.get("versao").asLong());
    }

    @Test
    void alunoInativoComMensalidadeVencidaMantidaAbertaPodeTerACobrancaCancelada() throws Exception {
        UUID aluno = aluno();
        contratacaoComMinimo(aluno);
        vencer(doTipo(aluno, "MENSALIDADE"), 5);
        inativar(aluno);
        assertThat(quantas(aluno, "MENSALIDADE", "ABERTA")).as("a vencida fica aberta ao inativar").isEqualTo(1);

        JsonNode vencida = doTipo(aluno, "MENSALIDADE");
        JsonNode cancelada = api.post("/cobrancas/" + vencida.get("id").asString() + "/cancelar", admin, motivo(vencida), 200);

        assertThat(cancelada.get("situacao").asString()).isEqualTo("CANCELADA");
        assertThat(quantas(aluno, "MENSALIDADE", "CANCELADA")).isEqualTo(1);
        assertThat(quantas(aluno, "MENSALIDADE", "ABERTA")).isZero();
    }

    @Test
    void alunoInativoAindaPodeDarBaixaEDesfazerMasNaoContestarNemEstornar() throws Exception {
        UUID aluno = aluno();
        contratacaoComMinimo(aluno);
        vencer(doTipo(aluno, "MENSALIDADE"), 5);
        inativar(aluno);

        JsonNode vencida = doTipo(aluno, "MENSALIDADE");
        JsonNode paga = api.post("/cobrancas/" + vencida.get("id").asString() + "/baixa-manual", admin,
                Map.of("data", hoje.toString(), "forma", "PIX_DIRETO", "versao", vencida.get("versao").asLong()), 200);
        assertThat(paga.get("situacao").asString()).isEqualTo("PAGA");

        // Contestar e estornar seguem recusados para quem saiu.
        assertThat(codigo(api.post("/cobrancas/" + paga.get("id").asString() + "/contestar", admin, motivo(paga), 409)))
                .isEqualTo("ALUNO_INATIVO");
        assertThat(codigo(api.post("/cobrancas/" + paga.get("id").asString() + "/estornar", admin, motivo(paga), 409)))
                .isEqualTo("ALUNO_INATIVO");

        JsonNode desfeita = api.post("/cobrancas/" + paga.get("id").asString() + "/desfazer-baixa", admin, motivo(paga), 200);
        assertThat(desfeita.get("situacao").asString()).isEqualTo("ABERTA");
        assertThat(quantas(aluno, "MENSALIDADE", "ABERTA")).isEqualTo(1);
    }

    @Test
    void baixaEmLoteAceitaVencidaESaidaDeAlunoInativoEAnonimizadoSegueRecusado() throws Exception {
        // Aluno inativo: a mensalidade vencida e a cobrança de saída são baixadas pelo lote, como pela baixa individual.
        UUID aluno = aluno();
        JsonNode contratacao = contratacaoComMinimo(aluno);
        encerrar(contratacao, saida("OUTRO", 7000L, null), 200);
        vencer(doTipo(aluno, "MENSALIDADE"), 5);
        inativar(aluno);
        JsonNode vencida = doTipo(aluno, "MENSALIDADE");
        JsonNode saida = doTipo(aluno, "SAIDA");

        JsonNode resultados = api.post("/cobrancas/baixa-em-lote", admin, Map.of("data", hoje.toString(), "forma", "PIX_DIRETO",
                "itens", List.of(Map.of("cobrancaId", vencida.get("id").asString(), "versao", vencida.get("versao").asLong()),
                        Map.of("cobrancaId", saida.get("id").asString(), "versao", saida.get("versao").asLong()))), 200)
                .get("resultados");

        for (JsonNode r : resultados) {
            assertThat(r.get("ok").asBoolean()).as("item " + r).isTrue();
            assertThat(r.get("codigo").isNull()).isTrue();
        }
        assertThat(quantas(aluno, "MENSALIDADE", "PAGA")).isEqualTo(1);
        assertThat(quantas(aluno, "SAIDA", "PAGA")).isEqualTo(1);

        // Anonimizado continua recusado (a trava vem antes de olhar a situação da cobrança).
        String nome = "Ana Fictícia do Lote";
        UUID anonimo = api.criarAluno(admin, nome);
        contratacaoComMinimo(anonimo);
        JsonNode daAnonima = doTipo(anonimo, "MENSALIDADE");
        inativar(anonimo);
        api.post("/alunos/" + anonimo + "/anonimizar", admin, Map.of("nomeConfirmado", nome), 200);
        JsonNode recusado = api.post("/cobrancas/baixa-em-lote", admin, Map.of("data", hoje.toString(), "forma", "PIX_DIRETO",
                "itens", List.of(Map.of("cobrancaId", daAnonima.get("id").asString(), "versao", daAnonima.get("versao").asLong()))),
                200).get("resultados").get(0);
        assertThat(recusado.get("ok").asBoolean()).isFalse();
        assertThat(recusado.get("codigo").asString()).isEqualTo("ALUNO_ANONIMIZADO");
    }

    // ---- painel, CSV, lembretes ----

    @Test
    void saidaEntraNoRecebidoNoAReceberENoAtrasoMasNaoNosPagantes() throws Exception {
        UUID aluno = aluno();
        JsonNode contratacao = contratacaoComMinimo(aluno);
        JsonNode mensalidade = doTipo(aluno, "MENSALIDADE");
        encerrar(contratacao, saida("FALTAM", 30000L, List.of(mensalidade.get("id").asString())), 200);
        JsonNode saida = doTipo(aluno, "SAIDA");

        JsonNode aberta = api.get("/financeiro/painel", admin, 200).get("cartoes");
        assertThat(aberta.get("aReceberCentavos").asLong()).isEqualTo(30000);
        assertThat(aberta.path("alunosPagantes").asLong()).isZero();

        jdbc.update("update cobranca_aluno set vencimento = ?::date where id = ?::uuid", hoje.minusDays(3).toString(),
                saida.get("id").asString());
        JsonNode vencida = api.get("/financeiro/painel", admin, 200).get("cartoes");
        assertThat(vencida.get("emAtraso").get("valorCentavos").asLong()).isEqualTo(30000);
        assertThat(api.get("/financeiro/inadimplentes", admin, 200).get("valorTotalCentavos").asLong()).isEqualTo(30000);

        // CSV: descrição fixa e tipo vazio (nenhuma coluna nova).
        String csv = mvc.perform(MockMvcRequestBuilders.get("/financeiro/exportacao?de=" + hoje.minusDays(10) + "&ate=" + hoje.plusDays(1))
                .header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(admin))).andReturn().getResponse()
                .getContentAsString(StandardCharsets.UTF_8);
        assertThat(csv).contains(";Cobrança de saída;").contains(";300,00;");

        JsonNode paga = api.post("/cobrancas/" + saida.get("id").asString() + "/baixa-manual", admin,
                Map.of("data", hoje.toString(), "forma", "PIX_DIRETO", "versao", saida.get("versao").asLong()), 200);
        assertThat(paga.get("situacao").asString()).isEqualTo("PAGA");
        JsonNode recebida = api.get("/financeiro/painel", admin, 200).get("cartoes");
        assertThat(recebida.get("recebidoCentavos").asLong()).isEqualTo(30000);
        assertThat(recebida.path("alunosPagantes").asLong()).isZero();
        assertThat(recebida.path("valorMedioPorAlunoCentavos").asLong()).isZero();
        assertThat(api.get("/financeiro/inadimplentes", admin, 200).get("itens")).isEmpty();
    }
}
