package br.com.treinos.api.pagamentos;

import br.com.plataforma.comum.auth.EnviadorDeEmail;
import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.EmailDeTeste;
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
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * D15: os lembretes por e-mail e o "Abrir WhatsApp com a mensagem" vão ao responsável financeiro quando ele existe (o texto não
 * muda e não leva o nome dele), senão ao aluno como antes; desligar os lembretes vale também para o responsável; a fila não
 * guarda endereço; a exportação leva o responsável (o CPF também, pois exportar já exige {@code ALUNO_SENSIVEL_LER}); anonimizar e "Excluir minha conta"
 * apagam a linha. O job é chamado à mão com o "hoje" do cenário. Só dados fictícios; cada consulta filtra pelo id do teste.
 */
@AutoConfigureMockMvc
class LembretesParaResponsavelIntegrationTest extends AbstractIntegrationTest {

    private static final String NOME_DO_RESPONSAVEL = "Heloísa Responsável Fictícia";
    private static final String TELEFONE_DO_ALUNO = "(45) 98888-1111";
    private static final String TELEFONE_DO_RESPONSAVEL = "(45) 97777-2222";

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
        api.put("/financeiro/lembretes", admin,
                Map.of("ligado", true, "diasAntes", 3, "noDia", true, "diasDepois", 3), 200);
    }

    // ---- ajudantes ----

    /** Aluno com e-mail, plano mensal e contratação de hoje; devolve a cobrança aberta (vence hoje). */
    private JsonNode cobrancaDe(String nome, String email) throws Exception {
        String alunoId = api.post("/alunos", admin, Map.of("nome", nome, "email", email), 200).get("id").asString();
        JsonNode plano = api.post("/financeiro/planos", admin,
                Map.of("nome", "Plano responsável " + UUID.randomUUID(), "valorCentavos", 12000, "periodicidade", "MENSAL"), 200);
        api.post("/alunos/" + alunoId + "/contratacoes", admin, Map.of("planoComercialId", plano.get("id").asString(),
                "inicio", hoje.toString(), "diaVencimento", hoje.getDayOfMonth()), 200);
        for (JsonNode c : api.get("/alunos/" + alunoId + "/cobrancas", admin, 200)) {
            if ("ABERTA".equals(c.get("situacao").asString())) {
                return c;
            }
        }
        throw new AssertionError("Sem cobrança aberta.");
    }

    private static LocalDate vencimento(JsonNode cobranca) {
        return LocalDate.parse(cobranca.get("vencimento").asString());
    }

    private static String alunoId(JsonNode cobranca) {
        return cobranca.get("alunoId").asString();
    }

    private void definirResponsavel(JsonNode cobranca, String email, String telefone, String cpf) throws Exception {
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("nome", NOME_DO_RESPONSAVEL);
        corpo.put("parentesco", "Mãe");
        corpo.put("cpf", cpf);
        corpo.put("telefone", telefone);
        corpo.put("email", email);
        api.put("/alunos/" + alunoId(cobranca) + "/responsavel-financeiro", admin, corpo, 200);
    }

    /** O aluno entra (convite aceito) e ganha telefone na conta, que é de onde o WhatsApp do aluno lê. */
    private JsonNode loginComTelefone(JsonNode cobranca, String telefone) throws Exception {
        JsonNode login = api.convidarEEntrar(admin, UUID.fromString(alunoId(cobranca)));
        jdbc.update("update usuario set telefone = ? where id = ?::uuid", telefone, login.get("usuario").get("id").asString());
        return login;
    }

    private JsonNode folha(JsonNode cobranca) throws Exception {
        return api.get("/cobrancas/" + cobranca.get("id").asString() + "/lembretes", admin, 200);
    }

    private int linhasDoResponsavel(JsonNode cobranca) {
        return jdbc.queryForObject("select count(*) from responsavel_financeiro where aluno_id = ?::uuid", Integer.class,
                alunoId(cobranca));
    }

    private static EnviadorDeEmail.Mensagem unica(String para) {
        assertThat(EmailDeTeste.para(para)).hasSize(1);
        return EmailDeTeste.para(para).get(0);
    }

    // ---- e-mail ----

    @Test
    void comResponsavelOEmailVaiParaEleENaoParaOAlunoESemONomeDele() throws Exception {
        String emailDoAluno = ApiDeTeste.emailUnico("aluno-menor");
        String emailDoResponsavel = ApiDeTeste.emailUnico("responsavel");
        JsonNode cobranca = cobrancaDe("Bruno Fictício Menor", emailDoAluno);
        definirResponsavel(cobranca, emailDoResponsavel, null, null);

        job.rodar(vencimento(cobranca), enviador);

        EnviadorDeEmail.Mensagem m = unica(emailDoResponsavel);
        assertThat(EmailDeTeste.para(emailDoAluno)).isEmpty();
        // O texto é o de sempre (primeiro nome do aluno) e não leva o nome nem o parentesco do responsável.
        assertThat(m.texto()).contains("Bruno").contains("vence hoje");
        assertThat(m.texto() + m.assunto()).doesNotContain("Heloísa").doesNotContain("Responsável Fictícia").doesNotContain("Mãe");
        // A fila continua sem guardar endereço.
        String fila = jdbc.queryForObject("select string_agg(f::text, ' ') from lembrete_cobranca f where cobranca_id = ?::uuid",
                String.class, cobranca.get("id").asString());
        assertThat(fila).contains("ENVIADO").doesNotContain(emailDoResponsavel).doesNotContain(emailDoAluno);
    }

    @Test
    void semResponsavelOEmailVaiParaOAlunoComoAntes() throws Exception {
        String emailDoAluno = ApiDeTeste.emailUnico("aluno-sozinho");
        JsonNode cobranca = cobrancaDe("Carla Fictícia Sozinha", emailDoAluno);

        job.rodar(vencimento(cobranca), enviador);

        assertThat(unica(emailDoAluno).texto()).contains("Carla");
    }

    @Test
    void responsavelSemEmailOuSemNenhumContatoNaoMudaNada() throws Exception {
        String emailDoAluno = ApiDeTeste.emailUnico("aluno-fallback");
        JsonNode cobranca = cobrancaDe("Davi Fictício Fallback", emailDoAluno);
        definirResponsavel(cobranca, null, null, null);
        assertThat(folha(cobranca).get("paraResponsavel").asBoolean()).as("sem e-mail e sem telefone").isFalse();

        job.rodar(vencimento(cobranca), enviador);

        unica(emailDoAluno);

        // Só telefone: o e-mail continua no aluno e o WhatsApp vai ao responsável.
        String outroEmail = ApiDeTeste.emailUnico("aluno-fallback-tel");
        JsonNode outra = cobrancaDe("Eva Fictícia Telefone", outroEmail);
        definirResponsavel(outra, null, "45977772222", null);
        job.rodar(vencimento(outra), enviador);
        unica(outroEmail);
        assertThat(folha(outra).get("paraResponsavel").asBoolean()).isTrue();
        assertThat(folha(outra).get("whatsapp").get("telefone").asString()).isEqualTo(TELEFONE_DO_RESPONSAVEL);
    }

    @Test
    void alunoQueDesligouOsLembretesNaoMandaNemAoResponsavel() throws Exception {
        String emailDoAluno = ApiDeTeste.emailUnico("aluno-desligou");
        String emailDoResponsavel = ApiDeTeste.emailUnico("responsavel-desligou");
        JsonNode cobranca = cobrancaDe("Fábio Fictício Desligou", emailDoAluno);
        definirResponsavel(cobranca, emailDoResponsavel, null, null);
        JsonNode login = api.convidarEEntrar(admin, UUID.fromString(alunoId(cobranca)));
        api.put("/aluno/lembretes-de-cobranca", login, Map.of("receber", false), 200);

        job.rodar(vencimento(cobranca), enviador);

        assertThat(EmailDeTeste.para(emailDoResponsavel)).isEmpty();
        assertThat(EmailDeTeste.para(emailDoAluno)).isEmpty();
        assertThat(jdbc.queryForObject("select count(*) from lembrete_cobranca where cobranca_id = ?::uuid and situacao = 'ENVIADO'",
                Integer.class, cobranca.get("id").asString())).isZero();
        // O botão do WhatsApp do treinador não muda: segue indo ao responsável.
        definirResponsavelComTelefoneNaFolha(cobranca);
    }

    private void definirResponsavelComTelefoneNaFolha(JsonNode cobranca) throws Exception {
        JsonNode atual = api.get("/alunos/" + alunoId(cobranca) + "/responsavel-financeiro", admin, 200);
        api.put("/alunos/" + alunoId(cobranca) + "/responsavel-financeiro", admin, Map.of("nome", NOME_DO_RESPONSAVEL,
                "telefone", "45977772222", "email", atual.get("email").asString(), "versao", atual.get("versao").asLong()), 200);
        JsonNode f = folha(cobranca);
        assertThat(f.get("alunoDesligou").asBoolean()).isTrue();
        assertThat(f.get("paraResponsavel").asBoolean()).isTrue();
        assertThat(f.get("whatsapp").get("telefone").asString()).isEqualTo(TELEFONE_DO_RESPONSAVEL);
    }

    // ---- WhatsApp ----

    @Test
    void whatsappVaiAoResponsavelQuandoExisteEAoAlunoQuandoNao() throws Exception {
        String emailDoAluno = ApiDeTeste.emailUnico("aluno-whatsapp");
        JsonNode cobranca = cobrancaDe("Gabi Fictícia WhatsApp", emailDoAluno);
        loginComTelefone(cobranca, TELEFONE_DO_ALUNO);

        JsonNode sem = folha(cobranca);
        assertThat(sem.get("paraResponsavel").asBoolean()).isFalse();
        assertThat(sem.get("whatsapp").get("telefone").asString()).isEqualTo(TELEFONE_DO_ALUNO);
        String mensagemDoAluno = sem.get("whatsapp").get("mensagem").asString();

        definirResponsavel(cobranca, ApiDeTeste.emailUnico("responsavel-whatsapp"), "45977772222", null);

        JsonNode com = folha(cobranca);
        assertThat(com.get("paraResponsavel").asBoolean()).isTrue();
        assertThat(com.get("whatsapp").get("telefone").asString()).isEqualTo(TELEFONE_DO_RESPONSAVEL);
        // O texto é o mesmo e não leva o nome do responsável.
        assertThat(com.get("whatsapp").get("mensagem").asString()).isEqualTo(mensagemDoAluno)
                .doesNotContain("Heloísa").doesNotContain("Responsável");
        assertThat(com.get("motivoSemWhatsapp").isNull()).isTrue();

        // Responsável sem telefone (só e-mail): o WhatsApp continua no aluno, e o indicador diz que o e-mail vai ao responsável.
        JsonNode atual = api.get("/alunos/" + alunoId(cobranca) + "/responsavel-financeiro", admin, 200);
        api.put("/alunos/" + alunoId(cobranca) + "/responsavel-financeiro", admin, Map.of("nome", NOME_DO_RESPONSAVEL,
                "email", atual.get("email").asString(), "versao", atual.get("versao").asLong()), 200);
        JsonNode soEmail = folha(cobranca);
        assertThat(soEmail.get("paraResponsavel").asBoolean()).isTrue();
        assertThat(soEmail.get("whatsapp").get("telefone").asString()).isEqualTo(TELEFONE_DO_ALUNO);

        // Removido o responsável, volta ao aluno.
        api.delete("/alunos/" + alunoId(cobranca) + "/responsavel-financeiro", admin, 204);
        JsonNode removido = folha(cobranca);
        assertThat(removido.get("paraResponsavel").asBoolean()).isFalse();
        assertThat(removido.get("whatsapp").get("telefone").asString()).isEqualTo(TELEFONE_DO_ALUNO);
    }

    // ---- exportação e anonimização ----

    @Test
    void exportacaoLevaOResponsavel() throws Exception {
        JsonNode cobranca = cobrancaDe("Heitor Fictício Exportado", ApiDeTeste.emailUnico("aluno-exporta"));
        String emailDoResponsavel = ApiDeTeste.emailUnico("responsavel-exporta");
        definirResponsavel(cobranca, emailDoResponsavel, "45977772222", "529.982.247-25");

        JsonNode financeiro = api.get("/alunos/" + alunoId(cobranca) + "/exportacao", admin, 200).get("financeiro");

        JsonNode r = financeiro.get("responsavelFinanceiro");
        assertThat(r.get("nome").asString()).isEqualTo(NOME_DO_RESPONSAVEL);
        assertThat(r.get("parentesco").asString()).isEqualTo("Mãe");
        assertThat(r.get("cpf").asString()).isEqualTo("529.982.247-25");
        assertThat(r.get("telefone").asString()).isEqualTo(TELEFONE_DO_RESPONSAVEL);
        assertThat(r.get("email").asString()).isEqualTo(emailDoResponsavel);

        // ALUNO_EXPORTAR depende de ALUNO_SENSIVEL_LER (catálogo): quem exporta sempre vê o CPF; o ramo sem ela é defensivo.

        // Sem responsável, a seção sai nula.
        JsonNode outra = cobrancaDe("Íris Fictícia Sem Responsável", ApiDeTeste.emailUnico("aluno-exporta-sem"));
        assertThat(api.get("/alunos/" + alunoId(outra) + "/exportacao", admin, 200).get("financeiro").get("responsavelFinanceiro")
                .isNull()).isTrue();
    }

    @Test
    void anonimizarEExcluirAContaApagamOResponsavel() throws Exception {
        String nome = "João Fictício Anonimizado";
        JsonNode cobranca = cobrancaDe(nome, ApiDeTeste.emailUnico("aluno-anonimiza"));
        definirResponsavel(cobranca, ApiDeTeste.emailUnico("responsavel-anonimiza"), "45977772222", "529.982.247-25");
        assertThat(linhasDoResponsavel(cobranca)).isEqualTo(1);

        api.patch("/alunos/" + alunoId(cobranca) + "/situacao", admin, Map.of("ativo", false), 200);
        api.post("/alunos/" + alunoId(cobranca) + "/anonimizar", admin, Map.of("nomeConfirmado", nome), 200);

        assertThat(linhasDoResponsavel(cobranca)).isZero();
        assertThat(api.get("/alunos/" + alunoId(cobranca) + "/exportacao", admin, 200).get("financeiro")
                .get("responsavelFinanceiro").isNull()).isTrue();

        // "Excluir minha conta" pelo próprio aluno.
        JsonNode outra = cobrancaDe("Kátia Fictícia Exclui", ApiDeTeste.emailUnico("aluno-exclui"));
        definirResponsavel(outra, ApiDeTeste.emailUnico("responsavel-exclui"), null, null);
        JsonNode login = api.convidarEEntrar(admin, UUID.fromString(alunoId(outra)));
        assertThat(linhasDoResponsavel(outra)).isEqualTo(1);
        api.post("/aluno/conta/excluir", login, Map.of("senha", ApiDeTeste.SENHA, "confirmacao", "EXCLUIR"), 204);
        assertThat(linhasDoResponsavel(outra)).isZero();
    }
}
