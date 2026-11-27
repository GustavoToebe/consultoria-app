package br.com.treinos.api.contratos;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.Documentos;
import br.com.treinos.api.web.Fuso;
import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.nio.charset.StandardCharsets;
import java.sql.Date;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Guarda do contrato assinado (D16, passo 6 do {@code docs/planos/contrato-digital.md}): 5 anos depois do fim do contrato, e só de
 * aluno anonimizado, o texto, as evidências, o link e o PDF saem; ficam id, título, hash e situação. A rotina é chamada à mão
 * ({@code rodarNa} conta só o dado da própria consultoria do teste; {@code rodar} é a rodada inteira). Datas recuadas por JDBC. Só
 * dados fictícios.
 */
@AutoConfigureMockMvc
class GuardaDoContratoAssinadoIntegrationTest extends AbstractIntegrationTest {

    private static final LocalDate HOJE = LocalDate.now(Fuso.BRASILIA);
    private static final String FRASE_SIGILOSA = "Cláusula sigilosa da guarda fictícia";
    private static final String TEXTO = FRASE_SIGILOSA + " de {aluno_nome}, CPF {aluno_cpf}.";
    private static final List<String> EVIDENCIAS = List.of("texto", "assinado_em", "assinado_por_usuario_id", "assinante_nome",
            "assinante_cpf", "assinante_ip", "assinante_agente", "assinante_declarou_responsavel", "link_hash", "link_expira_em");

    private record Aluno(UUID id, String nome, JsonNode login) { }

    private record Contrato(String id, String titulo, String sha256) { }

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private GuardaDoContratoAssinado guarda;

    private ApiDeTeste api;
    private JsonNode admin;
    private UUID consultoria;
    private JsonNode modelo;
    private ListAppender<ILoggingEvent> log;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        consultoria = consultoriaDe(admin);
        modelo = modeloDe(admin);
        log = new ListAppender<>();
        log.start();
        ((Logger) LoggerFactory.getLogger(Logger.ROOT_LOGGER_NAME)).addAppender(log);
    }

    @AfterEach
    void soltarOLog() {
        ((Logger) LoggerFactory.getLogger(Logger.ROOT_LOGGER_NAME)).detachAppender(log);
    }

    // ---- ajudantes ----

    private UUID consultoriaDe(JsonNode login) {
        return jdbc.queryForObject("select consultoria_id from usuario where id = ?::uuid", UUID.class,
                login.get("usuario").get("id").asString());
    }

    private JsonNode modeloDe(JsonNode quem) throws Exception {
        return api.post("/contratos/modelos", quem, Map.of("nome", "Modelo da guarda " + UUID.randomUUID(), "texto", TEXTO), 201);
    }

    private Aluno novoAluno(JsonNode quem) throws Exception {
        String nome = "Joana Guarda " + UUID.randomUUID().toString().substring(0, 8);
        UUID id = UUID.fromString(api.post("/alunos", quem, Map.of("nome", nome, "cpf", Documentos.cpf()), 200).get("id").asString());
        return new Aluno(id, nome, api.convidarEEntrar(quem, id));
    }

    private JsonNode gerar(JsonNode quem, Aluno aluno, JsonNode doModelo, String contratacaoId) throws Exception {
        Map<String, Object> pedido = new LinkedHashMap<>();
        pedido.put("pedidoId", UUID.randomUUID().toString());
        pedido.put("modeloId", doModelo.get("id").asString());
        if (contratacaoId != null) {
            pedido.put("contratacaoId", contratacaoId);
        }
        return api.post("/alunos/" + aluno.id() + "/contratos", quem, pedido, 201);
    }

    private Contrato assinado(JsonNode quem, Aluno aluno, JsonNode doModelo, String contratacaoId) throws Exception {
        JsonNode criado = gerar(quem, aluno, doModelo, contratacaoId);
        String id = criado.get("id").asString();
        String sha = criado.get("sha256").asString();
        Map<String, Object> assinatura = new LinkedHashMap<>();
        assinatura.put("sha256", sha);
        assinatura.put("nome", aluno.nome());
        assinatura.put("aceite", true);
        api.post("/aluno/contratos/" + id + "/assinar", aluno.login(), assinatura, 200);
        return new Contrato(id, criado.get("titulo").asString(), sha);
    }

    /** Contratação recorrente (mensal) ou de parcela única, num plano novo; devolve o id da contratação. */
    private String contratar(JsonNode quem, Aluno aluno, String periodicidade) throws Exception {
        Map<String, Object> plano = new LinkedHashMap<>();
        plano.put("nome", "Plano da guarda " + UUID.randomUUID());
        plano.put("valorCentavos", 10_000);
        plano.put("periodicidade", periodicidade);
        String planoId = api.post("/financeiro/planos", quem, plano, 200).get("id").asString();
        return api.post("/alunos/" + aluno.id() + "/contratacoes", quem,
                Map.of("planoComercialId", planoId, "inicio", HOJE.toString(), "diaVencimento", 10), 200).get("id").asString();
    }

    /** Recua a assinatura para o meio-dia (Brasília) do dia dado. */
    private void assinadoEm(Contrato c, LocalDate dia) {
        jdbc.update("update contrato_aluno set assinado_em = (?::date + time '12:00') at time zone 'America/Sao_Paulo' "
                + "where id = ?::uuid", Date.valueOf(dia), c.id());
    }

    private void encerradaEm(String contratacaoId, LocalDate dia) {
        jdbc.update("update contratacao_aluno set situacao = 'ENCERRADA', "
                + "encerrada_em = (?::date + time '12:00') at time zone 'America/Sao_Paulo' where id = ?::uuid",
                Date.valueOf(dia), contratacaoId);
    }

    private void anonimizado(Aluno aluno) {
        jdbc.update("update aluno set anonimizado_em = now() where id = ?::uuid", aluno.id().toString());
    }

    private void comPdf(Contrato c, UUID daConsultoria) {
        jdbc.update("insert into contrato_arquivo (contrato_id, consultoria_id, bytes) values (?::uuid, ?::uuid, ?)",
                c.id(), daConsultoria.toString(), "%PDF-1.4 fictício".getBytes(StandardCharsets.UTF_8));
    }

    private int pdfs(Contrato c) {
        return jdbc.queryForObject("select count(*) from contrato_arquivo where contrato_id = ?::uuid", Integer.class, c.id());
    }

    private Map<String, Object> linha(Contrato c) {
        return jdbc.queryForMap("select * from contrato_aluno where id = ?::uuid", c.id());
    }

    private void confereApagado(Contrato c) {
        Map<String, Object> l = linha(c);
        for (String coluna : EVIDENCIAS) {
            assertThat(l.get(coluna)).as(coluna).isNull();
        }
        assertThat(l.get("apagado_em")).isNotNull();
        assertThat(l.get("situacao")).isEqualTo("ASSINADO");
        assertThat(l.get("titulo")).isEqualTo(c.titulo());
        assertThat(l.get("sha256")).isEqualTo(c.sha256());
        assertThat(pdfs(c)).isZero();
    }

    private void confereGuardado(Contrato c) {
        Map<String, Object> l = linha(c);
        assertThat(l.get("apagado_em")).isNull();
        assertThat(l.get("texto")).isNotNull();
        assertThat(l.get("assinado_em")).isNotNull();
        assertThat(l.get("assinante_nome")).isNotNull();
        assertThat(l.get("situacao")).isEqualTo("ASSINADO");
    }

    // ---- sem contratação: a referência é a assinatura ----

    @Test
    void apagaOAssinadoDeAlunoAnonimizadoHaMaisDeCincoAnosEFicamSoOsMetadados() throws Exception {
        Aluno aluno = novoAluno(admin);
        Contrato velho = assinado(admin, aluno, modelo, null);
        Contrato recente = assinado(admin, aluno, modelo, null);
        comPdf(velho, consultoria);
        comPdf(recente, consultoria);
        assinadoEm(velho, HOJE.minusYears(5).minusDays(1));
        anonimizado(aluno);

        assertThat(guarda.rodarNa(consultoria, HOJE)).isEqualTo(1);

        confereApagado(velho);
        // O outro contrato do mesmo aluno, assinado hoje, e o PDF dele ficam.
        confereGuardado(recente);
        assertThat(pdfs(recente)).isEqualTo(1);
    }

    @Test
    void cincoAnosExatosApagamEQuatroAnosE364DiasMantem() throws Exception {
        Aluno noLimite = novoAluno(admin);
        Aluno quaseLa = novoAluno(admin);
        Contrato cinco = assinado(admin, noLimite, modelo, null);
        Contrato quatro = assinado(admin, quaseLa, modelo, null);
        assinadoEm(cinco, HOJE.minusYears(5));
        assinadoEm(quatro, HOJE.minusYears(5).plusDays(1)); // 4 anos e 364 dias
        anonimizado(noLimite);
        anonimizado(quaseLa);

        assertThat(guarda.rodarNa(consultoria, HOJE)).isEqualTo(1);

        confereApagado(cinco);
        confereGuardado(quatro);
    }

    @Test
    void alunoNaoAnonimizadoNuncaTemOContratoApagadoMesmoComDezAnos() throws Exception {
        Aluno aluno = novoAluno(admin);
        Contrato c = assinado(admin, aluno, modelo, null);
        comPdf(c, consultoria);
        assinadoEm(c, HOJE.minusYears(10));

        assertThat(guarda.rodarNa(consultoria, HOJE)).isZero();

        confereGuardado(c);
        assertThat(pdfs(c)).isEqualTo(1);
    }

    @Test
    void pendenteECanceladoNuncaSaoTocadosPelaGuardaMesmoVelhos() throws Exception {
        // alunos distintos: gerar de novo para o mesmo aluno cancela o pendente anterior
        Aluno comPendente = novoAluno(admin);
        Aluno comCancelado = novoAluno(admin);
        JsonNode pendente = gerar(admin, comPendente, modelo, null);
        JsonNode cancelado = gerar(admin, comCancelado, modelo, null);
        api.post("/contratos/" + cancelado.get("id").asString() + "/cancelar", admin,
                Map.of("motivo", "Teste", "versao", cancelado.get("versao").asLong()), 200);
        for (Aluno aluno : List.of(comPendente, comCancelado)) {
            anonimizado(aluno); // só depois de gerar: o gerar recusa aluno anonimizado
            jdbc.update("update contrato_aluno set gerado_em = now() - interval '10 years', criado_em = now() - interval '10 years' "
                    + "where aluno_id = ?::uuid", aluno.id().toString());
        }

        assertThat(guarda.rodarNa(consultoria, HOJE)).isZero();

        for (Map.Entry<JsonNode, String> e : Map.of(pendente, "PENDENTE", cancelado, "CANCELADO").entrySet()) {
            Map<String, Object> l = jdbc.queryForMap("select * from contrato_aluno where id = ?::uuid", e.getKey().get("id").asString());
            assertThat(l.get("texto")).isNotNull();
            assertThat(l.get("apagado_em")).isNull();
            assertThat(l.get("situacao")).isEqualTo(e.getValue()); // a resposta do gerar é anterior ao cancelar
        }
    }

    // ---- com contratação: a referência é o fim dela ----

    @Test
    void contratacaoEncerradaHaSeisAnosApagaHaTresMantemEAindaAtivaMantem() throws Exception {
        Aluno velha = novoAluno(admin);
        Aluno recente = novoAluno(admin);
        Aluno ativa = novoAluno(admin);
        String contratacaoVelha = contratar(admin, velha, "MENSAL");
        String contratacaoRecente = contratar(admin, recente, "MENSAL");
        String contratacaoAtiva = contratar(admin, ativa, "MENSAL");
        Contrato daVelha = assinado(admin, velha, modelo, contratacaoVelha);
        Contrato daRecente = assinado(admin, recente, modelo, contratacaoRecente);
        Contrato daAtiva = assinado(admin, ativa, modelo, contratacaoAtiva);
        // A assinatura é antiga em todos: quem decide é a contratação.
        for (Contrato c : List.of(daVelha, daRecente, daAtiva)) {
            assinadoEm(c, HOJE.minusYears(10));
        }
        encerradaEm(contratacaoVelha, HOJE.minusYears(6));
        encerradaEm(contratacaoRecente, HOJE.minusYears(3));
        for (Aluno a : List.of(velha, recente, ativa)) {
            anonimizado(a);
        }

        assertThat(guarda.rodarNa(consultoria, HOJE)).isEqualTo(1);

        confereApagado(daVelha);
        confereGuardado(daRecente);
        confereGuardado(daAtiva);
    }

    @Test
    void parcelaUnicaQueTerminouHaMaisDeCincoAnosApagaPeloFimDaVigencia() throws Exception {
        Aluno aluno = novoAluno(admin);
        String contratacao = contratar(admin, aluno, "PARCELA_UNICA");
        Contrato c = assinado(admin, aluno, modelo, contratacao);
        assinadoEm(c, HOJE.minusYears(10));
        // Ainda ATIVA, mas o único ciclo (início + 1 mês) acabou há quase sete anos.
        jdbc.update("update contratacao_aluno set inicio = ?, ancora = ? where id = ?::uuid",
                Date.valueOf(HOJE.minusYears(7)), Date.valueOf(HOJE.minusYears(7)), contratacao);
        anonimizado(aluno);

        assertThat(guarda.rodarNa(consultoria, HOJE)).isEqualTo(1);

        confereApagado(c);
    }

    // ---- idempotência, isolamento e falha ----

    @Test
    void rodarDuasVezesApagaUmaVezSoEASegundaDevolveZero() throws Exception {
        Aluno aluno = novoAluno(admin);
        Contrato c = assinado(admin, aluno, modelo, null);
        assinadoEm(c, HOJE.minusYears(6));
        anonimizado(aluno);

        assertThat(guarda.rodarNa(consultoria, HOJE)).isEqualTo(1);
        Object apagadoEm = linha(c).get("apagado_em");
        Object versao = linha(c).get("versao");

        assertThat(guarda.rodarNa(consultoria, HOJE)).isZero();
        assertThat(linha(c).get("apagado_em")).isEqualTo(apagadoEm);
        assertThat(linha(c).get("versao")).isEqualTo(versao);
        assertThat(guarda.rodar(HOJE).consultoriasQueFalharam()).isZero();
    }

    @Test
    void aRodadaDeUmaConsultoriaNaoTocaNaOutra() throws Exception {
        JsonNode outroAdmin = api.novoTreinador();
        UUID outra = consultoriaDe(outroAdmin);
        Aluno meu = novoAluno(admin);
        Aluno dela = novoAluno(outroAdmin);
        Contrato meuContrato = assinado(admin, meu, modelo, null);
        Contrato delaContrato = assinado(outroAdmin, dela, modeloDe(outroAdmin), null);
        assinadoEm(meuContrato, HOJE.minusYears(6));
        assinadoEm(delaContrato, HOJE.minusYears(6));
        anonimizado(meu);
        anonimizado(dela);

        assertThat(guarda.rodarNa(consultoria, HOJE)).isEqualTo(1);
        confereApagado(meuContrato);
        confereGuardado(delaContrato);

        assertThat(guarda.rodarNa(outra, HOJE)).isEqualTo(1);
        confereApagado(delaContrato);
    }

    @Test
    void falhaEmUmaConsultoriaVaiAoLogSemDadoNaoImpedeAOutraEEContada() throws Exception {
        JsonNode outroAdmin = api.novoTreinador();
        UUID outra = consultoriaDe(outroAdmin);
        Aluno meu = novoAluno(admin);
        Aluno dela = novoAluno(outroAdmin);
        Contrato meuContrato = assinado(admin, meu, modelo, null);
        Contrato delaContrato = assinado(outroAdmin, dela, modeloDe(outroAdmin), null);
        assinadoEm(meuContrato, HOJE.minusYears(6));
        assinadoEm(delaContrato, HOJE.minusYears(6));
        anonimizado(meu);
        anonimizado(dela);

        // O banco recusa o apagar só na consultoria dela (gatilho temporário, apagado no fim): a transação dela desfaz.
        String funcao = "guarda_teste_recusa_" + outra.toString().replace("-", "");
        jdbc.execute("create function " + funcao + "() returns trigger language plpgsql as $$ begin "
                + "if new.apagado_em is not null and new.consultoria_id = '" + outra + "'::uuid then "
                + "raise exception 'recusado no teste'; end if; return new; end $$");
        jdbc.execute("create trigger " + funcao + " before update on contrato_aluno for each row execute function " + funcao + "()");
        GuardaDoContratoAssinado.Resultado resultado;
        try {
            resultado = guarda.rodar(HOJE);
        } finally {
            jdbc.execute("drop trigger " + funcao + " on contrato_aluno");
            jdbc.execute("drop function " + funcao + "()");
        }

        assertThat(resultado.consultoriasQueFalharam()).isEqualTo(1);
        assertThat(resultado.apagados()).isGreaterThanOrEqualTo(1);
        confereApagado(meuContrato);
        confereGuardado(delaContrato);

        // O log diz qual consultoria falhou e a classe do erro, nunca o texto, o nome, o CPF nem a mensagem da exceção.
        List<String> erros = log.list.stream()
                .filter(e -> e.getLevel() == Level.ERROR && e.getLoggerName().endsWith("GuardaDoContratoAssinado"))
                .map(ILoggingEvent::getFormattedMessage).toList();
        assertThat(erros).hasSize(1);
        assertThat(erros.get(0)).contains(outra.toString())
                .doesNotContain(FRASE_SIGILOSA).doesNotContain(dela.nome()).doesNotContain(meu.nome()).doesNotContain("recusado no teste");

        // Sem o gatilho, a rodada seguinte cumpre o que ficou para trás.
        assertThat(guarda.rodarNa(outra, HOJE)).isEqualTo(1);
        confereApagado(delaContrato);
    }

    // ---- o que o resto do app enxerga depois ----

    @Test
    void contratoApagadoSegueSendoLidoPelaEquipePeloAlunoEPelaExportacaoSemQuebrar() throws Exception {
        Aluno aluno = novoAluno(admin);
        Contrato c = assinado(admin, aluno, modelo, null);
        assinadoEm(c, HOJE.minusYears(6));
        anonimizado(aluno);
        assertThat(guarda.rodarNa(consultoria, HOJE)).isEqualTo(1);

        JsonNode detalhe = api.get("/contratos/" + c.id(), admin, 200);
        assertThat(detalhe.get("situacao").asString()).isEqualTo("ASSINADO");
        assertThat(detalhe.get("sha256").asString()).isEqualTo(c.sha256());
        assertThat(detalhe.path("texto").isNull() || detalhe.path("texto").isMissingNode()).isTrue();
        assertThat(api.get("/alunos/" + aluno.id() + "/contratos", admin, 200).toString()).contains(c.id());
        assertThat(api.get("/aluno/contratos/" + c.id(), aluno.login(), 200).get("situacao").asString()).isEqualTo("ASSINADO");
        assertThat(api.get("/alunos/" + aluno.id() + "/exportacao", admin, 200).get("contratos").get("itens")).hasSize(1);
    }
}
