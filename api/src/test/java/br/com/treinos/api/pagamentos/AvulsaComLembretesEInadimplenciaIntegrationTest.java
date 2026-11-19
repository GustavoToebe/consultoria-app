package br.com.treinos.api.pagamentos;

import br.com.plataforma.comum.auth.EnviadorDeEmail;
import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.EmailDeTeste;
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
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * A cobrança AVULSA (sem contratação, sem competência) junto do que já existia: lembretes por e-mail (texto "cobrança", sem
 * cancelar por contratação inativa, contada no "N em aberto", um e-mail por aluno por dia com a mensalidade), a rotina de
 * geração que a ignora, e inadimplentes e lista de cobranças com ela vencida (total e valor batendo com as páginas). O job e a
 * rotina são chamados à mão com o "hoje" do cenário. Só dados fictícios; cada teste cria a própria consultoria.
 */
@AutoConfigureMockMvc
class AvulsaComLembretesEInadimplenciaIntegrationTest extends AbstractIntegrationTest {

    private static final long VALOR_DA_AVULSA = 1_234;
    private static final long VALOR_DO_PLANO = 10_000;

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private LembretesDeCobranca job;
    @Autowired private EnviadorDeEmail enviador;
    @Autowired private RotinaDeGeracaoDeCobrancas rotina;

    private final LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
    private ApiDeTeste api;
    private JsonNode admin;
    private UUID consultoria;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        consultoria = jdbc.queryForObject("select consultoria_id from usuario where id = ?::uuid", UUID.class,
                admin.get("usuario").get("id").asString());
    }

    // ---- ajudantes ----

    private UUID alunoComEmail(String email) throws Exception {
        return UUID.fromString(api.post("/alunos", admin, Map.of("nome", "Aluno Fictício " + UUID.randomUUID(), "email", email), 200)
                .get("id").asString());
    }

    private void ligarLembretes() throws Exception {
        api.put("/financeiro/lembretes", admin,
                Map.of("ligado", true, "diasAntes", 3, "noDia", true, "diasDepois", 3), 200);
    }

    private void avulsa(List<UUID> alunos, long valor, LocalDate vencimento) throws Exception {
        api.post("/financeiro/cobrancas-avulsas", admin, Map.of("pedidoId", UUID.randomUUID().toString(), "alunoIds", alunos.stream().map(UUID::toString).toList(),
                "descricao", "Camiseta fictícia", "valorCentavos", valor, "primeiroVencimento", vencimento.toString(),
                "parcelas", 1), 201);
    }

    /** Contratação mensal que começa hoje (a primeira mensalidade vence hoje). */
    private void mensalidade(UUID aluno) throws Exception {
        JsonNode plano = api.post("/financeiro/planos", admin, Map.of("nome", "Plano da avulsa " + UUID.randomUUID(),
                "valorCentavos", VALOR_DO_PLANO, "periodicidade", "MENSAL"), 200);
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("planoComercialId", plano.get("id").asString());
        corpo.put("inicio", hoje.toString());
        corpo.put("diaVencimento", hoje.getDayOfMonth());
        api.post("/alunos/" + aluno + "/contratacoes", admin, corpo, 200);
    }

    private JsonNode cobranca(UUID aluno, String tipo) throws Exception {
        for (JsonNode c : api.get("/alunos/" + aluno + "/cobrancas", admin, 200)) {
            if (tipo.equals(c.get("tipo").asString())) {
                return c;
            }
        }
        throw new AssertionError("Sem cobrança do tipo " + tipo + ".");
    }

    private List<Map<String, Object>> linhas(JsonNode cobranca) {
        return jdbc.queryForList("select tipo, situacao, motivo from lembrete_cobranca where cobranca_id = ?::uuid",
                cobranca.get("id").asString());
    }

    private int contar(UUID aluno, String tipo) {
        Integer n = jdbc.queryForObject("select count(*) from cobranca_aluno where aluno_id = ? and tipo = ?", Integer.class,
                aluno, tipo);
        return n == null ? 0 : n;
    }

    private void vencerEm(JsonNode cobranca, LocalDate vencimento) {
        jdbc.update("update cobranca_aluno set vencimento = ?::date where id = ?::uuid", vencimento.toString(),
                cobranca.get("id").asString());
    }

    // ---- lembretes ----

    @Test
    void lembreteDaAvulsaSaiComTextoDeCobrancaESemCancelarPorContratacao() throws Exception {
        String email = ApiDeTeste.emailUnico("avulsa-lembrete");
        UUID aluno = alunoComEmail(email);
        avulsa(List.of(aluno), VALOR_DA_AVULSA, hoje.plusDays(10));
        ligarLembretes();

        job.rodar(hoje.plusDays(7), enviador);

        JsonNode avulsa = cobranca(aluno, "AVULSA");
        assertThat(linhas(avulsa)).singleElement().satisfies(l -> {
            assertThat(l.get("tipo")).isEqualTo("ANTES");
            assertThat(l.get("situacao")).as("planejado e enviado, não cancelado por CONTRATACAO_NAO_ATIVA").isEqualTo("ENVIADO");
            assertThat(l.get("motivo")).isNull();
        });
        List<EnviadorDeEmail.Mensagem> recebidas = EmailDeTeste.para(email);
        assertThat(recebidas).hasSize(1);
        assertThat(recebidas.get(0).assunto()).startsWith("Lembrete de cobrança").doesNotContain("mensalidade");
        assertThat(recebidas.get(0).texto()).contains("A cobrança de").contains("R$ 12,34").doesNotContain("mensalidade")
                .doesNotContain("Camiseta fictícia");
        assertThat(recebidas.get(0).html()).doesNotContain("mensalidade");
    }

    @Test
    void mensalidadeMaisAntigaMandaOEmailEOTextoContaAAvulsaNoEmAberto() throws Exception {
        String email = ApiDeTeste.emailUnico("avulsa-mensal-antiga");
        UUID aluno = alunoComEmail(email);
        mensalidade(aluno); // vence hoje (NO_DIA)
        avulsa(List.of(aluno), VALOR_DA_AVULSA, hoje.plusDays(2)); // ANTES já devido hoje, mas mais nova
        ligarLembretes();

        job.rodar(hoje, enviador);
        job.rodar(hoje, enviador);

        List<EnviadorDeEmail.Mensagem> recebidas = EmailDeTeste.para(email);
        assertThat(recebidas).as("um e-mail por aluno por dia, mesmo rodando de novo").hasSize(1);
        assertThat(recebidas.get(0).texto()).contains("A mensalidade de").contains("vence hoje")
                .contains("Você tem 2 cobranças em aberto no total.");
        assertThat(linhas(cobranca(aluno, "MENSALIDADE"))).singleElement()
                .satisfies(l -> assertThat(l.get("situacao")).isEqualTo("ENVIADO"));
        assertThat(linhas(cobranca(aluno, "AVULSA"))).as("a avulsa espera o dia seguinte").isEmpty();
    }

    @Test
    void avulsaMaisAntigaMandaOEmailEAMensalidadeFicaSemLembreteNoMesmoDia() throws Exception {
        String email = ApiDeTeste.emailUnico("avulsa-antiga");
        UUID aluno = alunoComEmail(email);
        mensalidade(aluno); // vence hoje
        avulsa(List.of(aluno), VALOR_DA_AVULSA, hoje.minusDays(3)); // DEPOIS devido hoje e mais antiga
        ligarLembretes();

        job.rodar(hoje, enviador);
        job.rodar(hoje, enviador);

        List<EnviadorDeEmail.Mensagem> recebidas = EmailDeTeste.para(email);
        assertThat(recebidas).hasSize(1);
        assertThat(recebidas.get(0).texto()).contains("A cobrança de").contains("venceu em")
                .contains("Você tem 2 cobranças em aberto no total.").doesNotContain("A mensalidade de");
        assertThat(linhas(cobranca(aluno, "AVULSA"))).singleElement().satisfies(l -> {
            assertThat(l.get("tipo")).isEqualTo("DEPOIS");
            assertThat(l.get("situacao")).isEqualTo("ENVIADO");
        });
        assertThat(linhas(cobranca(aluno, "MENSALIDADE"))).isEmpty();
    }

    // ---- rotina de geração ----

    @Test
    void rotinaDeGeracaoIgnoraAAvulsa() throws Exception {
        UUID soAvulsa = api.criarAluno(admin, "Aluno Fictício Só Avulsa " + UUID.randomUUID());
        UUID comPlano = api.criarAluno(admin, "Aluno Fictício Com Plano " + UUID.randomUUID());
        avulsa(List.of(soAvulsa, comPlano), VALOR_DA_AVULSA, hoje.minusDays(40));
        mensalidade(comPlano);

        var r = rotina.rodarNa(consultoria, hoje.plusMonths(2));

        assertThat(r.falhas()).isZero();
        assertThat(r.contratacoes()).as("só a contratação mensal entra, a avulsa não tem contratação").isEqualTo(1);
        assertThat(r.cobrancas()).isEqualTo(contar(comPlano, "MENSALIDADE") - 1);
        assertThat(contar(soAvulsa, "AVULSA")).isEqualTo(1);
        assertThat(contar(soAvulsa, "MENSALIDADE")).isZero();
        assertThat(contar(comPlano, "AVULSA")).isEqualTo(1);
        assertThat(rotina.rodarNa(consultoria, hoje.plusMonths(2)).cobrancas()).as("repetir não duplica").isZero();
    }

    // ---- inadimplentes e lista ----

    @Test
    void inadimplentesEListaContamAAvulsaVencidaEOsTotaisBatemComAsPaginas() throws Exception {
        // 52 alunos com avulsa vencida (um deles também com mensalidade vencida), mais uma avulsa a vencer, que fica paga.
        List<UUID> vencidas = new ArrayList<>();
        for (int i = 0; i < 52; i++) {
            vencidas.add(api.criarAluno(admin, "Aluno Fictício Vencido " + i + " " + UUID.randomUUID()));
        }
        UUID comMensalidade = vencidas.get(0);
        UUID aVencer = api.criarAluno(admin, "Aluno Fictício A Vencer " + UUID.randomUUID());
        mensalidade(comMensalidade);
        vencerEm(cobranca(comMensalidade, "MENSALIDADE"), hoje.minusDays(30));
        avulsa(vencidas, VALOR_DA_AVULSA, hoje.minusDays(5));
        avulsa(List.of(aVencer), VALOR_DA_AVULSA, hoje.plusDays(5));
        JsonNode futura = cobranca(aVencer, "AVULSA");
        api.post("/cobrancas/" + futura.get("id").asString() + "/baixa-manual", admin,
                Map.of("data", hoje.toString(), "forma", "DINHEIRO", "versao", futura.get("versao").asLong()), 200);

        long valorVencido = 52 * VALOR_DA_AVULSA + VALOR_DO_PLANO;

        // Inadimplentes: uma linha por cobrança vencida e aberta (53), a avulsa inclusive.
        Set<String> ids = new HashSet<>();
        long soma = 0;
        for (int pagina = 0; pagina < 2; pagina++) {
            JsonNode p = api.get("/financeiro/inadimplentes?pagina=" + pagina, admin, 200);
            assertThat(p.get("total").asLong()).isEqualTo(53);
            assertThat(p.get("valorTotalCentavos").asLong()).isEqualTo(valorVencido);
            assertThat(p.get("itens")).hasSize(pagina == 0 ? 50 : 3);
            for (JsonNode i : p.get("itens")) {
                assertThat(ids.add(i.get("cobrancaId").asString())).as("sem repetir entre páginas").isTrue();
                soma += i.get("valorCentavos").asLong();
            }
        }
        assertThat(soma).isEqualTo(valorVencido);
        assertThat(ids).contains(cobranca(comMensalidade, "AVULSA").get("id").asString(),
                cobranca(comMensalidade, "MENSALIDADE").get("id").asString());
        assertThat(ids).doesNotContain(futura.get("id").asString());

        // Lista de cobranças: 52 avulsas vencidas + a mensalidade vencida + a avulsa paga = 54.
        long total = 0;
        long somaDosItens = 0;
        int avulsas = 0;
        for (int pagina = 0; pagina < 2; pagina++) {
            JsonNode p = api.get("/financeiro/cobrancas?pagina=" + pagina, admin, 200);
            total = p.get("total").asLong();
            assertThat(p.get("itens")).hasSize(pagina == 0 ? 50 : 4);
            JsonNode totais = p.get("totais");
            assertThat(totais.get("totalCentavos").asLong()).isEqualTo(valorVencido + VALOR_DA_AVULSA);
            assertThat(totais.get("pagoCentavos").asLong()).isEqualTo(VALOR_DA_AVULSA);
            assertThat(totais.get("emAbertoCentavos").asLong()).isEqualTo(valorVencido);
            assertThat(totais.get("vencidoCentavos").asLong()).isEqualTo(valorVencido);
            for (JsonNode i : p.get("itens")) {
                somaDosItens += i.get("valorCentavos").asLong();
                if ("AVULSA".equals(i.get("tipo").asString())) {
                    avulsas++;
                    assertThat(i.get("contratacaoId").isNull()).isTrue();
                    assertThat(i.get("planoNome").isNull()).isTrue();
                    assertThat(i.get("competencia").isNull()).isTrue();
                    assertThat(i.get("descricao").asString()).isEqualTo("Camiseta fictícia");
                }
            }
        }
        assertThat(total).isEqualTo(54);
        assertThat(somaDosItens).isEqualTo(valorVencido + VALOR_DA_AVULSA);
        assertThat(avulsas).isEqualTo(53);

        // O filtro de vencidas dá o mesmo que os inadimplentes.
        JsonNode soVencidas = api.get("/financeiro/cobrancas?situacao=VENCIDA", admin, 200);
        assertThat(soVencidas.get("total").asLong()).isEqualTo(53);
        assertThat(soVencidas.get("totais").get("totalCentavos").asLong()).isEqualTo(valorVencido);
    }
}
