package br.com.treinos.api.pagamentos;

import br.com.plataforma.comum.auth.EnviadorDeEmail;
import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.EmailDeTeste;
import br.com.treinos.api.web.Fuso;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Lembretes de cobrança por e-mail: a configuração (versão, validação, auditoria), o job sem duplicidade, o cancelamento
 * quando a cobrança é paga entre o planejamento e o envio, o e-mail desligado, a falha do provedor (3 tentativas), o aluno sem
 * e-mail, a outra consultoria, a folha da cobrança com a mensagem do WhatsApp e a exportação. O job é chamado à mão
 * ({@code agendados: false} nos testes) com o "hoje" do cenário. Só dados fictícios; cada consulta filtra pelo id do teste.
 */
@AutoConfigureMockMvc
class LembretesDeCobrancaIntegrationTest extends AbstractIntegrationTest {

    private static final String ROTA = "/financeiro/lembretes";

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private LembretesDeCobranca job;
    @Autowired private EnviadorDeEmail enviador;

    private ApiDeTeste api;
    private JsonNode admin;
    private final LocalDate hoje = LocalDate.now(Fuso.BRASILIA);

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
    }

    @AfterEach
    void provedorDeVolta() {
        EmailDeTeste.FALHAR.set(false);
    }

    // ---- ajudantes ----

    private UUID consultoriaDe(JsonNode login) {
        return jdbc.queryForObject("select consultoria_id from usuario where id = ?::uuid", UUID.class,
                login.get("usuario").get("id").asString());
    }

    private Map<String, Object> config(boolean ligado, int antes, boolean noDia, int depois, Long versao) {
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("ligado", ligado);
        corpo.put("diasAntes", antes);
        corpo.put("noDia", noDia);
        corpo.put("diasDepois", depois);
        if (versao != null) {
            corpo.put("versao", versao);
        }
        return corpo;
    }

    private JsonNode ligar(JsonNode quem) throws Exception {
        return api.put(ROTA, quem, config(true, 3, true, 3, null), 200);
    }

    /** Aluno (com ou sem e-mail), plano mensal e contratação de hoje; devolve a cobrança aberta. */
    private JsonNode cobrancaDe(JsonNode quem, String nome, String email, long valor) throws Exception {
        Map<String, Object> aluno = new LinkedHashMap<>();
        aluno.put("nome", nome);
        if (email != null) {
            aluno.put("email", email);
        }
        String alunoId = api.post("/alunos", quem, aluno, 200).get("id").asString();
        JsonNode plano = api.post("/financeiro/planos", quem,
                Map.of("nome", "Plano lembrete " + UUID.randomUUID(), "valorCentavos", valor, "periodicidade", "MENSAL"), 200);
        api.post("/alunos/" + alunoId + "/contratacoes", quem, Map.of("planoComercialId", plano.get("id").asString(),
                "inicio", hoje.toString(), "diaVencimento", hoje.getDayOfMonth()), 200);
        for (JsonNode c : api.get("/alunos/" + alunoId + "/cobrancas", quem, 200)) {
            if ("ABERTA".equals(c.get("situacao").asString())) {
                return c;
            }
        }
        throw new AssertionError("Sem cobrança aberta.");
    }

    private static LocalDate vencimento(JsonNode cobranca) {
        return LocalDate.parse(cobranca.get("vencimento").asString());
    }

    private List<Map<String, Object>> linhas(JsonNode cobranca) {
        return jdbc.queryForList("select tipo, situacao, motivo, tentativas, erro, enviado_em from lembrete_cobranca "
                + "where cobranca_id = ?::uuid order by criado_em", cobranca.get("id").asString());
    }

    private void pendenteNaMao(JsonNode quem, JsonNode cobranca, String tipo) {
        jdbc.update("insert into lembrete_cobranca (id, consultoria_id, cobranca_id, tipo, data_prevista) "
                + "values (?::uuid, ?::uuid, ?::uuid, ?, ?::date)", UUID.randomUUID().toString(),
                consultoriaDe(quem).toString(), cobranca.get("id").asString(), tipo, hoje.toString());
    }

    private void tentarDeNovoJa(JsonNode cobranca) {
        jdbc.update("update lembrete_cobranca set proxima_tentativa = now() where cobranca_id = ?::uuid",
                cobranca.get("id").asString());
    }

    private int auditorias(UUID consultoria) {
        Integer n = jdbc.queryForObject("select count(*) from auditoria where consultoria_id = ? "
                + "and acao = 'LEMBRETES_DE_COBRANCA_CONFIGURADOS'", Integer.class, consultoria);
        return n == null ? 0 : n;
    }

    // ---- configuração ----

    @Test
    void configuracaoNasceDesligadaComOsPadroesEAVersaoEConferida() throws Exception {
        UUID consultoria = consultoriaDe(admin);
        JsonNode padrao = api.get(ROTA, admin, 200);
        assertThat(padrao.propertyNames()).containsExactlyInAnyOrder("ligado", "diasAntes", "noDia", "diasDepois", "versao",
                "emailDisponivel");
        assertThat(padrao.get("ligado").asBoolean()).isFalse();
        assertThat(padrao.get("diasAntes").asInt()).isEqualTo(3);
        assertThat(padrao.get("noDia").asBoolean()).isTrue();
        assertThat(padrao.get("diasDepois").asInt()).isEqualTo(3);
        assertThat(padrao.get("versao").isNull()).isTrue();
        assertThat(padrao.get("emailDisponivel").asBoolean()).as("o e-mail está ligado na suíte").isTrue();

        // Criar com versão = alguém apagou: 409.
        api.put(ROTA, admin, config(true, 3, true, 3, 7L), 409);
        JsonNode criada = api.put(ROTA, admin, config(true, 5, false, 10, null), 200);
        assertThat(criada.get("ligado").asBoolean()).isTrue();
        assertThat(criada.get("diasAntes").asInt()).isEqualTo(5);
        long versao = criada.get("versao").asLong();
        assertThat(auditorias(consultoria)).isEqualTo(1);
        assertThat(jdbc.queryForObject("select resumo from auditoria where consultoria_id = ? "
                + "and acao = 'LEMBRETES_DE_COBRANCA_CONFIGURADOS'", String.class, consultoria))
                .isEqualTo("Configurou os lembretes de cobrança.");

        // Sem versão ou com versão velha: 409. Igual ao gravado: 200 sem auditoria nova.
        api.put(ROTA, admin, config(false, 5, false, 10, null), 409);
        api.put(ROTA, admin, config(false, 5, false, 10, versao + 1), 409);
        api.put(ROTA, admin, config(true, 5, false, 10, versao), 200);
        assertThat(auditorias(consultoria)).isEqualTo(1);
        JsonNode desligada = api.put(ROTA, admin, config(false, 5, false, 10, versao), 200);
        assertThat(desligada.get("ligado").asBoolean()).isFalse();
        assertThat(auditorias(consultoria)).isEqualTo(2);
    }

    @Test
    void diasForaDoIntervaloDao422ComOCampo() throws Exception {
        JsonNode erro = api.put(ROTA, admin, config(true, 16, true, 31, null), 422);
        assertThat(erro.get("codigo").asString()).isEqualTo("LEMBRETES_INVALIDOS");
        assertThat(erro.get("fieldErrors").valueStream().map(f -> f.get("field").asString()))
                .containsExactlyInAnyOrder("diasAntes", "diasDepois");
        api.put(ROTA, admin, config(true, -1, true, 3, null), 422);
        assertThat(api.get(ROTA, admin, 200).get("versao").isNull()).as("nada foi gravado").isTrue();
    }

    @Test
    void outraConsultoriaNaoVeOsLembretesDaCobranca() throws Exception {
        JsonNode cobranca = cobrancaDe(admin, "Aluno Fictício Isolado", ApiDeTeste.emailUnico("lembrete-isolado"), 15000);
        JsonNode outro = api.novoTreinador();
        api.get("/cobrancas/" + cobranca.get("id").asString() + "/lembretes", outro, 404);
        // A configuração de uma não é a da outra.
        ligar(admin);
        assertThat(api.get(ROTA, outro, 200).get("ligado").asBoolean()).isFalse();
    }

    // ---- o job ----

    @Test
    void mandaUmaVezSoEOTextoNaoTemNadaAlemDoCombinado() throws Exception {
        String email = ApiDeTeste.emailUnico("lembrete-antes");
        JsonNode cobranca = cobrancaDe(admin, "Bruna Fictícia Lembrada", email, 15000);
        ligar(admin);
        LocalDate dia = vencimento(cobranca).minusDays(3);

        job.rodar(dia, enviador);
        job.rodar(dia, enviador);
        job.rodar(dia.plusDays(1), enviador);

        List<EnviadorDeEmail.Mensagem> recebidas = EmailDeTeste.para(email);
        assertThat(recebidas).hasSize(1);
        String texto = recebidas.get(0).texto();
        assertThat(texto).startsWith("Olá, Bruna.").contains("no valor de R$ 150,00 vence em")
                .contains("/aluno/conta").doesNotContain("Fictícia Lembrada");
        assertThat(recebidas.get(0).html()).contains("/aluno/conta");
        List<Map<String, Object>> linhas = linhas(cobranca);
        assertThat(linhas).hasSize(1);
        assertThat(linhas.get(0).get("tipo")).isEqualTo("ANTES");
        assertThat(linhas.get(0).get("situacao")).isEqualTo("ENVIADO");
        assertThat(linhas.get(0).get("enviado_em")).isNotNull();
        assertThat(jdbc.queryForList("select column_name from information_schema.columns where table_name = 'lembrete_cobranca'",
                String.class)).as("a linha não guarda o endereço, o nome, o valor nem o texto")
                .doesNotContain("email", "para", "texto", "nome", "valor_centavos");

        // No dia e depois: um de cada.
        job.rodar(vencimento(cobranca), enviador);
        job.rodar(vencimento(cobranca).plusDays(3), enviador);
        assertThat(EmailDeTeste.para(email)).hasSize(3);
        assertThat(EmailDeTeste.para(email).get(1).texto()).contains("vence hoje");
        assertThat(EmailDeTeste.para(email).get(2).texto()).contains("venceu em").contains("ainda está em aberto");
        assertThat(linhas(cobranca)).extracting(l -> l.get("tipo")).containsExactly("ANTES", "NO_DIA", "DEPOIS");
    }

    @Test
    void cobrancaPagaEntreOPlanejamentoEOEnvioCancelaOLembrete() throws Exception {
        String email = ApiDeTeste.emailUnico("lembrete-pago");
        JsonNode cobranca = cobrancaDe(admin, "Carlos Fictício Pagou", email, 9000);
        ligar(admin);
        pendenteNaMao(admin, cobranca, "NO_DIA");
        api.post("/cobrancas/" + cobranca.get("id").asString() + "/baixa-manual", admin,
                Map.of("data", hoje.toString(), "forma", "DINHEIRO", "versao", cobranca.get("versao").asLong()), 200);

        job.rodar(vencimento(cobranca), enviador);

        assertThat(EmailDeTeste.para(email)).isEmpty();
        assertThat(linhas(cobranca)).singleElement().satisfies(l -> {
            assertThat(l.get("situacao")).isEqualTo("CANCELADO");
            assertThat(l.get("motivo")).isEqualTo("COBRANCA_NAO_ABERTA");
        });
    }

    @Test
    void configuracaoDesligadaDepoisDoPlanejamentoCancela() throws Exception {
        String email = ApiDeTeste.emailUnico("lembrete-desligou");
        JsonNode cobranca = cobrancaDe(admin, "Dora Fictícia", email, 9000);
        JsonNode ligada = ligar(admin);
        pendenteNaMao(admin, cobranca, "NO_DIA");
        api.put(ROTA, admin, config(false, 3, true, 3, ligada.get("versao").asLong()), 200);

        job.rodar(vencimento(cobranca), enviador);

        assertThat(EmailDeTeste.para(email)).isEmpty();
        assertThat(linhas(cobranca)).singleElement().satisfies(l -> assertThat(l.get("motivo")).isEqualTo("NAO_E_MAIS_DEVIDO"));
    }

    @Test
    void semOEmailDoAppNadaEPlanejadoEOPendenteNaoFicaPreso() throws Exception {
        String email = ApiDeTeste.emailUnico("lembrete-sem-envio");
        JsonNode cobranca = cobrancaDe(admin, "Eva Fictícia", email, 9000);
        ligar(admin);
        pendenteNaMao(admin, cobranca, "ANTES");

        var resultado = job.rodar(vencimento(cobranca), null);

        assertThat(resultado.planejados()).isZero();
        assertThat(EmailDeTeste.para(email)).isEmpty();
        assertThat(linhas(cobranca)).singleElement().satisfies(l -> {
            assertThat(l.get("situacao")).isEqualTo("CANCELADO");
            assertThat(l.get("motivo")).isEqualTo("EMAIL_DESLIGADO");
        });
    }

    @Test
    void falhaDoProvedorTentaTresVezesEGuardaSoAClasse() throws Exception {
        String email = ApiDeTeste.emailUnico("lembrete-falha");
        JsonNode cobranca = cobrancaDe(admin, "Fábio Fictício", email, 9000);
        ligar(admin);
        EmailDeTeste.FALHAR.set(true);

        job.rodar(vencimento(cobranca), enviador);
        assertThat(linhas(cobranca)).singleElement().satisfies(l -> {
            assertThat(l.get("situacao")).isEqualTo("PENDENTE");
            assertThat(l.get("tentativas")).isEqualTo(1);
            assertThat(l.get("erro")).isEqualTo("EnvioDeEmailException");
        });
        // Sem esperar: a nova tentativa ainda não venceu.
        job.rodar(vencimento(cobranca), enviador);
        assertThat(linhas(cobranca).get(0).get("tentativas")).isEqualTo(1);

        tentarDeNovoJa(cobranca);
        job.rodar(vencimento(cobranca), enviador);
        tentarDeNovoJa(cobranca);
        job.rodar(vencimento(cobranca), enviador);

        assertThat(linhas(cobranca)).singleElement().satisfies(l -> {
            assertThat(l.get("situacao")).isEqualTo("FALHOU");
            assertThat(l.get("tentativas")).isEqualTo(3);
        });
        EmailDeTeste.FALHAR.set(false);
        tentarDeNovoJa(cobranca);
        job.rodar(vencimento(cobranca), enviador);
        assertThat(EmailDeTeste.para(email)).as("falhou de vez não volta sozinho nem duplica").isEmpty();
    }

    @Test
    void alunoSemEmailOuContratacaoPausadaNaoRecebem() throws Exception {
        JsonNode semEmail = cobrancaDe(admin, "Gil Fictício Sem Email", null, 9000);
        String email = ApiDeTeste.emailUnico("lembrete-pausada");
        JsonNode pausada = cobrancaDe(admin, "Hana Fictícia Pausada", email, 9000);
        ligar(admin);
        String contratacao = pausada.get("contratacaoId").asString();
        jdbc.update("update contratacao_aluno set situacao = 'PAUSADA' where id = ?::uuid", contratacao);

        job.rodar(vencimento(semEmail), enviador);
        job.rodar(vencimento(pausada), enviador);

        assertThat(linhas(semEmail)).singleElement().satisfies(l -> assertThat(l.get("motivo")).isEqualTo("SEM_EMAIL"));
        assertThat(linhas(pausada)).singleElement().satisfies(l -> assertThat(l.get("motivo")).isEqualTo("CONTRATACAO_NAO_ATIVA"));
        assertThat(EmailDeTeste.para(email)).isEmpty();
    }

    @Test
    void consultoriaSemLembretesLigadosNaoRecebeNada() throws Exception {
        String emailA = ApiDeTeste.emailUnico("lembrete-a");
        JsonNode daA = cobrancaDe(admin, "Ivo Fictício A", emailA, 9000);
        ligar(admin);
        JsonNode outro = api.novoTreinador();
        String emailB = ApiDeTeste.emailUnico("lembrete-b");
        JsonNode daB = cobrancaDe(outro, "Júlia Fictícia B", emailB, 9000);

        job.rodar(vencimento(daA), enviador);

        assertThat(EmailDeTeste.para(emailA)).hasSize(1);
        assertThat(EmailDeTeste.para(emailB)).isEmpty();
        assertThat(linhas(daB)).isEmpty();
        assertThat(jdbc.queryForObject("select consultoria_id from lembrete_cobranca where cobranca_id = ?::uuid", UUID.class,
                daA.get("id").asString())).isEqualTo(consultoriaDe(admin));
    }

    // ---- folha da cobrança e exportação ----

    @Test
    void aFolhaListaOsLembretesEMandaAMensagemDoWhatsAppIgualAoEmail() throws Exception {
        String email = ApiDeTeste.emailUnico("lembrete-folha");
        JsonNode cobranca = cobrancaDe(admin, "Lia Fictícia Folha", email, 12000);
        ligar(admin);
        job.rodar(vencimento(cobranca), enviador);
        String id = cobranca.get("id").asString();

        JsonNode folha = api.get("/cobrancas/" + id + "/lembretes", admin, 200);

        assertThat(folha.get("itens")).hasSize(1);
        JsonNode item = folha.get("itens").get(0);
        assertThat(item.get("tipo").asString()).isEqualTo("NO_DIA");
        assertThat(item.get("situacao").asString()).isEqualTo("ENVIADO");
        assertThat(item.get("enviadoEm").isNull()).isFalse();
        assertThat(item.has("para")).isFalse();
        JsonNode whatsapp = folha.get("whatsapp");
        assertThat(whatsapp.get("telefone").isNull()).as("sem conta, sem telefone").isTrue();
        // A mensagem é a de hoje: o vencimento da cobrança é hoje.
        assertThat(whatsapp.get("mensagem").asString()).isEqualTo(EmailDeTeste.para(email).get(0).texto());

        // Paga: a folha continua listando o lembrete e não oferece mais o WhatsApp.
        api.post("/cobrancas/" + id + "/baixa-manual", admin,
                Map.of("data", hoje.toString(), "forma", "DINHEIRO", "versao", cobranca.get("versao").asLong()), 200);
        JsonNode paga = api.get("/cobrancas/" + id + "/lembretes", admin, 200);
        assertThat(paga.get("itens")).hasSize(1);
        assertThat(paga.get("whatsapp").isNull()).isTrue();
    }

    @Test
    void aExportacaoDoAlunoLevaOsLembretesEAAnonimizacaoNaoQuebra() throws Exception {
        String nome = "Mia Fictícia Exportada";
        String email = ApiDeTeste.emailUnico("lembrete-exporta");
        JsonNode cobranca = cobrancaDe(admin, nome, email, 9000);
        ligar(admin);
        job.rodar(vencimento(cobranca), enviador);
        String aluno = cobranca.get("alunoId").asString();

        JsonNode dados = api.get("/alunos/" + aluno + "/exportacao", admin, 200);

        JsonNode lembretes = dados.get("financeiro").get("lembretes");
        assertThat(lembretes).hasSize(1);
        assertThat(lembretes.get(0).get("tipo").asString()).isEqualTo("NO_DIA");
        assertThat(lembretes.get(0).get("situacao").asString()).isEqualTo("ENVIADO");
        assertThat(lembretes.get(0).toString()).doesNotContain(email);

        api.patch("/alunos/" + aluno + "/situacao", admin, Map.of("ativo", false), 200);
        api.post("/alunos/" + aluno + "/anonimizar", admin, Map.of("nomeConfirmado", nome), 200);
        assertThat(linhas(cobranca)).hasSize(1);
    }
}
