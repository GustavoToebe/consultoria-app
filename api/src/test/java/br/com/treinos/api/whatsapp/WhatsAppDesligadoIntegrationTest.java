package br.com.treinos.api.whatsapp;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.web.Fuso;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * A API subindo como na produção ANTES de existir qualquer variável do WhatsApp: a chave desligada e as quatro variáveis
 * ({@code TREINOS_WHATSAPP_CHAVES}, {@code _CHAVE_ATIVA}, {@code _META_APP_SECRET}, {@code _META_VERIFY_TOKEN}) vazias; o envio
 * agendado fica ligado (o padrão) e sai sem fazer nada. O {@code application-test.yml} liga tudo; aqui as propriedades dinâmicas
 * esvaziam cada uma, então este contexto não herda nada. Prova que a subida não exige nada, que nada do WhatsApp responde (503
 * {@code WHATSAPP_INDISPONIVEL}, webhook incluído), que a agenda não enfileira nem com tudo gravado no banco e que uma conexão
 * cifrada parada no banco (alguém ligou, configurou e desligou) não derruba a subida.
 */
@AutoConfigureMockMvc
class WhatsAppDesligadoIntegrationTest extends AbstractIntegrationTest {

    @DynamicPropertySource
    static void semNenhumaVariavel(DynamicPropertyRegistry registry) {
        registry.add("treinos.whatsapp.habilitado", () -> "false");
        registry.add("treinos.whatsapp.chaves", () -> "");
        registry.add("treinos.whatsapp.chave-ativa", () -> "");
        registry.add("treinos.whatsapp.meta-app-secret", () -> "");
        registry.add("treinos.whatsapp.meta-verify-token", () -> "");
        registry.add("treinos.whatsapp.envio-agendado", () -> "true");
    }

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private WhatsAppProperties propriedades;
    @Autowired private CifraDoWhatsApp cifra;
    @Autowired private WhatsAppDaFila job;
    @Autowired private VerificacaoDasConexoes verificacao;

    private ApiDeTeste api;
    private JsonNode admin;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
    }

    @Test
    void oContextoSobeSemExigirNadaEAsConfiguracoesFicamVazias() {
        assertThat(propriedades.habilitado()).isFalse();
        assertThat(propriedades.chaves()).isEmpty();
        assertThat(propriedades.chaveAtiva()).isEmpty();
        assertThat(propriedades.metaAppSecret()).isEmpty();
        assertThat(propriedades.metaVerifyToken()).isEmpty();
        assertThat(propriedades.envioAgendado()).isTrue();
        assertThat(cifra.configurada()).isFalse();
        assertThat(cifra.idsDasChaves()).isEmpty();
        // O job agendado, ligado por padrão, sai sem consultar nem gravar nada.
        assertThat(job.rodar().executou()).isFalse();
        assertThatCode(job::rodarAgendado).doesNotThrowAnyException();
    }

    @Test
    void euDizQueNaoEstaLigadoETodasAsRotasRespondem503() throws Exception {
        assertThat(api.get("/eu", admin, 200).path("whatsappHabilitado").asBoolean()).isFalse();
        UUID alunoId = api.criarAluno(admin, "Aluno Fictício WhatsApp Desligado " + UUID.randomUUID());
        JsonNode aluno = api.convidarEEntrar(admin, alunoId);
        assertThat(api.get("/eu", aluno, 200).path("whatsappHabilitado").asBoolean()).isFalse();

        Map<String, Object> conexao = Map.of("phoneNumberId", "12345", "wabaId", "67890", "accessToken", "EAAfake" + UUID.randomUUID());
        Map<String, Object> modelo = Map.of("nome", "lembrete_x", "idioma", "pt_BR");
        assertThat(api.get("/whatsapp/conexao", admin, 503).path("codigo").asString()).isEqualTo("WHATSAPP_INDISPONIVEL");
        api.put("/whatsapp/conexao", admin, conexao, 503);
        api.delete("/whatsapp/conexao", admin, 503);
        api.get("/whatsapp/modelos", admin, 503);
        api.put("/whatsapp/modelos/ANTES", admin, modelo, 503);
        api.delete("/whatsapp/modelos/ANTES", admin, 503);
        api.get("/aluno/avisos-pelo-whatsapp", aluno, 503);
        api.put("/aluno/avisos-pelo-whatsapp", aluno, Map.of("receber", true), 503);
        assertThat(jdbc.queryForObject("select count(*) from whatsapp_conexao where consultoria_id = ?", Integer.class,
                consultoriaDe(admin))).as("nada foi gravado").isZero();

        // O webhook (público) também: nunca aceita assinatura com app secret vazio, nem verificar o cadastro.
        assertThat(mvc.perform(get("/publico/whatsapp/meta").param("hub.mode", "subscribe").param("hub.verify_token", "")
                .param("hub.challenge", "123")).andReturn().getResponse().getStatus()).isEqualTo(503);
        String corpo = "{\"entry\":[]}";
        assertThat(mvc.perform(post("/publico/whatsapp/meta").header("X-Hub-Signature-256", "sha256=" + "0".repeat(64))
                .content(corpo.getBytes(StandardCharsets.UTF_8))).andReturn().getResponse().getStatus()).isEqualTo(503);
    }

    @Test
    void agendaNaoEnfileiraNemComTudoGravadoNoBancoEUmaConexaoParadaNaoDerrubaASubida() throws Exception {
        UUID consultoria = consultoriaDe(admin);
        UUID alunoId = api.criarAluno(admin, "Aluna Fictícia Agenda Desligada " + UUID.randomUUID());
        api.convidarEEntrar(admin, alunoId);
        UUID conexaoId = UUID.randomUUID();
        // Alguém ligou, configurou e desligou: conexão cifrada com id de chave que não existe mais, modelo e opt-in ficaram.
        jdbc.update("insert into whatsapp_conexao (id, consultoria_id, phone_number_id, waba_id, token_cifrado) "
                + "values (?, ?, '12345', '67890', 'v1:chave-que-saiu:AAAAAAAAAAAAAAAA:AAAA')", conexaoId, consultoria);
        try {
            jdbc.update("insert into whatsapp_modelo (id, consultoria_id, tipo, nome, idioma) values (?, ?, 'COMPROMISSO_NOVO', "
                    + "'compromisso_novo', 'pt_BR')", UUID.randomUUID(), consultoria);
            jdbc.update("update aluno set whatsapp_avisos_autorizado_em = now() where id = ?", alunoId);

            assertThatCode(() -> verificacao.run(null)).as("desligado, a subida não confere a chave").doesNotThrowAnyException();
            api.post("/agenda/compromissos", admin, Map.of("alunoIds", List.of(alunoId),
                    "responsavelId", admin.path("usuario").path("id").asString(),
                    "data", LocalDate.now(Fuso.BRASILIA).plusDays(2).toString(), "hora", "10:00", "duracaoMinutos", 30), 200);

            assertThat(jdbc.queryForObject("select count(*) from whatsapp_envio where aluno_id = ?", Integer.class, alunoId))
                    .as("a chave desligada fecha a fila").isZero();
            assertThat(job.rodar().executou()).isFalse();
        } finally {
            jdbc.update("delete from whatsapp_modelo where consultoria_id = ?", consultoria);
            jdbc.update("delete from whatsapp_conexao where id = ?", conexaoId);
        }
    }

    private UUID consultoriaDe(JsonNode login) {
        return jdbc.queryForObject("select consultoria_id from usuario where id = ?::uuid", UUID.class,
                login.path("usuario").path("id").asString());
    }
}
