package br.com.treinos.api.whatsapp;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.web.Fuso;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.UUID;

/**
 * Base dos testes do WhatsApp com a Meta de mentira: um servidor só para todas as classes (o contexto do Spring é o mesmo e
 * não se recria a cada classe). O {@code application-test.yml} liga o WhatsApp com valores fictícios e deixa o envio agendado
 * desligado; os testes chamam {@link WhatsAppDaFila#rodar()} à mão. O banco é compartilhado: cada teste usa o próprio token de
 * acesso (é por ele que se reconhece o que a Meta de mentira recebeu), telefone próprio e cancela no fim o que sobrou pendente
 * das suas consultorias, para o job de outro teste não o enviar.
 */
@AutoConfigureMockMvc
abstract class WhatsAppIntegrationTestBase extends AbstractIntegrationTest {

    static final MetaFalsa META = new MetaFalsa();
    private static final Random SORTEIO = new Random();

    @DynamicPropertySource
    static void metaDeMentira(DynamicPropertyRegistry registry) {
        registry.add("treinos.whatsapp.meta-url", META::url);
        registry.add("treinos.whatsapp.timeout-segundos", () -> "1");
    }

    /** Um aluno com acesso e telefone (o que a Meta recebe como destino é {@code 55} + os dígitos de {@code telefone}). */
    record AlunoDeTeste(UUID id, JsonNode login, String telefone) {

        String destino() {
            return "55" + telefone.replaceAll("\\D", "");
        }
    }

    @Autowired protected MockMvc mvc;
    @Autowired protected JsonMapper json;
    @Autowired protected JdbcTemplate jdbc;

    protected ApiDeTeste api;
    protected JsonNode admin;
    /** O token de acesso fictício deste teste (único: a Meta de mentira o usa para separar as chamadas de cada teste). */
    protected String token;
    private final List<UUID> consultoriasDoTeste = new ArrayList<>();

    @BeforeEach
    void prepararBase() throws Exception {
        META.zerar();
        api = new ApiDeTeste(mvc, json);
        admin = novaConsultoria();
        token = tokenNovo();
    }

    @AfterEach
    void limparPendentesDoTeste() {
        // Pendente que o teste deixou para trás não pode ser enviado (nem contado) por outro teste.
        consultoriasDoTeste.forEach(c -> jdbc.update("update whatsapp_envio set situacao = 'CANCELADO', motivo = 'TESTE', "
                + "reservado_por = null, reserva_ate = null where situacao = 'PENDENTE' and consultoria_id = ?", c));
    }

    static String tokenNovo() {
        return "EAAfake" + UUID.randomUUID().toString().replace("-", "");
    }

    /** Um treinador novo (consultoria nova), já acompanhado para a limpeza do fim do teste. */
    protected JsonNode novaConsultoria() throws Exception {
        JsonNode login = api.novoTreinador();
        consultoriasDoTeste.add(consultoriaDe(login));
        return login;
    }

    protected UUID consultoriaDe(JsonNode login) {
        return jdbc.queryForObject("select consultoria_id from usuario where id = ?::uuid", UUID.class,
                login.path("usuario").path("id").asString());
    }

    protected static Map<String, Object> pedidoDaConexao(String accessToken, Long versao) {
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("phoneNumberId", "10555" + (10_000 + SORTEIO.nextInt(80_000)));
        corpo.put("wabaId", "20777" + (10_000 + SORTEIO.nextInt(80_000)));
        if (accessToken != null) {
            corpo.put("accessToken", accessToken);
        }
        if (versao != null) {
            corpo.put("versao", versao);
        }
        return corpo;
    }

    /** Cria a conexão da consultoria de {@code quem} com o token dado. */
    protected JsonNode conectar(JsonNode quem, String accessToken) throws Exception {
        return api.put("/whatsapp/conexao", quem, pedidoDaConexao(accessToken, null), 200);
    }

    /** Cadastra o modelo do tipo (nome da Meta no padrão minúsculas e sublinhado). */
    protected JsonNode modelo(JsonNode quem, String tipo, String nome) throws Exception {
        return api.put("/whatsapp/modelos/" + tipo, quem, Map.of("nome", nome, "idioma", "pt_BR"), 200);
    }

    protected AlunoDeTeste alunoComTelefone(JsonNode treinador, String nome) throws Exception {
        String telefone = String.format("(45) 99%03d-%04d", SORTEIO.nextInt(1000), SORTEIO.nextInt(10_000));
        UUID id = UUID.fromString(api.post("/alunos", treinador, Map.of("nome", nome, "telefone", telefone), 200)
                .path("id").asString());
        return new AlunoDeTeste(id, api.convidarEEntrar(treinador, id), telefone);
    }

    private int marcados;

    /** Marca um compromisso (cada um num horário diferente: o mesmo responsável não pode ter dois sobrepostos). */
    protected JsonNode marcar(JsonNode treinador, UUID aluno) throws Exception {
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("alunoIds", List.of(aluno));
        corpo.put("responsavelId", treinador.path("usuario").path("id").asString());
        corpo.put("data", LocalDate.now(Fuso.BRASILIA).plusDays(2).toString());
        corpo.put("hora", String.format("%02d:45", 7 + marcados++));
        corpo.put("duracaoMinutos", 30);
        corpo.put("local", "Sala fictícia");
        return api.post("/agenda/compromissos", treinador, corpo, 200);
    }

    /** Troca o perfil do usuário por SQL (Administrador, Treinador ou Assistente) para provar o 403. */
    protected void trocarPerfil(JsonNode login, String perfil) {
        jdbc.update("update usuario u set perfil_id = p.id from perfil p where u.id = ?::uuid "
                + "and p.consultoria_id = u.consultoria_id and p.nome = ?", login.path("usuario").path("id").asString(), perfil);
    }

    protected JsonNode autorizar(AlunoDeTeste aluno, boolean receber, int esperado) throws Exception {
        return api.put("/aluno/avisos-pelo-whatsapp", aluno.login(), Map.of("receber", receber), esperado);
    }

    protected Map<String, Object> envioDe(UUID alunoId) {
        return jdbc.queryForMap("select tipo, situacao, motivo, tentativas, codigo_erro, id_externo, enviado_em, entregue_em, lido_em "
                + "from whatsapp_envio where aluno_id = ? order by criado_em desc limit 1", alunoId);
    }

    protected int enviosDe(UUID alunoId) {
        return jdbc.queryForObject("select count(*) from whatsapp_envio where aluno_id = ?", Integer.class, alunoId);
    }

    protected int auditorias(UUID consultoria, String acao) {
        return jdbc.queryForObject("select count(*) from auditoria where consultoria_id = ? and acao = ?", Integer.class,
                consultoria, acao);
    }
}
