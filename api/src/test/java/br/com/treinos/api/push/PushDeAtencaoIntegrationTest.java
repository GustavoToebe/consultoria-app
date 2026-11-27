package br.com.treinos.api.push;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.tenant.TenantContext;
import br.com.treinos.api.web.Fuso;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.IllegalTransactionStateException;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Push das regras de atenção ao membro da equipe (R7, R8, C7): só o responsável do aluno, ativo, com {@code ATUALIZACAO_LER} +
 * {@code ALUNO_SENSIVEL_LER} (o Administrador incluso, sem linhas em {@code perfil_permissao}), com a preferência ligada e token;
 * texto fixo sem nome nem quantos; na mesma transação do envio; o job confere de novo sem apagar o token de quem só não recebe;
 * a preferência ({@code /eu/preferencias-de-push}), o token do treinador ({@code /eu/push-token}) e a equipe que apaga o token de
 * quem perdeu acesso. Expo de mentira; cada teste só afirma sobre os próprios usuários e tokens. Dados fictícios.
 */
@AutoConfigureMockMvc
class PushDeAtencaoIntegrationTest extends AbstractIntegrationTest {

    private static final ExpoFalso EXPO = new ExpoFalso();
    private static final String SENTINELA_NOME = "Aluno Sentinela At7";
    private static final String CONTEUDO = """
        {"formato":2,"instrucoes":[],"secoes":[{"uid":"s1","titulo":"Geral","perguntas":[
          {"id":"dor","tipo":"SIM_NAO","rotulo":"Dor","obrigatoria":false}]}]}
        """;
    private static final Set<String> COM_ATENCAO = Set.of("ALUNO_LER", "ALUNO_SENSIVEL_LER", "ATUALIZACAO_LER");

    @DynamicPropertySource
    static void expoDeMentira(DynamicPropertyRegistry registry) {
        registry.add("treinos.push.expo-url", EXPO::url);
        registry.add("treinos.push.timeout-segundos", () -> "1");
    }

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private PushDoExpo job;
    @Autowired private PushService push;
    @Autowired private PlatformTransactionManager transacoes;

    private ApiDeTeste api;
    private JsonNode admin;
    private UUID consultoria;
    private UUID versao;
    private UUID questionario;
    private final Set<String> meusTokens = new HashSet<>();

    record AlunoDeTeste(UUID id, JsonNode login, String pasta) { }

    @BeforeEach
    void preparar() throws Exception {
        EXPO.zerar();
        meusTokens.clear();
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        consultoria = jdbc.queryForObject("select consultoria_id from usuario where id = ?", UUID.class, idDe(admin));
        questionario = UUID.randomUUID();
        versao = UUID.randomUUID();
        jdbc.update("insert into questionario(id,consultoria_id,nome,rascunho,versao_publicada,publicado_em) values (?,?,?,?::jsonb,1,now())",
                questionario, consultoria, "Questionário fictício " + questionario, CONTEUDO);
        jdbc.update("insert into questionario_versao(id,consultoria_id,questionario_id,numero,conteudo) values (?,?,?,1,?::jsonb)",
                versao, consultoria, questionario, CONTEUDO);
        long v = api.get("/regras-de-atencao", admin, 200).path("versao").asLong();
        api.put("/regras-de-atencao", admin, Map.of("versao", v, "regras",
                List.of(Map.of("tipo", "SIM", "perguntaId", "dor", "ativa", true))), 200);
    }

    @AfterEach
    void limpar() {
        jdbc.update("update push_envio set situacao = 'CANCELADO', motivo = 'TESTE' where situacao = 'PENDENTE' and consultoria_id = ?",
                consultoria);
    }

    // ---- apoio ----

    private static UUID idDe(JsonNode quem) {
        return UUID.fromString(quem.path("usuario").path("id").asString());
    }

    /** Aluno do administrador (o criador vira o responsável), com pasta vigente e treino publicado. */
    private AlunoDeTeste aluno() throws Exception {
        UUID id = api.criarAluno(admin, SENTINELA_NOME);
        JsonNode login = api.convidarEEntrar(admin, id);
        jdbc.update("update aluno set questionario_id = ? where id = ?", questionario, id);
        LocalDate fim = LocalDate.now(Fuso.BRASILIA);
        String pasta = api.post("/alunos/" + id + "/pastas", admin,
                Map.of("titulo", "Período fictício", "inicio", fim.minusDays(27), "fim", fim), 200).path("id").asString();
        JsonNode criado = api.post("/alunos/" + id + "/planos-treino", admin, Map.of("titulo", "Treino fictício", "pastaId", pasta), 200);
        String plano = criado.path("plano").path("id").asString();
        JsonNode salvo = api.put("/planos-treino/" + plano + "/rascunho", admin,
                ApiDeTeste.rascunho("Treino fictício", ApiDeTeste.treino().conteudo(), criado.path("plano").path("versao").asLong()), 200);
        api.post("/planos-treino/" + plano + "/publicar", admin,
                Map.of("versao", salvo.path("plano").path("versao").asLong(), "confirmarAvisos", true), 200);
        return new AlunoDeTeste(id, login, pasta);
    }

    private AlunoDeTeste alunoDe(JsonNode responsavel) throws Exception {
        AlunoDeTeste a = aluno();
        jdbc.update("update aluno set responsavel_id = ? where id = ?", idDe(responsavel), a.id());
        return a;
    }

    private void enviar(AlunoDeTeste a, boolean dor) throws Exception {
        api.post("/aluno/atualizacao/enviar", a.login(),
                Map.of("pastaId", a.pasta(), "questionarioVersaoId", versao.toString(), "respostas", Map.of("dor", dor)), 200);
    }

    private JsonNode membro(Set<String> permissoes) throws Exception {
        String perfil = api.post("/perfis", admin, Map.of("nome", "Perfil " + UUID.randomUUID(), "permissoes", permissoes), 200)
                .path("id").asString();
        return membroComPerfil(perfil);
    }

    private JsonNode membroComPerfil(String perfil) throws Exception {
        JsonNode convite = api.post("/usuarios/convites", admin, Map.of("nome", "Membro fictício",
                "email", ApiDeTeste.emailUnico("membro"), "perfilId", perfil), 200);
        return api.post("/publico/convites-equipe/aceitar", null,
                Map.of("codigo", convite.path("codigo").asString(), "senha", ApiDeTeste.SENHA), 200);
    }

    private String registrar(JsonNode quem) throws Exception {
        String token = "ExponentPushToken[" + UUID.randomUUID().toString().replace("-", "") + "]";
        api.put("/eu/push-token", quem, Map.of("token", token, "plataforma", "ANDROID"), 204);
        meusTokens.add(token);
        return token;
    }

    private int pendentes(JsonNode quem) {
        return jdbc.queryForObject("select count(*) from push_envio where consultoria_id = ? and usuario_id = ? "
                + "and tipo = 'ATUALIZACAO_ATENCAO' and situacao = 'PENDENTE'", Integer.class, consultoria, idDe(quem));
    }

    private int tokens(JsonNode quem) {
        return jdbc.queryForObject("select count(*) from push_token where usuario_id = ?", Integer.class, idDe(quem));
    }

    private Map<String, Object> ultimoEnvio(JsonNode quem) {
        return jdbc.queryForMap("select situacao, motivo from push_envio where usuario_id = ? and tipo = 'ATUALIZACAO_ATENCAO' "
                + "order by criado_em desc limit 1", idDe(quem));
    }

    private List<ExpoFalso.Chamada> minhasChamadas() {
        return EXPO.chamadas().stream().filter(c -> meusTokens.stream().anyMatch(c.corpo()::contains)).toList();
    }

    // ---- envio ----

    @Test
    void administradorResponsavelRecebeTextoFixoSemNomeNemQuantosENaoPerdeOToken() throws Exception {
        String token = registrar(admin);
        enviar(aluno(), true);
        assertThat(pendentes(admin)).isEqualTo(1);

        job.rodar();

        List<ExpoFalso.Chamada> minhas = minhasChamadas();
        assertThat(minhas).hasSize(1);
        JsonNode mensagem = json.readTree(minhas.get(0).corpo()).get(0);
        assertThat(mensagem.path("to").asString()).isEqualTo(token);
        assertThat(mensagem.path("title").asString()).isEqualTo("Atualização com pontos de atenção");
        assertThat(mensagem.path("body").asString()).isEqualTo("Abra o app para ver.");
        assertThat(mensagem.path("data").path("tipo").asString()).isEqualTo("atencao");
        assertThat(minhas.get(0).corpo()).doesNotContain(SENTINELA_NOME).doesNotContain("Dor").doesNotContain("dor");
        assertThat(ultimoEnvio(admin)).containsEntry("situacao", "ENVIADO");
        // B1: o membro não é aluno, e o job não apaga o token dele por isso.
        assertThat(tokens(admin)).isEqualTo(1);
    }

    @Test
    void soOResponsavelEntraNaFila() throws Exception {
        JsonNode outro = membroComPerfil(api.get("/eu", admin, 200).path("perfil").path("id").asString());
        registrar(admin);
        registrar(outro);
        enviar(aluno(), true);
        assertThat(pendentes(admin)).isEqualTo(1);
        assertThat(pendentes(outro)).isZero();

        // Sem responsável, ninguém.
        AlunoDeTeste sem = aluno();
        jdbc.update("update aluno set responsavel_id = null where id = ?", sem.id());
        jdbc.update("update push_envio set situacao = 'CANCELADO', motivo = 'TESTE' where situacao = 'PENDENTE' and consultoria_id = ?",
                consultoria);
        enviar(sem, true);
        assertThat(pendentes(admin)).isZero();
        assertThat(pendentes(outro)).isZero();
    }

    @Test
    void membroComAsPermissoesRecebeESemElasNao() throws Exception {
        JsonNode comAtencao = membro(COM_ATENCAO);
        JsonNode semAtualizacao = membro(Set.of("ALUNO_LER"));
        registrar(comAtencao);
        registrar(semAtualizacao);
        enviar(alunoDe(comAtencao), true);
        enviar(alunoDe(semAtualizacao), true);
        assertThat(pendentes(comAtencao)).isEqualTo(1);
        assertThat(pendentes(semAtualizacao)).isZero();
    }

    @Test
    void semPreferenciaSemTokenOuSemPontoNadaEntraNaFila() throws Exception {
        // Sem token.
        enviar(aluno(), true);
        assertThat(pendentes(admin)).isZero();
        // Sem ponto de atenção.
        registrar(admin);
        enviar(aluno(), false);
        assertThat(pendentes(admin)).isZero();
        // Preferência desligada.
        api.put("/eu/preferencias-de-push", admin, Map.of("atencao", false), 200);
        enviar(aluno(), true);
        assertThat(pendentes(admin)).isZero();
        // Religada, volta.
        api.put("/eu/preferencias-de-push", admin, Map.of("atencao", true), 200);
        enviar(aluno(), true);
        assertThat(pendentes(admin)).isEqualTo(1);
    }

    @Test
    void reenvioIdempotenteNaoEnfileiraDeNovo() throws Exception {
        registrar(admin);
        AlunoDeTeste a = aluno();
        enviar(a, true);
        job.rodar();
        assertThat(pendentes(admin)).isZero();
        enviar(a, true);
        assertThat(pendentes(admin)).isZero();
    }

    @Test
    void enfileiraSoDentroDaTransacaoDeQuemChamaEORollbackLevaOPush() throws Exception {
        registrar(admin);
        AlunoDeTeste a = aluno();
        assertThatThrownBy(() -> push.enfileirarAtencaoAoResponsavel(consultoria, a.id()))
                .isInstanceOf(IllegalTransactionStateException.class);
        TransactionTemplate t = new TransactionTemplate(transacoes);
        TenantContext.executarComo(consultoria, () -> {
            t.executeWithoutResult(s -> {
                push.enfileirarAtencaoAoResponsavel(consultoria, a.id());
                assertThat(pendentes(admin)).isEqualTo(1);
                s.setRollbackOnly();
            });
            return null;
        });
        assertThat(pendentes(admin)).isZero();
    }

    @Test
    void jobConfereDeNovoNaHoraDoEnvio() throws Exception {
        registrar(admin);
        enviar(aluno(), true);
        // Desligou a preferência depois de enfileirar: cancela e guarda o token.
        api.put("/eu/preferencias-de-push", admin, Map.of("atencao", false), 200);
        job.rodar();
        assertThat(minhasChamadas()).isEmpty();
        assertThat(ultimoEnvio(admin)).containsEntry("situacao", "CANCELADO").containsEntry("motivo", "NAO_ELEGIVEL");
        assertThat(tokens(admin)).isEqualTo(1);

        // Membro com a permissão que a perdeu por fora (SQL, sem passar pela equipe): cancela e guarda o token.
        JsonNode membro = membro(COM_ATENCAO);
        registrar(membro);
        enviar(alunoDe(membro), true);
        UUID perfilSemAtualizacao = UUID.fromString(api.post("/perfis", admin,
                Map.of("nome", "Perfil " + UUID.randomUUID(), "permissoes", Set.of("ALUNO_LER")), 200).path("id").asString());
        jdbc.update("update usuario set perfil_id = ? where id = ?", perfilSemAtualizacao, idDe(membro));
        job.rodar();
        assertThat(ultimoEnvio(membro)).containsEntry("motivo", "NAO_ELEGIVEL");
        assertThat(tokens(membro)).isEqualTo(1);

        // Conta inativa: cancela e apaga os tokens.
        JsonNode inativo = membro(COM_ATENCAO);
        registrar(inativo);
        enviar(alunoDe(inativo), true);
        jdbc.update("update usuario set ativo = false where id = ?", idDe(inativo));
        job.rodar();
        assertThat(ultimoEnvio(inativo)).containsEntry("motivo", "USUARIO_INATIVO");
        assertThat(tokens(inativo)).isZero();
    }

    // ---- preferência ----

    @Test
    void preferenciaDaContaGetPutComAuditoriaSoQuandoMuda() throws Exception {
        assertThat(api.get("/eu/preferencias-de-push", admin, 200).path("atencao").asBoolean()).isTrue();
        assertThat(api.put("/eu/preferencias-de-push", admin, Map.of("atencao", false), 200).path("atencao").asBoolean()).isFalse();
        api.put("/eu/preferencias-de-push", admin, Map.of("atencao", false), 200);
        assertThat(api.get("/eu/preferencias-de-push", admin, 200).path("atencao").asBoolean()).isFalse();
        assertThat(jdbc.queryForObject("select push_atencao from usuario where id = ?", Boolean.class, idDe(admin))).isFalse();
        assertThat(jdbc.queryForList("select resumo from auditoria where consultoria_id = ? and acao = 'PUSH_ATENCAO_ALTERADO'",
                String.class, consultoria)).containsExactly("Alterou o aviso no celular de pontos de atenção.");
        // Outra conta não muda; o aluno não tem a rota.
        JsonNode outro = api.novoTreinador();
        assertThat(api.get("/eu/preferencias-de-push", outro, 200).path("atencao").asBoolean()).isTrue();
        AlunoDeTeste a = aluno();
        api.get("/eu/preferencias-de-push", a.login(), 403);
        api.put("/eu/preferencias-de-push", a.login(), Map.of("atencao", false), 403);
    }

    // ---- token do treinador ----

    @Test
    void tokenDoTreinadorRegistraApagaENuncaMexeNoDeOutraConta() throws Exception {
        String token = registrar(admin);
        assertThat(jdbc.queryForObject("select count(*) from push_token where token = ? and usuario_id = ? and consultoria_id = ?",
                Integer.class, token, idDe(admin), consultoria)).isEqualTo(1);
        // Outra consultoria apagando o token que não é dela: nada muda.
        JsonNode outro = api.novoTreinador();
        api.delete("/eu/push-token", outro, Map.of("token", token), 204);
        assertThat(tokens(admin)).isEqualTo(1);
        // O aluno não usa a rota da equipe.
        AlunoDeTeste a = aluno();
        api.put("/eu/push-token", a.login(), Map.of("token", "ExponentPushToken[" + UUID.randomUUID().toString().replace("-", "") + "]",
                "plataforma", "ANDROID"), 403);
        api.delete("/eu/push-token", admin, Map.of("token", token), 204);
        assertThat(tokens(admin)).isZero();
        registrar(admin);
        registrar(admin);
        api.delete("/eu/push-token", admin, 204);
        assertThat(tokens(admin)).isZero();
    }

    // ---- equipe ----

    @Test
    void desativarTrocarPerfilOuTirarPermissaoApagaOToken() throws Exception {
        String perfilAdmin = api.get("/eu", admin, 200).path("perfil").path("id").asString();
        JsonNode desativado = membro(COM_ATENCAO);
        registrar(desativado);
        api.put("/usuarios/" + idDe(desativado), admin, Map.of("nome", "Membro fictício", "perfilId",
                jdbc.queryForObject("select perfil_id from usuario where id = ?", UUID.class, idDe(desativado)), "ativo", false), 200);
        assertThat(tokens(desativado)).isZero();

        JsonNode trocado = membro(COM_ATENCAO);
        registrar(trocado);
        api.put("/usuarios/" + idDe(trocado), admin, Map.of("nome", "Membro fictício", "perfilId", perfilAdmin, "ativo", true), 200);
        assertThat(tokens(trocado)).isZero();

        JsonNode perfil = api.post("/perfis", admin, Map.of("nome", "Perfil " + UUID.randomUUID(), "permissoes", COM_ATENCAO), 200);
        JsonNode semPermissao = membroComPerfil(perfil.path("id").asString());
        registrar(semPermissao);
        api.put("/perfis/" + perfil.path("id").asString(), admin, Map.of("nome", perfil.path("nome").asString(),
                "permissoes", Set.of("ALUNO_LER"), "ativo", true, "versao", perfil.path("versao").asLong()), 200);
        assertThat(tokens(semPermissao)).isZero();
    }
}
