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
 * {@code totais} de {@code GET /financeiro/cobrancas}: calculados no servidor sobre o filtro inteiro (não só a página), com
 * cancelada e estornada fora, vencido = aberta antes de hoje (Brasília), em aberto incluindo a vencida, a avulsa (sem contratação)
 * e a mensalidade juntas, os mesmos filtros da lista e isolamento por consultoria. Dados fictícios.
 */
@AutoConfigureMockMvc
class TotaisDeCobrancasIntegrationTest extends AbstractIntegrationTest {

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

    /** Aluno novo com uma cobrança avulsa; devolve o id da cobrança. */
    private String avulsa(JsonNode quem, String nomeDoAluno, long valor, LocalDate vencimento) throws Exception {
        UUID aluno = api.criarAluno(quem, nomeDoAluno);
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("alunoIds", List.of(aluno.toString()));
        corpo.put("descricao", "Avulsa fictícia");
        corpo.put("valorCentavos", valor);
        corpo.put("primeiroVencimento", vencimento.toString());
        corpo.put("parcelas", 1);
        api.post("/financeiro/cobrancas-avulsas", quem, corpo, 201);
        return api.get("/alunos/" + aluno + "/cobrancas", quem, 200).get(0).get("id").asString();
    }

    private void situacao(String cobrancaId, String situacao, LocalDate pagoEm) {
        if (pagoEm == null) {
            jdbc.update("update cobranca_aluno set situacao = ? where id = ?::uuid", situacao, cobrancaId);
        } else {
            jdbc.update("update cobranca_aluno set situacao = ?, forma = 'DINHEIRO', pago_em = ?::date where id = ?::uuid",
                    situacao, pagoEm.toString(), cobrancaId);
        }
    }

    private JsonNode totais(JsonNode quem, String consulta) throws Exception {
        return api.get("/financeiro/cobrancas" + (consulta.isEmpty() ? "" : "?" + consulta), quem, 200).get("totais");
    }

    private static void confere(JsonNode t, long total, long pago, long emAberto, long vencido) {
        assertThat(List.of(t.get("totalCentavos").asLong(), t.get("pagoCentavos").asLong(), t.get("emAbertoCentavos").asLong(),
                t.get("vencidoCentavos").asLong())).containsExactly(total, pago, emAberto, vencido);
    }

    @Test
    void totaisSobreOFiltroInteiroComAvulsaEMensalidadeJuntas() throws Exception {
        avulsa(admin, "Aluno Vencida", 10_000, hoje.minusDays(5));
        avulsa(admin, "Aluno Futura", 25_000, hoje.plusDays(5));
        String paga = avulsa(admin, "Aluno Paga", 40_000, hoje.minusDays(2));
        String cancelada = avulsa(admin, "Aluno Cancelada", 8_000, hoje.minusDays(3));
        String estornada = avulsa(admin, "Aluno Estornada", 7_000, hoje.minusDays(3));
        String contestada = avulsa(admin, "Aluno Contestada", 3_300, hoje.minusDays(2));
        situacao(paga, "PAGA", hoje.minusDays(1));
        situacao(cancelada, "CANCELADA", null);
        situacao(estornada, "ESTORNADA", hoje.minusDays(1));
        situacao(contestada, "CONTESTADA", hoje.minusDays(1));
        String plano = api.post("/financeiro/planos", admin,
                Map.of("nome", "Plano " + UUID.randomUUID(), "valorCentavos", 12_300, "periodicidade", "MENSAL"), 200).get("id").asString();
        UUID alunoPlano = api.criarAluno(admin, "Aluno Mensalidade");
        Map<String, Object> contratacao = new LinkedHashMap<>();
        contratacao.put("planoComercialId", plano);
        contratacao.put("inicio", hoje.toString());
        contratacao.put("diaVencimento", hoje.getDayOfMonth());
        api.post("/alunos/" + alunoPlano + "/contratacoes", admin, contratacao, 200);

        // Sem filtro: cancelada e estornada fora; a contestada entra no total (não no pago nem no em aberto).
        // total = 100 + 250 + 400 + 33 + 123; pago = 400; em aberto = 100 + 250 + 123; vencido = 100.
        confere(totais(admin, ""), 90_600, 40_000, 47_300, 10_000);
        confere(totais(admin, "situacao=TODAS"), 90_600, 40_000, 47_300, 10_000);
        // Situações, com a mesma regra da lista.
        confere(totais(admin, "situacao=VENCIDA"), 10_000, 0, 10_000, 10_000);
        confere(totais(admin, "situacao=ABERTA"), 47_300, 0, 47_300, 10_000);
        confere(totais(admin, "situacao=PAGA"), 40_000, 40_000, 0, 0);
        confere(totais(admin, "situacao=PAGA&situacao=VENCIDA"), 50_000, 40_000, 10_000, 10_000);
        confere(totais(admin, "situacao=CANCELADA"), 0, 0, 0, 0);
        confere(totais(admin, "situacao=ESTORNADA"), 0, 0, 0, 0);
        // Plano da contratação: só a mensalidade (a avulsa não tem plano).
        confere(totais(admin, "planoId=" + plano), 12_300, 0, 12_300, 0);
        // Vencimento, busca pelo aluno, pagamento e forma.
        confere(totais(admin, "de=" + hoje.minusDays(3) + "&ate=" + hoje.minusDays(2)), 43_300, 40_000, 0, 0);
        confere(totais(admin, "busca=Vencida"), 10_000, 0, 10_000, 10_000);
        confere(totais(admin, "pagoDe=" + hoje.minusDays(1) + "&pagoAte=" + hoje.minusDays(1)), 43_300, 40_000, 0, 0);
        confere(totais(admin, "forma=MANUAL"), 43_300, 40_000, 0, 0);
        confere(totais(admin, "busca=nao-existe-ninguem"), 0, 0, 0, 0);

        // A lista segue mostrando as canceladas e estornadas que os totais deixam de fora (a lista é a do filtro).
        JsonNode todas = api.get("/financeiro/cobrancas", admin, 200);
        assertThat(todas.get("total").asLong()).isEqualTo(7);
        assertThat(todas.get("itens")).hasSize(7);
        // E a avulsa aparece junto da mensalidade no join sem contratação.
        List<String> tipos = new ArrayList<>();
        todas.get("itens").forEach(i -> tipos.add(i.get("tipo").asString()));
        assertThat(tipos).contains("AVULSA", "MENSALIDADE");
    }

    @Test
    void totaisCobremTodasAsPaginasENuncaVazamDeOutraConsultoria() throws Exception {
        List<String> alunos = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            alunos.add(api.criarAluno(admin, "Aluno Página " + i + " " + UUID.randomUUID()).toString());
        }
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("alunoIds", alunos);
        corpo.put("descricao", "Parcelada");
        corpo.put("valorCentavos", 100);
        corpo.put("primeiroVencimento", hoje.plusDays(1).toString());
        corpo.put("parcelas", 12);
        api.post("/financeiro/cobrancas-avulsas", admin, corpo, 201);
        JsonNode outro = api.novoTreinador();
        avulsa(outro, "Aluno da Outra", 999_999, hoje.minusDays(10));

        JsonNode primeira = api.get("/financeiro/cobrancas", admin, 200);
        JsonNode segunda = api.get("/financeiro/cobrancas?pagina=1", admin, 200);

        assertThat(primeira.get("total").asLong()).isEqualTo(60);
        assertThat(primeira.get("itens")).hasSize(CobrancaService.TAMANHO_PAGINA);
        assertThat(segunda.get("itens")).hasSize(10);
        // 60 x R$ 1,00 nas duas páginas: o total é do filtro inteiro, não da página.
        confere(primeira.get("totais"), 6_000, 0, 6_000, 0);
        confere(segunda.get("totais"), 6_000, 0, 6_000, 0);
        // Outra consultoria: só o dela; sem cobrança nenhuma os totais são zero (nunca nulos).
        confere(totais(outro, ""), 999_999, 0, 999_999, 999_999);
        confere(totais(api.novoTreinador(), ""), 0, 0, 0, 0);
    }
}
