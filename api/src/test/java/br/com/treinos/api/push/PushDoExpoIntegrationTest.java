package br.com.treinos.api.push;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.web.Fuso;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Push do Expo para compromisso marcado, remarcado ou cancelado, com um Expo de mentira (servidor do JDK; nunca o real): as
 * rotas do token (formato, limite de 5, idempotência, só aluno, apagar sem corpo), o token único no banco (o aparelho que muda
 * de consultoria deixa de avisar o dono antigo) e a validade de 30 dias, a fila (só com token, sem duplicar), o texto fixo sem
 * dado pessoal, a falha do Expo (500, tempo máximo, resposta inválida) que não desfaz o compromisso e conta tentativa, o erro
 * definitivo do ticket, o {@code DeviceNotRegistered} (inclusive o lote misto), o token órfão de usuário inativo, a exportação
 * sem o valor do token, o token que não vai a log e o token apagado quando a sessão acaba (inativar, anonimizar, "Excluir minha
 * conta", troca de senha e senha provisória).
 * O job é chamado à mão ({@code envio-agendado: false}) e processa a fila inteira do banco compartilhado: cada teste só afirma
 * sobre as linhas e os tokens que ele mesmo criou (e cancela os pendentes que sobraram da própria consultoria no fim). Só
 * dados fictícios; valores-sentinela para provar que nada vaza.
 */
@AutoConfigureMockMvc
@ExtendWith(OutputCaptureExtension.class)
class PushDoExpoIntegrationTest extends AbstractIntegrationTest {

    private static final ExpoFalso EXPO = new ExpoFalso();
    private static final String SENTINELA_LOCAL = "Sala Sentinela Zx9";
    private static final String SENTINELA_OBS = "Observacao sentinela Qw7";
    private static final String SENTINELA_NOME = "Aluno Sentinela Kt3";
    private static final String HORA = "07:45"; // o primeiro compromisso de cada teste

    @DynamicPropertySource
    static void expoDeMentira(DynamicPropertyRegistry registry) {
        registry.add("treinos.push.expo-url", EXPO::url);
        registry.add("treinos.push.timeout-segundos", () -> "1");
    }

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private PushDoExpo job;

    private ApiDeTeste api;
    private JsonNode admin;
    private UUID alunoId;
    private JsonNode login;
    private String usuarioId;
    private UUID consultoriaId;
    /** Os tokens que ESTE teste registrou: o que o Expo recebeu de outras linhas do banco compartilhado não conta. */
    private final Set<String> meusTokens = new HashSet<>();

    @BeforeEach
    void preparar() throws Exception {
        EXPO.zerar();
        meusTokens.clear();
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        alunoId = api.criarAluno(admin, SENTINELA_NOME);
        login = api.convidarEEntrar(admin, alunoId);
        usuarioId = login.path("usuario").path("id").asString();
        consultoriaId = consultoriaDe(login);
    }

    @AfterEach
    void limparOQueSobrou() {
        // Pendente que o teste deixou para trás não pode ser enviado (nem contado) por outro teste.
        jdbc.update("update push_envio set situacao = 'CANCELADO', motivo = 'TESTE' where situacao = 'PENDENTE' and consultoria_id = ?",
                consultoriaId);
    }

    // ---- auxiliares ----

    private static String tokenNovo() {
        return "ExponentPushToken[" + UUID.randomUUID().toString().replace("-", "") + "]";
    }

    private void registrar(JsonNode quem, String token) throws Exception {
        api.put("/aluno/push-token", quem, Map.of("token", token, "plataforma", "ANDROID"), 204);
        meusTokens.add(token);
    }

    /** Os tokens deste teste que o Expo recebeu, na ordem. */
    private List<String> meusDestinatarios() {
        return EXPO.destinatarios().stream().filter(meusTokens::contains).toList();
    }

    /** As chamadas ao Expo que levaram algum token deste teste. */
    private List<ExpoFalso.Chamada> minhasChamadas() {
        return EXPO.chamadas().stream().filter(c -> meusTokens.stream().anyMatch(c.corpo()::contains)).toList();
    }

    private int tokensComValor(String token) {
        return jdbc.queryForObject("select count(*) from push_token where token = ?", Integer.class, token);
    }

    private int tokens(String usuario) {
        return jdbc.queryForObject("select count(*) from push_token where usuario_id = ?::uuid", Integer.class, usuario);
    }

    private int envios(String usuario, String situacao) {
        return jdbc.queryForObject("select count(*) from push_envio where usuario_id = ?::uuid and situacao = ?", Integer.class,
                usuario, situacao);
    }

    private Map<String, Object> envioDe(String usuario) {
        return jdbc.queryForMap("select situacao, motivo, tentativas, erro from push_envio where usuario_id = ?::uuid "
                + "order by criado_em desc limit 1", usuario);
    }

    private UUID consultoriaDe(JsonNode quem) {
        return jdbc.queryForObject("select consultoria_id from usuario where id = ?::uuid", UUID.class,
                quem.path("usuario").path("id").asString());
    }

    private Map<String, Object> pedido(JsonNode treinador, List<UUID> alunos, String hora) {
        Map<String, Object> corpo = new HashMap<>();
        corpo.put("alunoIds", alunos);
        corpo.put("responsavelId", treinador.path("usuario").path("id").asString());
        corpo.put("data", LocalDate.now(Fuso.BRASILIA).plusDays(2).toString());
        corpo.put("hora", hora);
        corpo.put("duracaoMinutos", 60);
        corpo.put("local", SENTINELA_LOCAL);
        corpo.put("observacao", SENTINELA_OBS);
        return corpo;
    }

    private int marcados;

    /** Cada compromisso de um teste cai num horário diferente (o mesmo responsável não pode ter dois sobrepostos). */
    private JsonNode marcar(JsonNode treinador, UUID aluno) throws Exception {
        String hora = String.format("%02d:45", 7 + 2 * marcados++);
        return api.post("/agenda/compromissos", treinador, pedido(treinador, List.of(aluno), hora), 200);
    }

    private void tentarDeNovoJa(String usuario) {
        jdbc.update("update push_envio set proxima_tentativa = now() where usuario_id = ?::uuid and situacao = 'PENDENTE'", usuario);
    }

    // ---- rotas do token ----

    @Test
    void registrarEhIdempotenteEGuardaNoMaximoCincoAparelhos() throws Exception {
        String primeiro = tokenNovo();
        registrar(login, primeiro);
        registrar(login, primeiro);
        assertThat(tokens(usuarioId)).isEqualTo(1);
        List<String> outros = List.of(tokenNovo(), tokenNovo(), tokenNovo(), tokenNovo(), tokenNovo());
        for (String t : outros) {
            registrar(login, t);
        }
        assertThat(tokens(usuarioId)).as("o 6º troca o mais antigo").isEqualTo(5);
        assertThat(jdbc.queryForObject("select count(*) from push_token where usuario_id = ?::uuid and token = ?", Integer.class,
                usuarioId, primeiro)).isZero();
    }

    @Test
    void formatoInvalidoEhRecusadoSemRepetirOToken() throws Exception {
        String ruim = "token-qualquer-que-nao-e-do-expo";
        String resposta = api.put("/aluno/push-token", login, Map.of("token", ruim, "plataforma", "ANDROID"), 400).toString();
        assertThat(resposta).doesNotContain(ruim);
        api.put("/aluno/push-token", login, Map.of("token", "ExponentPushToken[]", "plataforma", "IOS"), 400);
        api.put("/aluno/push-token", login, Map.of("token", "ExponentPushToken[" + "a".repeat(190) + "]", "plataforma", "IOS"), 400);
        api.put("/aluno/push-token", login, Map.of("token", tokenNovo(), "plataforma", "WINDOWS"), 400);
        assertThat(tokens(usuarioId)).isZero();
        // ExpoPushToken[...] (o formato antigo) também vale.
        api.put("/aluno/push-token", login, Map.of("token", "ExpoPushToken[abcdefgh12345678]", "plataforma", "IOS"), 204);
        assertThat(tokens(usuarioId)).isEqualTo(1);
    }

    @Test
    void removerEhIdempotenteESoAfetaOProprioAluno() throws Exception {
        UUID outroAluno = api.criarAluno(admin, "Outro Aluno Fictício Push");
        JsonNode outroLogin = api.convidarEEntrar(admin, outroAluno);
        String meu = tokenNovo();
        String dele = tokenNovo();
        registrar(login, meu);
        registrar(outroLogin, dele);
        api.delete("/aluno/push-token", outroLogin, Map.of("token", meu), 204);
        assertThat(tokens(usuarioId)).as("o token do outro aluno não some pelo corpo de quem não é o dono").isEqualTo(1);
        api.delete("/aluno/push-token", login, Map.of("token", meu), 204);
        api.delete("/aluno/push-token", login, Map.of("token", meu), 204);
        assertThat(tokens(usuarioId)).isZero();
        assertThat(tokens(outroLogin.path("usuario").path("id").asString())).isEqualTo(1);
    }

    @Test
    void apagarSemCorpoTiraTodosOsTokensDoProprioAlunoESoDele() throws Exception {
        UUID outroAluno = api.criarAluno(admin, "Outro Aluno Fictício Sem Corpo");
        JsonNode outroLogin = api.convidarEEntrar(admin, outroAluno);
        registrar(login, tokenNovo());
        registrar(login, tokenNovo());
        registrar(outroLogin, tokenNovo());
        api.delete("/aluno/push-token", admin, 403);
        api.delete("/aluno/push-token", null, 401);
        assertThat(tokens(usuarioId)).isEqualTo(2);

        api.delete("/aluno/push-token", login, 204);
        api.delete("/aluno/push-token", login, 204);

        assertThat(tokens(usuarioId)).isZero();
        assertThat(tokens(outroLogin.path("usuario").path("id").asString())).as("o do outro aluno fica").isEqualTo(1);
    }

    @Test
    void tokenDeUmCorpoInvalidoNaoApareceNemNaRespostaNemNoLog(CapturedOutput saida) throws Exception {
        String ruim = "TokenSentinelaDoLog" + UUID.randomUUID().toString().replace("-", "");
        // Formato inválido (validação) e JSON quebrado (o erro de leitura costuma citar o trecho do corpo).
        String resposta = api.put("/aluno/push-token", login, Map.of("token", ruim, "plataforma", "ANDROID"), 400).toString();
        String respostaQuebrada = mvc.perform(put("/aluno/push-token").header("X-Treinos-Cliente", "nativo")
                        .header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(login)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"" + ruim + "\", \"plataforma\": "))
                .andExpect(status().isBadRequest()).andReturn().getResponse().getContentAsString();
        api.delete("/aluno/push-token", login, Map.of("token", "x".repeat(250)), 400);

        assertThat(resposta).doesNotContain(ruim);
        assertThat(respostaQuebrada).doesNotContain(ruim);
        assertThat(saida.getAll()).as("log e saída do processo").doesNotContain(ruim);
        assertThat(tokens(usuarioId)).isZero();
    }

    @Test
    void soAlunoRegistraEOMesmoTokenNaoFicaComDoisUsuarios() throws Exception {
        api.put("/aluno/push-token", admin, Map.of("token", tokenNovo(), "plataforma", "ANDROID"), 403);
        api.put("/aluno/push-token", null, Map.of("token", tokenNovo(), "plataforma", "ANDROID"), 401);
        UUID outroAluno = api.criarAluno(admin, "Aluno Que Pega O Aparelho");
        JsonNode outroLogin = api.convidarEEntrar(admin, outroAluno);
        String aparelho = tokenNovo();
        registrar(login, aparelho);
        registrar(outroLogin, aparelho);
        assertThat(tokens(usuarioId)).as("o aparelho passou para quem entrou depois").isZero();
        assertThat(tokens(outroLogin.path("usuario").path("id").asString())).isEqualTo(1);
    }

    @Test
    void euDizQueOPushEstaLigado() throws Exception {
        assertThat(api.get("/eu", login, 200).get("pushHabilitado").asBoolean()).isTrue();
    }

    // ---- fila ----

    @Test
    void soEnfileiraQuemTemTokenENaoDuplica() throws Exception {
        marcar(admin, alunoId);
        assertThat(envios(usuarioId, "PENDENTE")).as("sem token, nada na fila").isZero();

        registrar(login, tokenNovo());
        JsonNode primeiro = marcar(admin, alunoId);
        marcar(admin, alunoId);
        assertThat(envios(usuarioId, "PENDENTE")).as("várias mudanças seguidas viram um aviso só").isEqualTo(1);

        // Remarcar e cancelar também entram na fila, mas já há um pendente: continua um.
        api.post("/agenda/compromissos/" + primeiro.path("id").asString() + "/situacao", admin,
                Map.of("cancelado", true, "versao", primeiro.path("versao").asLong()), 200);
        assertThat(envios(usuarioId, "PENDENTE")).isEqualTo(1);

        job.rodar();
        assertThat(meusDestinatarios()).hasSize(1);
        assertThat(envios(usuarioId, "ENVIADO")).isEqualTo(1);
        job.rodar();
        assertThat(minhasChamadas()).as("nada pendente: nada novo é enviado").hasSize(1);

        // Depois de enviado, uma mudança nova gera um aviso novo.
        marcar(admin, alunoId);
        assertThat(envios(usuarioId, "PENDENTE")).isEqualTo(1);
    }

    @Test
    void remarcarECancelarGeramAviso() throws Exception {
        registrar(login, tokenNovo());
        JsonNode c = marcar(admin, alunoId);
        job.rodar();
        assertThat(envios(usuarioId, "ENVIADO")).isEqualTo(1);

        Map<String, Object> corpo = pedido(admin, List.of(alunoId), "09:15");
        corpo.put("versao", c.path("versao").asLong());
        JsonNode remarcado = api.put("/agenda/compromissos/" + c.path("id").asString(), admin, corpo, 200);
        assertThat(envios(usuarioId, "PENDENTE")).isEqualTo(1);
        job.rodar();

        api.post("/agenda/compromissos/" + c.path("id").asString() + "/situacao", admin,
                Map.of("cancelado", true, "versao", remarcado.path("versao").asLong()), 200);
        assertThat(envios(usuarioId, "PENDENTE")).isEqualTo(1);
        job.rodar();
        assertThat(meusDestinatarios()).hasSize(3);
    }

    @Test
    void textoFixoSemNenhumDadoPessoal() throws Exception {
        String token = tokenNovo();
        registrar(login, token);
        JsonNode c = marcar(admin, alunoId);
        job.rodar();

        assertThat(minhasChamadas()).hasSize(1);
        JsonNode lista = json.readTree(minhasChamadas().get(0).corpo());
        assertThat(lista.isArray()).isTrue();
        JsonNode m = null;
        for (JsonNode candidata : lista) {
            if (token.equals(candidata.get("to").asString())) {
                m = candidata;
            }
        }
        assertThat(m).as("a mensagem deste teste").isNotNull();
        String corpo = m.toString();
        assertThat(m.get("title").asString()).isEqualTo("Seu compromisso mudou. Abra o app para ver.");
        assertThat(m.get("body").asString()).isEqualTo("Seu compromisso mudou. Abra o app para ver.");
        assertThat(m.get("data").toString()).isEqualTo("{\"tipo\":\"compromisso\"}");
        assertThat(m.propertyNames()).containsExactlyInAnyOrder("to", "title", "body", "sound", "priority", "data");
        assertThat(corpo).doesNotContain(SENTINELA_NOME, "Sentinela", HORA, SENTINELA_LOCAL, SENTINELA_OBS, usuarioId,
                c.path("id").asString(), alunoId.toString());
        assertThat(minhasChamadas().get(0).autorizacao()).as("sem token de acesso configurado, sem Authorization").isNull();
    }

    @Test
    void mesmoAparelhoEmOutraConsultoriaTiraOTokenDoDonoAntigoENadaVazaParaAOutra() throws Exception {
        JsonNode outroTreinador = api.novoTreinador();
        UUID alunoDeFora = api.criarAluno(outroTreinador, "Aluno Fictício de Fora");
        JsonNode loginDeFora = api.convidarEEntrar(outroTreinador, alunoDeFora);
        String usuarioDeFora = loginDeFora.path("usuario").path("id").asString();
        String aparelho = tokenNovo();
        String outroAparelho = tokenNovo();
        registrar(login, aparelho);
        registrar(login, outroAparelho);
        // O aparelho muda de dono e de consultoria: o token antigo não pode ficar vivo no dono antigo.
        registrar(loginDeFora, aparelho);

        assertThat(tokensComValor(aparelho)).as("o token é único no banco").isEqualTo(1);
        assertThat(jdbc.queryForObject("select usuario_id::text from push_token where token = ?", String.class, aparelho))
                .isEqualTo(usuarioDeFora);
        assertThat(tokens(usuarioId)).as("o dono antigo ficou só com o outro aparelho").isEqualTo(1);
        // Nem por SQL direto o mesmo token existe duas vezes (índice único global).
        assertThatThrownBy(() -> jdbc.update("insert into push_token (id, consultoria_id, usuario_id, token, plataforma) "
                + "values (?, ?, ?::uuid, ?, 'IOS')", UUID.randomUUID(), consultoriaId, usuarioId, aparelho))
                .isInstanceOf(DataIntegrityViolationException.class);

        // O compromisso do aluno antigo chega só ao aparelho que ainda é dele; o aparelho que mudou de dono não recebe nada dele.
        marcar(admin, alunoId);
        job.rodar();
        assertThat(meusDestinatarios()).containsExactly(outroAparelho);
        assertThat(envios(usuarioDeFora, "PENDENTE") + envios(usuarioDeFora, "ENVIADO")).isZero();
        assertThat(consultoriaDe(login)).isNotEqualTo(consultoriaDe(loginDeFora));
        jdbc.update("update push_envio set situacao = 'CANCELADO', motivo = 'TESTE' where situacao = 'PENDENTE' and consultoria_id = ?",
                consultoriaDe(loginDeFora));
    }

    @Test
    void tokenQueOAppNaoRenovaHaMaisDeTrintaDiasExpira() throws Exception {
        String velho = tokenNovo();
        String recente = tokenNovo();
        registrar(login, velho);
        registrar(login, recente);
        jdbc.update("update push_token set atualizado_em = now() - interval '31 days' where token = ?", velho);
        jdbc.update("update push_token set atualizado_em = now() - interval '29 days' where token = ?", recente);

        job.rodar();

        assertThat(tokensComValor(velho)).as("passou de 30 dias sem renovar").isZero();
        assertThat(tokensComValor(recente)).isEqualTo(1);
        // Quem abre o app renova: registrar de novo zera o prazo.
        registrar(login, recente);
        assertThat(jdbc.queryForObject("select atualizado_em > now() - interval '1 minute' from push_token where token = ?",
                Boolean.class, recente)).isTrue();
    }

    // ---- falha do Expo ----

    @Test
    void falhaDoExpoNaoDesfazOCompromissoEContaTentativaAteFalhar() throws Exception {
        registrar(login, tokenNovo());
        EXPO.modo(ExpoFalso.Modo.ERRO_500);
        JsonNode c = marcar(admin, alunoId);

        job.rodar();
        assertThat(envios(usuarioId, "ENVIADO")).isZero();
        api.get("/agenda/compromissos/" + c.path("id").asString(), admin, 200);
        Map<String, Object> envio = envioDe(usuarioId);
        assertThat(envio.get("situacao")).isEqualTo("PENDENTE");
        assertThat(envio.get("tentativas")).isEqualTo(1);
        assertThat(envio.get("erro")).isEqualTo("HTTP_500");
        assertThat(tokens(usuarioId)).as("falha do Expo não apaga o token").isEqualTo(1);

        assertThat(job.rodar().executou()).isTrue();
        assertThat(minhasChamadas()).as("a nova tentativa espera o prazo").hasSize(1);

        tentarDeNovoJa(usuarioId);
        job.rodar();
        tentarDeNovoJa(usuarioId);
        job.rodar();
        envio = envioDe(usuarioId);
        assertThat(envio.get("situacao")).isEqualTo("FALHOU");
        assertThat(envio.get("tentativas")).isEqualTo(3);
        assertThat(minhasChamadas()).hasSize(3);
        api.get("/agenda/compromissos/" + c.path("id").asString(), admin, 200);
    }

    @Test
    void expoQueDemoraDemaisContaTentativaESemTravarNada() throws Exception {
        registrar(login, tokenNovo());
        EXPO.modo(ExpoFalso.Modo.LENTO);
        JsonNode c = marcar(admin, alunoId);
        job.rodar();
        Map<String, Object> envio = envioDe(usuarioId);
        assertThat(envio.get("situacao")).isEqualTo("PENDENTE");
        assertThat(envio.get("tentativas")).isEqualTo(1);
        assertThat((String) envio.get("erro")).contains("Timeout");
        api.get("/agenda/compromissos/" + c.path("id").asString(), admin, 200);
    }

    @Test
    void deviceNotRegisteredApagaOToken() throws Exception {
        String morto = tokenNovo();
        String vivo = tokenNovo();
        registrar(login, morto);
        EXPO.modo(ExpoFalso.Modo.DEVICE_NOT_REGISTERED);
        marcar(admin, alunoId);
        job.rodar();
        assertThat(tokens(usuarioId)).isZero();
        assertThat(envios(usuarioId, "ENVIADO")).isEqualTo(1);

        // Sem token, a próxima mudança nem entra na fila.
        EXPO.zerar();
        marcar(admin, alunoId);
        assertThat(envios(usuarioId, "PENDENTE")).isZero();
        registrar(login, vivo);
        assertThat(tokens(usuarioId)).isEqualTo(1);
    }

    @Test
    void deviceNotRegisteredNumLoteMistoApagaSoOMortoEAEnvioSegueEnviado() throws Exception {
        String vivo = tokenNovo();
        String morto = tokenNovo();
        registrar(login, vivo);
        registrar(login, morto);
        EXPO.matar(morto);
        marcar(admin, alunoId);

        job.rodar();

        assertThat(meusDestinatarios()).as("os dois no mesmo envio").containsExactlyInAnyOrder(vivo, morto);
        assertThat(tokensComValor(morto)).isZero();
        assertThat(tokensComValor(vivo)).isEqualTo(1);
        assertThat(envios(usuarioId, "ENVIADO")).isEqualTo(1);
        assertThat(envios(usuarioId, "PENDENTE")).isZero();
    }

    @Test
    void erroDefinitivoDoTicketViraFalhouNaHoraComOCodigoDoExpo() throws Exception {
        registrar(login, tokenNovo());
        EXPO.modo(ExpoFalso.Modo.INVALID_CREDENTIALS);
        marcar(admin, alunoId);

        PushDoExpo.Resultado r = job.rodar();

        Map<String, Object> envio = envioDe(usuarioId);
        assertThat(envio.get("situacao")).isEqualTo("FALHOU");
        assertThat(envio.get("tentativas")).isEqualTo(1);
        assertThat(envio.get("erro")).isEqualTo("InvalidCredentials");
        assertThat(r.falhasPorCodigo()).as("o resumo da rodada soma por código").containsKey("InvalidCredentials");
        assertThat(tokens(usuarioId)).as("credencial ruim não apaga o token do aparelho").isEqualTo(1);
        tentarDeNovoJa(usuarioId);
        EXPO.zerar();
        job.rodar();
        assertThat(meusDestinatarios()).as("FALHOU não volta à fila").isEmpty();
    }

    @Test
    void respostaSemDataOuComListaDeOutroTamanhoTentaDeNovo() throws Exception {
        registrar(login, tokenNovo());
        EXPO.modo(ExpoFalso.Modo.SEM_DATA);
        marcar(admin, alunoId);
        job.rodar();
        Map<String, Object> envio = envioDe(usuarioId);
        assertThat(envio.get("situacao")).as("não sabemos o que houve com a mensagem: tenta de novo").isEqualTo("PENDENTE");
        assertThat(envio.get("tentativas")).isEqualTo(1);
        assertThat(envio.get("erro")).isEqualTo("RESPOSTA_INVALIDA");

        tentarDeNovoJa(usuarioId);
        EXPO.modo(ExpoFalso.Modo.LISTA_CURTA);
        job.rodar();
        envio = envioDe(usuarioId);
        assertThat(envio.get("situacao")).isEqualTo("PENDENTE");
        assertThat(envio.get("tentativas")).isEqualTo(2);
        assertThat(envio.get("erro")).isEqualTo("RESPOSTA_INVALIDA");
        assertThat(tokens(usuarioId)).isEqualTo(1);
    }

    @Test
    void tokenOrfaoDeUsuarioInativoEhApagadoNoEnvio() throws Exception {
        registrar(login, tokenNovo());
        marcar(admin, alunoId);
        // A conta cai sem passar pelos pontos que apagam os tokens (ex.: sessão recusada antes de qualquer limpeza).
        jdbc.update("update usuario set ativo = false where id = ?::uuid", usuarioId);
        job.rodar();
        assertThat(meusDestinatarios()).isEmpty();
        assertThat(tokens(usuarioId)).isZero();
        assertThat(envioDe(usuarioId)).containsEntry("situacao", "CANCELADO").containsEntry("motivo", "USUARIO_INATIVO");
    }

    @Test
    void usuarioQueFicouSemTokenDepoisDeEnfileirarEhCanceladoSemChamarOExpo() throws Exception {
        registrar(login, tokenNovo());
        marcar(admin, alunoId);
        // O token some entre o enfileirar e o enviar (foi para outra conta ou expirou): nada de chamada vazia nem de tentativas.
        jdbc.update("delete from push_token where usuario_id = ?::uuid", usuarioId);
        job.rodar();
        assertThat(minhasChamadas()).isEmpty();
        assertThat(envioDe(usuarioId)).containsEntry("situacao", "CANCELADO").containsEntry("motivo", "SEM_TOKEN")
                .containsEntry("tentativas", 0);
    }

    @Test
    void pendenteVelhoDemaisExpiraSemEnviar() throws Exception {
        registrar(login, tokenNovo());
        marcar(admin, alunoId);
        jdbc.update("update push_envio set criado_em = now() - interval '7 hours' where usuario_id = ?::uuid", usuarioId);
        job.rodar();
        assertThat(meusDestinatarios()).isEmpty();
        assertThat(envioDe(usuarioId)).containsEntry("situacao", "CANCELADO").containsEntry("motivo", "EXPIRADO");
    }

    // ---- exportação ----

    @Test
    void exportacaoMostraSoOsMetadadosDoToken() throws Exception {
        String token = tokenNovo();
        registrar(login, token);
        JsonNode exportacao = api.get("/alunos/" + alunoId + "/exportacao", admin, 200);
        JsonNode itens = exportacao.path("pushDoCelular").path("itens");
        assertThat(itens).hasSize(1);
        assertThat(itens.get(0).propertyNames()).containsExactlyInAnyOrder("plataforma", "registradoEm");
        assertThat(itens.get(0).path("plataforma").asString()).isEqualTo("ANDROID");
        assertThat(exportacao.toString()).doesNotContain(token).doesNotContain("PushToken[");
    }

    // ---- o token acaba com a sessão ----

    @Test
    void inativarApagaOTokenSoDoAluno() throws Exception {
        UUID outroAluno = api.criarAluno(admin, "Aluno Que Fica Com Push");
        JsonNode outroLogin = api.convidarEEntrar(admin, outroAluno);
        registrar(login, tokenNovo());
        registrar(outroLogin, tokenNovo());
        api.patch("/alunos/" + alunoId + "/situacao", admin, Map.of("ativo", false), 200);
        assertThat(tokens(usuarioId)).isZero();
        assertThat(tokens(outroLogin.path("usuario").path("id").asString())).isEqualTo(1);
    }

    @Test
    void anonimizarApagaOToken() throws Exception {
        api.patch("/alunos/" + alunoId + "/situacao", admin, Map.of("ativo", false), 200);
        jdbc.update("insert into push_token (id, consultoria_id, usuario_id, token, plataforma) values (?, ?, ?::uuid, ?, 'IOS')",
                UUID.randomUUID(), consultoriaDe(login), usuarioId, tokenNovo());
        assertThat(tokens(usuarioId)).isEqualTo(1);
        api.post("/alunos/" + alunoId + "/anonimizar", admin, Map.of("nomeConfirmado", SENTINELA_NOME), 200);
        assertThat(tokens(usuarioId)).isZero();
    }

    @Test
    void excluirMinhaContaApagaOToken() throws Exception {
        registrar(login, tokenNovo());
        api.post("/aluno/conta/excluir", login, Map.of("senha", ApiDeTeste.SENHA, "confirmacao", "EXCLUIR"), 204);
        assertThat(tokens(usuarioId)).isZero();
    }

    @Test
    void trocarASenhaApagaOToken() throws Exception {
        registrar(login, tokenNovo());
        api.put("/eu/senha", login, Map.of("senhaAtual", ApiDeTeste.SENHA, "senhaNova", "outra-senha-456"), 200);
        assertThat(tokens(usuarioId)).isZero();
    }

    @Test
    void senhaProvisoriaDoTreinadorApagaOToken() throws Exception {
        registrar(login, tokenNovo());
        api.put("/alunos/" + alunoId + "/acesso", admin,
                Map.of("email", ApiDeTeste.emailUnico("aluno-novo"), "senha", "provisoria-789"), 200);
        assertThat(tokens(usuarioId)).isZero();
    }
}
