package br.com.treinos.api.comunidade;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
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
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Como o nome do aluno aparece para os colegas (V085; plano {@code nome-no-mural}): o servidor monta o nome e o sobrenome nunca
 * sai quando a escolha não é {@code NOME_COMPLETO}. Cada teste confere o TEXTO inteiro da resposta que o aluno B recebe (não só o
 * campo do nome). A equipe continua vendo o nome completo e o apelido. Só dados fictícios.
 */
@AutoConfigureMockMvc
class NomeNoMuralIntegrationTest extends AbstractIntegrationTest {

    private static final String SOBRENOME = "Souzalima";
    private static final String NOME_DE_A = "Ana " + SOBRENOME;
    private static final String CAMINHO = "/aluno/comunidade";

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;

    private ApiDeTeste api;
    private JsonNode admin;
    private UUID alunoA;
    private UUID alunoB;
    private JsonNode loginA;
    private JsonNode loginB;
    private String usuarioA;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        alunoA = api.criarAluno(admin, NOME_DE_A);
        alunoB = api.criarAluno(admin, "Beto Votante Nunes");
        loginA = api.convidarEEntrar(admin, alunoA);
        loginB = api.convidarEEntrar(admin, alunoB);
        usuarioA = jdbc.queryForObject("select usuario_id::text from aluno where id = ?", String.class, alunoA);
        api.put(CAMINHO + "/apelido", loginA, Map.of("apelido", "Aninha"), 204);
    }

    // ---- ajudantes ----

    private void escolher(String valor) throws Exception {
        api.put(CAMINHO + "/perfil", loginA, pedido(false, valor), 200);
    }

    private static Map<String, Object> pedido(Boolean reservado, String exibicao) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("perfilReservado", reservado);
        m.put("destaques", List.of());
        m.put("cor", null);
        m.put("moldura", null);
        m.put("exibicaoDoNome", exibicao);
        return m;
    }

    private String postDeA() throws Exception {
        return api.post(CAMINHO + "/mural", loginA, Map.of("texto", "Treino de hoje feito"), 200).get("id").asString();
    }

    private JsonNode doMural(JsonNode login, String postId) throws Exception {
        for (JsonNode p : api.get(CAMINHO + "/mural?tamanho=50", login, 200).get("content")) {
            if (p.get("id").asString().equals(postId)) {
                return p;
            }
        }
        throw new AssertionError("post não está no mural");
    }

    private String aula() throws Exception {
        return api.post("/comunidade/aulas", admin, Map.of("titulo", "Aulão fictício", "videoUrl", "https://youtube.com/watch?v=abc",
                "publicada", true), 200).get("id").asString();
    }

    private String enqueteVotadaPorA() throws Exception {
        JsonNode enquete = api.post("/comunidade/mural", admin, Map.of("tipo", "ENQUETE", "texto", "Qual horário?",
                "opcoes", List.of("Manhã", "Noite")), 200);
        String opcao = enquete.get("enquete").get("opcoes").get(0).get("id").asString();
        api.put(CAMINHO + "/mural/" + enquete.get("id").asString() + "/votos", loginA, Map.of("opcaoIds", List.of(opcao)), 200);
        return enquete.get("id").asString();
    }

    /** A resposta INTEIRA a B, como texto: o sobrenome de A não pode estar em lugar nenhum. */
    private static void semSobrenome(JsonNode resposta) {
        assertThat(resposta.toString()).doesNotContain(SOBRENOME);
    }

    // ---- escolha no perfil ----

    @Test
    void perfilGuardaDevolveEValorForaDaListaDa422SemEco() throws Exception {
        assertThat(api.get(CAMINHO + "/perfil", loginA, 200).get("exibicaoDoNome").asString()).isEqualTo("NOME");
        assertThat(api.put(CAMINHO + "/perfil", loginA, pedido(false, "APELIDO"), 200).get("exibicaoDoNome").asString()).isEqualTo("APELIDO");
        assertThat(api.get(CAMINHO + "/perfil", loginA, 200).get("exibicaoDoNome").asString()).isEqualTo("APELIDO");
        assertThat(jdbc.queryForObject("select exibicao_do_nome from aluno where id = ?", String.class, alunoA)).isEqualTo("APELIDO");

        for (String invalido : new String[] {"nome_completo", "TUDO", "NOME COMPLETO", "x".repeat(200)}) {
            JsonNode erro = api.put(CAMINHO + "/perfil", loginA, pedido(false, invalido), 422);
            assertThat(erro.get("codigo").asString()).isEqualTo("PERFIL_INVALIDO");
            assertThat(erro.get("fieldErrors").get(0).get("field").asString()).isEqualTo("exibicaoDoNome");
            assertThat(erro.toString()).doesNotContain(invalido);
        }
        // A recusa não mexeu na escolha.
        assertThat(api.get(CAMINHO + "/perfil", loginA, 200).get("exibicaoDoNome").asString()).isEqualTo("APELIDO");
        // Nulo e em branco voltam ao padrão.
        assertThat(api.put(CAMINHO + "/perfil", loginA, pedido(false, null), 200).get("exibicaoDoNome").asString()).isEqualTo("NOME");
    }

    @Test
    void menorEscolheIgualAosOutros() throws Exception {
        jdbc.update("update aluno set data_nascimento = ? where id = ?", LocalDate.now(Fuso.BRASILIA).minusYears(12), alunoA);
        assertThat(api.put(CAMINHO + "/perfil", loginA, pedido(null, "NOME_E_APELIDO"), 200).get("exibicaoDoNome").asString())
                .isEqualTo("NOME_E_APELIDO");
    }

    // ---- mural, comentários, aulão ----

    @Test
    void muralMostraONomeMontadoSemSobrenomeEPostNovoTambem() throws Exception {
        String post = postDeA();
        // Sem escolha (nula): só o primeiro nome.
        JsonNode padrao = doMural(loginB, post);
        assertThat(padrao.get("autorNome").asString()).isEqualTo("Ana");
        assertThat(padrao.get("autorApelido").isNull()).isTrue();
        assertThat(padrao.get("autorEhAluno").asBoolean()).isTrue();
        semSobrenome(api.get(CAMINHO + "/mural?tamanho=50", loginB, 200));

        for (Object[] caso : new Object[][] {{"NOME", "Ana"}, {"APELIDO", "Aninha"}, {"NOME_E_APELIDO", "Ana (Aninha)"}}) {
            escolher((String) caso[0]);
            JsonNode lista = api.get(CAMINHO + "/mural?tamanho=50", loginB, 200);
            semSobrenome(lista);
            assertThat(doMural(loginB, post).get("autorNome").asString()).isEqualTo(caso[1]);
            assertThat(doMural(loginB, post).get("autorApelido").isNull()).isTrue();
            // A resposta ao próprio autor ao publicar também já vem montada (a cópia gravada no post é o nome completo).
            JsonNode nova = api.post(CAMINHO + "/mural", loginA, Map.of("texto", "Outro post"), 200);
            assertThat(nova.get("autorNome").asString()).isEqualTo(caso[1]);
            semSobrenome(nova);
        }
        escolher("NOME_COMPLETO");
        assertThat(doMural(loginB, post).get("autorNome").asString()).isEqualTo(NOME_DE_A);
    }

    @Test
    void equipeContinuaVendoNomeCompletoEApelido() throws Exception {
        String post = postDeA();
        escolher("NOME");
        JsonNode dePost = null;
        for (JsonNode p : api.get("/comunidade/mural?tamanho=50", admin, 200).get("content")) {
            if (p.get("id").asString().equals(post)) {
                dePost = p;
            }
        }
        assertThat(dePost).isNotNull();
        assertThat(dePost.get("autorNome").asString()).isEqualTo(NOME_DE_A);
        assertThat(dePost.get("autorApelido").asString()).isEqualTo("Aninha");

        api.post(CAMINHO + "/mural/" + post + "/comentarios", loginA, Map.of("texto", "Meu comentário"), 200);
        JsonNode comentario = api.get("/comunidade/mural/" + post + "/comentarios", admin, 200).get("itens").get(0);
        assertThat(comentario.get("autorNome").asString()).isEqualTo(NOME_DE_A);
        assertThat(comentario.get("autorApelido").asString()).isEqualTo("Aninha");

        String enquete = enqueteVotadaPorA();
        JsonNode votante = api.get("/comunidade/mural/" + enquete + "/votos", admin, 200).get("votantes").get("itens").get(0);
        assertThat(votante.get("nome").asString()).isEqualTo(NOME_DE_A);
        assertThat(votante.get("apelido").asString()).isEqualTo("Aninha");
    }

    @Test
    void comentarioDoMuralMostraONomeMontado() throws Exception {
        String post = api.post("/comunidade/mural", admin, Map.of("texto", "Aviso da equipe"), 200).get("id").asString();
        JsonNode resposta = api.post(CAMINHO + "/mural/" + post + "/comentarios", loginA, Map.of("texto", "Oi, time"), 200);
        assertThat(resposta.get("autorNome").asString()).isEqualTo("Ana");
        semSobrenome(resposta);
        for (Object[] caso : new Object[][] {{null, "Ana"}, {"APELIDO", "Aninha"}, {"NOME_E_APELIDO", "Ana (Aninha)"}}) {
            escolher((String) caso[0]);
            JsonNode lista = api.get(CAMINHO + "/mural/" + post + "/comentarios", loginB, 200);
            semSobrenome(lista);
            assertThat(lista.get("itens").get(0).get("autorNome").asString()).isEqualTo(caso[1]);
            assertThat(lista.get("itens").get(0).get("autorApelido").isNull()).isTrue();
            assertThat(lista.get("itens").get(0).get("autorEhAluno").asBoolean()).isTrue();
        }
        escolher("NOME_COMPLETO");
        assertThat(api.get(CAMINHO + "/mural/" + post + "/comentarios", loginB, 200).get("itens").get(0).get("autorNome").asString())
                .isEqualTo(NOME_DE_A);
    }

    @Test
    void comentarioDeAulaoMostraONomeMontado() throws Exception {
        String aula = aula();
        JsonNode resposta = api.post(CAMINHO + "/aulas/" + aula + "/comentarios", loginA, Map.of("texto", "Aula ótima"), 200);
        assertThat(resposta.get("autorNome").asString()).isEqualTo("Ana");
        semSobrenome(resposta);
        for (Object[] caso : new Object[][] {{null, "Ana"}, {"APELIDO", "Aninha"}, {"NOME_E_APELIDO", "Ana (Aninha)"}}) {
            escolher((String) caso[0]);
            JsonNode lista = api.get(CAMINHO + "/aulas/" + aula + "/comentarios", loginB, 200);
            semSobrenome(lista);
            assertThat(lista.get("itens").get(0).get("autorNome").asString()).isEqualTo(caso[1]);
            assertThat(lista.get("itens").get(0).get("autorApelido").isNull()).isTrue();
        }
        escolher("NOME_COMPLETO");
        assertThat(api.get(CAMINHO + "/aulas/" + aula + "/comentarios", loginB, 200).get("itens").get(0).get("autorNome").asString())
                .isEqualTo(NOME_DE_A);
        // A equipe vê o completo e o apelido.
        JsonNode daEquipe = api.get("/comunidade/aulas/" + aula + "/comentarios", admin, 200).get("itens").get(0);
        assertThat(daEquipe.get("autorNome").asString()).isEqualTo(NOME_DE_A);
        assertThat(daEquipe.get("autorApelido").asString()).isEqualTo("Aninha");
    }

    @Test
    void autorInativoNaoPerdeProtecaoENaoMostraApelido() throws Exception {
        String post = postDeA();
        escolher("NOME_E_APELIDO");
        jdbc.update("update aluno set ativo = false where id = ?", alunoA);
        JsonNode inativo = doMural(loginB, post);
        assertThat(inativo.get("autorNome").asString()).isEqualTo("Ana");
        assertThat(inativo.get("autorEhAluno").asBoolean()).isFalse();
        semSobrenome(api.get(CAMINHO + "/mural?tamanho=50", loginB, 200));
    }

    // ---- votos da enquete ----

    @Test
    void votosDaEnqueteMostramONomeMontado() throws Exception {
        String enquete = enqueteVotadaPorA();
        for (Object[] caso : new Object[][] {{null, "Ana"}, {"NOME", "Ana"}, {"APELIDO", "Aninha"}, {"NOME_E_APELIDO", "Ana (Aninha)"}}) {
            escolher((String) caso[0]);
            JsonNode votos = api.get(CAMINHO + "/mural/" + enquete + "/votos", loginB, 200);
            semSobrenome(votos);
            JsonNode votante = votos.get("votantes").get("itens").get(0);
            assertThat(votante.get("nome").asString()).isEqualTo(caso[1]);
            assertThat(votante.has("apelido")).isFalse();
            // A amostra de votantes da lista do mural também.
            JsonNode lista = api.get(CAMINHO + "/mural?tamanho=50", loginB, 200);
            semSobrenome(lista);
            JsonNode amostra = doMural(loginB, enquete).get("enquete").get("opcoes").get(0).get("votantesAmostra").get(0);
            assertThat(amostra.get("nome").asString()).isEqualTo(caso[1]);
            assertThat(amostra.has("apelido")).isFalse();
        }
        escolher("NOME_COMPLETO");
        assertThat(api.get(CAMINHO + "/mural/" + enquete + "/votos", loginB, 200).get("votantes").get("itens").get(0).get("nome")
                .asString()).isEqualTo(NOME_DE_A);
    }

    @Test
    void votanteReservadoNemInativoVazaOSobrenome() throws Exception {
        String enquete = enqueteVotadaPorA();
        escolher("APELIDO");
        api.put(CAMINHO + "/perfil", loginA, pedido(true, "NOME_E_APELIDO"), 200);
        JsonNode reservado = api.get(CAMINHO + "/mural/" + enquete + "/votos", loginB, 200);
        semSobrenome(reservado);
        assertThat(reservado.get("votantes").get("itens").get(0).get("nome").asString()).isEqualTo("Ana (Aninha)");
        jdbc.update("update aluno set ativo = false where id = ?", alunoA);
        JsonNode inativo = api.get(CAMINHO + "/mural/" + enquete + "/votos", loginB, 200);
        semSobrenome(inativo);
        assertThat(inativo.get("votantes").get("itens").get(0).get("nome").asString()).isEqualTo("Ana");
    }

    // ---- Colegas e perfil do colega ----

    @Test
    void listaDeColegasMostraONomeMontado() throws Exception {
        for (Object[] caso : new Object[][] {{null, "Ana"}, {"APELIDO", "Aninha"}, {"NOME_E_APELIDO", "Ana (Aninha)"}}) {
            escolher((String) caso[0]);
            JsonNode lista = api.get(CAMINHO + "/perfis", loginB, 200);
            semSobrenome(lista);
            assertThat(lista.get("itens")).hasSize(1);
            assertThat(lista.get("itens").get(0).get("nome").asString()).isEqualTo(caso[1]);
            assertThat(lista.get("itens").get(0).get("apelido").isNull()).isTrue();
        }
        escolher("NOME_COMPLETO");
        assertThat(api.get(CAMINHO + "/perfis", loginB, 200).get("itens").get(0).get("nome").asString()).isEqualTo(NOME_DE_A);
    }

    @Test
    void perfilDoColegaVisivelReservadoEMenorNaoVazamOSobrenome() throws Exception {
        String caminho = CAMINHO + "/perfis/" + usuarioA;
        for (Object[] caso : new Object[][] {{null, "Ana"}, {"APELIDO", "Aninha"}, {"NOME_E_APELIDO", "Ana (Aninha)"}}) {
            escolher((String) caso[0]);
            JsonNode visivel = api.get(caminho, loginB, 200);
            semSobrenome(visivel);
            assertThat(visivel.get("nome").asString()).isEqualTo(caso[1]);
            assertThat(visivel.get("apelido").isNull()).isTrue();
            assertThat(visivel.get("reservado").asBoolean()).isFalse();

            // Reservado pela escolha: só o nome (montado), nunca o completo.
            api.put(CAMINHO + "/perfil", loginA, pedido(true, (String) caso[0]), 200);
            JsonNode reservado = api.get(caminho, loginB, 200);
            semSobrenome(reservado);
            assertThat(reservado.get("reservado").asBoolean()).isTrue();
            assertThat(reservado.get("nome").asString()).isEqualTo(caso[1]);
            api.put(CAMINHO + "/perfil", loginA, pedido(false, (String) caso[0]), 200);
        }
        // Menor de idade (reservado pela regra da idade, sem escolha): igual.
        jdbc.update("update aluno set data_nascimento = ? where id = ?", LocalDate.now(Fuso.BRASILIA).minusYears(12), alunoA);
        api.put(CAMINHO + "/perfil", loginA, pedido(null, "NOME_E_APELIDO"), 200);
        JsonNode menor = api.get(caminho, loginB, 200);
        semSobrenome(menor);
        assertThat(menor.get("reservado").asBoolean()).isTrue();
        assertThat(menor.get("nome").asString()).isEqualTo("Ana (Aninha)");
        // O menor que escolheu NOME_COMPLETO é quem decide, como os outros.
        api.put(CAMINHO + "/perfil", loginA, pedido(null, "NOME_COMPLETO"), 200);
        assertThat(api.get(caminho, loginB, 200).get("nome").asString()).isEqualTo(NOME_DE_A);
    }

    // ---- LGPD ----

    @Test
    void exportacaoLevaAEscolhaEAnonimizacaoZera() throws Exception {
        escolher("NOME_E_APELIDO");
        JsonNode perfil = api.get("/alunos/" + alunoA + "/exportacao", admin, 200).get("comunidade").get("perfil");
        assertThat(perfil.get("exibicaoDoNome").asString()).isEqualTo("NOME_E_APELIDO");

        api.patch("/alunos/" + alunoA + "/situacao", admin, Map.of("ativo", false), 200);
        api.post("/alunos/" + alunoA + "/anonimizar", admin, Map.of("nomeConfirmado", NOME_DE_A), 200);
        assertThat(jdbc.queryForObject("select exibicao_do_nome from aluno where id = ?", String.class, alunoA)).isNull();
    }

    @Test
    void excluirMinhaContaZeraAEscolha() throws Exception {
        escolher("NOME_COMPLETO");
        api.post("/aluno/conta/excluir", loginA, Map.of("senha", ApiDeTeste.SENHA, "confirmacao", "EXCLUIR"), 204);
        assertThat(jdbc.queryForObject("select exibicao_do_nome from aluno where id = ?", String.class, alunoA)).isNull();
    }

    @Test
    void checkDoBancoRecusaValorForaDaLista() {
        org.assertj.core.api.Assertions.assertThatThrownBy(
                        () -> jdbc.update("update aluno set exibicao_do_nome = 'TUDO' where id = ?", alunoA))
                .hasMessageContaining("ck_aluno_exibicao_do_nome");
    }
}
