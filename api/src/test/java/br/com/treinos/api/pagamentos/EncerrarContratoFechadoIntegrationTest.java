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
 * Encerrar um contrato fechado (V098): sempre cancela as cobranças futuras em aberto (vencimento de hoje em diante, Brasília), deixa as
 * vencidas e as pagas, e em OUTRO cria a multa (SAIDA) com valor e vencimento do treinador, sem link. FALTAM e VIGENTE não valem, e o
 * servidor confere o conjunto que a tela viu. O recorrente segue como era (ver {@code SaidaETempoMinimoIntegrationTest}). Só dados
 * fictícios.
 */
@AutoConfigureMockMvc
class EncerrarContratoFechadoIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;

    private ApiDeTeste api;
    private JsonNode admin;
    private ContratoDeTeste contrato;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        contrato = new ContratoDeTeste(api, admin);
    }

    /** Entrada paga, uma parcela vencida (há 10 dias), uma que vence hoje e uma daqui a 30 dias. */
    private JsonNode comParcelas(UUID aluno) throws Exception {
        List<Map<String, Object>> parcelas = List.of(parcela(HOJE.minusDays(10), 20_000), parcela(HOJE, 20_000),
                parcela(HOJE.plusDays(30), 20_000));
        return contrato.contratar(aluno, corpo(contrato.plano("TRIMESTRAL"), "PARCELADO_FIXO", 70_000L,
                entrada(10_000, HOJE, true, "DINHEIRO"), parcelas), 200);
    }

    private JsonNode previa(JsonNode contratacao) throws Exception {
        return api.get("/contratacoes/" + contratacao.get("id").asString() + "/previa-de-encerramento", admin, 200);
    }

    private static List<String> ids(JsonNode lista) {
        List<String> ids = new ArrayList<>();
        lista.forEach(c -> ids.add(c.get("cobrancaId").asString()));
        return ids;
    }

    private JsonNode encerrar(JsonNode contratacao, Map<String, Object> saida, int esperado) throws Exception {
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("versao", contratacao.get("versao").asLong());
        corpo.put("saida", saida);
        return api.post("/contratacoes/" + contratacao.get("id").asString() + "/encerrar", admin, corpo, esperado);
    }

    private static Map<String, Object> saida(String opcao, Long valor, LocalDate vencimento, List<String> cancelar) {
        Map<String, Object> s = new LinkedHashMap<>();
        s.put("opcao", opcao);
        s.put("valorCentavos", valor);
        s.put("vencimento", vencimento == null ? null : vencimento.toString());
        s.put("cobrancasACancelar", cancelar);
        return s;
    }

    private JsonNode daDescricao(UUID aluno, String descricao) throws Exception {
        return contrato.cobrancas(aluno).stream().filter(c -> descricao.equals(c.path("descricao").asString())).findFirst().orElseThrow();
    }

    @Test
    void aPreviaSeparaOQueSeraCanceladoDoQueFicaVencido() throws Exception {
        UUID aluno = contrato.aluno();
        JsonNode criada = comParcelas(aluno);

        JsonNode previa = previa(criada);

        assertThat(ids(previa.get("aCancelar"))).hasSize(2);
        assertThat(previa.get("aCancelar").valueStream().map(c -> c.get("descricao").asString()).toList())
                .containsExactlyInAnyOrder("Parcela 2/3", "Parcela 3/3");
        assertThat(previa.get("aCancelar").valueStream().map(c -> c.get("valorCentavos").asLong()).toList()).containsOnly(20_000L);
        assertThat(previa.get("vencidasQueFicam")).hasSize(1);
        assertThat(previa.get("vencidasQueFicam").get(0).get("descricao").asString()).isEqualTo("Parcela 1/3");
        assertThat(previa.get("vencidasQueFicam").get(0).get("vencimento").asString()).isEqualTo(HOJE.minusDays(10).toString());
        assertThat(previa.get("cobrancasACancelar")).hasSize(2);
        assertThat(previa.get("opcoes").valueStream().filter(o -> o.get("disponivel").asBoolean())
                .map(o -> o.get("opcao").asString()).toList()).containsExactlyInAnyOrder("OUTRO", "NAO_COBRAR");
        for (String indisponivel : List.of("FALTAM", "VIGENTE")) {
            JsonNode opcao = previa.get("opcoes").valueStream().filter(o -> indisponivel.equals(o.get("opcao").asString())).findFirst().orElseThrow();
            assertThat(opcao.get("disponivel").asBoolean()).isFalse();
            assertThat(opcao.get("motivo").asString()).isNotBlank();
        }
        // Só leitura: nada mudou.
        assertThat(contrato.doTipo(aluno, "RENEGOCIACAO")).allMatch(c -> "ABERTA".equals(c.get("situacao").asString()));
    }

    @Test
    void encerrarComMultaCancelaAsFuturasDeixaAsVencidasEAsPagasECriaASaidaSemLink() throws Exception {
        UUID aluno = contrato.aluno();
        JsonNode criada = comParcelas(aluno);
        List<String> futuras = ids(previa(criada).get("aCancelar"));
        LocalDate vencimentoDaMulta = HOJE.plusDays(10);

        JsonNode encerrada = encerrar(criada, saida("OUTRO", 30_000L, vencimentoDaMulta, futuras), 200);

        assertThat(encerrada.get("situacao").asString()).isEqualTo("ENCERRADA");
        assertThat(daDescricao(aluno, "Parcela 2/3").get("situacao").asString()).as("vence hoje: cancela").isEqualTo("CANCELADA");
        assertThat(daDescricao(aluno, "Parcela 3/3").get("situacao").asString()).isEqualTo("CANCELADA");
        assertThat(daDescricao(aluno, "Parcela 3/3").get("motivo").asString()).isEqualTo("Cancelada ao encerrar o contrato.");
        assertThat(daDescricao(aluno, "Parcela 1/3").get("situacao").asString()).as("vencida: fica").isEqualTo("ABERTA");
        assertThat(daDescricao(aluno, "Entrada").get("situacao").asString()).as("paga: fica").isEqualTo("PAGA");
        JsonNode multa = contrato.doTipo(aluno, "SAIDA").get(0);
        assertThat(multa.get("valorCentavos").asLong()).isEqualTo(30_000);
        assertThat(multa.get("vencimento").asString()).isEqualTo(vencimentoDaMulta.toString());
        assertThat(multa.get("situacao").asString()).isEqualTo("ABERTA");
        assertThat(multa.get("contratacaoId").asString()).isEqualTo(criada.get("id").asString());
        // O bloco do contrato não conta a multa: só o que é do contrato.
        JsonNode bloco = encerrada.get("contrato");
        assertThat(bloco.get("pagoCentavos").asLong()).isEqualTo(10_000);
        assertThat(bloco.get("vencidas").asInt()).isEqualTo(1);
        assertThat(bloco.get("cobrancasTotal").asInt()).as("entrada e parcela vencida").isEqualTo(2);
        // A multa (como toda saída) não tem link de pagamento.
        assertThat(api.post("/cobrancas/" + multa.get("id").asString() + "/link", admin, Map.of(), 409).get("codigo").asString())
                .isEqualTo("COBRANCA_SEM_LINK");
        assertThat(jdbc.queryForObject("select count(*) from auditoria where entidade_id::text = ? and acao = 'CONTRATACAO_ENCERRADA'",
                Integer.class, criada.get("id").asString())).isEqualTo(1);
    }

    @Test
    void naoCobrarEncerraECancelaAsFuturasSemMulta() throws Exception {
        UUID aluno = contrato.aluno();
        JsonNode criada = comParcelas(aluno);

        JsonNode encerrada = encerrar(criada, saida("NAO_COBRAR", null, null, ids(previa(criada).get("aCancelar"))), 200);

        assertThat(encerrada.get("situacao").asString()).isEqualTo("ENCERRADA");
        assertThat(contrato.doTipo(aluno, "SAIDA")).isEmpty();
        assertThat(contrato.doTipo(aluno, "RENEGOCIACAO").stream().filter(c -> "CANCELADA".equals(c.get("situacao").asString())))
                .hasSize(2);
        // Encerrar de novo sem saída é idempotente.
        JsonNode repetida = api.post("/contratacoes/" + criada.get("id").asString() + "/encerrar", admin,
                Map.of("versao", criada.get("versao").asLong()), 200);
        assertThat(repetida.get("situacao").asString()).isEqualTo("ENCERRADA");
    }

    @Test
    void oConjuntoQueATelaViuMudouDa409SemGravarNada() throws Exception {
        UUID aluno = contrato.aluno();
        JsonNode criada = comParcelas(aluno);
        List<String> vistas = ids(previa(criada).get("aCancelar"));
        // Enquanto a tela olhava, uma das futuras foi paga: o conjunto do servidor já é outro.
        JsonNode paga = daDescricao(aluno, "Parcela 3/3");
        contrato.baixar(paga);

        JsonNode erro = encerrar(criada, saida("OUTRO", 5_000L, null, vistas), 409);
        assertThat(erro.get("codigo").asString()).isEqualTo("VALOR_DA_SAIDA_MUDOU");
        assertThat(contrato.contratacao(aluno).get("situacao").asString()).isEqualTo("ATIVA");
        assertThat(daDescricao(aluno, "Parcela 2/3").get("situacao").asString()).isEqualTo("ABERTA");
        assertThat(contrato.doTipo(aluno, "SAIDA")).isEmpty();

        // Sem dizer o que viu, também não vale (o conjunto vazio não bate com o que há para cancelar).
        JsonNode semLista = api.post("/contratacoes/" + criada.get("id").asString() + "/encerrar", admin,
                Map.of("versao", criada.get("versao").asLong()), 409);
        assertThat(semLista.get("codigo").asString()).isEqualTo("VALOR_DA_SAIDA_MUDOU");
    }

    @Test
    void faltamEVigenteNaoValemEValorEVencimentoDaMultaSaoConferidos() throws Exception {
        UUID aluno = contrato.aluno();
        JsonNode criada = comParcelas(aluno);
        List<String> vistas = ids(previa(criada).get("aCancelar"));

        assertThat(encerrar(criada, saida("FALTAM", 1_000L, null, vistas), 422).get("fieldErrors").get(0).get("field").asString())
                .isEqualTo("saida.opcao");
        assertThat(encerrar(criada, saida("VIGENTE", 1_000L, null, List.of()), 422).get("fieldErrors").get(0).get("field").asString())
                .isEqualTo("saida.opcao");
        assertThat(encerrar(criada, saida("OUTRO", 100_000_001L, null, vistas), 422).get("fieldErrors").get(0).get("field").asString())
                .isEqualTo("saida.valorCentavos");
        assertThat(encerrar(criada, saida("OUTRO", 1_000L, HOJE.minusDays(1), vistas), 422).get("fieldErrors").get(0).get("field")
                .asString()).isEqualTo("saida.vencimento");
        assertThat(contrato.contratacao(aluno).get("situacao").asString()).isEqualTo("ATIVA");
        assertThat(contrato.doTipo(aluno, "SAIDA")).isEmpty();
    }

    @Test
    void contratoSemFuturasEncerraComMultaSemNada_aCancelar() throws Exception {
        UUID aluno = contrato.aluno();
        JsonNode criada = contrato.contratar(aluno, corpo(contrato.plano("MENSAL"), "SALDO_ABERTO", 20_000L,
                entrada(5_000, HOJE.minusDays(2), false, null), null), 200);
        JsonNode previa = previa(criada);
        assertThat(previa.get("aCancelar")).isEmpty();
        assertThat(previa.get("vencidasQueFicam")).hasSize(1);

        JsonNode encerrada = encerrar(criada, saida("OUTRO", 1_000L, null, List.of()), 200);

        assertThat(encerrada.get("situacao").asString()).isEqualTo("ENCERRADA");
        assertThat(contrato.doTipo(aluno, "SAIDA").get(0).get("vencimento").asString()).isEqualTo(HOJE.toString());
        assertThat(daDescricao(aluno, "Entrada").get("situacao").asString()).isEqualTo("ABERTA");
    }
}
