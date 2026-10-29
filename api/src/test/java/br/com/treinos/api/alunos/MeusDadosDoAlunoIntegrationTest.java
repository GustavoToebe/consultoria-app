package br.com.treinos.api.alunos;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.Documentos;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * "Meus dados" do aluno: lê e corrige só o próprio cadastro (telefone, endereço, sexo e, se vazio, o CPF). Dados fictícios;
 * nenhum valor pode aparecer na auditoria nem nas mensagens de erro.
 */
@AutoConfigureMockMvc
class MeusDadosDoAlunoIntegrationTest extends AbstractIntegrationTest {

    private static final String ROTA = "/aluno/meus-dados";
    private static final String ACAO = "ALUNO_DADOS_ALTERADOS_PELO_ALUNO";
    private static final String NOME = "Aluna Fictícia Meus Dados";
    private static final String TELEFONE = "(45) 99999-8888";
    private static final String LOGRADOURO = "Rua Fictícia dos Testes";
    private static final String COMPLEMENTO = "Bloco Fictício 7";

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate banco;

    private ApiDeTeste api;
    private JsonNode treinador;
    private UUID aluno;
    private JsonNode loginAluno;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        treinador = api.novoTreinador();
        aluno = api.criarAluno(treinador, NOME);
        loginAluno = api.convidarEEntrar(treinador, aluno);
    }

    // ---- leitura e escrita ----

    @Test
    void getDevolveSoOsProprioDados() throws Exception {
        UUID outro = api.criarAluno(treinador, "Aluno Fictício Vizinho");
        JsonNode loginOutro = api.convidarEEntrar(treinador, outro);
        api.put(ROTA, loginOutro, corpo(TELEFONE, null, endereco("85800000"), "OUTRO", versao(loginOutro)), 200);

        JsonNode meus = api.get(ROTA, loginAluno, 200);
        assertThat(meus.path("nome").asString()).isEqualTo(NOME);
        assertThat(meus.path("emailDeAcesso").asString()).endsWith("@teste.local");
        assertThat(meus.path("email").isNull()).isTrue();
        assertThat(meus.path("telefone").isNull()).isTrue();
        assertThat(meus.path("cpf").isNull()).isTrue();
        assertThat(meus.path("endereco").isNull()).isTrue();
        assertThat(meus.path("sexo").isNull()).isTrue();
        assertThat(meus.path("versao").isNumber()).isTrue();
        assertThat(meus.toString()).doesNotContain("Vizinho").doesNotContain("OUTRO").doesNotContain(LOGRADOURO);
        assertThat(api.get(ROTA, loginOutro, 200).path("nome").asString()).isEqualTo("Aluno Fictício Vizinho");
    }

    @Test
    void putAlteraTelefoneEnderecoESexoETreinadorVeOValorNovo() throws Exception {
        UUID outro = api.criarAluno(treinador, "Aluno Fictício Vizinho");
        JsonNode loginOutro = api.convidarEEntrar(treinador, outro);
        long antes = versao(loginAluno);

        JsonNode depois = api.put(ROTA, loginAluno, corpo(TELEFONE, null, endereco("85800000"), "FEMININO", antes), 200);
        assertThat(depois.path("telefone").asString()).isEqualTo(TELEFONE);
        assertThat(depois.path("endereco").path("cep").asString()).isEqualTo("85800-000");
        assertThat(depois.path("endereco").path("uf").asString()).isEqualTo("PR");
        assertThat(depois.path("sexo").asString()).isEqualTo("FEMININO");
        assertThat(depois.path("versao").asLong()).isEqualTo(antes + 1);
        assertThat(api.get(ROTA, loginAluno, 200)).isEqualTo(depois);

        JsonNode ficha = api.get("/alunos/" + aluno, treinador, 200);
        assertThat(ficha.path("telefone").asString()).isEqualTo(TELEFONE);
        assertThat(ficha.path("endereco").path("logradouro").asString()).isEqualTo(LOGRADOURO);
        assertThat(ficha.path("endereco").path("cidade").asString()).isEqualTo("Cidade Exemplo");
        assertThat(ficha.path("sexo").asString()).isEqualTo("FEMININO");
        assertThat(ficha.path("versao").asLong()).isEqualTo(antes + 1);

        // Outro aluno da mesma consultoria não muda.
        JsonNode intacto = api.get(ROTA, loginOutro, 200);
        assertThat(intacto.path("telefone").isNull()).isTrue();
        assertThat(intacto.path("endereco").isNull()).isTrue();
        assertThat(intacto.path("sexo").isNull()).isTrue();
        assertThat(api.get("/alunos/" + outro, treinador, 200).path("telefone").isNull()).isTrue();

        // A exportação LGPD já leva o cadastro, com sexo e versão.
        JsonNode cadastro = api.get("/alunos/" + aluno + "/exportacao", treinador, 200).path("cadastro");
        assertThat(cadastro.path("sexo").asString()).isEqualTo("FEMININO");
        assertThat(cadastro.path("versao").asLong()).isEqualTo(antes + 1);
        assertThat(cadastro.path("endereco").path("cep").asString()).isEqualTo("85800-000");
    }

    @Test
    void soOTelefoneMudandoTambemSobeAVersao() throws Exception {
        long antes = versao(loginAluno);
        JsonNode depois = api.put(ROTA, loginAluno, corpo(TELEFONE, null, null, null, antes), 200);
        assertThat(depois.path("versao").asLong()).isEqualTo(antes + 1);
        assertThat(eventos()).isEqualTo(1);
    }

    @Test
    void camposSaoSubstituidosEApagados() throws Exception {
        api.put(ROTA, loginAluno, corpo(TELEFONE, null, endereco("85800000"), "OUTRO", versao(loginAluno)), 200);

        // Telefone em branco apaga, endereço nulo apaga, sexo em branco = não informado.
        JsonNode apagado = api.put(ROTA, loginAluno, corpo("  ", null, null, "", versao(loginAluno)), 200);
        assertThat(apagado.path("telefone").isNull()).isTrue();
        assertThat(apagado.path("endereco").isNull()).isTrue();
        assertThat(apagado.path("sexo").isNull()).isTrue();
        assertThat(api.get("/alunos/" + aluno, treinador, 200).path("telefone").isNull()).isTrue();

        // Endereço com os sete campos em branco também apaga.
        api.put(ROTA, loginAluno, corpo(null, null, endereco("85800000"), null, versao(loginAluno)), 200);
        Map<String, Object> vazio = new LinkedHashMap<>();
        for (String campo : List.of("cep", "logradouro", "numero", "complemento", "bairro", "cidade", "uf")) {
            vazio.put(campo, " ");
        }
        assertThat(api.put(ROTA, loginAluno, corpo(null, null, vazio, null, versao(loginAluno)), 200).path("endereco").isNull()).isTrue();
    }

    // ---- validação ----

    @Test
    void erro422PorCampoJuntosESemOValorEnviado() throws Exception {
        Map<String, Object> ruim = endereco("123");
        ruim.put("uf", "ZZ");
        long antes = versao(loginAluno);
        JsonNode erro = api.put(ROTA, loginAluno, corpo("12345", "111.111.111-11", ruim, "ROBO", antes), 422);
        assertThat(erro.path("codigo").asString()).isEqualTo("ALUNO_INVALIDO");
        Map<String, String> porCampo = new LinkedHashMap<>();
        erro.path("fieldErrors").forEach(f -> porCampo.put(f.path("field").asString(), f.path("message").asString()));
        assertThat(porCampo.keySet()).containsExactlyInAnyOrder("telefone", "cpf", "endereco.cep", "endereco.uf", "sexo");
        assertThat(porCampo.get("sexo")).isEqualTo("Escolha Masculino, Feminino ou Outro.");
        assertThat(erro.toString()).doesNotContain("12345").doesNotContain("111.111.111-11").doesNotContain("ROBO")
                .doesNotContain("ZZ").doesNotContain(LOGRADOURO);
        assertThat(versao(loginAluno)).isEqualTo(antes);
        assertThat(eventos()).isZero();
    }

    @Test
    void enderecoParcialEhRecusadoPorCampo() throws Exception {
        JsonNode erro = api.put(ROTA, loginAluno,
                corpo(null, null, Map.of("cidade", "Cidade Exemplo", "complemento", COMPLEMENTO), null, versao(loginAluno)), 422);
        assertThat(erro.path("codigo").asString()).isEqualTo("ALUNO_INVALIDO");
        Set<String> campos = new java.util.HashSet<>();
        erro.path("fieldErrors").forEach(f -> campos.add(f.path("field").asString()));
        assertThat(campos).containsExactlyInAnyOrder("endereco.cep", "endereco.logradouro", "endereco.numero", "endereco.uf");
        assertThat(erro.toString()).doesNotContain("Cidade Exemplo").doesNotContain(COMPLEMENTO);
    }

    // ---- CPF ----

    @Test
    void cpfVazioGravaEmBrancoOuIgualNaoTemEfeito() throws Exception {
        String cpf = Documentos.cpf();
        long v0 = versao(loginAluno);
        // Em branco ou nulo: sem efeito, nem audita.
        assertThat(api.put(ROTA, loginAluno, corpo(null, "  ", null, null, v0), 200).path("versao").asLong()).isEqualTo(v0);
        assertThat(eventos()).isZero();

        JsonNode gravado = api.put(ROTA, loginAluno, corpo(null, Documentos.semPontuacao(cpf), null, null, v0), 200);
        assertThat(gravado.path("cpf").asString()).isEqualTo(cpf);
        assertThat(gravado.path("versao").asLong()).isEqualTo(v0 + 1);
        assertThat(api.get("/alunos/" + aluno, treinador, 200).path("cpf").asString()).isEqualTo(cpf);
        assertThat(eventos()).isEqualTo(1);

        // O mesmo CPF (comparado depois de normalizar, com ou sem máscara) não faz nada: versão igual, sem novo evento.
        long v1 = gravado.path("versao").asLong();
        assertThat(api.put(ROTA, loginAluno, corpo(null, cpf, null, null, v1), 200).path("versao").asLong()).isEqualTo(v1);
        assertThat(api.put(ROTA, loginAluno, corpo(null, Documentos.semPontuacao(cpf), null, null, v1), 200)
                .path("versao").asLong()).isEqualTo(v1);
        // Nulo também não apaga o CPF gravado.
        assertThat(api.put(ROTA, loginAluno, corpo(null, null, null, null, v1), 200).path("cpf").asString()).isEqualTo(cpf);
        assertThat(eventos()).isEqualTo(1);
    }

    @Test
    void cpfPreenchidoEDiferenteSoOTreinadorCorrige() throws Exception {
        String cpf = Documentos.cpf();
        String outroCpf = outroCpfDiferenteDe(cpf);
        api.put(ROTA, loginAluno, corpo(null, cpf, null, null, versao(loginAluno)), 200);
        long v = versao(loginAluno);

        JsonNode recusa = api.put(ROTA, loginAluno, corpo(TELEFONE, outroCpf, null, "OUTRO", v), 409);
        assertThat(recusa.path("codigo").asString()).isEqualTo("CPF_SO_PELO_TREINADOR");
        assertThat(recusa.toString()).doesNotContain(outroCpf).doesNotContain(Documentos.semPontuacao(outroCpf))
                .doesNotContain(cpf).doesNotContain(Documentos.semPontuacao(cpf));
        // Nada do mesmo pedido foi gravado.
        JsonNode atual = api.get(ROTA, loginAluno, 200);
        assertThat(atual.path("cpf").asString()).isEqualTo(cpf);
        assertThat(atual.path("telefone").isNull()).isTrue();
        assertThat(atual.path("versao").asLong()).isEqualTo(v);
        assertThat(eventos()).isEqualTo(1);
    }

    @Test
    void cpfDeOutroAlunoDaConsultoriaEhConflitoSemRepetirOCpf() throws Exception {
        String cpf = Documentos.cpf();
        UUID outro = api.criarAluno(treinador, "Aluno Fictício Com Cpf");
        JsonNode ficha = api.get("/alunos/" + outro, treinador, 200);
        api.put("/alunos/" + outro, treinador, Map.of("nome", "Aluno Fictício Com Cpf", "versao", ficha.path("versao").asLong(),
                "cpf", cpf), 200);

        JsonNode recusa = api.put(ROTA, loginAluno, corpo(null, cpf, null, null, versao(loginAluno)), 409);
        assertThat(recusa.path("codigo").asString()).isEqualTo("ALUNO_CPF_EM_USO");
        assertThat(recusa.toString()).doesNotContain(cpf).doesNotContain(Documentos.semPontuacao(cpf));
        assertThat(api.get(ROTA, loginAluno, 200).path("cpf").isNull()).isTrue();
        assertThat(eventos()).isZero();
    }

    @Test
    void cpfTemLimiteDeDezEnviosPorDiaEARecusaTambemConta() throws Exception {
        String cpf = Documentos.cpf();
        UUID outro = api.criarAluno(treinador, "Aluno Fictício Do Limite");
        JsonNode ficha = api.get("/alunos/" + outro, treinador, 200);
        api.put("/alunos/" + outro, treinador, Map.of("nome", "Aluno Fictício Do Limite", "versao", ficha.path("versao").asLong(),
                "cpf", cpf), 200);
        long v = versao(loginAluno);
        for (int i = 0; i < 10; i++) {
            api.put(ROTA, loginAluno, corpo(null, cpf, null, null, v), 409);
        }

        JsonNode limitado = api.put(ROTA, loginAluno, corpo(null, Documentos.cpf(), null, null, v), 429);
        assertThat(limitado.path("codigo").asString()).isEqualTo("LOGIN_LIMITADO");
        assertThat(api.get(ROTA, loginAluno, 200).path("cpf").isNull()).isTrue();
        // Sem CPF no corpo o limite não vale: telefone, endereço e sexo continuam editáveis.
        api.put(ROTA, loginAluno, corpo(TELEFONE, null, null, null, v), 200);
    }

    // ---- versão, estado e permissão ----

    @Test
    void versaoVelhaOuNulaEh409ConflitoDeEdicao() throws Exception {
        long antes = versao(loginAluno);
        JsonNode ficha = api.get("/alunos/" + aluno, treinador, 200);
        api.put("/alunos/" + aluno, treinador, Map.of("nome", NOME, "versao", ficha.path("versao").asLong(), "diasAtualizacao", 20), 200);

        JsonNode velha = api.put(ROTA, loginAluno, corpo(TELEFONE, null, null, null, antes), 409);
        assertThat(velha.path("codigo").asString()).isEqualTo("CONFLITO_EDICAO");
        JsonNode nula = api.put(ROTA, loginAluno, corpo(TELEFONE, null, null, null, null), 409);
        assertThat(nula.path("codigo").asString()).isEqualTo("CONFLITO_EDICAO");
        assertThat(api.get(ROTA, loginAluno, 200).path("telefone").isNull()).isTrue();

        // Recarregando (versão nova) grava.
        api.put(ROTA, loginAluno, corpo(TELEFONE, null, null, null, versao(loginAluno)), 200);
    }

    @Test
    void anonimizadoEhRecusadoComConflito() throws Exception {
        long v = versao(loginAluno);
        // A anonimização pelo treinador também derruba a sessão; aqui só a marca no cadastro, para provar a recusa do serviço.
        banco.update("update aluno set anonimizado_em = now() where id = ?", aluno);
        JsonNode recusa = api.put(ROTA, loginAluno, corpo(TELEFONE, null, null, null, v), 409);
        assertThat(recusa.path("codigo").asString()).isEqualTo("ALUNO_ANONIMIZADO");
        assertThat(eventos()).isZero();
    }

    @Test
    void alunoInativoNemChegaALeituraNemAEscrita() throws Exception {
        // Nenhuma rota do aluno confere "ativo": inativar encerra as sessões e o filtro só aceita usuário ativo (401).
        long v = versao(loginAluno);
        api.patch("/alunos/" + aluno + "/situacao", treinador, Map.of("ativo", false), 200);
        api.get(ROTA, loginAluno, 401);
        api.put(ROTA, loginAluno, corpo(TELEFONE, null, null, null, v), 401);
        assertThat(eventos()).isZero();
    }

    @Test
    void soOAlunoDaSessaoUsaARota() throws Exception {
        api.get(ROTA, treinador, 403);
        api.put(ROTA, treinador, corpo(TELEFONE, null, null, null, 0L), 403);
        api.get(ROTA, null, 401);
        api.put(ROTA, null, corpo(TELEFONE, null, null, null, 0L), 401);
    }

    // ---- auditoria ----

    @Test
    void auditaUmEventoQuandoMudouENenhumQuandoNaoMudouSemValores() throws Exception {
        String cpf = Documentos.cpf();
        long v0 = versao(loginAluno);
        JsonNode primeiro = api.put(ROTA, loginAluno, corpo(TELEFONE, cpf, endereco("85800000"), "FEMININO", v0), 200);
        assertThat(eventos()).isEqualTo(1);

        // O mesmo conteúdo outra vez: nada mudou, nenhum evento novo e a versão não sobe.
        long v1 = primeiro.path("versao").asLong();
        JsonNode igual = api.put(ROTA, loginAluno, corpo(TELEFONE, cpf, endereco("85800000"), "FEMININO", v1), 200);
        assertThat(igual.path("versao").asLong()).isEqualTo(v1);
        assertThat(eventos()).isEqualTo(1);

        List<Map<String, Object>> linhas = banco.queryForList(
                "select usuario_id, entidade, resumo, ip, user_agent from auditoria where entidade_id = ?::uuid and acao = ?", aluno, ACAO);
        assertThat(linhas).hasSize(1);
        UUID usuarioDoAluno = banco.queryForObject("select usuario_id from aluno where id = ?", UUID.class, aluno);
        assertThat(linhas.get(0).get("usuario_id")).isEqualTo(usuarioDoAluno); // o ator é o próprio aluno
        assertThat(linhas.get(0).get("entidade")).isEqualTo("ALUNO");

        String tudo = banco.queryForObject(
                "select string_agg(coalesce(resumo, '') || ' ' || coalesce(acao, ''), ' ') from auditoria where entidade_id = ?::uuid",
                String.class, aluno);
        List<String> valores = new ArrayList<>(List.of(TELEFONE, "45999998888", "99999-8888", cpf, Documentos.semPontuacao(cpf),
                "85800-000", "85800000", LOGRADOURO, "Cidade Exemplo", "FEMININO", "Feminino"));
        for (String valor : valores) {
            assertThat(tudo).as("a auditoria não pode conter o valor").doesNotContain(valor);
        }
    }

    // ---- sexo × ciclo ----

    @Test
    void deixarDeSerFemininoDesligaOCiclo() throws Exception {
        api.put(ROTA, loginAluno, corpo(null, null, null, "FEMININO", versao(loginAluno)), 200);
        api.post("/aluno/ciclo/ativar", loginAluno, Map.of("consentimentoVersao", 1, "duracaoHabitual", 28), 200);
        assertThat(banco.queryForObject("select ciclo_ativado_em from aluno where id = ?", String.class, aluno)).isNotNull();

        JsonNode depois = api.put(ROTA, loginAluno, corpo(null, null, null, "MASCULINO", versao(loginAluno)), 200);
        assertThat(depois.path("sexo").asString()).isEqualTo("MASCULINO");
        assertThat(banco.queryForObject("select ciclo_ativado_em from aluno where id = ?", String.class, aluno)).isNull();
        assertThat(banco.queryForObject(
                "select count(*) from auditoria where entidade_id = ?::uuid and acao = 'CICLO_ACOMPANHAMENTO_DESATIVADO'",
                Integer.class, aluno)).isEqualTo(1);
        assertThat(api.get("/aluno/ciclo", loginAluno, 200).path("disponivel").asBoolean()).isFalse();
    }

    // ---- apoio ----

    private long versao(JsonNode login) throws Exception {
        return api.get(ROTA, login, 200).path("versao").asLong();
    }

    private int eventos() {
        return banco.queryForObject("select count(*) from auditoria where entidade_id = ?::uuid and acao = ?", Integer.class, aluno, ACAO);
    }

    private static Map<String, Object> corpo(String telefone, String cpf, Map<String, Object> endereco, String sexo, Long versao) {
        Map<String, Object> corpo = new HashMap<>();
        corpo.put("telefone", telefone);
        corpo.put("cpf", cpf);
        corpo.put("endereco", endereco);
        corpo.put("sexo", sexo);
        corpo.put("versao", versao);
        return corpo;
    }

    private static Map<String, Object> endereco(String cep) {
        Map<String, Object> e = new LinkedHashMap<>();
        e.put("cep", cep);
        e.put("logradouro", LOGRADOURO);
        e.put("numero", "123");
        e.put("complemento", COMPLEMENTO);
        e.put("bairro", "Bairro Exemplo");
        e.put("cidade", "Cidade Exemplo");
        e.put("uf", "pr");
        return e;
    }

    private static String outroCpfDiferenteDe(String cpf) {
        String outro;
        do {
            outro = Documentos.cpf();
        } while (outro.equals(cpf));
        return outro;
    }
}
