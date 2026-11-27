package br.com.treinos.api.contratos;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Corridas do contrato (pendências da revisão do passo 1): duas assinaturas ao mesmo tempo gravam uma só, assinar x cancelar nunca deixa
 * o contrato assinado e cancelado, o mesmo {@code pedidoId} ao mesmo tempo gera um contrato só e o mesmo UUID em outra consultoria não
 * conflita. Só dados fictícios.
 */
@AutoConfigureMockMvc
class ContratosConcorrenciaIntegrationTest extends AbstractIntegrationTest {

    private record Resposta(int status, JsonNode corpo) { }

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;

    private ApiDeTeste api;
    private JsonNode admin;
    private JsonNode modelo;
    private String nomeDoAluno;
    private UUID aluno;
    private JsonNode loginDoAluno;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        modelo = api.post("/contratos/modelos", admin, Map.of("nome", "Modelo " + UUID.randomUUID(), "texto", "Contrato de {aluno_nome}."), 201);
        nomeDoAluno = "Aluno Corrida " + UUID.randomUUID().toString().substring(0, 8);
        aluno = UUID.fromString(api.post("/alunos", admin, Map.of("nome", nomeDoAluno), 200).get("id").asString());
        loginDoAluno = api.convidarEEntrar(admin, aluno);
    }

    // ---- ajudantes ----

    private Map<String, Object> pedido(JsonNode umModelo, UUID pedidoId) {
        return Map.of("pedidoId", pedidoId.toString(), "modeloId", umModelo.get("id").asString());
    }

    private JsonNode gerar() throws Exception {
        return api.post("/alunos/" + aluno + "/contratos", admin, pedido(modelo, UUID.randomUUID()), 201);
    }

    private Callable<Resposta> post(String caminho, JsonNode login, Object corpo) {
        return () -> {
            var resposta = mvc.perform(MockMvcRequestBuilders.post(caminho).header("Authorization", ApiDeTeste.bearer(login))
                    .contentType(MediaType.APPLICATION_JSON).content(api.paraJson(corpo))).andReturn().getResponse();
            String texto = resposta.getContentAsString(StandardCharsets.UTF_8);
            return new Resposta(resposta.getStatus(), texto.isBlank() ? json.nullNode() : json.readTree(texto));
        };
    }

    private Callable<Resposta> assinar(JsonNode contrato) {
        return post("/aluno/contratos/" + contrato.get("id").asString() + "/assinar", loginDoAluno,
                Map.of("sha256", contrato.get("sha256").asString(), "nome", nomeDoAluno, "aceite", true));
    }

    /** Solta todas as chamadas juntas numa barreira e devolve as respostas na ordem das ações. */
    private static List<Resposta> emParalelo(List<Callable<Resposta>> acoes) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(acoes.size());
        try {
            CyclicBarrier largada = new CyclicBarrier(acoes.size());
            List<Future<Resposta>> futuros = new ArrayList<>();
            for (Callable<Resposta> acao : acoes) {
                futuros.add(pool.submit(() -> {
                    largada.await(10, TimeUnit.SECONDS);
                    return acao.call();
                }));
            }
            List<Resposta> respostas = new ArrayList<>();
            for (Future<Resposta> futuro : futuros) {
                respostas.add(futuro.get(60, TimeUnit.SECONDS));
            }
            return respostas;
        } finally {
            pool.shutdownNow();
        }
    }

    private int contar(String sql, Object... args) {
        return jdbc.queryForObject(sql, Integer.class, args);
    }

    // ---- as corridas ----

    @Test
    void duasAssinaturasAoMesmoTempoGravamUmaSoEAOutraVolta200SemRegravar() throws Exception {
        for (int rodada = 0; rodada < 3; rodada++) {
            JsonNode contrato = gerar();
            String id = contrato.get("id").asString();

            List<Resposta> respostas = emParalelo(List.of(assinar(contrato), assinar(contrato)));

            // O serviço trava a linha: a segunda espera, vê o assinado e devolve 200 com a mesma assinatura (sem regravar).
            assertThat(respostas).extracting(Resposta::status).containsExactly(200, 200);
            assertThat(respostas.get(0).corpo().get("assinatura").get("assinadoEm").asString())
                    .isEqualTo(respostas.get(1).corpo().get("assinatura").get("assinadoEm").asString());
            assertThat(contar("select count(*) from contrato_aluno where id = ?::uuid and situacao = 'ASSINADO'", id)).isEqualTo(1);
            assertThat(contar("select count(*) from auditoria where acao = 'CONTRATO_ASSINADO' and entidade_id = ?::uuid", id)).isEqualTo(1);
            assertThat(jdbc.queryForObject("select assinado_em::text from contrato_aluno where id = ?::uuid", String.class, id)).isNotBlank();
        }
    }

    @Test
    void assinarECancelarAoMesmoTempoNuncaDeixamOContratoAssinadoECancelado() throws Exception {
        boolean viuAssinadoPrimeiro = false;
        boolean viuCanceladoPrimeiro = false;
        for (int rodada = 0; rodada < 8; rodada++) {
            JsonNode contrato = gerar();
            String id = contrato.get("id").asString();

            List<Resposta> respostas = emParalelo(List.of(assinar(contrato),
                    post("/contratos/" + id + "/cancelar", admin, Map.of("motivo", "Corrida de teste", "versao", contrato.get("versao").asLong()))));
            Resposta assinatura = respostas.get(0);
            Resposta cancelamento = respostas.get(1);

            var linha = jdbc.queryForMap("select situacao, assinado_em is not null as com_assinatura, cancelado_em is not null as com_cancelamento"
                    + " from contrato_aluno where id = ?::uuid", id);
            if (linha.get("situacao").equals("ASSINADO")) {
                // Assinou primeiro: o cancelamento vê o assinado e é recusado (409), nada de cancelado.
                viuAssinadoPrimeiro = true;
                assertThat(assinatura.status()).isEqualTo(200);
                assertThat(cancelamento.status()).isEqualTo(409);
                assertThat(cancelamento.corpo().get("codigo").asString()).isEqualTo("CONTRATO_ASSINADO");
                assertThat(linha.get("com_assinatura")).isEqualTo(true);
                assertThat(linha.get("com_cancelamento")).isEqualTo(false);
            } else {
                // Cancelou primeiro: para o aluno o cancelado não existe (404) e nada de assinado.
                viuCanceladoPrimeiro = true;
                assertThat(linha.get("situacao")).isEqualTo("CANCELADO");
                assertThat(cancelamento.status()).isEqualTo(200);
                assertThat(assinatura.status()).isEqualTo(404);
                assertThat(linha.get("com_assinatura")).isEqualTo(false);
                assertThat(linha.get("com_cancelamento")).isEqualTo(true);
            }
        }
        // As duas ordens são legítimas; o que não pode existir é o estado misto, conferido em cada rodada. (viu* só documenta a corrida.)
        assertThat(viuAssinadoPrimeiro || viuCanceladoPrimeiro).isTrue();
    }

    @Test
    void mesmoPedidoIdAoMesmoTempoGeraUmContratoSoEORepetidoDevolveOMesmo() throws Exception {
        UUID pedidoId = UUID.randomUUID();
        Callable<Resposta> gerar = post("/alunos/" + aluno + "/contratos", admin, pedido(modelo, pedidoId));

        List<Resposta> respostas = emParalelo(List.of(gerar, gerar, gerar));

        // Uma criação (201) e as outras só devolvem o que a primeira gerou (200), nunca erro nem segundo contrato.
        assertThat(respostas).extracting(Resposta::status).containsExactlyInAnyOrder(201, 200, 200);
        assertThat(respostas).extracting(r -> r.corpo().get("id").asString()).containsOnly(respostas.get(0).corpo().get("id").asString());
        assertThat(contar("select count(*) from contrato_aluno where aluno_id = ?::uuid and pedido_id = ?::uuid", aluno.toString(), pedidoId.toString()))
                .isEqualTo(1);
        assertThat(contar("select count(*) from auditoria where acao = 'CONTRATO_GERADO' and entidade_id = ?::uuid",
                respostas.get(0).corpo().get("id").asString())).isEqualTo(1);
    }

    @Test
    void mesmoPedidoIdEmOutraConsultoriaNaoConflita() throws Exception {
        JsonNode outraEquipe = api.novoTreinador();
        JsonNode outroModelo = api.post("/contratos/modelos", outraEquipe,
                Map.of("nome", "Outro " + UUID.randomUUID(), "texto", "Texto de {aluno_nome}."), 201);
        UUID alunoDeLa = api.criarAluno(outraEquipe, "Aluno de Outra " + UUID.randomUUID());
        UUID pedidoId = UUID.randomUUID();

        List<Resposta> respostas = emParalelo(List.of(
                post("/alunos/" + aluno + "/contratos", admin, pedido(modelo, pedidoId)),
                post("/alunos/" + alunoDeLa + "/contratos", outraEquipe, pedido(outroModelo, pedidoId))));

        assertThat(respostas).extracting(Resposta::status).containsExactly(201, 201);
        assertThat(respostas.get(0).corpo().get("id").asString()).isNotEqualTo(respostas.get(1).corpo().get("id").asString());
        assertThat(contar("select count(*) from contrato_aluno where pedido_id = ?::uuid", pedidoId.toString())).isEqualTo(2);

        // E repetir em cada lado devolve o contrato do próprio lado (200), nunca o do outro.
        JsonNode daqui = api.post("/alunos/" + aluno + "/contratos", admin, pedido(modelo, pedidoId), 200);
        JsonNode dela = api.post("/alunos/" + alunoDeLa + "/contratos", outraEquipe, pedido(outroModelo, pedidoId), 200);
        assertThat(daqui.get("id").asString()).isEqualTo(respostas.get(0).corpo().get("id").asString());
        assertThat(dela.get("id").asString()).isEqualTo(respostas.get(1).corpo().get("id").asString());
    }
}
