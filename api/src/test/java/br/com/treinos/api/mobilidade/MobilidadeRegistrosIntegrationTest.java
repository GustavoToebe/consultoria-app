package br.com.treinos.api.mobilidade;

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

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** O aluno marca "feito" na mobilidade: idempotência, versão publicada, janela de datas, desmarcar e isolamento. */
@AutoConfigureMockMvc
class MobilidadeRegistrosIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JsonMapper json;
    @Autowired
    private JdbcTemplate jdbc;

    private ApiDeTeste api;
    private JsonNode treinador;
    private UUID alunoId;
    private JsonNode aluno;
    private ApiDeTeste.MobilidadeDeTeste mobilidade;
    private String versaoId;
    private final LocalDate hoje = LocalDate.now(Fuso.BRASILIA);

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        treinador = api.novoTreinador();
        alunoId = api.criarAluno(treinador, "Aluno Fictício");
        mobilidade = ApiDeTeste.mobilidade();
        api.publicarMobilidade(treinador, alunoId, mobilidade.conteudo());
        aluno = api.convidarEEntrar(treinador, alunoId);
        versaoId = versaoDe(aluno);
    }

    private String versaoDe(JsonNode login) throws Exception {
        return api.get("/aluno/mobilidade", login, 200).get("mobilidade").get("id").asString();
    }

    @Test
    void marcarEReenviarNaoDuplicaEOGetDevolveSoOAceito() throws Exception {
        UUID id = UUID.randomUUID();
        Instant quando = Instant.now();
        var lote = List.of(registro(id, mobilidade.itemUid(), hoje, true, quando));

        assertThat(situacoes(enviar(lote))).containsExactly("ACEITO");
        // Reenvio do mesmo registro (a fila do aparelho repete até confirmar): não duplica nem muda nada.
        assertThat(situacoes(enviar(lote))).containsExactly("IGNORADO_ANTIGO");
        assertThat(contar()).isEqualTo(1);

        JsonNode feitos = api.get("/aluno/mobilidade/registros", aluno, 200);
        assertThat(feitos).hasSize(1);
        assertThat(feitos.get(0).get("itemUid").asString()).isEqualTo(mobilidade.itemUid().toString());
        assertThat(feitos.get(0).get("secaoUid").asString()).isEqualTo(mobilidade.secaoUid().toString());
        assertThat(feitos.get(0).get("planoVersaoId").asString()).isEqualTo(versaoId);
        assertThat(feitos.get(0).get("data").asString()).isEqualTo(hoje.toString());
        assertThat(feitos.get(0).get("feito").asBoolean()).isTrue();
        // O que o aluno lê não leva id nem situação.
        assertThat(feitos.get(0).has("id")).isFalse();
        assertThat(feitos.get(0).has("situacao")).isFalse();
    }

    @Test
    void desmarcarEOMesmoRegistroComFeitoFalsoEOUltimoAChegarVale() throws Exception {
        UUID id = UUID.randomUUID();
        Instant marcou = Instant.now().minusSeconds(60);
        Instant desmarcou = marcou.plusSeconds(30);

        enviar(List.of(registro(id, mobilidade.itemUid(), hoje, true, marcou)));
        assertThat(situacoes(enviar(List.of(registro(id, mobilidade.itemUid(), hoje, false, desmarcou))))).containsExactly("ACEITO");
        assertThat(contar()).isEqualTo(1);
        assertThat(api.get("/aluno/mobilidade/registros", aluno, 200).get(0).get("feito").asBoolean()).isFalse();

        // Um "feito" mais antigo que chega depois não desfaz a desmarcação.
        assertThat(situacoes(enviar(List.of(registro(id, mobilidade.itemUid(), hoje, true, marcou.plusSeconds(10))))))
                .containsExactly("IGNORADO_ANTIGO");
        assertThat(api.get("/aluno/mobilidade/registros", aluno, 200).get(0).get("feito").asBoolean()).isFalse();
    }

    @Test
    void itemForaDaVersaoERecusadoComMotivoSemDerrubarOLote() throws Exception {
        UUID bom = UUID.randomUUID();
        UUID inexistente = UUID.randomUUID();
        UUID itemQueNaoExiste = UUID.randomUUID();
        JsonNode resposta = enviar(List.of(
                registro(bom, mobilidade.itemUid(), hoje, true, Instant.now()),
                registro(inexistente, itemQueNaoExiste, hoje, true, Instant.now())));

        assertThat(situacoes(resposta)).containsExactly("ACEITO", "RECUSADO");
        assertThat(resposta.get("resultados").get(1).get("motivo").asString()).contains("não existe");
        // O recusado por item inexistente fica guardado com o motivo (a versão é imutável, então é permanente) ...
        assertThat(jdbc.queryForObject("select count(*) from mobilidade_registro where aluno_id = ? and situacao = 'RECUSADO'",
                Integer.class, alunoId)).isEqualTo(1);
        // ... mas ninguém lê: nem o aluno nem o treinador.
        assertThat(api.get("/aluno/mobilidade/registros", aluno, 200)).hasSize(1);
        assertThat(api.get("/alunos/" + alunoId + "/mobilidade/registros", treinador, 200)).hasSize(1);
    }

    @Test
    void itemNaSecaoErradaOuDataForaDaJanelaOuHorarioFuturoSaoRecusadosSemGravar() throws Exception {
        JsonNode resposta = enviar(List.of(
                registro(UUID.randomUUID(), mobilidade.itemUid(), hoje, true, Instant.now(), UUID.randomUUID()),
                registro(UUID.randomUUID(), mobilidade.itemUid(), hoje.minusDays(61), true, Instant.now()),
                registro(UUID.randomUUID(), mobilidade.itemUid(), hoje.plusDays(61), true, Instant.now()),
                registro(UUID.randomUUID(), mobilidade.itemUid(), hoje, true, Instant.now().plusSeconds(3 * 86400L))));

        assertThat(situacoes(resposta)).containsExactly("RECUSADO", "RECUSADO", "RECUSADO", "RECUSADO");
        assertThat(resposta.get("resultados").get(1).get("motivo").asString()).contains("60 dias");
        assertThat(contar()).isZero();

        // Os limites da janela (60 dias para trás e para a frente) ainda valem.
        assertThat(situacoes(enviar(List.of(
                registro(UUID.randomUUID(), mobilidade.itemUid(), hoje.minusDays(60), true, Instant.now()),
                registro(UUID.randomUUID(), mobilidade.outroItemUid(), hoje.plusDays(60), true, Instant.now())))))
                .containsExactly("ACEITO", "ACEITO");
    }

    @Test
    void recusaPorDataNaoSobrescreveORegistroJaAceito() throws Exception {
        UUID id = UUID.randomUUID();
        enviar(List.of(registro(id, mobilidade.itemUid(), hoje, true, Instant.now().minusSeconds(30))));

        // Mesmo id e mesma chave, mas o horário do aparelho é de dias no futuro: recusado, o aceito fica como estava.
        JsonNode resposta = enviar(List.of(registro(id, mobilidade.itemUid(), hoje, false, Instant.now().plusSeconds(5 * 86400L))));
        assertThat(situacoes(resposta)).containsExactly("RECUSADO");
        assertThat(api.get("/aluno/mobilidade/registros", aluno, 200).get(0).get("feito").asBoolean()).isTrue();
    }

    @Test
    void registroIncompletoEVersaoInexistenteSaoRecusados() throws Exception {
        Map<String, Object> semItem = registro(UUID.randomUUID(), mobilidade.itemUid(), hoje, true, Instant.now());
        semItem.remove("itemUid");
        Map<String, Object> semFeito = registro(UUID.randomUUID(), mobilidade.itemUid(), hoje, true, Instant.now());
        semFeito.remove("feito");
        Map<String, Object> versaoInexistente = registro(UUID.randomUUID(), mobilidade.itemUid(), hoje, true, Instant.now());
        versaoInexistente.put("planoVersaoId", UUID.randomUUID().toString());

        JsonNode resposta = enviar(List.of(semItem, semFeito, versaoInexistente));
        assertThat(situacoes(resposta)).containsExactly("RECUSADO", "RECUSADO", "RECUSADO");
        assertThat(resposta.get("resultados").get(0).get("motivo").asString()).isEqualTo("Registro incompleto.");
        assertThat(resposta.get("resultados").get(2).get("motivo").asString()).contains("não encontrada");
        assertThat(contar()).isZero();
    }

    @Test
    void versaoDeOutroAlunoEIdDeOutroAlunoSaoRecusadosEOGetDeCadaUmSoVeOProprio() throws Exception {
        UUID outroAlunoId = api.criarAluno(treinador, "Outro Aluno Fictício");
        var outraMobilidade = ApiDeTeste.mobilidade();
        api.publicarMobilidade(treinador, outroAlunoId, outraMobilidade.conteudo());
        JsonNode outro = api.convidarEEntrar(treinador, outroAlunoId);
        String versaoDoOutro = versaoDe(outro);

        // O aluno A manda a versão do aluno B (e o uid de um item que só existe lá): recusado, nada gravado.
        Map<String, Object> alheio = registro(UUID.randomUUID(), outraMobilidade.itemUid(), hoje, true, Instant.now());
        alheio.put("planoVersaoId", versaoDoOutro);
        alheio.put("secaoUid", outraMobilidade.secaoUid().toString());
        assertThat(situacoes(enviar(List.of(alheio)))).containsExactly("RECUSADO");
        assertThat(contar()).isZero();

        // B marca o dele; A reaproveita o id de B com a própria chave: recusado, o registro de B não muda.
        UUID idDoOutro = UUID.randomUUID();
        Map<String, Object> deB = registro(idDoOutro, outraMobilidade.itemUid(), hoje, true, Instant.now().minusSeconds(20));
        deB.put("planoVersaoId", versaoDoOutro);
        deB.put("secaoUid", outraMobilidade.secaoUid().toString());
        assertThat(situacoes(api.post("/aluno/mobilidade/registros", outro, Map.of("registros", List.of(deB)), 200)))
                .containsExactly("ACEITO");
        JsonNode colisao = enviar(List.of(registro(idDoOutro, mobilidade.itemUid(), hoje, false, Instant.now())));
        assertThat(situacoes(colisao)).containsExactly("RECUSADO");
        assertThat(colisao.get("resultados").get(0).get("motivo").asString()).contains("já usado");

        assertThat(api.get("/aluno/mobilidade/registros", aluno, 200)).isEmpty();
        JsonNode doOutro = api.get("/aluno/mobilidade/registros", outro, 200);
        assertThat(doOutro).hasSize(1);
        assertThat(doOutro.get(0).get("feito").asBoolean()).isTrue();
    }

    @Test
    void treinadorLeOsRegistrosDoAlunoEOutraConsultoriaRecebe404() throws Exception {
        enviar(List.of(registro(UUID.randomUUID(), mobilidade.itemUid(), hoje, true, Instant.now())));

        JsonNode lidos = api.get("/alunos/" + alunoId + "/mobilidade/registros", treinador, 200);
        assertThat(lidos).hasSize(1);
        assertThat(lidos.get(0).get("itemUid").asString()).isEqualTo(mobilidade.itemUid().toString());

        JsonNode deOutraConsultoria = api.novoTreinador();
        api.get("/alunos/" + alunoId + "/mobilidade/registros", deOutraConsultoria, 404);
        api.get("/alunos/" + alunoId + "/mobilidade/registros", null, 401);
    }

    @Test
    void periodoDaLeituraValeComoNoHistoricoDoTreino() throws Exception {
        enviar(List.of(
                registro(UUID.randomUUID(), mobilidade.itemUid(), hoje, true, Instant.now()),
                registro(UUID.randomUUID(), mobilidade.itemUid(), hoje.minusDays(30), true, Instant.now())));

        // Sem parâmetros: as duas últimas semanas.
        assertThat(api.get("/aluno/mobilidade/registros", aluno, 200)).hasSize(1);
        assertThat(api.get("/aluno/mobilidade/registros?de=" + hoje.minusDays(40) + "&ate=" + hoje, aluno, 200)).hasSize(2);
        api.get("/aluno/mobilidade/registros?de=" + hoje.minusDays(400) + "&ate=" + hoje, aluno, 400);
        api.get("/aluno/mobilidade/registros?de=" + hoje + "&ate=" + hoje.minusDays(1), aluno, 400);
    }

    @Test
    void loteComMaisDe300RegistrosERecusado() throws Exception {
        List<Map<String, Object>> grande = new ArrayList<>();
        for (int i = 0; i < 301; i++) {
            grande.add(registro(UUID.randomUUID(), mobilidade.itemUid(), hoje, true, Instant.now()));
        }
        api.post("/aluno/mobilidade/registros", aluno, Map.of("registros", grande), 400);
        assertThat(contar()).isZero();
    }

    @Test
    void soOAlunoGravaETreinadorNaoPodeUsarARotaDoAluno() throws Exception {
        api.post("/aluno/mobilidade/registros", treinador, Map.of("registros", List.of()), 403);
        api.get("/aluno/mobilidade/registros", treinador, 403);
        api.post("/aluno/mobilidade/registros", null, Map.of("registros", List.of()), 401);
    }

    private Map<String, Object> registro(UUID id, UUID itemUid, LocalDate data, boolean feito, Instant quando) {
        return registro(id, itemUid, data, feito, quando, mobilidade.secaoUid());
    }

    private Map<String, Object> registro(UUID id, UUID itemUid, LocalDate data, boolean feito, Instant quando, UUID secaoUid) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("id", id.toString());
        r.put("planoVersaoId", versaoId);
        r.put("secaoUid", secaoUid.toString());
        r.put("itemUid", itemUid.toString());
        r.put("data", data.toString());
        r.put("feito", feito);
        r.put("alteradoNoAparelhoEm", quando.toString());
        return r;
    }

    private JsonNode enviar(List<Map<String, Object>> registros) throws Exception {
        return api.post("/aluno/mobilidade/registros", aluno, Map.of("registros", registros), 200);
    }

    private static List<String> situacoes(JsonNode resposta) {
        return resposta.get("resultados").valueStream().map(r -> r.get("situacao").asString()).toList();
    }

    private int contar() {
        Integer n = jdbc.queryForObject("select count(*) from mobilidade_registro where aluno_id = ?", Integer.class, alunoId);
        return n == null ? 0 : n;
    }
}
