package br.com.treinos.api.importacao;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.LimiteDoTreinadorDeTeste;
import br.com.treinos.api.LimiteDoTreinadorDeTeste.Membro;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMultipartHttpServletRequestBuilder;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Importação de uma aba de alunos com o limite por treinador (D3, D7, D15): o responsável padrão é quem importa, a coluna
 * "responsavel" troca o de quem já existe e a situação "ativo" reativa. A linha que estoura o limite fica de fora, como no
 * limite do plano, e a contagem enxerga as linhas da mesma importação ainda não gravadas (prévia incluída). Só dados fictícios.
 */
@AutoConfigureMockMvc
class ImportacaoLimiteDoTreinadorIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate banco;

    private ApiDeTeste api;
    private JsonNode admin;
    private LimiteDoTreinadorDeTeste lim;
    private Membro membro;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        lim = new LimiteDoTreinadorDeTeste(api, admin, banco);
        membro = lim.membro();
    }

    private static String unico(String prefixo) {
        return prefixo + "-" + UUID.randomUUID() + "@teste.local";
    }

    private String config(String existentes, Map<String, Integer> mapeamento) throws Exception {
        return json.writeValueAsString(Map.of("aba", 0, "linhaDoCabecalho", 1, "chave", "email", "existentes", existentes,
                "mapeamento", mapeamento));
    }

    private JsonNode enviar(JsonNode login, String caminho, String csv, String config, String hash) throws Exception {
        MockMultipartHttpServletRequestBuilder pedido = multipart("/importacoes/" + caminho)
                .file(new MockMultipartFile("arquivo", "limite.csv", "text/csv", csv.getBytes(StandardCharsets.UTF_8)))
                .file(new MockMultipartFile("configuracao", "config.json", "application/json", config.getBytes(StandardCharsets.UTF_8)))
                .header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(login))
                .header("X-Treinos-Cliente", "nativo");
        if (hash != null) {
            pedido.param("hash", hash);
        }
        String texto = mvc.perform(pedido).andExpect(status().isOk()).andReturn().getResponse()
                .getContentAsString(StandardCharsets.UTF_8);
        return json.readTree(texto);
    }

    private JsonNode previa(JsonNode login, String csv, String config) throws Exception {
        return enviar(login, "alunos/previa", csv, config, null);
    }

    /** Prévia e confirmação; devolve {previa, feito}. */
    private JsonNode[] importar(JsonNode login, String csv, String config) throws Exception {
        JsonNode previa = previa(login, csv, config);
        return new JsonNode[] {previa, enviar(login, "alunos", csv, config, previa.path("hash").asString())};
    }

    private static String linhas(String cabecalho, String... linhas) {
        return cabecalho + "\n" + String.join("\n", linhas) + "\n";
    }

    @Test
    void linhaDeAlunoNovoDoImportadorNoLimiteFicaDeForaComoNoLimiteDoPlano() throws Exception {
        lim.limite(membro, 1);
        lim.aluno(membro);
        String dentro = "Dentro Fictício " + UUID.randomUUID();
        String csv = linhas("nome;email", dentro + ";" + unico("a"), "Fora Fictício " + UUID.randomUUID() + ";" + unico("b"));
        String config = config("IGNORAR", Map.of("nome", 0, "email", 1));

        JsonNode[] r = importar(membro.login(), csv, config);
        // Cheio desde o começo: as duas linhas ficam de fora, com um motivo que não é o do plano e sem nome nem e-mail.
        assertThat(r[0].path("novos").asInt()).isZero();
        assertThat(r[0].path("comErro").asInt()).isEqualTo(2);
        for (JsonNode erro : r[0].path("erros")) {
            assertThat(erro.path("motivo").asString()).isNotBlank().isNotEqualTo("Limite de alunos do plano")
                    .doesNotContain(membro.nome()).doesNotContain(membro.id()).doesNotContain("Fictício");
        }
        assertThat(r[1].path("novos").asInt()).isZero();
        assertThat(lim.ativosDe(membro)).isEqualTo(1);
        assertThat(banco.queryForObject("select count(*) from aluno where nome = ?", Long.class, dentro)).isZero();
    }

    /** N+2 linhas com limite N: exatamente N entram, e a prévia diz o mesmo antes de gravar qualquer coisa. */
    @Test
    void nMaisDuasLinhasComLimiteNEntramExatamenteN() throws Exception {
        int n = 3;
        lim.limite(membro, n);
        String[] linhas = new String[n + 2];
        for (int i = 0; i < linhas.length; i++) {
            linhas[i] = "Linha " + i + " Fictícia " + UUID.randomUUID() + ";" + unico("n" + i);
        }
        String csv = linhas("nome;email", linhas);
        String config = config("IGNORAR", Map.of("nome", 0, "email", 1));

        JsonNode previa = previa(membro.login(), csv, config);
        assertThat(previa.path("novos").asInt()).isEqualTo(n);
        assertThat(previa.path("comErro").asInt()).isEqualTo(2);
        assertThat(lim.ativosDe(membro)).isZero(); // a prévia não grava

        JsonNode feito = enviar(membro.login(), "alunos", csv, config, previa.path("hash").asString());
        assertThat(feito.path("novos").asInt()).isEqualTo(n);
        assertThat(feito.path("comErro").asInt()).isEqualTo(2);
        assertThat(lim.ativosDe(membro)).isEqualTo(n);
    }

    @Test
    void contaOQueOMembroJaTemMaisAsLinhasDaMesmaImportacao() throws Exception {
        lim.limite(membro, 3);
        lim.alunos(membro, 2); // vaga para uma só
        String csv = linhas("nome;email", "Um Fictício " + UUID.randomUUID() + ";" + unico("um"),
                "Dois Fictício " + UUID.randomUUID() + ";" + unico("dois"));
        JsonNode[] r = importar(membro.login(), csv, config("IGNORAR", Map.of("nome", 0, "email", 1)));
        assertThat(r[0].path("novos").asInt()).isEqualTo(1);
        assertThat(r[1].path("novos").asInt()).isEqualTo(1);
        assertThat(lim.ativosDe(membro)).isEqualTo(3);
    }

    /** D8/D15: a linha de aluno novo já inativo na planilha não ocupa vaga. */
    @Test
    void alunoNovoInativoNaPlanilhaNaoOcupaVaga() throws Exception {
        lim.limite(membro, 1);
        lim.aluno(membro);
        String csv = linhas("nome;email;situacao", "Inativo Fictício " + UUID.randomUUID() + ";" + unico("in") + ";inativo");
        JsonNode[] r = importar(membro.login(), csv, config("IGNORAR", Map.of("nome", 0, "email", 1, "situacao", 2)));
        assertThat(r[0].path("novos").asInt()).isEqualTo(1);
        assertThat(r[1].path("novos").asInt()).isEqualTo(1);
        assertThat(lim.ativosDe(membro)).isEqualTo(1);
        // O mesmo membro cheio, agora com uma linha ativa: essa fica de fora.
        JsonNode[] ativo = importar(membro.login(), linhas("nome;email", "Ativo Fictício " + UUID.randomUUID() + ";" + unico("at")),
                config("IGNORAR", Map.of("nome", 0, "email", 1)));
        assertThat(ativo[1].path("novos").asInt()).isZero();
        assertThat(lim.ativosDe(membro)).isEqualTo(1);
    }

    /** Reativar pela planilha (situação "ativo" em quem já existe) confere o responsável que o aluno já tem. */
    @Test
    void reativarPelaPlanilhaComOResponsavelNoLimiteDeixaALinhaDeFora() throws Exception {
        lim.limite(membro, 1);
        UUID dele = lim.aluno(membro);
        String email = unico("volta");
        banco.update("update aluno set email = ? where id = ?", email, dele);
        lim.inativar(dele);
        lim.aluno(membro); // ocupa a vaga
        String csv = linhas("nome;email;situacao", lim.nomeDe(dele) + ";" + email + ";ativo");
        String config = config("ATUALIZAR", Map.of("nome", 0, "email", 1, "situacao", 2));

        JsonNode[] r = importar(admin, csv, config);
        assertThat(r[0].path("comErro").asInt()).isEqualTo(1);
        // Sem a coluna "responsavel" não houve escolha: o texto não fala em "escolhido".
        assertThat(r[0].path("erros").get(0).path("motivo").asString()).isEqualTo("O responsável do aluno já atingiu o limite de alunos.");
        assertThat(r[1].path("atualizados").asInt()).isZero();
        assertThat(lim.ativo(dele)).isFalse();
        assertThat(lim.ativosDe(membro)).isEqualTo(1);

        lim.limite(membro, 2);
        JsonNode[] depois = importar(admin, csv, config);
        assertThat(depois[0].path("comErro").asInt()).isZero();
        assertThat(lim.ativo(dele)).isTrue();
        assertThat(lim.ativosDe(membro)).isEqualTo(2);
    }

    /** A coluna "responsavel" que troca o responsável de quem já existe (e está ativo) confere o membro que recebe. */
    @Test
    void trocarOResponsavelPelaColunaDaPlanilhaConfereQuemRecebe() throws Exception {
        lim.limite(membro, 1);
        lim.aluno(membro);
        UUID aluno = lim.aluno(null);
        String email = unico("troca");
        banco.update("update aluno set email = ? where id = ?", email, aluno);
        String csv = linhas("nome;email;responsavel", lim.nomeDe(aluno) + ";" + email + ";" + membro.email());
        String config = config("ATUALIZAR", Map.of("nome", 0, "email", 1, "responsavel", 2));

        JsonNode[] r = importar(admin, csv, config);
        assertThat(r[0].path("comErro").asInt()).isEqualTo(1);
        assertThat(lim.responsavelDe(aluno)).isEqualTo(lim.idDoAdmin());

        lim.limite(membro, 2);
        importar(admin, csv, config);
        assertThat(lim.responsavelDe(aluno)).isEqualTo(membro.id());
    }

    @Test
    void importadorSemLimiteEOuMesmoResponsavelNaoSaoBarrados() throws Exception {
        UUID dele = lim.aluno(membro);
        lim.aluno(membro);
        String email = unico("mantem");
        banco.update("update aluno set email = ? where id = ?", email, dele);
        lim.limite(membro, 1); // já acima do limite (D4)

        // O Administrador não tem limite: importa aluno novo sem problema, mesmo com o membro cheio.
        String csv = linhas("nome;email", "Admin Fictício " + UUID.randomUUID() + ";" + unico("ad"));
        JsonNode[] r = importar(admin, csv, config("IGNORAR", Map.of("nome", 0, "email", 1)));
        assertThat(r[1].path("novos").asInt()).isEqualTo(1);

        // Atualizar quem já é do membro acima do limite, sem mexer no responsável, passa (D15).
        JsonNode[] mantem = importar(admin, linhas("nome;email", "Renomeado Fictício " + UUID.randomUUID() + ";" + email),
                config("ATUALIZAR", Map.of("nome", 0, "email", 1)));
        assertThat(mantem[0].path("comErro").asInt()).isZero();
        assertThat(mantem[1].path("atualizados").asInt()).isEqualTo(1);
        assertThat(lim.ativosDe(membro)).isEqualTo(2);

        // Já o membro acima do limite não traz aluno novo: a linha dele, que viraria dele, fica de fora.
        JsonNode[] dele2 = importar(membro.login(), linhas("nome;email", "Do Membro Fictício " + UUID.randomUUID() + ";" + unico("dm")),
                config("IGNORAR", Map.of("nome", 0, "email", 1)));
        assertThat(dele2[1].path("novos").asInt()).isZero();
        assertThat(lim.ativosDe(membro)).isEqualTo(2);
    }

    /**
     * Membro acima do limite (D4): 3 ativos e limite 1, saldo -2. A linha 1 tira um aluno dele e a linha 2 põe um novo: ainda
     * sobra -1, então a linha 2 fica de fora, na prévia e na confirmação (a prévia não pode cortar as vagas em zero).
     */
    @Test
    void membroAcimaDoLimiteQueTiraUmERecebeOutroNaMesmaImportacaoNaoCabePreviaEConfirmacaoIguais() throws Exception {
        Membro outro = lim.membro();
        UUID dele = lim.aluno(membro);
        lim.alunos(membro, 2);
        lim.limite(membro, 1);
        String email = unico("sai");
        banco.update("update aluno set email = ? where id = ?", email, dele);
        String novoNome = "Novo Fictício " + UUID.randomUUID();
        String csv = linhas("nome;email;responsavel", lim.nomeDe(dele) + ";" + email + ";" + outro.email(),
                novoNome + ";" + unico("entra") + ";" + membro.email());
        String config = config("ATUALIZAR", Map.of("nome", 0, "email", 1, "responsavel", 2));

        JsonNode[] r = importar(admin, csv, config);
        assertThat(r[0].path("comErro").asInt()).as("prévia").isEqualTo(1);
        assertThat(r[0].path("novos").asInt()).isZero();
        assertThat(r[1].path("comErro").asInt()).as("confirmação").isEqualTo(1);
        assertThat(r[1].path("novos").asInt()).isZero();
        assertThat(r[1].path("atualizados").asInt()).isEqualTo(1);
        assertThat(lim.ativosDe(membro)).isEqualTo(2);
        assertThat(lim.responsavelDe(dele)).isEqualTo(outro.id());
    }

    /** O texto diz "você" quando o responsável é o próprio importador (sem coluna) e "o responsável escolhido" quando a coluna aponta outro. */
    @Test
    void textoDoErroDependeDeQuemEOResponsavel() throws Exception {
        lim.limite(membro, 1);
        lim.aluno(membro);
        String config = config("IGNORAR", Map.of("nome", 0, "email", 1));
        JsonNode proprio = previa(membro.login(), linhas("nome;email", "Eu Fictício " + UUID.randomUUID() + ";" + unico("eu")), config);
        assertThat(proprio.path("erros").get(0).path("motivo").asString()).isEqualTo("Você já atingiu o limite de alunos.");

        String comColuna = config("IGNORAR", Map.of("nome", 0, "email", 1, "responsavel", 2));
        JsonNode escolhido = previa(admin, linhas("nome;email;responsavel",
                "Outro Fictício " + UUID.randomUUID() + ";" + unico("ou") + ";" + membro.email()), comColuna);
        assertThat(escolhido.path("erros").get(0).path("motivo").asString()).isEqualTo("O responsável escolhido já atingiu o limite de alunos.");
    }
}
