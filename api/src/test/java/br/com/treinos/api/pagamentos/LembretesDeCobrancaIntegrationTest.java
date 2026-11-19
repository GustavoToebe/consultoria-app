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
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Lembretes de cobrança por e-mail: a configuração (versão, validação, auditoria), o job sem duplicidade, o cancelamento
 * quando a cobrança é paga entre o planejamento e o envio, o e-mail desligado, a falha do provedor (3 tentativas), o aluno sem
 * e-mail, a outra consultoria, a folha da cobrança com a mensagem do WhatsApp e a exportação; e o aluno que desliga os
 * lembretes só para ele (job, planejamento, auditoria, exportação, anonimização, exclusão da conta e isolamento). O job é chamado à mão
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

    private static final String ROTA_DO_ALUNO = "/aluno/lembretes-de-cobranca";

    /** Entra como o aluno dessa cobrança (convite aceito, cliente nativo). */
    private JsonNode loginDoAluno(JsonNode cobranca) throws Exception {
        return api.convidarEEntrar(admin, UUID.fromString(cobranca.get("alunoId").asString()));
    }

    private int auditoriasDoAluno(JsonNode cobranca) {
        Integer n = jdbc.queryForObject("select count(*) from auditoria where acao = 'LEMBRETES_DE_COBRANCA_DO_ALUNO_ALTERADOS' "
                + "and entidade_id = ?::uuid", Integer.class, cobranca.get("alunoId").asString());
        return n == null ? 0 : n;
    }

    private Object desligadoEm(JsonNode cobranca) {
        return jdbc.queryForObject("select lembretes_cobranca_desligados_em from aluno where id = ?::uuid", Object.class,
                cobranca.get("alunoId").asString());
    }

    private static Map<String, Object> receber(boolean valor) {
        return Map.of("receber", valor);
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
    void lembreteSaiComONomeEOResponderParaDaConsultoriaOuONomeDelaSaneado() throws Exception {
        String padrao = ApiDeTeste.emailUnico("lembrete-padrao");
        JsonNode cobrancaPadrao = cobrancaDe(admin, "Aluna Remetente Padrão", padrao, 9000);
        String nomeDaConsultoria = api.get("/consultoria", admin, 200).get("marca").get("nome").asString();
        ligar(admin);
        job.rodar(vencimento(cobrancaPadrao).minusDays(3), enviador);
        var semMarca = EmailDeTeste.para(padrao);
        assertThat(semMarca).hasSize(1);
        assertThat(semMarca.get(0).nomeRemetente()).as("sem nome na Marca vale o da consultoria, até 60")
                .isEqualTo(nomeDaConsultoria.substring(0, 60).strip());
        assertThat(semMarca.get(0).responderPara()).isNull();
        assertThat(semMarca.get(0).remetente()).isNull();

        JsonNode atual = api.get("/consultoria", admin, 200);
        api.put("/consultoria/marca", admin, Map.of("nome", nomeDaConsultoria, "corPrimaria", "#C62828", "fonteTitulo", "PADRAO",
                "temaPadrao", "CLARO", "versao", atual.get("versao").asLong(), "emailRemetenteNome", "Time Lembrete",
                "emailResponderPara", "cobranca@teste.local"), 200);
        String comMarca = ApiDeTeste.emailUnico("lembrete-marca");
        JsonNode cobranca = cobrancaDe(admin, "Aluna Remetente Marca", comMarca, 9000);
        job.rodar(vencimento(cobranca).minusDays(3), enviador);
        var m = EmailDeTeste.para(comMarca).get(0);
        assertThat(m.nomeRemetente()).isEqualTo("Time Lembrete");
        assertThat(m.responderPara()).isEqualTo("cobranca@teste.local");
        assertThat(m.remetente()).isNull();
    }

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

    /** Aluno com três mensalidades abertas, todas com lembrete devido hoje: vencidas há 5 e 4 dias e a que vence hoje. */
    private List<JsonNode> tresAbertasComLembreteDevidoHoje(String email) throws Exception {
        String alunoId = api.post("/alunos", admin, Map.of("nome", "Marta Fictícia Acumulada", "email", email), 200)
                .get("id").asString();
        JsonNode plano = api.post("/financeiro/planos", admin,
                Map.of("nome", "Plano varias " + UUID.randomUUID(), "valorCentavos", 9000, "periodicidade", "MENSAL"), 200);
        // Início há 2 meses: a geração já cria as três mensalidades (hoje-2m, hoje-1m e hoje), todas abertas.
        api.post("/alunos/" + alunoId + "/contratacoes", admin, Map.of("planoComercialId", plano.get("id").asString(),
                "inicio", hoje.minusMonths(2).toString(), "diaVencimento", hoje.getDayOfMonth(), "gerarMesesAnteriores", true), 200);
        List<JsonNode> abertas = new ArrayList<>();
        api.get("/alunos/" + alunoId + "/cobrancas", admin, 200).forEach(c -> abertas.add(0, c));
        assertThat(abertas).hasSize(3);
        ligar(admin);
        int[] atraso = {5, 4, 0};
        for (int i = 0; i < 3; i++) {
            jdbc.update("update cobranca_aluno set vencimento = ?::date where id = ?::uuid",
                    hoje.minusDays(atraso[i]).toString(), abertas.get(i).get("id").asString());
        }
        return abertas;
    }

    @Test
    void alunoComVariasAbertasRecebeUmEmailPorDiaDaMaisAntigaEOTextoDizQuantasSao() throws Exception {
        String email = ApiDeTeste.emailUnico("lembrete-varias");
        List<JsonNode> abertas = tresAbertasComLembreteDevidoHoje(email);

        job.rodar(hoje, enviador);
        job.rodar(hoje, enviador);

        List<EnviadorDeEmail.Mensagem> recebidas = EmailDeTeste.para(email);
        assertThat(recebidas).as("um e-mail por aluno por dia, mesmo rodando de novo").hasSize(1);
        assertThat(recebidas.get(0).texto()).contains("Você tem 3 cobranças em aberto no total.")
                .contains("venceu em " + String.format("%02d/%02d", hoje.minusDays(5).getDayOfMonth(),
                        hoje.minusDays(5).getMonthValue()));
        assertThat(linhas(abertas.get(0))).singleElement().satisfies(l -> assertThat(l.get("situacao")).isEqualTo("ENVIADO"));
        assertThat(linhas(abertas.get(1))).isEmpty();
        assertThat(linhas(abertas.get(2))).isEmpty();
    }

    @Test
    void baixaDaMaisAntigaEntreDuasRodadasNaoLiberaUmSegundoEmailNoMesmoDia() throws Exception {
        String email = ApiDeTeste.emailUnico("lembrete-baixa-no-meio");
        List<JsonNode> abertas = tresAbertasComLembreteDevidoHoje(email);
        job.rodar(hoje, enviador);
        assertThat(EmailDeTeste.para(email)).hasSize(1);

        api.post("/cobrancas/" + abertas.get(0).get("id").asString() + "/baixa-manual", admin,
                Map.of("data", hoje.toString(), "forma", "DINHEIRO", "versao", abertas.get(0).get("versao").asLong()), 200);
        job.rodar(hoje, enviador);

        assertThat(EmailDeTeste.para(email)).as("a seguinte espera o dia seguinte").hasSize(1);
        assertThat(linhas(abertas.get(1))).isEmpty();
        assertThat(linhas(abertas.get(2))).isEmpty();
    }

    @Test
    void cobrancaVencidaDeContratacaoPausadaNaoTiraAVagaDaOutra() throws Exception {
        String email = ApiDeTeste.emailUnico("lembrete-pausada");
        List<JsonNode> abertas = tresAbertasComLembreteDevidoHoje(email);
        // Pausada, a contratação cancelaria os três: nenhum ocupa a vaga e nenhum e-mail sai.
        String contratacao = api.get("/alunos/" + abertas.get(0).get("alunoId").asString() + "/contratacoes", admin, 200)
                .get(0).get("id").asString();
        jdbc.update("update contratacao_aluno set situacao = 'PAUSADA' where id = ?::uuid", contratacao);

        job.rodar(hoje, enviador);

        assertThat(EmailDeTeste.para(email)).isEmpty();
        assertThat(linhas(abertas.get(0))).isEmpty();
    }

    private void vencerEm(JsonNode cobranca, LocalDate vencimento) {
        jdbc.update("update cobranca_aluno set vencimento = ?::date where id = ?::uuid", vencimento.toString(),
                cobranca.get("id").asString());
    }

    private JsonNode avulsaDe(JsonNode cobranca, LocalDate vencimento) throws Exception {
        String alunoId = cobranca.get("alunoId").asString();
        api.post("/financeiro/cobrancas-avulsas", admin, Map.of("pedidoId", UUID.randomUUID().toString(), "alunoIds", List.of(alunoId), "descricao", "Camiseta fictícia",
                "valorCentavos", 3000, "primeiroVencimento", vencimento.toString(), "parcelas", 1), 201);
        for (JsonNode c : api.get("/alunos/" + alunoId + "/cobrancas", admin, 200)) {
            if ("AVULSA".equals(c.get("tipo").asString())) {
                return c;
            }
        }
        throw new AssertionError("Sem avulsa.");
    }

    @Test
    void avulsaQueJaTemOLembreteDaFolgaNaoGastaAVagaDaMensalidadeNosDiasSeguintes() throws Exception {
        String email = ApiDeTeste.emailUnico("lembrete-folga-avulsa");
        JsonNode mensalidade = cobrancaDe(admin, "Nina Fictícia da Folga", email, 9000);
        vencerEm(mensalidade, hoje.plusDays(5));
        JsonNode avulsa = avulsaDe(mensalidade, hoje); // DEPOIS em hoje+3, ainda devido em +4 e +5 pela folga de 2 dias
        ligar(admin);

        job.rodar(hoje.plusDays(3), enviador);
        assertThat(EmailDeTeste.para(email)).hasSize(1);
        assertThat(EmailDeTeste.para(email).get(0).texto()).contains("A cobrança de").contains("venceu em");

        // A avulsa já tem o DEPOIS: não ocupa a vaga e o ANTES da mensalidade sai.
        job.rodar(hoje.plusDays(4), enviador);
        assertThat(EmailDeTeste.para(email)).hasSize(2);
        assertThat(EmailDeTeste.para(email).get(1).texto()).contains("A mensalidade de").contains("vence em");

        // No dia da mensalidade, o NO_DIA dela não se perde.
        job.rodar(hoje.plusDays(5), enviador);
        job.rodar(hoje.plusDays(5), enviador);
        assertThat(EmailDeTeste.para(email)).hasSize(3);
        assertThat(EmailDeTeste.para(email).get(2).texto()).contains("A mensalidade de").contains("vence hoje");
        assertThat(linhas(avulsa)).extracting(l -> l.get("tipo")).containsExactly("DEPOIS");
        assertThat(linhas(mensalidade)).extracting(l -> l.get("tipo")).containsExactly("ANTES", "NO_DIA");
    }

    @Test
    void soMensalidadesComDiasDepoisGrandeNaoPerdemOLembreteDaSeguinte() throws Exception {
        String email = ApiDeTeste.emailUnico("lembrete-folga-mensal");
        String alunoId = api.post("/alunos", admin, Map.of("nome", "Rita Fictícia da Folga", "email", email), 200).get("id").asString();
        JsonNode plano = api.post("/financeiro/planos", admin,
                Map.of("nome", "Plano folga " + UUID.randomUUID(), "valorCentavos", 9000, "periodicidade", "MENSAL"), 200);
        api.post("/alunos/" + alunoId + "/contratacoes", admin, Map.of("planoComercialId", plano.get("id").asString(),
                "inicio", hoje.minusMonths(1).toString(), "diaVencimento", hoje.getDayOfMonth(), "gerarMesesAnteriores", true), 200);
        List<JsonNode> abertas = new ArrayList<>();
        api.get("/alunos/" + alunoId + "/cobrancas", admin, 200).forEach(c -> abertas.add(0, c));
        assertThat(abertas).hasSize(2);
        JsonNode antiga = abertas.get(0);
        JsonNode nova = abertas.get(1);
        vencerEm(antiga, hoje);
        vencerEm(nova, hoje.plusDays(8));
        api.put(ROTA, admin, config(true, 3, true, 6, null), 200);

        // hoje+6: DEPOIS da antiga (a mais antiga ganha a vaga); +7: o DEPOIS dela já existe e o ANTES da nova sai; +8: NO_DIA da nova.
        job.rodar(hoje.plusDays(6), enviador);
        job.rodar(hoje.plusDays(7), enviador);
        job.rodar(hoje.plusDays(8), enviador);

        List<EnviadorDeEmail.Mensagem> recebidas = EmailDeTeste.para(email);
        assertThat(recebidas).hasSize(3);
        assertThat(recebidas.get(2).texto()).contains("vence hoje");
        assertThat(linhas(antiga)).extracting(l -> l.get("tipo")).containsExactly("DEPOIS");
        assertThat(linhas(nova)).extracting(l -> l.get("tipo")).containsExactly("ANTES", "NO_DIA");
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
    void alunoInativadoComMensalidadeVencidaMantidaAbertaNaoRecebeEmailDeAtraso() throws Exception {
        String email = ApiDeTeste.emailUnico("lembrete-inativo");
        JsonNode cobranca = cobrancaDe(admin, "Fábio Fictício Inativo", email, 9000);
        ligar(admin);
        // Vence há 3 dias: o lembrete DEPOIS (3 dias) é devido hoje.
        jdbc.update("update cobranca_aluno set vencimento = ?::date where id = ?::uuid", hoje.minusDays(3).toString(),
                cobranca.get("id").asString());
        api.patch("/alunos/" + cobranca.get("alunoId").asString() + "/situacao", admin, Map.of("ativo", false), 200);
        // A inativação mantém a vencida aberta (a equipe ainda cobra), mas não pode mandar e-mail a quem saiu.
        assertThat(jdbc.queryForObject("select situacao from cobranca_aluno where id = ?::uuid", String.class,
                cobranca.get("id").asString())).isEqualTo("ABERTA");
        // O planejamento já nem escolhe a cobrança de contratação encerrada; um lembrete que ficou pendente de antes é cancelado.
        pendenteNaMao(admin, cobranca, "DEPOIS");

        job.rodar(hoje, enviador);
        job.rodar(hoje, enviador);

        assertThat(EmailDeTeste.para(email)).isEmpty();
        assertThat(linhas(cobranca)).allSatisfy(l -> assertThat(l.get("situacao")).isEqualTo("CANCELADO"));
        // A contratação encerrada pela inativação é conferida antes do aluno: é esse o motivo gravado.
        assertThat(linhas(cobranca)).singleElement().satisfies(l -> assertThat(l.get("motivo")).isEqualTo("CONTRATACAO_NAO_ATIVA"));
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
        // O planejamento já nem escolhe a pausada; um lembrete que ficou pendente de antes é cancelado pelo preparo.
        pendenteNaMao(admin, pausada, "NO_DIA");

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

    // ---- o aluno desliga os lembretes só para ele ----

    @Test
    void alunoQueDesligaTemOPendenteCanceladoComOMotivoENaoRecebe() throws Exception {
        String email = ApiDeTeste.emailUnico("lembrete-aluno-desligou");
        JsonNode cobranca = cobrancaDe(admin, "Nina Fictícia Descadastrada", email, 9000);
        ligar(admin);
        JsonNode aluno = loginDoAluno(cobranca);
        pendenteNaMao(admin, cobranca, "NO_DIA");

        assertThat(api.get(ROTA_DO_ALUNO, aluno, 200).propertyNames()).containsExactly("receber");
        assertThat(api.get(ROTA_DO_ALUNO, aluno, 200).get("receber").asBoolean()).isTrue();
        assertThat(api.put(ROTA_DO_ALUNO, aluno, receber(false), 200).get("receber").asBoolean()).isFalse();
        assertThat(api.get(ROTA_DO_ALUNO, aluno, 200).get("receber").asBoolean()).isFalse();

        job.rodar(vencimento(cobranca), enviador);

        assertThat(EmailDeTeste.para(email)).isEmpty();
        assertThat(linhas(cobranca)).singleElement().satisfies(l -> {
            assertThat(l.get("situacao")).isEqualTo("CANCELADO");
            assertThat(l.get("motivo")).isEqualTo("ALUNO_DESLIGOU");
        });
        JsonNode folha = api.get("/cobrancas/" + cobranca.get("id").asString() + "/lembretes", admin, 200);
        assertThat(folha.get("itens").get(0).get("motivo").asString()).isEqualTo("ALUNO_DESLIGOU");
    }

    @Test
    void oPlanejamentoPulaOAlunoDesligadoEReativarVoltaAPlanejar() throws Exception {
        String email = ApiDeTeste.emailUnico("lembrete-aluno-reativa");
        JsonNode cobranca = cobrancaDe(admin, "Otávio Fictício Reativa", email, 9000);
        ligar(admin);
        JsonNode aluno = loginDoAluno(cobranca);
        api.put(ROTA_DO_ALUNO, aluno, receber(false), 200);

        job.rodar(vencimento(cobranca), enviador);

        assertThat(linhas(cobranca)).as("nem a linha do lembrete nasce").isEmpty();
        assertThat(EmailDeTeste.para(email)).isEmpty();

        api.put(ROTA_DO_ALUNO, aluno, receber(true), 200);
        assertThat(desligadoEm(cobranca)).isNull();
        job.rodar(vencimento(cobranca), enviador);

        assertThat(EmailDeTeste.para(email)).hasSize(1);
        assertThat(linhas(cobranca)).singleElement().satisfies(l -> assertThat(l.get("situacao")).isEqualTo("ENVIADO"));
    }

    @Test
    void aAuditoriaSoSaiQuandoOValorMudaECarregaResumoFixo() throws Exception {
        JsonNode cobranca = cobrancaDe(admin, "Paulo Fictício Auditado", ApiDeTeste.emailUnico("lembrete-aluno-auditoria"), 9000);
        JsonNode aluno = loginDoAluno(cobranca);

        api.put(ROTA_DO_ALUNO, aluno, receber(true), 200);
        assertThat(auditoriasDoAluno(cobranca)).as("já recebia: nada muda").isZero();
        assertThat(desligadoEm(cobranca)).isNull();

        api.put(ROTA_DO_ALUNO, aluno, receber(false), 200);
        assertThat(auditoriasDoAluno(cobranca)).isEqualTo(1);
        Object quando = desligadoEm(cobranca);
        assertThat(quando).isNotNull();

        api.put(ROTA_DO_ALUNO, aluno, receber(false), 200);
        assertThat(auditoriasDoAluno(cobranca)).as("repetir não audita").isEqualTo(1);
        assertThat(desligadoEm(cobranca)).as("e não regrava o instante").isEqualTo(quando);

        api.put(ROTA_DO_ALUNO, aluno, receber(true), 200);
        assertThat(auditoriasDoAluno(cobranca)).isEqualTo(2);
        assertThat(desligadoEm(cobranca)).isNull();
        assertThat(jdbc.queryForList("select distinct resumo from auditoria where acao = 'LEMBRETES_DE_COBRANCA_DO_ALUNO_ALTERADOS' "
                + "and entidade_id = ?::uuid", String.class, cobranca.get("alunoId").asString()))
                .containsExactly("Aluno alterou o recebimento dos lembretes de cobrança.");
    }

    @Test
    void soOAlunoDaSessaoMudaEOutroAlunoOuConsultoriaSegueRecebendo() throws Exception {
        String emailA = ApiDeTeste.emailUnico("lembrete-aluno-a");
        String emailB = ApiDeTeste.emailUnico("lembrete-aluno-b");
        JsonNode daA = cobrancaDe(admin, "Rita Fictícia A", emailA, 9000);
        JsonNode daB = cobrancaDe(admin, "Saulo Fictício B", emailB, 9000);
        JsonNode outro = api.novoTreinador();
        String emailC = ApiDeTeste.emailUnico("lembrete-aluno-c");
        JsonNode daC = cobrancaDe(outro, "Tânia Fictícia C", emailC, 9000);
        ligar(admin);
        ligar(outro);
        JsonNode alunoA = loginDoAluno(daA);
        JsonNode alunoB = loginDoAluno(daB);

        // O corpo só leva "receber": quem muda é sempre o aluno da sessão.
        api.put(ROTA_DO_ALUNO, alunoA, receber(false), 200);

        assertThat(desligadoEm(daA)).isNotNull();
        assertThat(desligadoEm(daB)).isNull();
        assertThat(api.get(ROTA_DO_ALUNO, alunoB, 200).get("receber").asBoolean()).isTrue();
        // A equipe não usa a rota do aluno, e sem login não há resposta.
        api.get(ROTA_DO_ALUNO, admin, 403);
        api.put(ROTA_DO_ALUNO, admin, receber(false), 403);
        api.get(ROTA_DO_ALUNO, null, 401);

        job.rodar(vencimento(daA), enviador);

        assertThat(EmailDeTeste.para(emailA)).isEmpty();
        assertThat(EmailDeTeste.para(emailB)).hasSize(1);
        assertThat(EmailDeTeste.para(emailC)).as("o aluno de outra consultoria segue recebendo").hasSize(1);
        assertThat(desligadoEm(daC)).isNull();
    }

    @Test
    void aFolhaDaCobrancaDizQueOAlunoDesligouSemMexerNoWhatsApp() throws Exception {
        JsonNode cobranca = cobrancaDe(admin, "Ubiratã Fictício Folha", ApiDeTeste.emailUnico("lembrete-aluno-folha"), 9000);
        JsonNode aluno = loginDoAluno(cobranca);
        String rota = "/cobrancas/" + cobranca.get("id").asString() + "/lembretes";

        JsonNode antes = api.get(rota, admin, 200);
        assertThat(antes.get("alunoDesligou").asBoolean()).isFalse();
        assertThat(antes.get("whatsapp").isNull()).isFalse();

        api.put(ROTA_DO_ALUNO, aluno, receber(false), 200);
        JsonNode depois = api.get(rota, admin, 200);
        assertThat(depois.get("alunoDesligou").asBoolean()).isTrue();
        assertThat(depois.get("whatsapp").get("mensagem").asString()).as("o WhatsApp manual não muda")
                .isEqualTo(antes.get("whatsapp").get("mensagem").asString());

        api.put(ROTA_DO_ALUNO, aluno, receber(true), 200);
        assertThat(api.get(rota, admin, 200).get("alunoDesligou").asBoolean()).isFalse();
    }

    @Test
    void aExportacaoLevaAEscolhaEAnonimizarEExcluirAContaVoltamAReceber() throws Exception {
        String nome = "Vera Fictícia Escolha";
        JsonNode cobranca = cobrancaDe(admin, nome, ApiDeTeste.emailUnico("lembrete-aluno-exporta"), 9000);
        JsonNode aluno = loginDoAluno(cobranca);
        String id = cobranca.get("alunoId").asString();

        JsonNode recebe = api.get("/alunos/" + id + "/exportacao", admin, 200).get("financeiro").get("escolhaDeLembretes");
        assertThat(recebe.get("receber").asBoolean()).isTrue();
        assertThat(recebe.get("desligadoEm").isNull()).isTrue();

        api.put(ROTA_DO_ALUNO, aluno, receber(false), 200);
        JsonNode desligou = api.get("/alunos/" + id + "/exportacao", admin, 200).get("financeiro").get("escolhaDeLembretes");
        assertThat(desligou.get("receber").asBoolean()).isFalse();
        assertThat(desligou.get("desligadoEm").isNull()).isFalse();

        // Anonimizar pelo treinador zera a coluna.
        api.patch("/alunos/" + id + "/situacao", admin, Map.of("ativo", false), 200);
        api.post("/alunos/" + id + "/anonimizar", admin, Map.of("nomeConfirmado", nome), 200);
        assertThat(desligadoEm(cobranca)).isNull();

        // "Excluir minha conta" pelo próprio aluno também.
        JsonNode outra = cobrancaDe(admin, "Wagner Fictício Exclui", ApiDeTeste.emailUnico("lembrete-aluno-exclui"), 9000);
        JsonNode alunoQueSai = loginDoAluno(outra);
        api.put(ROTA_DO_ALUNO, alunoQueSai, receber(false), 200);
        assertThat(desligadoEm(outra)).isNotNull();
        api.post("/aluno/conta/excluir", alunoQueSai, Map.of("senha", ApiDeTeste.SENHA, "confirmacao", "EXCLUIR"), 204);
        assertThat(desligadoEm(outra)).isNull();
    }
}
