package br.com.treinos.api.importacao.completa;

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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static br.com.treinos.api.importacao.completa.PlanilhaDeTeste.linha;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Migração assistida, fase 1: {@code POST /importacoes/diagnostico} pela rota, com a chave ligada (a suíte a liga). Não grava
 * nada, a resposta nunca leva valor de célula e o limite de alunos vem do que a importação já confere. Arquivos fictícios
 * gerados no teste.
 */
@AutoConfigureMockMvc
class DiagnosticoDoArquivoIntegrationTest extends AbstractIntegrationTest {

    private static final String ROTA = "/importacoes/diagnostico";
    private static final String SENTINELA = "Sentinela-Unica-Qx9";

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate banco;

    private ApiDeTeste api;
    private JsonNode treinador;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        treinador = api.novoTreinador();
    }

    private String corpo(JsonNode login, String nome, byte[] bytes, int esperado) throws Exception {
        MockMultipartHttpServletRequestBuilder pedido = multipart(ROTA)
                .file(new MockMultipartFile("arquivo", nome, "application/octet-stream", bytes))
                .header("X-Treinos-Cliente", "nativo");
        if (login != null) {
            pedido.header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(login));
        }
        return mvc.perform(pedido).andExpect(status().is(esperado)).andReturn().getResponse()
                .getContentAsString(StandardCharsets.UTF_8);
    }

    private JsonNode diagnosticar(JsonNode login, String nome, byte[] bytes) throws Exception {
        return json.readTree(corpo(login, nome, bytes, 200));
    }

    private static byte[] cadastro(int alunos) {
        List<List<Object>> linhas = new java.util.ArrayList<>();
        linhas.add(linha("Nome", "Email", "Telefone", "Plano Antigo"));
        for (int i = 1; i <= alunos; i++) {
            linhas.add(linha("Aluno Teste " + i, "aluno" + i + "@example.com", null, "Gold"));
        }
        Map<String, List<List<Object>>> abas = new LinkedHashMap<>();
        abas.put("Alunos", linhas);
        return PlanilhaDeTeste.xlsx(abas);
    }

    private int problema(JsonNode d, String codigo) {
        for (JsonNode p : d.path("problemas")) {
            if (codigo.equals(p.path("codigo").asString())) {
                return p.path("quantidade").asInt();
            }
        }
        return 0;
    }

    @Test
    void diagnosticaSemGravarNadaENuncaDevolveValorDeCelula() throws Exception {
        Map<String, List<List<Object>>> abas = new LinkedHashMap<>();
        abas.put("Alunos " + SENTINELA, List.of(
                linha("Nome", "Email", "Telefone", "Observação Interna " + "Extra"),
                linha("Aluno Teste 1 " + SENTINELA, "um@example.com", null, "Nota " + SENTINELA),
                linha("Aluno Teste 2", "invalido-" + SENTINELA, null, null),
                linha(null, "um@example.com", null, null)));
        long alunosAntes = api.get("/alunos", treinador, 200).path("total").asLong();

        String texto = corpo(treinador, "migracao.xlsx", PlanilhaDeTeste.xlsx(abas), 200);
        JsonNode d = json.readTree(texto);

        assertThat(d.path("tipo").asString()).isEqualTo("CADASTRO_DE_ALUNOS");
        assertThat(d.path("linhas").asInt()).isEqualTo(3);
        assertThat(problema(d, "EMAIL_INVALIDO")).isEqualTo(1);
        assertThat(problema(d, "EMAIL_DUPLICADO")).isEqualTo(1);
        assertThat(problema(d, "LINHA_SEM_NOME")).isEqualTo(1);
        // O nome da aba é texto livre do arquivo: a resposta traz só a posição e o tipo reconhecido.
        assertThat(d.path("abas").get(0).has("nome")).isFalse();
        assertThat(d.path("abas").get(0).path("indice").asInt()).isZero();
        assertThat(d.path("abas").get(0).path("tipo").asString()).isEqualTo("ALUNOS");
        assertThat(d.path("abas").get(0).path("colunas").get(3).path("nome").isString()).isFalse(); // coluna sem nome conhecido
        // Nenhum valor de célula, nem o nome do aluno, nem o e-mail, nem o texto livre.
        assertThat(texto).doesNotContain(SENTINELA).doesNotContain("Aluno Teste").doesNotContain("example.com")
                .doesNotContain("invalido-");
        // Nada gravado: nem aluno nem registro de importação.
        assertThat(api.get("/alunos", treinador, 200).path("total").asLong()).isEqualTo(alunosAntes);
        assertThat(api.get("/importacoes", treinador, 200).path("total").asInt()).isZero();
    }

    @Test
    void csvSemCabecalhoNaoDevolveAPrimeiraLinhaDeDados() throws Exception {
        byte[] csv = ("Aluno Teste 1;" + SENTINELA + ";x\nAluno Teste 2;Outra Cidade;y\n").getBytes(StandardCharsets.UTF_8);

        String texto = corpo(treinador, "sem-cabecalho.csv", csv, 200);

        assertThat(texto).doesNotContain(SENTINELA).doesNotContain("Aluno Teste").doesNotContain("Outra Cidade");
        assertThat(json.readTree(texto).path("tipo").asString()).isEqualTo("DESCONHECIDO");
    }

    @Test
    void limiteDeAlunosDeQuemImportaVemSoEmContagemEOutraConsultoriaNaoSeMistura() throws Exception {
        LimiteDoTreinadorDeTeste lim = new LimiteDoTreinadorDeTeste(api, treinador, banco);
        Membro membro = lim.membro();
        lim.limite(membro, 2);
        lim.alunos(membro, 1); // sobra 1 vaga para o membro
        byte[] tres = cadastro(3);

        JsonNode doMembro = diagnosticar(membro.login(), "tres.xlsx", tres);
        assertThat(problema(doMembro, "ACIMA_DO_LIMITE_DO_TREINADOR")).isEqualTo(2);
        assertThat(problema(doMembro, "ACIMA_DO_LIMITE_DO_PLANO")).isZero();
        assertThat(doMembro.toString()).doesNotContain(membro.nome()).doesNotContain(membro.id());

        // Outra consultoria: sem limite, o mesmo arquivo não acusa nada e a primeira não aparece no histórico dela.
        JsonNode outra = api.novoTreinador();
        JsonNode daOutra = diagnosticar(outra, "tres.xlsx", tres);
        assertThat(problema(daOutra, "ACIMA_DO_LIMITE_DO_TREINADOR")).isZero();
        assertThat(api.get("/importacoes", outra, 200).path("total").asInt()).isZero();
        assertThat(api.get("/importacoes", treinador, 200).path("total").asInt()).isZero();
    }

    @Test
    void soBlocosDeAlunosNovosGastamVagaDoPlanoEDoTreinador() throws Exception {
        LimiteDoTreinadorDeTeste lim = new LimiteDoTreinadorDeTeste(api, treinador, banco);
        Membro membro = lim.membro();
        lim.limite(membro, 0); // não recebe aluno novo
        List<List<Object>> blocos = new java.util.ArrayList<>();
        for (int i = 1; i <= 10; i++) {
            blocos.add(linha("Aluno: Aluno Teste " + i));
            blocos.add(linha("Exercício", "Prescrição"));
            blocos.add(linha("Agachamento fictício", "4x10"));
        }
        Map<String, List<List<Object>>> abas = new LinkedHashMap<>();
        abas.put("Treinos", blocos);

        JsonNode d = diagnosticar(membro.login(), "blocos.xlsx", PlanilhaDeTeste.xlsx(abas));

        assertThat(d.path("tipo").asString()).isEqualTo("TREINO");
        assertThat(problema(d, "ACIMA_DO_LIMITE_DO_TREINADOR")).isEqualTo(10);
    }

    @Test
    void diagnosticoTemOSeuProprioLimiteDeTentativas() throws Exception {
        JsonNode outro = api.novoTreinador();
        byte[] arquivo = cadastro(1);
        for (int i = 0; i < 30; i++) {
            diagnosticar(outro, "a.xlsx", arquivo);
        }
        corpo(outro, "a.xlsx", arquivo, 429);
        // O balde é só dele: a prévia da importação do mesmo usuário continua livre.
        mvc.perform(multipart("/importacoes/alunos/colunas")
                        .file(new MockMultipartFile("arquivo", "a.xlsx", "application/octet-stream", arquivo))
                        .header("X-Treinos-Cliente", "nativo")
                        .header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(outro)))
                .andExpect(status().isOk());
    }

    @Test
    void euDizQueAChaveEstaLigada() throws Exception {
        assertThat(api.get("/eu", treinador, 200).path("migracaoAssistidaHabilitada").asBoolean()).isTrue();
    }

    @Test
    void semPermissaoDeAlunoSemLoginEArquivoInvalido() throws Exception {
        // Perfil só com a biblioteca: ALUNO_ALTERAR é a permissão da rota.
        Membro biblioteca = new LimiteDoTreinadorDeTeste(api, treinador, banco).membro(Set.of("BIBLIOTECA_LER", "BIBLIOTECA_ALTERAR"));
        corpo(biblioteca.login(), "a.xlsx", cadastro(1), 403);

        UUID aluno = api.criarAluno(treinador, "Aluno Fictício " + UUID.randomUUID());
        corpo(api.convidarEEntrar(treinador, aluno), "a.xlsx", cadastro(1), 403);

        corpo(null, "a.xlsx", cadastro(1), 401);

        JsonNode invalido = json.readTree(corpo(treinador, "a.xls", new byte[] {(byte) 0xD0, (byte) 0xCF, 0x11, (byte) 0xE0}, 422));
        assertThat(invalido.path("codigo").asString()).isEqualTo("ARQUIVO_INVALIDO");
        corpo(treinador, "vazio.csv", new byte[0], 422);
    }
}
