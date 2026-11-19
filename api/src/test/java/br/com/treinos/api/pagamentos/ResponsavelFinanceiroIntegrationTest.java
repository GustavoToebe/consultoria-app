package br.com.treinos.api.pagamentos;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
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

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * {@code GET/PUT/DELETE /alunos/{id}/responsavel-financeiro} (V092, D15): criar e alterar com versão (409), 422 por campo sem
 * repetir o valor, 404 de outra consultoria, 409 de aluno anonimizado, permissões, CPF omitido sem {@code ALUNO_SENSIVEL_LER},
 * auditoria com resumo fixo e nenhum dado do responsável em log, auditoria, erro nem {@code toString}. Só dados fictícios.
 */
@AutoConfigureMockMvc
class ResponsavelFinanceiroIntegrationTest extends AbstractIntegrationTest {

    private static final String NOME = "Rosana Responsável Sigilosa";
    private static final String CPF = "52998224725";
    private static final String CPF_FORMATADO = "529.982.247-25";
    private static final String EMAIL = "rosana.sigilosa@example.com";
    private static final String TELEFONE = "(45) 99999-8877";

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;

    private ApiDeTeste api;
    private JsonNode admin;
    private UUID aluno;
    private ListAppender<ILoggingEvent> log;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        aluno = api.criarAluno(admin, "Aluno Fictício do Responsável");
        log = new ListAppender<>();
        log.start();
        ((Logger) LoggerFactory.getLogger(Logger.ROOT_LOGGER_NAME)).addAppender(log);
    }

    @AfterEach
    void soltarOLog() {
        ((Logger) LoggerFactory.getLogger(Logger.ROOT_LOGGER_NAME)).detachAppender(log);
    }

    private String rota(UUID alunoId) {
        return "/alunos/" + alunoId + "/responsavel-financeiro";
    }

    private String rota() {
        return rota(aluno);
    }

    private UUID consultoriaDe(JsonNode login) {
        return jdbc.queryForObject("select consultoria_id from usuario where id = ?::uuid", UUID.class,
                login.get("usuario").get("id").asString());
    }

    private static Map<String, Object> corpo(String nome, String parentesco, String cpf, String telefone, String email, Long versao) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("nome", nome);
        m.put("parentesco", parentesco);
        m.put("cpf", cpf);
        m.put("telefone", telefone);
        m.put("email", email);
        if (versao != null) {
            m.put("versao", versao);
        }
        return m;
    }

    private static Map<String, Object> completo(Long versao) {
        return corpo(NOME, "Mãe", CPF, "45999998877", "  " + EMAIL + " ", versao);
    }

    private JsonNode membro(String nome, Set<String> permissoes) throws Exception {
        String perfil = api.post("/perfis", admin, Map.of("nome", "Perfil " + nome + UUID.randomUUID(), "permissoes", permissoes), 200)
                .get("id").asString();
        JsonNode convite = api.post("/usuarios/convites", admin,
                Map.of("nome", nome, "email", ApiDeTeste.emailUnico("membro"), "perfilId", perfil), 200);
        return api.post("/publico/convites-equipe/aceitar", null,
                Map.of("codigo", convite.get("codigo").asString(), "senha", ApiDeTeste.SENHA), 200);
    }

    private static Set<String> campos(JsonNode erro) {
        Set<String> nomes = new TreeSet<>();
        erro.get("fieldErrors").forEach(f -> nomes.add(f.get("field").asString()));
        return nomes;
    }

    private int auditorias(String acao) {
        return jdbc.queryForObject("select count(*) from auditoria where acao = ? and entidade_id = ?::uuid", Integer.class, acao,
                aluno.toString());
    }

    private int linhas() {
        return jdbc.queryForObject("select count(*) from responsavel_financeiro where aluno_id = ?::uuid", Integer.class,
                aluno.toString());
    }

    private void nadaVazou(String... segredos) {
        String auditoria = jdbc.queryForObject(
                "select coalesce(string_agg(coalesce(acao,'') || ' ' || coalesce(resumo,'') || ' ' || coalesce(entidade,''), ' '), '') "
                        + "from auditoria where consultoria_id = ?", String.class, consultoriaDe(admin));
        String logado = String.join("\n", log.list.stream().map(ILoggingEvent::getFormattedMessage).toList());
        for (String segredo : segredos) {
            assertThat(auditoria).as("auditoria").doesNotContain(segredo);
            assertThat(logado).as("log").doesNotContain(segredo);
        }
    }

    @Test
    void semResponsavelOGetDevolveTudoNuloEOCrudCompletoFunciona() throws Exception {
        JsonNode vazio = api.get(rota(), admin, 200);
        assertThat(vazio.propertyNames()).containsExactlyInAnyOrder("nome", "parentesco", "cpf", "telefone", "email", "versao",
                "atualizadoEm");
        assertThat(vazio.get("versao").isNull()).isTrue();
        assertThat(vazio.get("nome").isNull()).isTrue();

        JsonNode criado = api.put(rota(), admin, completo(null), 200);

        assertThat(criado.get("nome").asString()).isEqualTo(NOME);
        assertThat(criado.get("parentesco").asString()).isEqualTo("Mãe");
        assertThat(criado.get("cpf").asString()).isEqualTo(CPF_FORMATADO);
        assertThat(criado.get("telefone").asString()).isEqualTo(TELEFONE);
        assertThat(criado.get("email").asString()).isEqualTo(EMAIL);
        assertThat(criado.get("versao").asLong()).isZero();
        assertThat(api.get(rota(), admin, 200)).isEqualTo(criado);
        assertThat(linhas()).isEqualTo(1);
        assertThat(auditorias("RESPONSAVEL_FINANCEIRO_DEFINIDO")).isEqualTo(1);

        // Alterar com a versão atual substitui tudo (campo opcional ausente apaga).
        JsonNode alterado = api.put(rota(), admin, corpo("Rosana Nova", null, null, null, null, criado.get("versao").asLong()), 200);
        assertThat(alterado.get("nome").asString()).isEqualTo("Rosana Nova");
        assertThat(alterado.get("cpf").isNull()).isTrue();
        assertThat(alterado.get("telefone").isNull()).isTrue();
        assertThat(alterado.get("email").isNull()).isTrue();
        assertThat(alterado.get("parentesco").isNull()).isTrue();
        assertThat(alterado.get("versao").asLong()).isGreaterThan(criado.get("versao").asLong());
        assertThat(auditorias("RESPONSAVEL_FINANCEIRO_DEFINIDO")).isEqualTo(2);

        // Igual ao gravado: 200, sem versão nova nem auditoria nova.
        JsonNode igual = api.put(rota(), admin, corpo("Rosana Nova", null, null, null, null, alterado.get("versao").asLong()), 200);
        assertThat(igual.get("versao").asLong()).isEqualTo(alterado.get("versao").asLong());
        assertThat(auditorias("RESPONSAVEL_FINANCEIRO_DEFINIDO")).isEqualTo(2);

        api.delete(rota(), admin, 204);
        assertThat(linhas()).isZero();
        assertThat(api.get(rota(), admin, 200).get("versao").isNull()).isTrue();
        assertThat(auditorias("RESPONSAVEL_FINANCEIRO_REMOVIDO")).isEqualTo(1);
        // Remover de novo é idempotente e não audita.
        api.delete(rota(), admin, 204);
        assertThat(auditorias("RESPONSAVEL_FINANCEIRO_REMOVIDO")).isEqualTo(1);
    }

    @Test
    void versaoVelhaOuAusenteE409AoAlterarECriarComVersaoTambem() throws Exception {
        assertThat(api.put(rota(), admin, completo(3L), 409).get("codigo").asString()).isEqualTo("CONFLITO_EDICAO");
        assertThat(linhas()).isZero();
        JsonNode criado = api.put(rota(), admin, completo(null), 200);
        long v0 = criado.get("versao").asLong();
        api.put(rota(), admin, corpo("Outro Nome", null, null, null, null, v0), 200);

        assertThat(api.put(rota(), admin, corpo("Nome Velho", null, null, null, null, v0), 409).get("codigo").asString())
                .isEqualTo("CONFLITO_EDICAO");
        assertThat(api.put(rota(), admin, corpo("Sem Versão", null, null, null, null, null), 409).get("codigo").asString())
                .isEqualTo("CONFLITO_EDICAO");
        assertThat(api.get(rota(), admin, 200).get("nome").asString()).isEqualTo("Outro Nome");
        // Remover com versão velha é 409; com a atual ou sem versão, 204.
        assertThat(api.delete(rota() + "?versao=" + v0, admin, 409).get("codigo").asString()).isEqualTo("CONFLITO_EDICAO");
        assertThat(linhas()).isEqualTo(1);
        api.delete(rota() + "?versao=" + api.get(rota(), admin, 200).get("versao").asLong(), admin, 204);
        assertThat(linhas()).isZero();
    }

    @Test
    void erro422PorCampoSemRepetirOValorDigitado() throws Exception {
        String ruimDeCpf = "111.111.111-11";
        String ruimDeTelefone = "12345";
        String ruimDeEmail = "email-que-nao-e-email";

        JsonNode erro = api.put(rota(), admin, corpo("N".repeat(121), "P".repeat(31), ruimDeCpf, ruimDeTelefone, ruimDeEmail, null), 422);

        assertThat(erro.get("codigo").asString()).isEqualTo("RESPONSAVEL_INVALIDO");
        assertThat(campos(erro)).containsExactlyInAnyOrder("nome", "parentesco", "cpf", "telefone", "email");
        assertThat(erro.toString()).doesNotContain("NNNNN").doesNotContain("PPPPP").doesNotContain(ruimDeCpf)
                .doesNotContain(ruimDeTelefone).doesNotContain(ruimDeEmail);
        assertThat(campos(api.put(rota(), admin, corpo("   ", null, null, null, null, null), 422))).containsExactly("nome");
        assertThat(campos(api.put(rota(), admin, corpo(null, null, null, null, null, null), 422))).containsExactly("nome");
        assertThat(campos(api.put(rota(), admin, corpo("Nome Ok", null, "123.456.789-00", null, null, null), 422)))
                .containsExactly("cpf");
        // No limite exato vale.
        api.put(rota(), admin, corpo("N".repeat(120), "P".repeat(30), null, null, null, null), 200);
        nadaVazou(ruimDeCpf, ruimDeTelefone, ruimDeEmail);
    }

    @Test
    void mesmoCpfEmDoisAlunosValeSemUnicidade() throws Exception {
        UUID outroAluno = api.criarAluno(admin, "Irmão Fictício do Aluno");
        api.put(rota(), admin, completo(null), 200);
        api.put(rota(outroAluno), admin, completo(null), 200);

        assertThat(jdbc.queryForObject("select count(*) from responsavel_financeiro where cpf = ? and consultoria_id = ?", Integer.class,
                CPF_FORMATADO, consultoriaDe(admin))).isEqualTo(2);
    }

    @Test
    void alunoDeOutraConsultoriaE404EAnonimizadoE409() throws Exception {
        JsonNode outro = api.novoTreinador();
        api.put(rota(), admin, completo(null), 200);

        api.get(rota(), outro, 404);
        api.put(rota(), outro, completo(null), 404);
        api.delete(rota(), outro, 404);
        assertThat(api.get(rota(), admin, 200).get("nome").asString()).isEqualTo(NOME);
        api.get(rota(UUID.randomUUID()), admin, 404);

        // Anonimizar apaga a linha e depois disso nada grava nem remove.
        api.patch("/alunos/" + aluno + "/situacao", admin, Map.of("ativo", false), 200);
        api.post("/alunos/" + aluno + "/anonimizar", admin, Map.of("nomeConfirmado", "Aluno Fictício do Responsável"), 200);
        assertThat(linhas()).isZero();
        assertThat(api.put(rota(), admin, completo(null), 409).get("codigo").asString()).isEqualTo("ALUNO_ANONIMIZADO");
        assertThat(api.delete(rota(), admin, 409).get("codigo").asString()).isEqualTo("ALUNO_ANONIMIZADO");
        assertThat(api.get(rota(), admin, 200).get("versao").isNull()).isTrue();
    }

    @Test
    void permissoes() throws Exception {
        JsonNode leitor = membro("Leitor", Set.of("FINANCEIRO_LER", "ALUNO_LER"));
        JsonNode semFinanceiro = membro("Sem financeiro", Set.of("ALUNO_LER"));
        JsonNode escritor = membro("Escritor", Set.of("FINANCEIRO_LER", "FINANCEIRO_ALTERAR", "ALUNO_LER"));

        api.get(rota(), leitor, 200);
        api.put(rota(), leitor, completo(null), 403);
        api.delete(rota(), leitor, 403);
        api.get(rota(), semFinanceiro, 403);
        api.put(rota(), semFinanceiro, completo(null), 403);
        api.get(rota(), null, 401);
        api.put(rota(), escritor, completo(null), 200);
        api.delete(rota(), escritor, 204);
        assertThat(linhas()).isZero();
    }

    @Test
    void cpfSoApareceComAlunoSensivelLerESemEleOGravadoFicaNoPut() throws Exception {
        JsonNode escritor = membro("Escritor sem sensível", Set.of("FINANCEIRO_LER", "FINANCEIRO_ALTERAR", "ALUNO_LER"));
        JsonNode criado = api.put(rota(), admin, completo(null), 200);
        assertThat(criado.get("cpf").asString()).isEqualTo(CPF_FORMATADO);

        JsonNode visto = api.get(rota(), escritor, 200);
        assertThat(visto.get("nome").asString()).isEqualTo(NOME);
        assertThat(visto.get("cpf").isNull()).isTrue();
        assertThat(visto.toString()).doesNotContain(CPF).doesNotContain("529.982");

        // Sem a permissão sensível, o CPF do corpo é ignorado (nem valida) e o gravado fica.
        JsonNode alterado = api.put(rota(), escritor, corpo("Nome pelo Escritor", "Tia", "000.000.000-00", null, null,
                visto.get("versao").asLong()), 200);
        assertThat(alterado.get("cpf").isNull()).isTrue();
        assertThat(api.get(rota(), admin, 200).get("cpf").asString()).isEqualTo(CPF_FORMATADO);
        assertThat(api.get(rota(), admin, 200).get("nome").asString()).isEqualTo("Nome pelo Escritor");

        // Criação sem a permissão: sem CPF.
        UUID outroAluno = api.criarAluno(admin, "Outro Aluno Fictício");
        JsonNode semCpf = api.put(rota(outroAluno), escritor, corpo("Responsável sem CPF", null, CPF, null, null, null), 200);
        assertThat(semCpf.get("cpf").isNull()).isTrue();
        assertThat(api.get(rota(outroAluno), admin, 200).get("cpf").isNull()).isTrue();
    }

    @Test
    void auditoriaTemResumoFixoENadaDoResponsavelVazaParaLogErroOuToString() throws Exception {
        UUID consultoria = consultoriaDe(admin);
        JsonNode criado = api.put(rota(), admin, completo(null), 200);
        api.put(rota(), admin, corpo(NOME + " Alterada", "Mãe", CPF, "45999998877", EMAIL, criado.get("versao").asLong()), 200);
        api.delete(rota(), admin, 204);

        List<String> resumos = jdbc.queryForList("select resumo from auditoria where consultoria_id = ? and acao like 'RESPONSAVEL_FINANCEIRO_%' "
                + "order by acao", String.class, consultoria);
        assertThat(resumos).containsExactly("Definiu o responsável financeiro do aluno.", "Definiu o responsável financeiro do aluno.",
                "Removeu o responsável financeiro do aluno.");
        nadaVazou("Rosana", "Sigilosa", CPF, "529.982", EMAIL, "rosana.sigilosa", "99999-8877", "45999998877");

        // toString da entidade e dos records não leva nenhum dado pessoal.
        var dados = new ResponsavelFinanceiro.Dados(NOME, "Mãe", CPF_FORMATADO, TELEFONE, EMAIL);
        var entidade = new ResponsavelFinanceiro(aluno, dados, java.time.Instant.now());
        var requisicao = new ResponsavelFinanceiroDtos.ResponsavelFinanceiroRequest(NOME, "Mãe", CPF_FORMATADO, TELEFONE, EMAIL, null);
        var resposta = new ResponsavelFinanceiroDtos.ResponsavelFinanceiroResponse(NOME, "Mãe", CPF_FORMATADO, TELEFONE, EMAIL, 0L, null);
        var exportado = new ResponsavelFinanceiroDtos.ResponsavelExportado(NOME, "Mãe", CPF_FORMATADO, TELEFONE, EMAIL, null);
        for (Object o : List.of(dados, entidade, requisicao, resposta, exportado)) {
            assertThat(o.toString()).as(o.getClass().getSimpleName()).doesNotContain("Rosana").doesNotContain(CPF)
                    .doesNotContain("529.982").doesNotContain(EMAIL).doesNotContain("99999-8877").doesNotContain("Mãe");
        }
    }
}
