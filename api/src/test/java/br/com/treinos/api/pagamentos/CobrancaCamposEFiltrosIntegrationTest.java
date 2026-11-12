package br.com.treinos.api.pagamentos;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.Documentos;
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
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Campos novos da cobrança ({@code criadoEm}, {@code idExterno}, {@code alunoCpf}) e os filtros de emissão e de pagamento em
 * {@code GET /financeiro/cobrancas}. O CPF só vai a quem tem {@code ALUNO_SENSIVEL_LER}. Dados fictícios.
 */
@AutoConfigureMockMvc
class CobrancaCamposEFiltrosIntegrationTest extends AbstractIntegrationTest {

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

    private String plano() throws Exception {
        Map<String, Object> plano = new LinkedHashMap<>();
        plano.put("nome", "Plano " + UUID.randomUUID());
        plano.put("valorCentavos", 10_000);
        plano.put("periodicidade", "PARCELA_UNICA");
        return api.post("/financeiro/planos", admin, plano, 200).get("id").asString();
    }

    private JsonNode cobranca(String nome, String cpf, String planoId) throws Exception {
        Map<String, Object> aluno = new LinkedHashMap<>();
        aluno.put("nome", nome);
        if (cpf != null) aluno.put("cpf", cpf);
        String id = api.post("/alunos", admin, aluno, 200).get("id").asString();
        Map<String, Object> contratacao = new LinkedHashMap<>();
        contratacao.put("planoComercialId", planoId);
        contratacao.put("inicio", hoje.toString());
        contratacao.put("diaVencimento", hoje.getDayOfMonth());
        api.post("/alunos/" + id + "/contratacoes", admin, contratacao, 200);
        return api.get("/alunos/" + id + "/cobrancas", admin, 200).get(0);
    }

    private JsonNode membro(String nome, Set<String> permissoes) throws Exception {
        String perfil = api.post("/perfis", admin, Map.of("nome", "Perfil " + nome + UUID.randomUUID(), "permissoes", permissoes), 200)
                .get("id").asString();
        JsonNode convite = api.post("/usuarios/convites", admin,
                Map.of("nome", nome, "email", ApiDeTeste.emailUnico("membro"), "perfilId", perfil), 200);
        return api.post("/publico/convites-equipe/aceitar", null,
                Map.of("codigo", convite.get("codigo").asString(), "senha", ApiDeTeste.SENHA), 200);
    }

    private List<String> nomes(String consulta) throws Exception {
        List<String> nomes = new ArrayList<>();
        api.get("/financeiro/cobrancas?" + consulta, admin, 200).get("itens").forEach(i -> nomes.add(i.get("alunoNome").asString()));
        return nomes;
    }

    @Test
    void camposNovosECpfSoComPermissaoSensivel() throws Exception {
        String cpf = Documentos.cpf();
        JsonNode criada = cobranca("Fabiana Fictícia", cpf, plano());
        cobranca("Gilberto Fictício", null, plano());

        // Tem a permissão: CPF na lista, na ficha do aluno e no detalhe devolvido pela baixa.
        JsonNode daLista = null;
        for (JsonNode i : api.get("/financeiro/cobrancas?busca=fabiana", admin, 200).get("itens")) daLista = i;
        assertThat(daLista.get("alunoCpf").asString()).isEqualTo(cpf);
        assertThat(daLista.get("id").asString()).isEqualTo(criada.get("id").asString());
        assertThat(daLista.get("criadoEm").asString()).isNotBlank();
        assertThat(daLista.get("idExterno").isNull()).isTrue();
        assertThat(daLista.get("competencia").asString()).isNotBlank();
        assertThat(daLista.get("vencimento").asString()).isNotBlank();
        assertThat(criada.get("alunoCpf").asString()).isEqualTo(cpf);
        JsonNode paga = api.post("/cobrancas/" + criada.get("id").asString() + "/baixa-manual", admin,
                Map.of("data", hoje.toString(), "forma", "DINHEIRO", "versao", criada.get("versao").asLong()), 200);
        assertThat(paga.get("alunoCpf").asString()).isEqualTo(cpf);
        assertThat(paga.get("pagoEm").asString()).isEqualTo(hoje.toString());
        // Aluno sem CPF: nulo, não "".
        for (JsonNode i : api.get("/financeiro/cobrancas?busca=gilberto", admin, 200).get("itens")) {
            assertThat(i.get("alunoCpf").isNull()).isTrue();
        }

        // Sem ALUNO_SENSIVEL_LER: nulo em todas as rotas, e o CPF não aparece em lugar nenhum da resposta.
        JsonNode leitor = membro("Leitor financeiro", Set.of("FINANCEIRO_LER", "FINANCEIRO_ALTERAR", "ALUNO_LER"));
        JsonNode lista = api.get("/financeiro/cobrancas?busca=fabiana", leitor, 200);
        assertThat(lista.get("itens").get(0).get("alunoCpf").isNull()).isTrue();
        assertThat(lista.toString()).doesNotContain(cpf).doesNotContain(cpf.replaceAll("\\D", ""));
        JsonNode ficha = api.get("/alunos/" + criada.get("alunoId").asString() + "/cobrancas", leitor, 200);
        assertThat(ficha.toString()).doesNotContain(cpf);
        // O toString do DTO nunca leva o CPF.
        var dto = new PagamentosDtos.CobrancaResponse(UUID.randomUUID(), null, null, "x", "p", hoje, hoje, 1,
                CobrancaAluno.Situacao.ABERTA, false, null, null, "MANUAL", null, null, null, null, null, 0L, null, null, cpf);
        assertThat(dto.toString()).doesNotContain(cpf);
    }

    @Test
    void filtrosDeEmissaoEDePagamento() throws Exception {
        String plano = plano();
        JsonNode paga = cobranca("Helena Fictícia", null, plano);
        JsonNode antiga = cobranca("Igor Fictício", null, plano);
        JsonNode aberta = cobranca("Julia Fictícia", null, plano);
        api.post("/cobrancas/" + paga.get("id").asString() + "/baixa-manual", admin,
                Map.of("data", hoje.minusDays(3).toString(), "forma", "PIX_DIRETO", "versao", paga.get("versao").asLong()), 200);
        // A emissão é o criado_em: uma cobrança gerada há 10 dias (Brasília).
        jdbc.update("update cobranca_aluno set criado_em = (?::date - 10)::timestamp at time zone 'America/Sao_Paulo' + interval '12 hours' "
                + "where id = ?::uuid", hoje.toString(), antiga.get("id").asString());

        // Emissão por dia de Brasília, pontas incluídas.
        assertThat(nomes("emissaoDe=" + hoje)).containsExactlyInAnyOrder("Helena Fictícia", "Julia Fictícia");
        assertThat(nomes("emissaoDe=" + hoje.minusDays(10) + "&emissaoAte=" + hoje.minusDays(10))).containsExactly("Igor Fictício");
        assertThat(nomes("emissaoAte=" + hoje.minusDays(1))).containsExactly("Igor Fictício");
        assertThat(nomes("emissaoDe=" + hoje.plusDays(1))).isEmpty();
        // Pagamento (data da baixa): só cobranças com baixa.
        assertThat(nomes("pagoDe=" + hoje.minusDays(4) + "&pagoAte=" + hoje.minusDays(2))).containsExactly("Helena Fictícia");
        assertThat(nomes("pagoDe=" + hoje.minusDays(2))).isEmpty();
        assertThat(nomes("pagoAte=" + hoje)).containsExactly("Helena Fictícia");
        // E entre filtros, e com os que já existiam.
        assertThat(nomes("emissaoDe=" + hoje + "&pagoAte=" + hoje + "&situacao=PAGA")).containsExactly("Helena Fictícia");
        assertThat(nomes("emissaoAte=" + hoje.minusDays(1) + "&pagoAte=" + hoje)).isEmpty();
        assertThat(nomes("")).hasSize(3);
        // Pontas absurdas não estouram.
        assertThat(nomes("emissaoDe=0001-01-01&emissaoAte=9999-12-31")).hasSize(3);

        // Recusas: fim antes do início.
        assertThat(api.get("/financeiro/cobrancas?emissaoDe=" + hoje + "&emissaoAte=" + hoje.minusDays(1), admin, 400)
                .get("codigo").asString()).isEqualTo("PERIODO_INVALIDO");
        assertThat(api.get("/financeiro/cobrancas?pagoDe=" + hoje + "&pagoAte=" + hoje.minusDays(1), admin, 400)
                .get("codigo").asString()).isEqualTo("PERIODO_INVALIDO");
        api.get("/financeiro/cobrancas?emissaoDe=ontem", admin, 400);

        // Outra consultoria não vê nada.
        JsonNode outro = api.novoTreinador();
        assertThat(api.get("/financeiro/cobrancas?emissaoDe=" + hoje + "&pagoAte=" + hoje, outro, 200).get("total").asLong()).isZero();
        assertThat(aberta.get("id").asString()).isNotBlank();
    }
}
