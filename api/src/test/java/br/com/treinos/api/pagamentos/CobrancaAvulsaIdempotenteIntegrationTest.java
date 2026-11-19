package br.com.treinos.api.pagamentos;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.web.Fuso;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Idempotência da cobrança avulsa (D11, V090): o mesmo {@code pedidoId} devolve 200 com o que já foi gerado, sem gravar nem auditar
 * de novo; pedidos diferentes geram; duas chamadas simultâneas geram uma vez só e as duas respondem sem erro; outra consultoria com
 * o mesmo UUID não vê nem conflita; {@code pedidoId} ausente é 422. Dados fictícios.
 */
@AutoConfigureMockMvc
class CobrancaAvulsaIdempotenteIntegrationTest extends AbstractIntegrationTest {

    private static final String ROTA = "/financeiro/cobrancas-avulsas";

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

    private Map<String, Object> corpo(UUID pedido, List<UUID> alunos, long valor, int parcelas) {
        Map<String, Object> m = new LinkedHashMap<>();
        if (pedido != null) {
            m.put("pedidoId", pedido.toString());
        }
        m.put("alunoIds", alunos.stream().map(UUID::toString).toList());
        m.put("descricao", "Camiseta fictícia");
        m.put("valorCentavos", valor);
        m.put("primeiroVencimento", hoje.plusDays(5).toString());
        m.put("parcelas", parcelas);
        return m;
    }

    private UUID aluno(JsonNode quem) throws Exception {
        return api.criarAluno(quem, "Aluno Fictício " + UUID.randomUUID());
    }

    private int cobrancasDoAluno(JsonNode quem, UUID aluno) throws Exception {
        return api.get("/alunos/" + aluno + "/cobrancas", quem, 200).size();
    }

    private long auditoriaDo(UUID aluno) {
        return jdbc.queryForObject("select count(*) from auditoria where acao = 'COBRANCAS_AVULSAS_GERADAS' and entidade_id = ?::uuid",
                Long.class, aluno.toString());
    }

    @Test
    void repetirOMesmoPedidoDevolve200ComOQueJaFoiGeradoSemDuplicarNemAuditar() throws Exception {
        UUID pedido = UUID.randomUUID();
        List<UUID> alunos = List.of(aluno(admin), aluno(admin));

        JsonNode primeira = api.post(ROTA, admin, corpo(pedido, alunos, 5_000, 3), 201);
        JsonNode segunda = api.post(ROTA, admin, corpo(pedido, alunos, 5_000, 3), 200);

        assertThat(primeira.get("alunos").asInt()).isEqualTo(2);
        assertThat(primeira.get("cobrancas").asInt()).isEqualTo(6);
        assertThat(segunda).isEqualTo(primeira);
        for (UUID a : alunos) {
            assertThat(cobrancasDoAluno(admin, a)).isEqualTo(3);
            assertThat(auditoriaDo(a)).isEqualTo(1);
        }
        // Uma terceira vez também devolve o mesmo (não é "só a segunda").
        assertThat(api.post(ROTA, admin, corpo(pedido, alunos, 5_000, 3), 200)).isEqualTo(primeira);
    }

    @Test
    void mesmoPedidoComOutroCorpoDevolveOQueJaExisteSemComparar() throws Exception {
        UUID pedido = UUID.randomUUID();
        UUID a = aluno(admin);
        UUID b = aluno(admin);
        JsonNode primeira = api.post(ROTA, admin, corpo(pedido, List.of(a), 5_000, 2), 201);

        // Outro aluno, outro valor e outras parcelas: o pedido já foi gerado, nada novo.
        JsonNode segunda = api.post(ROTA, admin, corpo(pedido, List.of(b), 9_999, 5), 200);

        assertThat(segunda).isEqualTo(primeira);
        assertThat(cobrancasDoAluno(admin, a)).isEqualTo(2);
        assertThat(cobrancasDoAluno(admin, b)).isZero();
        assertThat(auditoriaDo(b)).isZero();
    }

    @Test
    void repetirDevolveOQueJaExisteMesmoComOAlunoInativoDepois() throws Exception {
        UUID pedido = UUID.randomUUID();
        UUID a = aluno(admin);
        JsonNode primeira = api.post(ROTA, admin, corpo(pedido, List.of(a), 5_000, 1), 201);
        api.patch("/alunos/" + a + "/situacao", admin, Map.of("ativo", false), 200);

        assertThat(api.post(ROTA, admin, corpo(pedido, List.of(a), 5_000, 1), 200)).isEqualTo(primeira);
        // Pedido novo para o inativo continua recusado.
        api.post(ROTA, admin, corpo(UUID.randomUUID(), List.of(a), 5_000, 1), 409);
    }

    @Test
    void pedidosDiferentesGeramCadaUmOsSeus() throws Exception {
        UUID a = aluno(admin);

        api.post(ROTA, admin, corpo(UUID.randomUUID(), List.of(a), 1_000, 2), 201);
        api.post(ROTA, admin, corpo(UUID.randomUUID(), List.of(a), 1_000, 2), 201);

        assertThat(cobrancasDoAluno(admin, a)).isEqualTo(4);
        assertThat(auditoriaDo(a)).isEqualTo(2);
    }

    @Test
    void duasChamadasSimultaneasDoMesmoPedidoGeramUmaVezEAsDuasRespondemSemErro() throws Exception {
        UUID pedido = UUID.randomUUID();
        List<UUID> alunos = List.of(aluno(admin), aluno(admin));
        String texto = json.writeValueAsString(corpo(pedido, alunos, 2_500, 4));
        CountDownLatch largada = new CountDownLatch(1);
        Callable<int[]> chamada = () -> {
            largada.await();
            var r = mvc.perform(MockMvcRequestBuilders.post(ROTA).header("X-Treinos-Cliente", "nativo")
                            .header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(admin))
                            .contentType(MediaType.APPLICATION_JSON).content(texto))
                    .andReturn().getResponse();
            JsonNode corpoDaResposta = json.readTree(r.getContentAsString(java.nio.charset.StandardCharsets.UTF_8));
            return new int[] {r.getStatus(), corpoDaResposta.get("alunos").asInt(), corpoDaResposta.get("cobrancas").asInt()};
        };
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Future<int[]> um = pool.submit(chamada);
            Future<int[]> dois = pool.submit(chamada);
            largada.countDown();
            List<int[]> respostas = new ArrayList<>(List.of(um.get(), dois.get()));
            // Uma criou (201) e a outra recebeu o que a primeira gerou (200); nenhuma deu 500.
            assertThat(respostas).extracting(r -> r[0]).containsExactlyInAnyOrder(201, 200);
            assertThat(respostas).allSatisfy(r -> {
                assertThat(r[1]).isEqualTo(2);
                assertThat(r[2]).isEqualTo(8);
            });
        } finally {
            pool.shutdownNow();
        }
        for (UUID a : alunos) {
            assertThat(cobrancasDoAluno(admin, a)).isEqualTo(4);
            assertThat(auditoriaDo(a)).isEqualTo(1);
        }
    }

    @Test
    void outraConsultoriaComOMesmoPedidoIdNaoVeNemConflita() throws Exception {
        UUID pedido = UUID.randomUUID();
        UUID a = aluno(admin);
        JsonNode outro = api.novoTreinador();
        UUID deOutro = aluno(outro);
        api.post(ROTA, admin, corpo(pedido, List.of(a), 5_000, 1), 201);

        // A outra consultoria usa o mesmo UUID: gera o dela (201), não recebe o da primeira nem conflita.
        JsonNode dela = api.post(ROTA, outro, corpo(pedido, List.of(deOutro), 7_000, 2), 201);

        assertThat(dela.get("cobrancas").asInt()).isEqualTo(2);
        assertThat(cobrancasDoAluno(admin, a)).isEqualTo(1);
        assertThat(cobrancasDoAluno(outro, deOutro)).isEqualTo(2);
        // E repetir em cada uma devolve só o que é de cada uma.
        assertThat(api.post(ROTA, outro, corpo(pedido, List.of(deOutro), 7_000, 2), 200).get("cobrancas").asInt()).isEqualTo(2);
        assertThat(api.post(ROTA, admin, corpo(pedido, List.of(a), 5_000, 1), 200).get("cobrancas").asInt()).isEqualTo(1);
    }

    @Test
    void pedidoIdAusenteDa422NoCampoSemGravarNada() throws Exception {
        UUID a = aluno(admin);

        JsonNode erro = api.post(ROTA, admin, corpo(null, List.of(a), 5_000, 1), 422);

        assertThat(erro.get("codigo").asString()).isEqualTo("COBRANCA_AVULSA_INVALIDA");
        assertThat(erro.get("fieldErrors")).hasSize(1);
        assertThat(erro.get("fieldErrors").get(0).get("field").asString()).isEqualTo("pedidoId");
        assertThat(cobrancasDoAluno(admin, a)).isZero();
    }
}
