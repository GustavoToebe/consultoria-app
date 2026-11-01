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
 * Filtros do lote 2 em {@code GET /financeiro/cobrancas} e {@code GET /financeiro/lancamentos}: várias situações (VENCIDA
 * calculada), busca pelo aluno, um aluno, plano, forma da baixa (manual ou online), tipo, categoria e busca dos
 * lançamentos, recusas (400 sem repetir o valor, 404 de aluno ou plano de fora) e outra consultoria. Dados fictícios.
 */
@AutoConfigureMockMvc
class CobrancasFiltrosIntegrationTest extends AbstractIntegrationTest {

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

    private String plano(JsonNode quem) throws Exception {
        Map<String, Object> plano = new LinkedHashMap<>();
        plano.put("nome", "Plano " + UUID.randomUUID());
        plano.put("valorCentavos", 10_000);
        plano.put("periodicidade", "PARCELA_UNICA");
        return api.post("/financeiro/planos", quem, plano, 200).get("id").asString();
    }

    /** Aluno com uma contratação de parcela única no plano; devolve a cobrança, com o vencimento escolhido. */
    private JsonNode cobranca(JsonNode quem, String nomeDoAluno, String planoId, LocalDate vencimento) throws Exception {
        String aluno = api.post("/alunos", quem, Map.of("nome", nomeDoAluno), 200).get("id").asString();
        Map<String, Object> contratacao = new LinkedHashMap<>();
        contratacao.put("planoComercialId", planoId);
        contratacao.put("inicio", hoje.toString());
        contratacao.put("diaVencimento", hoje.getDayOfMonth());
        api.post("/alunos/" + aluno + "/contratacoes", quem, contratacao, 200);
        JsonNode c = api.get("/alunos/" + aluno + "/cobrancas", quem, 200).get(0);
        jdbc.update("update cobranca_aluno set vencimento = ?::date where id = ?::uuid", vencimento.toString(),
                c.get("id").asString());
        return api.get("/alunos/" + aluno + "/cobrancas", quem, 200).get(0);
    }

    private List<String> alunos(String consulta) throws Exception {
        List<String> nomes = new ArrayList<>();
        api.get("/financeiro/cobrancas?" + consulta, admin, 200).get("itens").forEach(i -> nomes.add(i.get("alunoNome").asString()));
        return nomes;
    }

    @Test
    void situacoesBuscaAlunoPlanoEForma() throws Exception {
        String p1 = plano(admin);
        String p2 = plano(admin);
        JsonNode vencida = cobranca(admin, "Ana Fictícia", p1, hoje.minusDays(10));
        JsonNode manual = cobranca(admin, "Bruno Fictício", p2, hoje.minusDays(5));
        cobranca(admin, "Carla Fictícia", p1, hoje.plusDays(5));
        JsonNode online = cobranca(admin, "Davi Fictício", p2, hoje.minusDays(3));
        api.post("/cobrancas/" + manual.get("id").asString() + "/baixa-manual", admin,
                Map.of("data", hoje.toString(), "forma", "DINHEIRO", "versao", manual.get("versao").asLong()), 200);
        // Baixa confirmada por um provedor (o caminho real passa pela consulta à InfinitePay; aqui só o resultado).
        jdbc.update("update cobranca_aluno set situacao = 'PAGA', forma = 'PIX', provedor = 'INFINITEPAY', pago_em = ?::date "
                + "where id = ?::uuid", hoje.toString(), online.get("id").asString());

        // Várias situações em OU; VENCIDA = aberta com vencimento antes de hoje; ABERTA inclui as vencidas (das mais antigas).
        assertThat(alunos("situacao=VENCIDA&situacao=PAGA")).containsExactlyInAnyOrder("Ana Fictícia", "Bruno Fictício", "Davi Fictício");
        assertThat(alunos("situacao=ABERTA,VENCIDA")).containsExactly("Ana Fictícia", "Carla Fictícia");
        assertThat(alunos("situacao=VENCIDA")).containsExactly("Ana Fictícia");
        assertThat(alunos("situacao=TODAS")).hasSize(4);
        assertThat(alunos("")).hasSize(4);
        // Busca pelo nome do aluno (sem diferença de caixa) e um aluno só.
        assertThat(alunos("busca=ANA")).containsExactly("Ana Fictícia");
        assertThat(alunos("busca=100%")).isEmpty();
        assertThat(alunos("alunoId=" + vencida.get("alunoId").asString())).containsExactly("Ana Fictícia");
        // Plano da contratação.
        assertThat(alunos("planoId=" + p1)).containsExactlyInAnyOrder("Ana Fictícia", "Carla Fictícia");
        // Forma da baixa: só cobranças com baixa.
        assertThat(alunos("forma=MANUAL")).containsExactly("Bruno Fictício");
        assertThat(alunos("forma=online")).containsExactly("Davi Fictício");
        // E entre filtros.
        assertThat(alunos("planoId=" + p2 + "&situacao=PAGA&forma=MANUAL")).containsExactly("Bruno Fictício");
        assertThat(alunos("planoId=" + p1 + "&forma=MANUAL")).isEmpty();
        assertThat(alunos("situacao=VENCIDA&busca=carla")).isEmpty();
        assertThat(alunos("de=" + hoje.minusDays(6) + "&ate=" + hoje + "&situacao=PAGA")).containsExactlyInAnyOrder("Bruno Fictício", "Davi Fictício");
    }

    @Test
    void recusasEOutraConsultoria() throws Exception {
        String p1 = plano(admin);
        JsonNode daqui = cobranca(admin, "Elisa Fictícia", p1, hoje);
        for (String consulta : List.of("situacao=QUITADA", "forma=BOLETO", "alunoId=abc", "planoId=xyz")) {
            JsonNode erro = api.get("/financeiro/cobrancas?" + consulta, admin, 400);
            assertThat(erro.get("codigo").asString()).as(consulta).isEqualTo("FILTRO_INVALIDO");
            assertThat(erro.toString()).doesNotContain("QUITADA").doesNotContain("BOLETO");
        }
        assertThat(api.get("/financeiro/cobrancas?de=" + hoje + "&ate=" + hoje.minusDays(1), admin, 400).get("codigo").asString())
                .isEqualTo("PERIODO_INVALIDO");
        api.get("/financeiro/cobrancas?alunoId=" + UUID.randomUUID(), admin, 404);
        api.get("/financeiro/cobrancas?planoId=" + UUID.randomUUID(), admin, 404);

        JsonNode outro = api.novoTreinador();
        api.get("/financeiro/cobrancas?alunoId=" + daqui.get("alunoId").asString(), outro, 404);
        api.get("/financeiro/cobrancas?planoId=" + p1, outro, 404);
        assertThat(api.get("/financeiro/cobrancas?busca=elisa&situacao=ABERTA,VENCIDA", outro, 200).get("total").asLong()).isZero();
    }

    private void lancamento(String descricao, String tipo, String categoria) throws Exception {
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("data", hoje.toString());
        corpo.put("descricao", descricao);
        corpo.put("valorCentavos", 5_000);
        corpo.put("tipo", tipo);
        corpo.put("categoria", categoria);
        corpo.put("versao", null);
        api.post("/financeiro/lancamentos", admin, corpo, 200);
    }

    private List<String> descricoes(JsonNode quem, String consulta) throws Exception {
        List<String> nomes = new ArrayList<>();
        api.get("/financeiro/lancamentos?" + consulta, quem, 200).get("itens").forEach(i -> nomes.add(i.get("descricao").asString()));
        return nomes.stream().sorted().toList();
    }

    @Test
    void lancamentosPorTipoCategoriaEBusca() throws Exception {
        lancamento("Aluguel da sala", "SAIDA", "Estrutura");
        lancamento("Halteres novos", "SAIDA", "Equipamento");
        lancamento("Aula avulsa", "ENTRADA", "Aulas");
        lancamento("Consultoria extra", "ENTRADA", null);
        lancamento("Conta de luz", "SAIDA", "Aluguel, luz e água");

        assertThat(descricoes(admin, "tipo=SAIDA")).containsExactly("Aluguel da sala", "Conta de luz", "Halteres novos");
        assertThat(descricoes(admin, "tipo=entrada")).containsExactly("Aula avulsa", "Consultoria extra");
        // Categoria repetível, sem diferença de caixa.
        assertThat(descricoes(admin, "categoria=estrutura&categoria=AULAS")).containsExactly("Aluguel da sala", "Aula avulsa");
        assertThat(descricoes(admin, "busca=ALUGUEL")).containsExactly("Aluguel da sala");
        // Categoria com vírgula não é partida (é texto livre).
        assertThat(descricoes(admin, "categoria=aluguel, luz e água"))
                .containsExactly("Conta de luz");
        assertThat(descricoes(admin, "busca=a&tipo=ENTRADA&categoria=Aulas")).containsExactly("Aula avulsa");
        assertThat(descricoes(admin, "busca=100%")).isEmpty();
        assertThat(api.get("/financeiro/lancamentos/categorias", admin, 200).toString())
                .isEqualTo("[\"Aluguel, luz e água\",\"Aulas\",\"Equipamento\",\"Estrutura\"]");

        JsonNode erro = api.get("/financeiro/lancamentos?tipo=TRANSFERENCIA", admin, 400);
        assertThat(erro.get("codigo").asString()).isEqualTo("FILTRO_INVALIDO");
        assertThat(erro.toString()).doesNotContain("TRANSFERENCIA");

        JsonNode outro = api.novoTreinador();
        assertThat(descricoes(outro, "categoria=Estrutura")).isEmpty();
        assertThat(api.get("/financeiro/lancamentos/categorias", outro, 200)).isEmpty();
    }
}
