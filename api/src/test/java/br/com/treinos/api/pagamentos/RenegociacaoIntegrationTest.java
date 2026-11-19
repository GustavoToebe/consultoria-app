package br.com.treinos.api.pagamentos;

import br.com.plataforma.comum.auth.EnviadorDeEmail;
import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.EmailDeTeste;
import br.com.treinos.api.pagamentos.provedor.InfinitePayFalsa;
import br.com.treinos.api.web.Fuso;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Renegociar cobranças (D14, V094): a prévia é o confirmar sem gravar; a conta (soma lida no banco, sobra dos centavos na última, dia 31);
 * só ABERTAS (vencidas incluídas) do mesmo aluno, MENSALIDADE ou AVULSA; as recusas e os códigos; 422 por campo; idempotência por
 * {@code pedidoId} (200 com o mesmo corpo, também depois de desfeito, e a corrida); totais, lista, inadimplentes e painel sem a original
 * renegociada; desfazer e seus 409; baixa, link, inativar, lembretes, competência não gerada de novo, auditoria sem dado e exportação.
 * Dados fictícios; cada teste cria a própria consultoria.
 */
@AutoConfigureMockMvc
class RenegociacaoIntegrationTest extends AbstractIntegrationTest {

    private static final InfinitePayFalsa FALSA = new InfinitePayFalsa();
    private static final String MOTIVO = "Combinado no WhatsApp com Fulana Sigilosa";

    @DynamicPropertySource
    static void apontarParaAFalsa(DynamicPropertyRegistry registry) {
        registry.add("treinos.pagamentos.infinitepay.api-url", FALSA::url);
        registry.add("treinos.app-url", () -> "https://app.teste.local");
    }

    @AfterAll
    static void desligarAFalsa() {
        FALSA.close();
    }

    @AfterEach
    void conferirAFalsa() {
        assertThat(FALSA.violacoes()).as("a API real recusaria algum pedido").isEmpty();
    }

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private RotinaDeGeracaoDeCobrancas rotina;
    @Autowired private LembretesDeCobranca job;
    @Autowired private EnviadorDeEmail enviador;
    @Autowired private PlatformTransactionManager transacoes;

    private final LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
    private final LocalDate primeiro = hoje.plusDays(10);
    private ApiDeTeste api;
    private JsonNode admin;
    private int sequencia;

    @BeforeEach
    void preparar() throws Exception {
        FALSA.reiniciar();
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
    }

    // ---- ajudantes ----

    private UUID aluno() throws Exception {
        return api.criarAluno(admin, "Aluno Renegocia " + UUID.randomUUID());
    }

    private List<JsonNode> cobrancasDe(UUID aluno) throws Exception {
        List<JsonNode> lista = new ArrayList<>();
        api.get("/alunos/" + aluno + "/cobrancas", admin, 200).forEach(lista::add);
        return lista;
    }

    private JsonNode atual(UUID aluno, String id) throws Exception {
        return cobrancasDe(aluno).stream().filter(c -> c.get("id").asString().equals(id)).findFirst().orElseThrow();
    }

    private JsonNode atual(JsonNode c) throws Exception {
        return atual(UUID.fromString(c.get("alunoId").asString()), c.get("id").asString());
    }

    /** Avulsa de uma parcela, e a cobrança criada. */
    private JsonNode avulsa(UUID aluno, long valor, LocalDate vencimento) throws Exception {
        String descricao = "Avulsa fictícia " + (++sequencia);
        api.post("/financeiro/cobrancas-avulsas", admin, Map.of("pedidoId", UUID.randomUUID().toString(),
                "alunoIds", List.of(aluno.toString()), "descricao", descricao, "valorCentavos", valor,
                "primeiroVencimento", vencimento.toString(), "parcelas", 1), 201);
        return cobrancasDe(aluno).stream().filter(c -> descricao.equals(c.get("descricao").asString())).findFirst().orElseThrow();
    }

    /** Contratação mensal que começa hoje: a primeira mensalidade vence hoje. Devolve a contratação. */
    private JsonNode contratar(UUID aluno, long valor) throws Exception {
        JsonNode plano = api.post("/financeiro/planos", admin, Map.of("nome", "Plano renegocia " + UUID.randomUUID(),
                "valorCentavos", valor, "periodicidade", "MENSAL"), 200);
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("planoComercialId", plano.get("id").asString());
        corpo.put("inicio", hoje.toString());
        corpo.put("diaVencimento", hoje.getDayOfMonth());
        return api.post("/alunos/" + aluno + "/contratacoes", admin, corpo, 200);
    }

    private JsonNode doTipo(UUID aluno, String tipo) throws Exception {
        return cobrancasDe(aluno).stream().filter(c -> tipo.equals(c.get("tipo").asString())).findFirst().orElseThrow();
    }

    private static Map<String, Object> item(JsonNode c) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("cobrancaId", c.get("id").asString());
        m.put("versao", c.get("versao").asLong());
        return m;
    }

    private Map<String, Object> previa(List<JsonNode> originais, long acrescimo, long desconto, int parcelas, LocalDate primeiroVencimento) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("itens", originais.stream().map(RenegociacaoIntegrationTest::item).toList());
        m.put("acrescimoCentavos", acrescimo);
        m.put("descontoCentavos", desconto);
        m.put("parcelas", parcelas);
        m.put("primeiroVencimento", primeiroVencimento.toString());
        return m;
    }

    private Map<String, Object> confirmar(Map<String, Object> previa, UUID pedido) {
        Map<String, Object> m = new LinkedHashMap<>(previa);
        m.put("pedidoId", pedido.toString());
        m.put("motivo", MOTIVO);
        return m;
    }

    private JsonNode renegociar(List<JsonNode> originais, long acrescimo, long desconto, int parcelas) throws Exception {
        return api.post("/cobrancas/renegociar", admin,
                confirmar(previa(originais, acrescimo, desconto, parcelas, primeiro), UUID.randomUUID()), 201);
    }

    private static String codigo(JsonNode erro) {
        return erro.get("codigo").asString();
    }

    private List<String> campos(JsonNode erro) {
        List<String> campos = new ArrayList<>();
        erro.get("fieldErrors").forEach(f -> campos.add(f.get("field").asString()));
        return campos;
    }

    private int contar(String sql, Object... args) {
        Integer n = jdbc.queryForObject(sql, Integer.class, args);
        return n == null ? 0 : n;
    }

    private UUID consultoria() {
        return jdbc.queryForObject("select consultoria_id from usuario where id = ?::uuid", UUID.class, admin.get("usuario").get("id").asString());
    }

    /** Acordos da consultoria do teste (o banco é dividido com os outros testes: nada de contagem global). */
    private int acordos(String condicao) {
        return contar("select count(*) from acordo_de_cobranca where consultoria_id = ? and " + condicao, consultoria());
    }

    private int auditorias(String acao) {
        return contar("select count(*) from auditoria where acao = ? and consultoria_id = (select consultoria_id from usuario where id = ?::uuid)",
                acao, admin.get("usuario").get("id").asString());
    }

    private JsonNode membro(String nome, Set<String> permissoes) throws Exception {
        String perfil = api.post("/perfis", admin, Map.of("nome", "Perfil " + nome + UUID.randomUUID(), "permissoes", permissoes), 200)
                .get("id").asString();
        JsonNode convite = api.post("/usuarios/convites", admin,
                Map.of("nome", nome, "email", ApiDeTeste.emailUnico("membro"), "perfilId", perfil), 200);
        return api.post("/publico/convites-equipe/aceitar", null,
                Map.of("codigo", convite.get("codigo").asString(), "senha", ApiDeTeste.SENHA), 200);
    }

    // ---- prévia e conta ----

    @Test
    void previaEOConfirmarSemGravar_mesmosNumerosENadaMuda() throws Exception {
        UUID a = aluno();
        JsonNode vencida = avulsa(a, 10_000, hoje.minusDays(5));
        contratar(a, 20_000);
        JsonNode mensalidade = doTipo(a, "MENSALIDADE");
        List<JsonNode> originais = List.of(vencida, mensalidade);
        Map<String, Object> corpo = previa(originais, 500, 200, 3, primeiro);
        int cobrancasAntes = contar("select count(*) from cobranca_aluno where aluno_id = ?", a);

        JsonNode p = api.post("/cobrancas/renegociar/previa", admin, corpo, 200);

        assertThat(p.get("alunoId").asString()).isEqualTo(a.toString());
        assertThat(p.get("quantidadeDeOriginais").asInt()).isEqualTo(2);
        assertThat(p.get("somaDosOriginaisCentavos").asLong()).isEqualTo(30_000);
        assertThat(p.get("acrescimoCentavos").asLong()).isEqualTo(500);
        assertThat(p.get("descontoCentavos").asLong()).isEqualTo(200);
        assertThat(p.get("totalCentavos").asLong()).isEqualTo(30_300);
        assertThat(p.get("parcelas")).hasSize(3);
        // Só leitura: nada gravado, nada auditado, as originais seguem abertas e na mesma versão.
        assertThat(contar("select count(*) from cobranca_aluno where aluno_id = ?", a)).isEqualTo(cobrancasAntes);
        assertThat(acordos("true")).isZero();
        assertThat(auditorias("COBRANCAS_RENEGOCIADAS")).isZero();
        for (JsonNode o : originais) {
            assertThat(atual(o).get("situacao").asString()).isEqualTo("ABERTA");
            assertThat(atual(o).get("versao").asLong()).isEqualTo(o.get("versao").asLong());
        }

        JsonNode r = api.post("/cobrancas/renegociar", admin, confirmar(corpo, UUID.randomUUID()), 201);

        assertThat(r.get("renegociadas").asInt()).isEqualTo(2);
        assertThat(r.get("parcelas").asInt()).isEqualTo(3);
        assertThat(r.get("totalCentavos").asLong()).isEqualTo(p.get("totalCentavos").asLong());
        String acordo = r.get("acordoId").asString();
        List<JsonNode> parcelas = cobrancasDe(a).stream().filter(c -> "RENEGOCIACAO".equals(c.get("tipo").asString())).toList();
        assertThat(parcelas).hasSize(3);
        for (JsonNode parcela : p.get("parcelas")) {
            JsonNode gravada = parcelas.stream().filter(c -> c.get("vencimento").asString().equals(parcela.get("vencimento").asString()))
                    .findFirst().orElseThrow();
            assertThat(gravada.get("valorCentavos").asLong()).isEqualTo(parcela.get("valorCentavos").asLong());
            assertThat(gravada.get("descricao").asString()).isEqualTo(parcela.get("descricao").asString());
            assertThat(gravada.get("acordoId").asString()).isEqualTo(acordo);
            assertThat(gravada.get("situacao").asString()).isEqualTo("ABERTA");
            assertThat(gravada.get("contratacaoId").isNull()).isTrue();
            assertThat(gravada.get("competencia").isNull()).isTrue();
            // As parcelas nascem sem o motivo nem observação.
            assertThat(gravada.get("motivo").isNull()).isTrue();
            assertThat(gravada.get("observacao").isNull()).isTrue();
        }
        for (JsonNode o : originais) {
            JsonNode depois = atual(o);
            assertThat(depois.get("situacao").asString()).isEqualTo("RENEGOCIADA");
            assertThat(depois.get("acordoId").asString()).isEqualTo(acordo);
            assertThat(depois.get("motivo").asString()).isEqualTo(MOTIVO);
            assertThat(depois.get("versao").asLong()).isEqualTo(o.get("versao").asLong() + 1);
            assertThat(depois.get("vencida").asBoolean()).isFalse();
        }
        assertThat(auditorias("COBRANCAS_RENEGOCIADAS")).isEqualTo(1);
    }

    @Test
    void contaComSobraDeCentavosNaUltimaEVencimentosPresosAoFimDoMes() throws Exception {
        UUID a = aluno();
        JsonNode c = avulsa(a, 10_001, hoje.plusDays(3));

        // 10.001 / 3 = 3.333 e a sobra (2) na última.
        JsonNode tres = api.post("/cobrancas/renegociar/previa", admin, previa(List.of(c), 0, 0, 3, primeiro), 200);
        assertThat(tres.get("parcelas").get(0).get("valorCentavos").asLong()).isEqualTo(3_333);
        assertThat(tres.get("parcelas").get(1).get("valorCentavos").asLong()).isEqualTo(3_333);
        assertThat(tres.get("parcelas").get(2).get("valorCentavos").asLong()).isEqualTo(3_335);
        assertThat(tres.get("parcelas").get(0).get("descricao").asString()).isEqualTo("Renegociação (Parcela 1/3)");
        assertThat(tres.get("parcelas").get(2).get("descricao").asString()).isEqualTo("Renegociação (Parcela 3/3)");
        assertThat(tres.get("parcelas").get(2).get("numero").asInt()).isEqualTo(3);
        // Uma parcela só: descrição sem "Parcela".
        assertThat(api.post("/cobrancas/renegociar/previa", admin, previa(List.of(c), 0, 0, 1, primeiro), 200)
                .get("parcelas").get(0).get("descricao").asString()).isEqualTo("Renegociação");

        // Dia 31: cada vencimento parte do primeiro (nunca encadeia), preso ao último dia do mês curto. 2028 é bissexto.
        int ano = hoje.getYear() + 1;
        JsonNode dia31 = api.post("/cobrancas/renegociar/previa", admin, previa(List.of(c), 0, 0, 5, LocalDate.of(ano, 1, 31)), 200);
        assertThat(datas(dia31)).containsExactly(LocalDate.of(ano, 1, 31).toString(),
                LocalDate.of(ano, 2, 1).withDayOfMonth(LocalDate.of(ano, 2, 1).lengthOfMonth()).toString(),
                LocalDate.of(ano, 3, 31).toString(), LocalDate.of(ano, 4, 30).toString(), LocalDate.of(ano, 5, 31).toString());
        JsonNode bissexto = api.post("/cobrancas/renegociar/previa", admin, previa(List.of(c), 0, 0, 2, LocalDate.of(2028, 1, 30)), 200);
        assertThat(datas(bissexto)).containsExactly("2028-01-30", "2028-02-29");

        // Acréscimo e desconto: 10.001 + 500 - 201 = 10.300 em 4 parcelas iguais de 2.575.
        JsonNode ajustada = api.post("/cobrancas/renegociar/previa", admin, previa(List.of(c), 500, 201, 4, primeiro), 200);
        assertThat(ajustada.get("totalCentavos").asLong()).isEqualTo(10_300);
        ajustada.get("parcelas").forEach(p -> assertThat(p.get("valorCentavos").asLong()).isEqualTo(2_575));
    }

    private List<String> datas(JsonNode previa) {
        List<String> datas = new ArrayList<>();
        previa.get("parcelas").forEach(p -> datas.add(p.get("vencimento").asString()));
        return datas;
    }

    @Test
    void oValorDoCorpoNuncaEASomaDasOriginais() throws Exception {
        UUID a = aluno();
        JsonNode c = avulsa(a, 7_000, hoje.plusDays(3));
        Map<String, Object> corpo = previa(List.of(c), 0, 0, 1, primeiro);
        corpo.put("somaDosOriginaisCentavos", 1);
        corpo.put("totalCentavos", 1);
        corpo.put("valorCentavos", 1);

        JsonNode p = api.post("/cobrancas/renegociar/previa", admin, corpo, 200);

        assertThat(p.get("somaDosOriginaisCentavos").asLong()).isEqualTo(7_000);
        assertThat(p.get("totalCentavos").asLong()).isEqualTo(7_000);
    }

    // ---- elegibilidade e recusas ----

    @Test
    void soAbertasDoMesmoAlunoMensalidadeOuAvulsaEInelegiveisRecusados() throws Exception {
        UUID a = aluno();
        JsonNode boa = avulsa(a, 1_000, hoje.plusDays(2));
        JsonNode paga = avulsa(a, 1_000, hoje.plusDays(2));
        paga = api.post("/cobrancas/" + paga.get("id").asString() + "/baixa-manual", admin,
                Map.of("data", hoje.toString(), "forma", "DINHEIRO", "versao", paga.get("versao").asLong()), 200);
        JsonNode cancelada = avulsa(a, 1_000, hoje.plusDays(2));
        cancelada = api.post("/cobrancas/" + cancelada.get("id").asString() + "/cancelar", admin,
                Map.of("motivo", "Engano", "versao", cancelada.get("versao").asLong()), 200);

        assertThat(codigo(api.post("/cobrancas/renegociar/previa", admin, previa(List.of(boa, paga), 0, 0, 1, primeiro), 409)))
                .isEqualTo("COBRANCA_NAO_ABERTA");
        assertThat(codigo(api.post("/cobrancas/renegociar/previa", admin, previa(List.of(boa, cancelada), 0, 0, 1, primeiro), 409)))
                .isEqualTo("COBRANCA_NAO_ABERTA");

        // Saída (encerrar a contratação com valor definido) e parcela de acordo não se renegociam.
        UUID b = aluno();
        JsonNode contratacao = contratar(b, 9_000);
        api.post("/contratacoes/" + contratacao.get("id").asString() + "/encerrar", admin, Map.of("versao", contratacao.get("versao").asLong(),
                "saida", Map.of("opcao", "OUTRO", "valorCentavos", 5_000, "vencimento", hoje.plusDays(1).toString())), 200);
        JsonNode saida = doTipo(b, "SAIDA");
        assertThat(saida.get("situacao").asString()).isEqualTo("ABERTA");
        assertThat(codigo(api.post("/cobrancas/renegociar/previa", admin, previa(List.of(saida), 0, 0, 1, primeiro), 409)))
                .isEqualTo("COBRANCA_NAO_RENEGOCIAVEL");

        UUID c = aluno();
        JsonNode original = avulsa(c, 3_000, hoje.plusDays(2));
        renegociar(List.of(original), 0, 0, 2);
        JsonNode parcela = doTipo(c, "RENEGOCIACAO");
        assertThat(codigo(api.post("/cobrancas/renegociar/previa", admin, previa(List.of(parcela), 0, 0, 1, primeiro), 409)))
                .isEqualTo("COBRANCA_NAO_RENEGOCIAVEL");
        // A original já renegociada não está mais aberta.
        assertThat(codigo(api.post("/cobrancas/renegociar", admin, confirmar(previa(List.of(original), 0, 0, 1, primeiro), UUID.randomUUID()), 409)))
                .isEqualTo("COBRANCA_NAO_ABERTA");
    }

    @Test
    void alunosDiferentesDao409SemMudarNada() throws Exception {
        JsonNode deUm = avulsa(aluno(), 1_000, hoje.plusDays(2));
        JsonNode deOutro = avulsa(aluno(), 1_000, hoje.plusDays(2));

        JsonNode erro = api.post("/cobrancas/renegociar", admin,
                confirmar(previa(List.of(deUm, deOutro), 0, 0, 1, primeiro), UUID.randomUUID()), 409);

        assertThat(codigo(erro)).isEqualTo("COBRANCAS_DE_ALUNOS_DIFERENTES");
        assertThat(atual(deUm).get("situacao").asString()).isEqualTo("ABERTA");
        assertThat(acordos("true")).isZero();
    }

    @Test
    void cobrancaDeOutraConsultoriaOuInexistenteDa404SemRevelar() throws Exception {
        UUID a = aluno();
        JsonNode minha = avulsa(a, 1_000, hoje.plusDays(2));
        JsonNode outro = api.novoTreinador();
        UUID alunoDeFora = api.criarAluno(outro, "Aluno De Fora " + UUID.randomUUID());
        api.post("/financeiro/cobrancas-avulsas", outro, Map.of("pedidoId", UUID.randomUUID().toString(), "alunoIds", List.of(alunoDeFora.toString()),
                "descricao", "De fora", "valorCentavos", 1_000, "primeiroVencimento", hoje.plusDays(2).toString(), "parcelas", 1), 201);
        JsonNode deFora = api.get("/alunos/" + alunoDeFora + "/cobrancas", outro, 200).get(0);
        Map<String, Object> inexistente = Map.of("cobrancaId", UUID.randomUUID().toString(), "versao", 0);

        for (Map<String, Object> estranho : List.of(item(deFora), inexistente)) {
            Map<String, Object> corpo = previa(List.of(minha), 0, 0, 1, primeiro);
            corpo.put("itens", List.of(item(minha), estranho));
            assertThat(codigo(api.post("/cobrancas/renegociar/previa", admin, corpo, 404))).isEqualTo("COBRANCA_NAO_ENCONTRADA");
            assertThat(api.post("/cobrancas/renegociar", admin, confirmar(corpo, UUID.randomUUID()), 404).toString())
                    .doesNotContain(deFora.get("id").asString());
        }
        assertThat(atual(minha).get("situacao").asString()).isEqualTo("ABERTA");
        // O acordo de outra consultoria também não existe para quem pede.
        UUID acordoDeFora = UUID.fromString(api.post("/cobrancas/renegociar", outro, confirmar(previa(List.of(deFora), 0, 0, 1, primeiro),
                UUID.randomUUID()), 201).get("acordoId").asString());
        api.post("/cobrancas/acordos/" + acordoDeFora + "/desfazer", admin, Map.of("motivo", "Quero ver"), 404);
        api.post("/cobrancas/acordos/" + UUID.randomUUID() + "/desfazer", admin, Map.of("motivo", "Não existe"), 404);
        assertThat(acordos("desfeito_em is not null")).isZero();
    }

    @Test
    void versaoVelhaDa409EONadaOuTudoNaoGravaNada() throws Exception {
        UUID a = aluno();
        JsonNode um = avulsa(a, 1_000, hoje.plusDays(2));
        JsonNode dois = avulsa(a, 2_000, hoje.plusDays(2));
        Map<String, Object> velha = item(dois);
        velha.put("versao", dois.get("versao").asLong() + 1);
        Map<String, Object> corpo = previa(List.of(um, dois), 0, 0, 2, primeiro);
        corpo.put("itens", List.of(item(um), velha));

        assertThat(codigo(api.post("/cobrancas/renegociar", admin, confirmar(corpo, UUID.randomUUID()), 409))).isEqualTo("CONFLITO_EDICAO");
        assertThat(codigo(api.post("/cobrancas/renegociar/previa", admin, corpo, 409))).isEqualTo("CONFLITO_EDICAO");

        assertThat(atual(um).get("situacao").asString()).isEqualTo("ABERTA");
        assertThat(atual(um).get("versao").asLong()).isEqualTo(um.get("versao").asLong());
        assertThat(acordos("true")).isZero();
        assertThat(contar("select count(*) from cobranca_aluno where consultoria_id = ? and tipo = 'RENEGOCIACAO'", consultoria())).isZero();
    }

    @Test
    void erro422PorCampoSemRepetirValorNemTextoEMotivoObrigatorioSoNoConfirmar() throws Exception {
        UUID a = aluno();
        JsonNode c = avulsa(a, 5_000, hoje.plusDays(2));
        String repetido = c.get("id").asString();

        // Prévia: sem pedido nem motivo, só os campos da conta.
        assertThat(campos(api.post("/cobrancas/renegociar/previa", admin, Map.of("itens", List.of(), "acrescimoCentavos", -1,
                "descontoCentavos", 1_000_000_001L, "parcelas", 13, "primeiroVencimento", "1999-12-31"), 422)))
                .containsExactlyInAnyOrder("itens", "acrescimoCentavos", "descontoCentavos", "parcelas", "primeiroVencimento");
        Map<String, Object> vazio = new LinkedHashMap<>();
        JsonNode semNada = api.post("/cobrancas/renegociar/previa", admin, vazio, 422);
        assertThat(codigo(semNada)).isEqualTo("RENEGOCIACAO_INVALIDA");
        assertThat(campos(semNada)).containsExactlyInAnyOrder("itens", "acrescimoCentavos", "descontoCentavos", "parcelas", "primeiroVencimento");
        // Itens: repetido, 101 e item sem versão.
        Map<String, Object> dobrado = previa(List.of(c, c), 0, 0, 1, primeiro);
        assertThat(campos(api.post("/cobrancas/renegociar/previa", admin, dobrado, 422))).containsExactly("itens");
        List<Map<String, Object>> muitos = new ArrayList<>();
        for (int i = 0; i < 101; i++) {
            muitos.add(Map.of("cobrancaId", UUID.randomUUID().toString(), "versao", 0));
        }
        Map<String, Object> demais = previa(List.of(c), 0, 0, 1, primeiro);
        demais.put("itens", muitos);
        assertThat(campos(api.post("/cobrancas/renegociar/previa", admin, demais, 422))).containsExactly("itens");
        Map<String, Object> semVersao = previa(List.of(c), 0, 0, 1, primeiro);
        semVersao.put("itens", List.of(Map.of("cobrancaId", repetido)));
        assertThat(campos(api.post("/cobrancas/renegociar/previa", admin, semVersao, 422))).containsExactly("itens[0]");
        // Parcelas 0 e data fora da faixa de planejamento.
        assertThat(campos(api.post("/cobrancas/renegociar/previa", admin, previa(List.of(c), 0, 0, 0, primeiro), 422))).containsExactly("parcelas");
        assertThat(campos(api.post("/cobrancas/renegociar/previa", admin, previa(List.of(c), 0, 0, 1, LocalDate.of(1999, 1, 1)), 422)))
                .containsExactly("primeiroVencimento");
        // O desconto não pode zerar o total (cada parcela fica com 1 centavo ou mais).
        assertThat(campos(api.post("/cobrancas/renegociar/previa", admin, previa(List.of(c), 0, 5_000, 1, primeiro), 422)))
                .containsExactly("descontoCentavos");
        assertThat(campos(api.post("/cobrancas/renegociar/previa", admin, previa(List.of(c), 0, 4_998, 3, primeiro), 422)))
                .containsExactly("descontoCentavos");
        api.post("/cobrancas/renegociar/previa", admin, previa(List.of(c), 0, 4_997, 3, primeiro), 200);

        // Confirmar: pedido e motivo (vazio e 301 caracteres depois do strip).
        Map<String, Object> semPedido = confirmar(previa(List.of(c), 0, 0, 1, primeiro), UUID.randomUUID());
        semPedido.remove("pedidoId");
        assertThat(campos(api.post("/cobrancas/renegociar", admin, semPedido, 422))).containsExactly("pedidoId");
        for (String motivo : List.of("   ", "x".repeat(301), "  " + "y".repeat(301) + "  ")) {
            Map<String, Object> corpo = confirmar(previa(List.of(c), 0, 0, 1, primeiro), UUID.randomUUID());
            corpo.put("motivo", motivo);
            JsonNode erro = api.post("/cobrancas/renegociar", admin, corpo, 422);
            assertThat(campos(erro)).containsExactly("motivo");
            if (!motivo.isBlank()) {
                assertThat(erro.toString()).doesNotContain(motivo.strip());
            }
        }
        // 300 depois do strip passa.
        Map<String, Object> limite = confirmar(previa(List.of(c), 0, 0, 1, primeiro), UUID.randomUUID());
        limite.put("motivo", "  " + "z".repeat(300) + "  ");
        api.post("/cobrancas/renegociar", admin, limite, 201);
        assertThat(atual(c).get("motivo").asString()).hasSize(300);
    }

    // ---- idempotência ----

    @Test
    void mesmoPedidoDevolve200ComOMesmoCorpoSemGravarNemAuditarMesmoDepoisDeDesfeitoOuComOAlunoInativo() throws Exception {
        UUID a = aluno();
        JsonNode um = avulsa(a, 1_000, hoje.plusDays(2));
        JsonNode dois = avulsa(a, 2_001, hoje.plusDays(2));
        UUID pedido = UUID.randomUUID();
        Map<String, Object> corpo = confirmar(previa(List.of(um, dois), 0, 0, 3, primeiro), pedido);

        JsonNode primeira = api.post("/cobrancas/renegociar", admin, corpo, 201);
        int cobrancas = contar("select count(*) from cobranca_aluno where aluno_id = ?", a);
        JsonNode segunda = api.post("/cobrancas/renegociar", admin, corpo, 200);

        assertThat(segunda).isEqualTo(primeira);
        assertThat(contar("select count(*) from cobranca_aluno where aluno_id = ?", a)).isEqualTo(cobrancas);
        assertThat(acordos("true")).isEqualTo(1);
        assertThat(auditorias("COBRANCAS_RENEGOCIADAS")).isEqualTo(1);
        // Com o corpo velho (versões que já não valem) e até com outro corpo: nada de reconferir situação nem versão.
        assertThat(api.post("/cobrancas/renegociar", admin, confirmar(previa(List.of(um), 9, 0, 1, primeiro), pedido), 200)).isEqualTo(primeira);

        // Desfeito, o mesmo pedido ainda devolve o corpo de antes (as contagens ficam no acordo) e não refaz o acordo.
        api.post("/cobrancas/acordos/" + primeira.get("acordoId").asString() + "/desfazer", admin, Map.of("motivo", "Voltou atrás"), 200);
        assertThat(api.post("/cobrancas/renegociar", admin, corpo, 200)).isEqualTo(primeira);
        assertThat(acordos("true")).isEqualTo(1);
        // Pedido novo com as mesmas originais, agora reabertas: gera outro acordo.
        JsonNode nova = api.post("/cobrancas/renegociar", admin,
                confirmar(previa(List.of(atual(um), atual(dois)), 0, 0, 1, primeiro), UUID.randomUUID()), 201);
        assertThat(nova.get("acordoId").asString()).isNotEqualTo(primeira.get("acordoId").asString());

        // Aluno inativo depois: o pedido repetido segue respondendo.
        api.patch("/alunos/" + a + "/situacao", admin, Map.of("ativo", false), 200);
        assertThat(api.post("/cobrancas/renegociar", admin, corpo, 200)).isEqualTo(primeira);
    }

    @Test
    void duasChamadasSimultaneasDoMesmoPedidoGeramUmAcordoSoEAsDuasRespondemSemErro() throws Exception {
        UUID a = aluno();
        JsonNode c = avulsa(a, 4_000, hoje.plusDays(2));
        String texto = json.writeValueAsString(confirmar(previa(List.of(c), 0, 0, 2, primeiro), UUID.randomUUID()));
        CountDownLatch largada = new CountDownLatch(1);
        Callable<int[]> chamada = () -> {
            largada.await();
            var r = mvc.perform(MockMvcRequestBuilders.post("/cobrancas/renegociar").header("X-Treinos-Cliente", "nativo")
                            .header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(admin))
                            .contentType(MediaType.APPLICATION_JSON).content(texto))
                    .andReturn().getResponse();
            JsonNode corpoDaResposta = json.readTree(r.getContentAsString(StandardCharsets.UTF_8));
            return new int[] {r.getStatus(), corpoDaResposta.get("renegociadas").asInt(), corpoDaResposta.get("parcelas").asInt()};
        };
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Future<int[]> um = pool.submit(chamada);
            Future<int[]> dois = pool.submit(chamada);
            largada.countDown();
            List<int[]> respostas = new ArrayList<>(List.of(um.get(), dois.get()));
            assertThat(respostas).extracting(r -> r[0]).containsExactlyInAnyOrder(201, 200);
            assertThat(respostas).allSatisfy(r -> {
                assertThat(r[1]).isEqualTo(1);
                assertThat(r[2]).isEqualTo(2);
            });
        } finally {
            pool.shutdownNow();
        }
        assertThat(contar("select count(*) from cobranca_aluno where aluno_id = ? and tipo = 'RENEGOCIACAO'", a)).isEqualTo(2);
        assertThat(auditorias("COBRANCAS_RENEGOCIADAS")).isEqualTo(1);
    }

    @Test
    void mesmoPedidoDeOutroAlunoNaCorridaDa409ConflitoEdicaoEnaoEstouraOIndiceComo500() throws Exception {
        UUID a = aluno();
        UUID b = aluno();
        JsonNode c = avulsa(a, 4_000, hoje.plusDays(2));
        UUID pedido = UUID.randomUUID();
        UUID acordoDeB = UUID.randomUUID();
        String texto = json.writeValueAsString(confirmar(previa(List.of(c), 0, 0, 2, primeiro), pedido));
        ExecutorService pool = Executors.newSingleThreadExecutor();
        try {
            // O acordo do aluno B com o mesmo pedido, gravado mas ainda não confirmado: a checagem do serviço não o enxerga e o
            // insert do aluno A espera pelo índice único. Só então o de B é confirmado, e o insert de A viola o índice.
            List<Future<int[]>> chamada = new ArrayList<>();
            new TransactionTemplate(transacoes).executeWithoutResult(status -> {
                jdbc.update("insert into acordo_de_cobranca (id, consultoria_id, aluno_id, pedido_id, renegociadas, parcelas, "
                        + "total_centavos) values (?, ?, ?, ?, 1, 1, 1000)", acordoDeB, consultoria(), b, pedido);
                chamada.add(pool.submit(() -> {
                    var r = mvc.perform(MockMvcRequestBuilders.post("/cobrancas/renegociar").header("X-Treinos-Cliente", "nativo")
                                    .header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(admin))
                                    .contentType(MediaType.APPLICATION_JSON).content(texto))
                            .andReturn().getResponse();
                    return new int[] {r.getStatus(), r.getContentAsString(StandardCharsets.UTF_8).contains("CONFLITO_EDICAO") ? 1 : 0};
                }));
                aguardarInsertBloqueado();
            });
            int[] resposta = chamada.get(0).get(30, TimeUnit.SECONDS);
            assertThat(resposta[0]).isEqualTo(409);
            assertThat(resposta[1]).as("CONFLITO_EDICAO").isEqualTo(1);
        } finally {
            pool.shutdownNow();
        }
        // A transação do aluno A caiu inteira: a original segue aberta e nada nasceu para ele.
        assertThat(atual(c).get("situacao").asString()).isEqualTo("ABERTA");
        assertThat(contar("select count(*) from cobranca_aluno where aluno_id = ? and tipo = 'RENEGOCIACAO'", a)).isZero();
        // Tentar de novo cai na checagem do começo: 200 com o acordo que já existe.
        JsonNode repetida = api.post("/cobrancas/renegociar", admin, confirmar(previa(List.of(c), 0, 0, 2, primeiro), pedido), 200);
        assertThat(repetida.get("acordoId").asString()).isEqualTo(acordoDeB.toString());
        assertThat(acordos("true")).isEqualTo(1);
    }

    /** Espera (até 15 s) alguma sessão ficar presa num lock: o insert do aluno A, esperando pelo índice único do pedido. */
    private void aguardarInsertBloqueado() {
        long limite = System.nanoTime() + TimeUnit.SECONDS.toNanos(15);
        while (System.nanoTime() < limite) {
            if (contar("select count(*) from pg_locks where not granted") > 0) {
                return;
            }
            try {
                Thread.sleep(50);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            }
        }
        throw new AssertionError("o insert do segundo aluno não chegou a esperar pelo índice");
    }

    @Test
    void cadaParcelaTemOTetoDeValorDoFinanceiro422SemRepetirValor() throws Exception {
        UUID a = aluno();
        JsonNode um = avulsa(a, PagamentosDtos.VALOR_MAXIMO, hoje.plusDays(2));
        JsonNode dois = avulsa(a, PagamentosDtos.VALOR_MAXIMO, hoje.plusDays(2));
        List<JsonNode> originais = List.of(um, dois);

        // 2 x 10.000.000,00 em uma parcela passa do teto; em duas, cada parcela cabe no teto.
        JsonNode erro = api.post("/cobrancas/renegociar/previa", admin, previa(originais, 0, 0, 1, primeiro), 422);
        assertThat(codigo(erro)).isEqualTo("RENEGOCIACAO_INVALIDA");
        assertThat(campos(erro)).containsExactlyInAnyOrder("descontoCentavos", "parcelas");
        assertThat(erro.toString()).doesNotContain("2000000000");
        api.post("/cobrancas/renegociar/previa", admin, previa(originais, 0, 0, 2, primeiro), 200);
        // A sobra dos centavos vai na última: 1 centavo a mais já estoura o teto da última parcela.
        api.post("/cobrancas/renegociar/previa", admin, previa(originais, 1, 0, 2, primeiro), 422);
        api.post("/cobrancas/renegociar/previa", admin, previa(originais, 1, 1, 2, primeiro), 200);
        // O confirmar também recusa e não grava nada.
        api.post("/cobrancas/renegociar", admin, confirmar(previa(originais, 0, 0, 1, primeiro), UUID.randomUUID()), 422);
        assertThat(acordos("true")).isZero();
        assertThat(atual(um).get("situacao").asString()).isEqualTo("ABERTA");
    }

    @Test
    void outraConsultoriaComOMesmoPedidoIdGeraOAcordoDela() throws Exception {
        UUID pedido = UUID.randomUUID();
        JsonNode minha = avulsa(aluno(), 1_000, hoje.plusDays(2));
        JsonNode outro = api.novoTreinador();
        UUID alunoDeFora = api.criarAluno(outro, "Aluno De Fora " + UUID.randomUUID());
        api.post("/financeiro/cobrancas-avulsas", outro, Map.of("pedidoId", UUID.randomUUID().toString(), "alunoIds", List.of(alunoDeFora.toString()),
                "descricao", "De fora", "valorCentavos", 2_000, "primeiroVencimento", hoje.plusDays(2).toString(), "parcelas", 1), 201);
        JsonNode deFora = api.get("/alunos/" + alunoDeFora + "/cobrancas", outro, 200).get(0);

        JsonNode meu = api.post("/cobrancas/renegociar", admin, confirmar(previa(List.of(minha), 0, 0, 1, primeiro), pedido), 201);
        JsonNode dele = api.post("/cobrancas/renegociar", outro, confirmar(previa(List.of(deFora), 0, 0, 2, primeiro), pedido), 201);

        assertThat(dele.get("acordoId").asString()).isNotEqualTo(meu.get("acordoId").asString());
        assertThat(dele.get("totalCentavos").asLong()).isEqualTo(2_000);
        assertThat(api.post("/cobrancas/renegociar", admin, confirmar(previa(List.of(minha), 0, 0, 1, primeiro), pedido), 200)).isEqualTo(meu);
    }

    // ---- totais, lista, inadimplentes, painel ----

    @Test
    void totaisListaInadimplentesEPainelSemARenegociada() throws Exception {
        UUID a = aluno();
        JsonNode vencida = avulsa(a, 10_000, hoje.minusDays(5));
        contratar(a, 20_000);
        JsonNode mensalidade = doTipo(a, "MENSALIDADE");
        assertThat(api.get("/financeiro/cobrancas?alunoId=" + a, admin, 200).get("totais").get("totalCentavos").asLong()).isEqualTo(30_000);
        assertThat(api.get("/financeiro/inadimplentes", admin, 200).get("itens").toString()).contains(vencida.get("id").asString());
        JsonNode painelAntes = api.get("/financeiro/painel", admin, 200);
        assertThat(painelAntes.get("cartoes").get("emAtraso").get("valorCentavos").asLong()).isEqualTo(10_000);
        assertThat(painelAntes.get("inadimplencia").get("cobradoCentavos").asLong()).isEqualTo(10_000);

        renegociar(List.of(vencida, mensalidade), 0, 0, 3);

        // Total, em aberto e vencido só com as parcelas (30.000 em aberto, nada vencido).
        JsonNode lista = api.get("/financeiro/cobrancas?alunoId=" + a, admin, 200);
        JsonNode totais = lista.get("totais");
        assertThat(totais.get("totalCentavos").asLong()).isEqualTo(30_000);
        assertThat(totais.get("emAbertoCentavos").asLong()).isEqualTo(30_000);
        assertThat(totais.get("vencidoCentavos").asLong()).isZero();
        assertThat(totais.get("pagoCentavos").asLong()).isZero();
        // O filtro por RENEGOCIADA lista as originais e os totais ficam zerados (como CANCELADA e ESTORNADA).
        JsonNode renegociadas = api.get("/financeiro/cobrancas?alunoId=" + a + "&situacao=RENEGOCIADA", admin, 200);
        assertThat(renegociadas.get("itens")).hasSize(2);
        renegociadas.get("itens").forEach(c -> {
            assertThat(c.get("situacao").asString()).isEqualTo("RENEGOCIADA");
            assertThat(c.get("acordoId").isNull()).isFalse();
            assertThat(c.get("vencida").asBoolean()).isFalse();
        });
        assertThat(renegociadas.get("totais").get("totalCentavos").asLong()).isZero();
        // Fora de vencido e de inadimplentes (as parcelas vencem no futuro).
        assertThat(api.get("/financeiro/cobrancas?alunoId=" + a + "&situacao=VENCIDA", admin, 200).get("itens")).isEmpty();
        assertThat(api.get("/financeiro/inadimplentes", admin, 200).get("itens")).isEmpty();
        JsonNode painel = api.get("/financeiro/painel", admin, 200);
        assertThat(painel.get("cartoes").get("emAtraso").get("valorCentavos").asLong()).isZero();
        assertThat(painel.get("cartoes").get("emAtraso").get("cobrancas").asInt()).isZero();
        assertThat(painel.get("inadimplencia").get("cobradoCentavos").asLong()).as("a renegociada não entra no cobrado").isZero();
        // O aluno só vê as parcelas abertas (nunca a RENEGOCIADA): ver o financeiro dele é com o login do aluno.
        assertThat(jdbc.queryForList("select situacao from cobranca_aluno where aluno_id = ? and situacao = 'ABERTA' and tipo = 'RENEGOCIACAO'", a))
                .hasSize(3);
    }

    // ---- desfazer ----

    @Test
    void desfazerReabreAsOriginaisECancelaAsParcelasAbertasComOMotivo() throws Exception {
        UUID a = aluno();
        JsonNode um = avulsa(a, 1_000, hoje.minusDays(2));
        JsonNode dois = avulsa(a, 2_000, hoje.plusDays(2));
        String acordo = renegociar(List.of(um, dois), 0, 0, 3).get("acordoId").asString();
        JsonNode antes = atual(um);

        JsonNode r = api.post("/cobrancas/acordos/" + acordo + "/desfazer", admin, Map.of("motivo", "Voltou atrás"), 200);

        assertThat(r.get("acordoId").asString()).isEqualTo(acordo);
        assertThat(r.get("reabertas").asInt()).isEqualTo(2);
        assertThat(r.get("canceladas").asInt()).isEqualTo(3);
        for (JsonNode o : List.of(um, dois)) {
            JsonNode depois = atual(o);
            assertThat(depois.get("situacao").asString()).isEqualTo("ABERTA");
            assertThat(depois.get("acordoId").isNull()).isTrue();
            assertThat(depois.get("motivo").isNull()).as("o motivo do acordo some com ele").isTrue();
        }
        assertThat(atual(um).get("vencida").asBoolean()).isTrue();
        assertThat(atual(um).get("versao").asLong()).isEqualTo(antes.get("versao").asLong() + 1);
        for (JsonNode p : cobrancasDe(a).stream().filter(c -> "RENEGOCIACAO".equals(c.get("tipo").asString())).toList()) {
            assertThat(p.get("situacao").asString()).isEqualTo("CANCELADA");
            assertThat(p.get("motivo").asString()).isEqualTo("Voltou atrás");
            assertThat(p.get("acordoId").asString()).isEqualTo(acordo);
        }
        assertThat(api.post("/cobrancas/acordos/" + acordo + "/desfazer", admin, Map.of("motivo", "De novo"), 409).get("codigo").asString())
                .isEqualTo("ACORDO_JA_DESFEITO");
        // A original volta a poder ser renegociada.
        renegociar(List.of(atual(um)), 0, 0, 1);
        assertThat(auditorias("ACORDO_DESFEITO")).isEqualTo(1);
    }

    @Test
    void desfazerSoSemParcelaPagaContestadaOuEstornadaENadaMudaNaRecusa() throws Exception {
        for (String destino : List.of("PAGA", "CONTESTADA", "ESTORNADA")) {
            UUID a = aluno();
            JsonNode original = avulsa(a, 3_000, hoje.plusDays(2));
            String acordo = renegociar(List.of(original), 0, 0, 2).get("acordoId").asString();
            JsonNode parcela = cobrancasDe(a).stream().filter(c -> "RENEGOCIACAO".equals(c.get("tipo").asString())).findFirst().orElseThrow();
            JsonNode paga = api.post("/cobrancas/" + parcela.get("id").asString() + "/baixa-manual", admin,
                    Map.of("data", hoje.toString(), "forma", "PIX_DIRETO", "versao", parcela.get("versao").asLong()), 200);
            assertThat(paga.get("situacao").asString()).isEqualTo("PAGA");
            JsonNode atual = paga;
            if (!destino.equals("PAGA")) {
                atual = api.post("/cobrancas/" + parcela.get("id").asString() + "/contestar", admin,
                        Map.of("motivo", "Contestou", "versao", paga.get("versao").asLong()), 200);
            }
            if (destino.equals("ESTORNADA")) {
                api.post("/cobrancas/" + parcela.get("id").asString() + "/estornar", admin,
                        Map.of("motivo", "Estornou", "versao", atual.get("versao").asLong()), 200);
            }

            assertThat(codigo(api.post("/cobrancas/acordos/" + acordo + "/desfazer", admin, Map.of("motivo", "Quero desfazer"), 409)))
                    .as(destino).isEqualTo("ACORDO_NAO_DESFAZIVEL");
            assertThat(atual(original).get("situacao").asString()).isEqualTo("RENEGOCIADA");
            assertThat(contar("select count(*) from acordo_de_cobranca where id = ?::uuid and desfeito_em is null", acordo)).isEqualTo(1);
        }
    }

    @Test
    void desfazerPedeOMotivoE422SemRepetirOTexto() throws Exception {
        UUID a = aluno();
        String acordo = renegociar(List.of(avulsa(a, 3_000, hoje.plusDays(2))), 0, 0, 1).get("acordoId").asString();

        for (String motivo : List.of("  ", "x".repeat(301))) {
            JsonNode erro = api.post("/cobrancas/acordos/" + acordo + "/desfazer", admin, Map.of("motivo", motivo), 422);
            assertThat(codigo(erro)).isEqualTo("RENEGOCIACAO_INVALIDA");
            assertThat(campos(erro)).containsExactly("motivo");
        }
        assertThat(acordos("desfeito_em is not null")).isZero();
    }

    // ---- as parcelas como cobranças comuns ----

    @Test
    void parcelaDoAcordoTemBaixaCancelarLoteELinkComTextoFixo() throws Exception {
        api.put("/financeiro/recebimento-online", admin, Map.of("infiniteTag", "$TREINADOR-FAKE"), 200);
        UUID a = aluno();
        JsonNode original = avulsa(a, 8_990, hoje.plusDays(2));
        renegociar(List.of(original), 0, 0, 3);
        List<JsonNode> parcelas = cobrancasDe(a).stream().filter(c -> "RENEGOCIACAO".equals(c.get("tipo").asString()))
                .sorted((x, y) -> x.get("vencimento").asString().compareTo(y.get("vencimento").asString())).toList();

        // Baixa individual e em lote; cancelar.
        JsonNode paga = api.post("/cobrancas/" + parcelas.get(0).get("id").asString() + "/baixa-manual", admin,
                Map.of("data", hoje.toString(), "forma", "DINHEIRO", "versao", parcelas.get(0).get("versao").asLong()), 200);
        assertThat(paga.get("situacao").asString()).isEqualTo("PAGA");
        assertThat(paga.get("tipo").asString()).isEqualTo("RENEGOCIACAO");
        JsonNode lote = api.post("/cobrancas/baixa-em-lote", admin, Map.of("itens", List.of(item(parcelas.get(1))),
                "data", hoje.toString(), "forma", "DINHEIRO"), 200);
        assertThat(lote.get("resultados").get(0).get("ok").asBoolean()).isTrue();
        // Gerar o link da última: o provedor recebe o valor do servidor e só "Renegociação (MM/aaaa)", nunca o texto do treinador.
        JsonNode ultima = parcelas.get(2);
        FALSA.esperaPreco(ultima.get("valorCentavos").asLong()).esperaPedido(UUID.fromString(ultima.get("id").asString()));
        String url = api.post("/cobrancas/" + ultima.get("id").asString() + "/link", admin, Map.of(), 200).get("url").asString();
        assertThat(url).startsWith("https://checkout.falsa.test/pagar/");
        JsonNode corpo = FALSA.requisicoes().get(0).corpo();
        String vencimento = ultima.get("vencimento").asString();
        assertThat(corpo.get("items").get(0).get("description").asString())
                .isEqualTo("Renegociação (" + vencimento.substring(5, 7) + "/" + vencimento.substring(0, 4) + ")");
        assertThat(corpo.toString()).doesNotContain("Fulana").doesNotContain("WhatsApp").doesNotContain(MOTIVO);
        api.post("/cobrancas/cancelar-em-lote", admin, Map.of("itens", List.of(item(atual(ultima)))), 200);
        assertThat(atual(ultima).get("situacao").asString()).isEqualTo("CANCELADA");
    }

    @Test
    void aOriginalRenegociadaNaoTemBaixaCancelarNemLink() throws Exception {
        api.put("/financeiro/recebimento-online", admin, Map.of("infiniteTag", "$TREINADOR-FAKE"), 200);
        UUID a = aluno();
        JsonNode original = avulsa(a, 3_000, hoje.plusDays(2));
        renegociar(List.of(original), 0, 0, 1);
        JsonNode depois = atual(original);
        String id = depois.get("id").asString();
        long versao = depois.get("versao").asLong();

        assertThat(codigo(api.post("/cobrancas/" + id + "/baixa-manual", admin,
                Map.of("data", hoje.toString(), "forma", "DINHEIRO", "versao", versao), 409))).isEqualTo("COBRANCA_NAO_ABERTA");
        assertThat(codigo(api.post("/cobrancas/" + id + "/cancelar", admin, Map.of("motivo", "x", "versao", versao), 409)))
                .isEqualTo("COBRANCA_NAO_ABERTA");
        assertThat(codigo(api.post("/cobrancas/" + id + "/link", admin, Map.of(), 409))).isEqualTo("COBRANCA_NAO_ABERTA");
        assertThat(FALSA.requisicoes()).isEmpty();
    }

    @Test
    void aCompetenciaDaMensalidadeRenegociadaNaoNasceDeNovo() throws Exception {
        UUID a = aluno();
        JsonNode contratacao = contratar(a, 20_000);
        JsonNode mensalidade = doTipo(a, "MENSALIDADE");
        int mensalidadesAntes = contar("select count(*) from cobranca_aluno where aluno_id = ? and tipo = 'MENSALIDADE'", a);
        String acordo = renegociar(List.of(mensalidade), 0, 0, 2).get("acordoId").asString();

        rotina.rodarNa(consultoria(), hoje);
        rotina.rodarNa(consultoria(), hoje);

        assertThat(contar("select count(*) from cobranca_aluno where aluno_id = ? and tipo = 'MENSALIDADE'", a)).isEqualTo(mensalidadesAntes);
        assertThat(contar("select count(*) from cobranca_aluno where aluno_id = ? and tipo = 'MENSALIDADE' and situacao = 'RENEGOCIADA'", a))
                .isEqualTo(1);
        // Desfeito, ela volta aberta e a rotina também não duplica.
        api.post("/cobrancas/acordos/" + acordo + "/desfazer", admin, Map.of("motivo", "Voltou"), 200);
        rotina.rodarNa(consultoria(), hoje);
        assertThat(contar("select count(*) from cobranca_aluno where aluno_id = ? and tipo = 'MENSALIDADE'", a)).isEqualTo(mensalidadesAntes);
        assertThat(atual(mensalidade).get("situacao").asString()).isEqualTo("ABERTA");
        assertThat(contratacao.get("id").asString()).isNotBlank();
    }

    @Test
    void aMensalidadeRenegociadaContinuaCobrindoOMesNaPreviaDeSaida() throws Exception {
        UUID a = aluno();
        JsonNode plano = api.post("/financeiro/planos", admin, Map.of("nome", "Plano mínimo " + UUID.randomUUID(), "valorCentavos", 10_000,
                "periodicidade", "MENSAL", "tempoMinimoMeses", 3), 200);
        Map<String, Object> corpoDaContratacao = new LinkedHashMap<>();
        corpoDaContratacao.put("planoComercialId", plano.get("id").asString());
        corpoDaContratacao.put("inicio", hoje.toString());
        corpoDaContratacao.put("diaVencimento", hoje.getDayOfMonth());
        JsonNode contratacao = api.post("/alunos/" + a + "/contratacoes", admin, corpoDaContratacao, 200);
        String rota = "/contratacoes/" + contratacao.get("id").asString() + "/previa-de-encerramento";
        JsonNode antes = api.get(rota, admin, 200);
        assertThat(antes.get("aVencerNoMinimo").get("quantidade").asInt()).isEqualTo(1);

        renegociar(List.of(doTipo(a, "MENSALIDADE")), 0, 0, 2);

        // RENEGOCIADA cobre o mês (D14): "mês vigente" segue indisponível (não nasce outra) e a renegociada não é "a cancelar" nem "a vencer".
        JsonNode depois = api.get(rota, admin, 200);
        JsonNode vigente = null;
        for (JsonNode o : depois.get("opcoes")) {
            if ("VIGENTE".equals(o.get("opcao").asString())) {
                vigente = o;
            }
        }
        assertThat(vigente).isNotNull();
        assertThat(vigente.get("disponivel").asBoolean()).as("o mês vigente está coberto pela renegociada").isFalse();
        assertThat(depois.get("cobrancasACancelar")).isEmpty();
        assertThat(depois.get("aVencerNoMinimo").get("quantidade").asInt()).isZero();
        assertThat(depois.get("mesesNaoGerados").asInt()).isEqualTo(antes.get("mesesNaoGerados").asInt());
    }

    @Test
    void oAlunoVeSoAsParcelasAbertasENuncaAOriginalNemOMotivoNemOAcordo() throws Exception {
        UUID a = aluno();
        JsonNode original = avulsa(a, 6_000, hoje.plusDays(2));
        renegociar(List.of(original), 0, 0, 2);
        JsonNode login = api.convidarEEntrar(admin, a);

        JsonNode financeiro = api.get("/aluno/financeiro", login, 200);

        assertThat(financeiro.get("abertas")).hasSize(2);
        financeiro.get("abertas").forEach(c -> {
            assertThat(c.get("tipo").asString()).isEqualTo("RENEGOCIACAO");
            assertThat(c.get("descricao").asString()).startsWith("Renegociação (Parcela");
        });
        assertThat(financeiro.toString()).doesNotContain(original.get("id").asString()).doesNotContain("RENEGOCIADA")
                .doesNotContain("acordoId").doesNotContain("Fulana").doesNotContain(MOTIVO);
    }

    // ---- inativar, lembretes ----

    @Test
    void inativarNaoMexeNasParcelasDoAcordoNemNaOriginalRenegociada() throws Exception {
        UUID a = aluno();
        JsonNode original = avulsa(a, 9_000, hoje.plusDays(2));
        // Primeira parcela vencida (o primeiro vencimento pode ser passado), as outras a vencer.
        api.post("/cobrancas/renegociar", admin, confirmar(previa(List.of(original), 0, 0, 3, hoje.minusDays(40)), UUID.randomUUID()), 201);
        List<JsonNode> parcelas = cobrancasDe(a).stream().filter(c -> "RENEGOCIACAO".equals(c.get("tipo").asString())).toList();
        assertThat(parcelas).hasSize(3);
        // D2 (18/11): acordo sobrevive à inativação, a vencer ou vencido; uma avulsa comum a vencer é cancelada (D9).
        JsonNode avulsaComum = avulsa(a, 2_500, hoje.plusDays(5));
        assertThat(parcelas.stream().filter(p -> LocalDate.parse(p.get("vencimento").asString()).isBefore(hoje)).count()).isEqualTo(2);

        JsonNode resumo = api.get("/alunos/" + a + "/resumo-da-saida", admin, 200);
        assertThat(resumo.get("aCancelar").get("quantidade").asInt()).as("só a avulsa comum").isEqualTo(1);
        assertThat(resumo.get("emAberto").get("quantidade").asInt()).as("as três parcelas do acordo").isEqualTo(3);

        api.patch("/alunos/" + a + "/situacao", admin, Map.of("ativo", false), 200);

        for (JsonNode p : parcelas) {
            assertThat(atual(p).get("situacao").asString()).as(p.get("vencimento").asString()).isEqualTo("ABERTA");
        }
        assertThat(atual(avulsaComum).get("situacao").asString()).isEqualTo("CANCELADA");
        assertThat(atual(original).get("situacao").asString()).isEqualTo("RENEGOCIADA");
        // Aluno inativo: nem prévia, nem confirmar, nem desfazer (reative-o primeiro).
        JsonNode outra = avulsa(aluno(), 1_000, hoje.plusDays(2));
        UUID paraInativar = UUID.fromString(outra.get("alunoId").asString());
        api.patch("/alunos/" + paraInativar + "/situacao", admin, Map.of("ativo", false), 200);
        JsonNode inativa = atual(outra);
        assertThat(codigo(api.post("/cobrancas/renegociar/previa", admin, previa(List.of(inativa), 0, 0, 1, primeiro), 409))).isEqualTo("ALUNO_INATIVO");
        assertThat(codigo(api.post("/cobrancas/renegociar", admin, confirmar(previa(List.of(inativa), 0, 0, 1, primeiro), UUID.randomUUID()), 409)))
                .isEqualTo("ALUNO_INATIVO");
        String acordo = jdbc.queryForObject("select acordo_id::text from cobranca_aluno where id = ?::uuid", String.class, original.get("id").asString());
        assertThat(codigo(api.post("/cobrancas/acordos/" + acordo + "/desfazer", admin, Map.of("motivo", "Reativar antes"), 409)))
                .isEqualTo("ALUNO_INATIVO");
    }

    @Test
    void anonimizarCancelaTodasAsParcelasDoAcordoMesmoDepoisDeInativar() throws Exception {
        String nome = "Aluno Acordo Anonimizado " + UUID.randomUUID();
        UUID a = api.criarAluno(admin, nome);
        JsonNode original = avulsa(a, 9_000, hoje.plusDays(2));
        api.post("/cobrancas/renegociar", admin, confirmar(previa(List.of(original), 0, 0, 3, hoje.minusDays(40)), UUID.randomUUID()), 201);
        api.patch("/alunos/" + a + "/situacao", admin, Map.of("ativo", false), 200);
        assertThat(contar("select count(*) from cobranca_aluno where aluno_id = ? and tipo = 'RENEGOCIACAO' and situacao = 'ABERTA'", a))
                .isEqualTo(3);

        api.post("/alunos/" + a + "/anonimizar", admin, Map.of("nomeConfirmado", nome), 200);

        assertThat(contar("select count(*) from cobranca_aluno where aluno_id = ? and tipo = 'RENEGOCIACAO' and situacao = 'ABERTA'", a))
                .isZero();
        assertThat(contar("select count(*) from cobranca_aluno where aluno_id = ? and tipo = 'RENEGOCIACAO' and situacao = 'CANCELADA'", a))
                .isEqualTo(3);
        assertThat(contar("select count(*) from cobranca_aluno where aluno_id = ? and situacao = 'ABERTA'", a)).isZero();
    }

    @Test
    void alunoAnonimizadoDa409() throws Exception {
        String nome = "Aluno Anonimizado " + UUID.randomUUID();
        UUID a = api.criarAluno(admin, nome);
        JsonNode original = avulsa(a, 1_000, hoje.plusDays(2));
        String acordo = renegociar(List.of(avulsa(a, 2_000, hoje.plusDays(2))), 0, 0, 1).get("acordoId").asString();
        api.patch("/alunos/" + a + "/situacao", admin, Map.of("ativo", false), 200);
        api.post("/alunos/" + a + "/anonimizar", admin, Map.of("nomeConfirmado", nome), 200);
        JsonNode cancelada = atual(original);

        assertThat(codigo(api.post("/cobrancas/renegociar/previa", admin, previa(List.of(cancelada), 0, 0, 1, primeiro), 409)))
                .isEqualTo("ALUNO_ANONIMIZADO");
        assertThat(codigo(api.post("/cobrancas/renegociar", admin, confirmar(previa(List.of(cancelada), 0, 0, 1, primeiro), UUID.randomUUID()), 409)))
                .isEqualTo("ALUNO_ANONIMIZADO");
        assertThat(codigo(api.post("/cobrancas/acordos/" + acordo + "/desfazer", admin, Map.of("motivo", "Tarde demais"), 409)))
                .isEqualTo("ALUNO_ANONIMIZADO");
    }

    @Test
    void lembreteSaiParaAParcelaComTextoDeCobrancaENaoParaAOriginalNemParaAlunoInativo() throws Exception {
        String email = ApiDeTeste.emailUnico("renegocia-lembrete");
        UUID a = UUID.fromString(api.post("/alunos", admin, Map.of("nome", "Aluno Fictício " + UUID.randomUUID(), "email", email), 200)
                .get("id").asString());
        JsonNode original = avulsa(a, 5_000, hoje.minusDays(1));
        api.put("/financeiro/lembretes", admin, Map.of("ligado", true, "diasAntes", 3, "noDia", true, "diasDepois", 3), 200);
        api.post("/cobrancas/renegociar", admin, confirmar(previa(List.of(original), 0, 0, 1, hoje.plusDays(2)), UUID.randomUUID()), 201);

        job.rodar(hoje, enviador);

        List<EnviadorDeEmail.Mensagem> recebidas = EmailDeTeste.para(email);
        assertThat(recebidas).as("um e-mail, da parcela (a original renegociada não tem lembrete)").hasSize(1);
        assertThat(recebidas.get(0).texto()).contains("A cobrança de").contains("R$ 50,00").doesNotContain("mensalidade")
                .doesNotContain("Renegociação").doesNotContain(MOTIVO);
        assertThat(contar("select count(*) from lembrete_cobranca where cobranca_id = ?::uuid", original.get("id").asString())).isZero();

        // Inativo: a parcela vencida segue aberta, mas o aluno não recebe lembrete.
        String outroEmail = ApiDeTeste.emailUnico("renegocia-inativo");
        UUID b = UUID.fromString(api.post("/alunos", admin, Map.of("nome", "Aluno Inativo " + UUID.randomUUID(), "email", outroEmail), 200)
                .get("id").asString());
        JsonNode outra = avulsa(b, 5_000, hoje.minusDays(9));
        api.post("/cobrancas/renegociar", admin, confirmar(previa(List.of(outra), 0, 0, 1, hoje.minusDays(3)), UUID.randomUUID()), 201);
        api.patch("/alunos/" + b + "/situacao", admin, Map.of("ativo", false), 200);

        job.rodar(hoje, enviador);

        assertThat(doTipo(b, "RENEGOCIACAO").get("situacao").asString()).isEqualTo("ABERTA");
        assertThat(EmailDeTeste.para(outroEmail)).isEmpty();
    }

    // ---- auditoria, exportação, anonimização, permissão ----

    @Test
    void auditoriaComResumoFixoSemValorNomeNemMotivo() throws Exception {
        String nome = "Aluno Auditado " + UUID.randomUUID();
        UUID a = api.criarAluno(admin, nome);
        JsonNode original = avulsa(a, 4_455, hoje.plusDays(2));
        String acordo = renegociar(List.of(original), 123, 0, 2).get("acordoId").asString();
        api.post("/cobrancas/acordos/" + acordo + "/desfazer", admin, Map.of("motivo", "Motivo sigiloso do desfazer"), 200);

        List<Map<String, Object>> linhas = jdbc.queryForList(
                "select acao, entidade, entidade_id::text as entidade_id, resumo from auditoria where acao in ('COBRANCAS_RENEGOCIADAS', 'ACORDO_DESFEITO') "
                        + "and entidade_id = ?::uuid order by acao", UUID.fromString(acordo));
        assertThat(linhas).hasSize(2);
        for (Map<String, Object> l : linhas) {
            assertThat(l.get("entidade")).isEqualTo("ACORDO");
            String resumo = l.get("resumo").toString();
            assertThat(resumo).doesNotContain(nome).doesNotContain("sigiloso").doesNotContain("Fulana").doesNotContain("44,55")
                    .doesNotContain("4455").doesNotContain("4578");
        }
        assertThat(linhas.get(0).get("resumo")).isEqualTo("Desfez um acordo de renegociação.");
        assertThat(linhas.get(1).get("resumo")).isEqualTo("Renegociou cobranças de um aluno em parcelas.");
    }

    @Test
    void exportacaoDoAlunoLevaOAcordoEAAnonimizacaoLimpaOsMotivos() throws Exception {
        String nome = "Aluno Exportável " + UUID.randomUUID();
        UUID a = api.criarAluno(admin, nome);
        JsonNode original = avulsa(a, 9_900, hoje.plusDays(1));
        String acordo = renegociar(List.of(original), 0, 0, 2).get("acordoId").asString();

        JsonNode financeiro = api.get("/alunos/" + a + "/exportacao", admin, 200).get("financeiro");
        JsonNode cobrancas = financeiro.get("cobrancas");
        assertThat(financeiro.get("acordos")).hasSize(1);
        assertThat(financeiro.get("acordos").get(0).get("id").asString()).isEqualTo(acordo);
        assertThat(financeiro.get("acordos").get(0).get("renegociadas").asInt()).isEqualTo(1);
        assertThat(financeiro.get("acordos").get(0).get("parcelas").asInt()).isEqualTo(2);
        assertThat(financeiro.get("acordos").get(0).get("totalCentavos").asLong()).isEqualTo(9_900);
        assertThat(financeiro.get("acordos").get(0).get("desfeitoEm").isNull()).isTrue();
        assertThat(financeiro.get("acordos").toString()).doesNotContain(MOTIVO);

        assertThat(cobrancas).hasSize(3);
        int renegociadas = 0;
        int parcelas = 0;
        for (JsonNode c : cobrancas) {
            assertThat(c.get("acordoId").asString()).isEqualTo(acordo);
            if ("RENEGOCIADA".equals(c.get("situacao").asString())) {
                renegociadas++;
                assertThat(c.get("motivo").asString()).isEqualTo(MOTIVO);
            } else {
                parcelas++;
                assertThat(c.get("tipo").asString()).isEqualTo("RENEGOCIACAO");
                assertThat(c.get("descricao").asString()).startsWith("Renegociação (Parcela");
            }
        }
        assertThat(renegociadas).isEqualTo(1);
        assertThat(parcelas).isEqualTo(2);

        api.patch("/alunos/" + a + "/situacao", admin, Map.of("ativo", false), 200);
        api.post("/alunos/" + a + "/anonimizar", admin, Map.of("nomeConfirmado", nome), 200);

        for (Map<String, Object> linha : jdbc.queryForList("select tipo, situacao, motivo, descricao from cobranca_aluno where aluno_id = ?::uuid",
                a.toString())) {
            assertThat(linha.get("motivo")).as("a anonimização limpa os motivos").isNull();
            if ("RENEGOCIACAO".equals(linha.get("tipo"))) {
                assertThat(linha.get("situacao")).isEqualTo("CANCELADA");
                assertThat(linha.get("descricao").toString()).startsWith("Renegociação (Parcela");
            }
        }
        assertThat(jdbc.queryForList("select situacao from cobranca_aluno where aluno_id = ?::uuid and tipo = 'AVULSA'", a.toString()))
                .singleElement().satisfies(l -> assertThat(l.get("situacao")).isEqualTo("RENEGOCIADA"));
    }

    @Test
    void semFinanceiroAlterarOsTresEndpointsDao403() throws Exception {
        UUID a = aluno();
        JsonNode c = avulsa(a, 1_000, hoje.plusDays(2));
        String acordo = renegociar(List.of(avulsa(a, 2_000, hoje.plusDays(2))), 0, 0, 1).get("acordoId").asString();
        JsonNode leitor = membro("Leitor", Set.of("FINANCEIRO_LER", "ALUNO_LER"));
        Map<String, Object> corpo = previa(List.of(c), 0, 0, 1, primeiro);

        api.post("/cobrancas/renegociar/previa", leitor, corpo, 403);
        api.post("/cobrancas/renegociar", leitor, confirmar(corpo, UUID.randomUUID()), 403);
        api.post("/cobrancas/acordos/" + acordo + "/desfazer", leitor, Map.of("motivo", "Sem permissão"), 403);
        assertThat(atual(c).get("situacao").asString()).isEqualTo("ABERTA");
        assertThat(acordos("desfeito_em is not null")).isZero();
    }
}
