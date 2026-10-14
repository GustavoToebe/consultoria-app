package br.com.treinos.api.privacidade;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.dieta.ConteudoDieta;
import br.com.treinos.api.dieta.ConteudoDieta.Item;
import br.com.treinos.api.dieta.ConteudoDieta.Opcao;
import br.com.treinos.api.dieta.ConteudoDieta.Refeicao;
import br.com.treinos.api.web.Fuso;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Exportar e anonimizar os dados de um aluno (LGPD). Só dados fictícios. */
@AutoConfigureMockMvc
class PrivacidadeIntegrationTest extends AbstractIntegrationTest {

    private static final String NOME = "Maria Fictícia";
    private static final String OBJETIVO = "Meta pessoal fictícia XYZ";
    private static final String OBSERVACAO_SERIE = "Dor leve no ombro (texto fictício)";

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JsonMapper json;
    @Autowired
    private JdbcTemplate jdbc;

    private ApiDeTeste api;
    private JsonNode admin;
    private UUID alunoId;
    private String emailDoAluno;
    private JsonNode loginDoAluno;
    private final LocalDate hoje = LocalDate.now(Fuso.BRASILIA);

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        emailDoAluno = ApiDeTeste.emailUnico("maria");
        alunoId = UUID.fromString(api.post("/alunos", admin, Map.of("nome", NOME, "email", emailDoAluno,
                "objetivo", OBJETIVO, "observacoes", "Observação fictícia do cadastro"), 200).get("id").asString());
        popular();
    }

    /** Pasta com treino e dieta publicados, registro com observação, peso, lesão e uma atualização com feedback. */
    private void popular() throws Exception {
        String pasta = api.post("/alunos/" + alunoId + "/pastas", admin, Map.of("titulo", "Pasta de " + NOME,
                "inicio", hoje.minusDays(26), "fim", hoje.plusDays(1)), 200).get("id").asString();
        var treino = ApiDeTeste.treino();
        JsonNode criado = api.post("/alunos/" + alunoId + "/planos-treino", admin,
                Map.of("titulo", "Treino de " + NOME, "pastaId", pasta), 200);
        String treinoId = criado.get("plano").get("id").asString();
        JsonNode salvo = api.put("/planos-treino/" + treinoId + "/rascunho", admin,
                ApiDeTeste.rascunho("Treino de " + NOME, treino.conteudo(), criado.get("plano").get("versao").asLong()), 200);
        api.post("/planos-treino/" + treinoId + "/publicar", admin,
                Map.of("versao", salvo.get("plano").get("versao").asLong(), "confirmarAvisos", true), 200);

        JsonNode dieta = api.post("/alunos/" + alunoId + "/planos-dieta", admin,
                Map.of("titulo", "Dieta de " + NOME, "pastaId", pasta), 200);
        String dietaId = dieta.get("plano").get("id").asString();
        ConteudoDieta conteudo = new ConteudoDieta(null, null, null, List.of(new Refeicao(UUID.randomUUID(), "Almoço", "12:00", null,
                List.of(new Opcao(UUID.randomUUID(), "A", List.of(new Item(UUID.randomUUID(), UUID.randomUUID(),
                        "Arroz branco cozido", new BigDecimal("150"), "g", new BigDecimal("191.7"), BigDecimal.ONE,
                        BigDecimal.TEN, BigDecimal.ZERO, false)))))), List.of(), null, List.of(),
                List.of(new ConteudoDieta.Ergogenico(UUID.randomUUID(), "Item ergogênico fictício", null, null, "1 dose",
                        null, null, null)));
        JsonNode dietaSalva = api.put("/planos-dieta/" + dietaId + "/rascunho", admin,
                ApiDeTeste.rascunho("Dieta de " + NOME, conteudo, dieta.get("plano").get("versao").asLong()), 200);
        api.post("/planos-dieta/" + dietaId + "/publicar", admin,
                Map.of("versao", dietaSalva.get("plano").get("versao").asLong(), "confirmarAvisos", true), 200);

        String codigo = api.post("/alunos/" + alunoId + "/convite", admin, null, 200).get("codigo").asString();
        loginDoAluno = api.post("/publico/convites/" + codigo + "/aceitar", null,
                Map.of("email", emailDoAluno, "senha", ApiDeTeste.SENHA), 200);
        String versaoId = api.get("/aluno/painel", loginDoAluno, 200).get("treino").get("versaoId").asString();
        Map<String, Object> registro = new LinkedHashMap<>();
        registro.put("id", UUID.randomUUID().toString());
        registro.put("planoVersaoId", versaoId);
        registro.put("sessaoUid", treino.sessaoUid().toString());
        registro.put("exercicioUid", treino.exercicioUid().toString());
        registro.put("serieUid", treino.wsUid().toString());
        registro.put("data", hoje.toString());
        registro.put("carga", "32.5");
        registro.put("repeticoes", 5);
        registro.put("concluida", true);
        registro.put("observacao", OBSERVACAO_SERIE);
        registro.put("alteradoNoAparelhoEm", Instant.now().toString());
        api.post("/aluno/execucoes/lote", loginDoAluno, Map.of("registros", List.of(registro)), 200);

        api.post("/alunos/" + alunoId + "/pesos", admin,
                Map.of("data", hoje.minusDays(3), "pesoKg", "79.90", "observacao", "Obs de peso fictícia"), 200);
        api.post("/alunos/" + alunoId + "/lesoes", admin,
                Map.of("regiao", "Ombro direito", "descricao", "Dor fictícia", "dataInicio", "2026-03-01", "situacao", "ATIVA"), 200);

        JsonNode atual = api.get("/aluno/atualizacao", loginDoAluno, 200);
        JsonNode enviada = api.post("/aluno/atualizacao/enviar", loginDoAluno, Map.of("pastaId", atual.get("pastaId").asString(),
                "questionarioVersaoId", atual.get("questionarioVersaoId").asString(),
                "respostas", Map.of("peso", 80.5, "sono", 7, "alim_desempenho", 8, "treino_desempenho", 6)), 200);
        api.put("/atualizacoes/" + enviada.get("id").asString() + "/feedback", admin,
                Map.of("texto", "Feedback fictício", "versao", enviada.get("versao").asLong()), 200);
    }

    private JsonNode membro(String nome, Set<String> permissoes) throws Exception {
        String perfil = api.post("/perfis", admin, Map.of("nome", "Perfil " + nome, "permissoes", permissoes), 200)
                .get("id").asString();
        JsonNode convite = api.post("/usuarios/convites", admin,
                Map.of("nome", nome, "email", ApiDeTeste.emailUnico("membro"), "perfilId", perfil), 200);
        return api.post("/publico/convites-equipe/" + convite.get("codigo").asString(), null,
                Map.of("senha", ApiDeTeste.SENHA), 200);
    }

    @Test
    void exportarTrazOQueAConsultoriaGuardaComArquivoSemCacheEAuditoriaSemConteudo() throws Exception {
        var resposta = mvc.perform(MockMvcRequestBuilders.get("/alunos/" + alunoId + "/exportacao")
                .header("Authorization", ApiDeTeste.bearer(admin))).andReturn().getResponse();
        assertThat(resposta.getStatus()).isEqualTo(200);
        assertThat(resposta.getHeader("Content-Disposition")).contains("attachment").contains("dados-do-aluno.json");
        assertThat(resposta.getHeader("Cache-Control")).contains("no-store");
        JsonNode dados = json.readTree(resposta.getContentAsString(java.nio.charset.StandardCharsets.UTF_8));

        assertThat(dados.get("secoesOmitidas")).isEmpty();
        assertThat(dados.get("cadastro").get("nome").asString()).isEqualTo(NOME);
        assertThat(dados.get("cadastro").get("objetivo").asString()).isEqualTo(OBJETIVO);
        assertThat(dados.get("pastas").get("itens")).hasSize(1);
        assertThat(dados.get("treinos").get("itens")).hasSize(1);
        assertThat(dados.get("dietas").get("itens").get(0).get("versoes").get(0).get("conteudo").get("ergogenicos"))
                .hasSize(1);
        assertThat(dados.get("registros").toString()).contains("Dor leve");
        assertThat(dados.get("pesos").get("itens").size()).isGreaterThanOrEqualTo(2);
        assertThat(dados.get("lesoes").get("itens")).hasSize(1);
        assertThat(dados.get("atualizacoes").get("itens").get(0).get("feedback").asString()).isEqualTo("Feedback fictício");
        assertThat(dados.get("pastas").get("truncado").asBoolean()).isFalse();

        List<Map<String, Object>> linhas = jdbc.queryForList(
                "select resumo, entidade, entidade_id from auditoria where acao = 'ALUNO_EXPORTADO' and entidade_id = ?::uuid",
                alunoId.toString());
        assertThat(linhas).hasSize(1);
        assertThat(linhas.get(0).get("resumo")).isEqualTo("Exportou os dados de um aluno.");
        assertThat(linhas.get(0).get("entidade_id").toString()).isEqualTo(alunoId.toString());
    }

    @Test
    void exportarSoLeOQueAPermissaoDeCadaSecaoDeixa() throws Exception {
        // Só as três permissões que a dependência garante: nada de plano, registro nem atualização.
        JsonNode minimo = membro("Exportador mínimo", Set.of("ALUNO_LER", "ALUNO_SENSIVEL_LER", "ALUNO_EXPORTAR"));
        JsonNode dados = api.get("/alunos/" + alunoId + "/exportacao", minimo, 200);
        assertThat(dados.get("secoesOmitidas").valueStream().map(JsonNode::asString))
                .containsExactlyInAnyOrder("treinos", "dietas", "mobilidades", "registros", "atualizacoes");
        assertThat(dados.has("treinos")).isFalse();
        assertThat(dados.has("dietas")).isFalse();
        assertThat(dados.has("registros")).isFalse();
        assertThat(dados.has("atualizacoes")).isFalse();
        assertThat(dados.get("pesos").get("itens")).isNotEmpty();
        assertThat(dados.get("lesoes").get("itens")).hasSize(1);

        // Com a dieta mas sem ERGOGENICO_LER, a medicação não sai.
        JsonNode comDieta = membro("Exportador com dieta",
                Set.of("ALUNO_LER", "ALUNO_SENSIVEL_LER", "ALUNO_EXPORTAR", "DIETA_LER"));
        JsonNode versao = api.get("/alunos/" + alunoId + "/exportacao", comDieta, 200)
                .get("dietas").get("itens").get(0).get("versoes").get(0).get("conteudo");
        assertThat(versao.get("refeicoes")).hasSize(1);
        assertThat(versao.path("ergogenicos").isMissingNode() || versao.path("ergogenicos").isNull()).isTrue();
    }

    @Test
    void exportarEAnonimizarExigemAPermissaoEOAlunoDaConsultoria() throws Exception {
        JsonNode semPermissao = membro("Sem privacidade", Set.of("ALUNO_LER", "ALUNO_SENSIVEL_LER", "ALUNO_ALTERAR",
                "ALUNO_SENSIVEL_ALTERAR"));
        api.get("/alunos/" + alunoId + "/exportacao", semPermissao, 403);
        api.post("/alunos/" + alunoId + "/anonimizar", semPermissao, Map.of("nomeConfirmado", NOME), 403);
        api.get("/alunos/" + alunoId + "/exportacao", loginDoAluno, 403);

        JsonNode outraConsultoria = api.novoTreinador();
        api.get("/alunos/" + alunoId + "/exportacao", outraConsultoria, 404);
        api.post("/alunos/" + alunoId + "/anonimizar", outraConsultoria, Map.of("nomeConfirmado", NOME), 404);
        api.get("/alunos/" + alunoId + "/exportacao", null, 401);
    }

    @Test
    void anonimizarExigeAlunoInativoENomeCerto() throws Exception {
        JsonNode ativo = api.post("/alunos/" + alunoId + "/anonimizar", admin, Map.of("nomeConfirmado", NOME), 409);
        assertThat(ativo.get("codigo").asString()).isEqualTo("ALUNO_ATIVO");

        api.patch("/alunos/" + alunoId + "/situacao", admin, Map.of("ativo", false), 200);
        JsonNode errado = api.post("/alunos/" + alunoId + "/anonimizar", admin, Map.of("nomeConfirmado", "Outra Pessoa"), 422);
        assertThat(errado.get("codigo").asString()).isEqualTo("NOME_NAO_CONFERE");
        api.post("/alunos/" + alunoId + "/anonimizar", admin, Map.of("nomeConfirmado", " "), 400);
        assertThat(jdbc.queryForObject("select count(*) from registro_peso where aluno_id = ?::uuid", Integer.class,
                alunoId.toString())).isPositive();
    }

    @Test
    void anonimizarApagaOPessoalMantemAsContagensEFechaAsPortas() throws Exception {
        String id = alunoId.toString();
        int series = jdbc.queryForObject("select count(*) from execucao_serie where aluno_id = ?::uuid", Integer.class, id);
        int pastas = jdbc.queryForObject("select count(*) from pasta_plano where aluno_id = ?::uuid", Integer.class, id);
        int treinos = jdbc.queryForObject("select count(*) from plano_treino where aluno_id = ?::uuid", Integer.class, id);
        String usuarioId = jdbc.queryForObject("select usuario_id::text from aluno where id = ?::uuid", String.class, id);
        assertThat(series).isPositive();
        int versoesDeDieta = jdbc.queryForObject("select count(*) from plano_dieta_versao v join plano_dieta p on p.id = v.plano_id"
                + " where p.aluno_id = ?::uuid", Integer.class, id);
        assertThat(versoesDeDieta).isPositive();

        api.patch("/alunos/" + alunoId + "/situacao", admin, Map.of("ativo", false), 200);
        JsonNode anonimo = api.post("/alunos/" + alunoId + "/anonimizar", admin, Map.of("nomeConfirmado", NOME.toLowerCase(java.util.Locale.ROOT)), 200);
        assertThat(anonimo.get("nome").asString()).isEqualTo("Aluno anonimizado");
        assertThat(anonimo.get("anonimizado").asBoolean()).isTrue();
        assertThat(anonimo.get("ativo").asBoolean()).isFalse();
        assertThat(anonimo.path("email").isNull() || anonimo.path("email").isMissingNode()).isTrue();
        assertThat(anonimo.has("objetivo")).isFalse();
        assertThat(anonimo.has("observacoes")).isFalse();

        // Apagado.
        for (String tabela : List.of("registro_peso", "lesao_aluno", "plano_dieta")) {
            assertThat(jdbc.queryForObject("select count(*) from " + tabela + " where aluno_id = ?::uuid", Integer.class, id))
                    .as(tabela).isZero();
        }
        assertThat(jdbc.queryForObject("select count(*) from plano_dieta_versao v where not exists "
                + "(select 1 from plano_dieta p where p.id = v.plano_id)", Integer.class)).isZero();
        assertThat(jdbc.queryForObject("select count(*) from atualizacao where aluno_id = ?::uuid and "
                + "(feedback is not null or respostas <> '{}'::jsonb or atraso_motivo is not null)", Integer.class, id)).isZero();
        assertThat(jdbc.queryForObject("select count(*) from execucao_serie where aluno_id = ?::uuid and observacao is not null",
                Integer.class, id)).isZero();
        assertThat(jdbc.queryForObject("select count(*) from aluno where id = ?::uuid and objetivo is null and observacoes is null"
                + " and email is null and convite_hash is null and anonimizado_em is not null", Integer.class, id)).isEqualTo(1);
        assertThat(jdbc.queryForObject("select count(*) from plataforma.refresh_token where sujeito = ?", Integer.class,
                usuarioId)).isZero();
        Map<String, Object> usuario = jdbc.queryForMap("select nome, email, telefone, ativo from usuario where id = ?::uuid", usuarioId);
        assertThat(usuario.get("nome")).isEqualTo("Aluno anonimizado");
        assertThat(usuario.get("email").toString()).startsWith("anonimizado+").endsWith("@anonimizado.invalid");
        assertThat(usuario.get("telefone")).isNull();
        assertThat(usuario.get("ativo")).isEqualTo(false);
        // O nome não sobrou nos títulos.
        assertThat(jdbc.queryForObject("select count(*) from plano_treino where aluno_id = ?::uuid and titulo like '%Maria%'",
                Integer.class, id)).isZero();
        assertThat(jdbc.queryForObject("select count(*) from plano_treino_versao v join plano_treino p on p.id = v.plano_id"
                + " where p.aluno_id = ?::uuid and v.titulo like '%Maria%'", Integer.class, id)).isZero();
        assertThat(jdbc.queryForObject("select count(*) from pasta_plano where aluno_id = ?::uuid and titulo like '%Maria%'",
                Integer.class, id)).isZero();

        // Mantido para as contagens.
        assertThat(jdbc.queryForObject("select count(*) from execucao_serie where aluno_id = ?::uuid", Integer.class, id)).isEqualTo(series);
        assertThat(jdbc.queryForObject("select count(*) from pasta_plano where aluno_id = ?::uuid", Integer.class, id)).isEqualTo(pastas);
        assertThat(jdbc.queryForObject("select count(*) from plano_treino where aluno_id = ?::uuid", Integer.class, id)).isEqualTo(treinos);
        assertThat(jdbc.queryForObject("select count(*) from execucao_serie where aluno_id = ?::uuid and carga is not null and repeticoes is not null",
                Integer.class, id)).isEqualTo(series);

        // Ninguém acha o nome antigo, o login antigo morreu e o cadastro não volta.
        assertThat(api.get("/alunos?busca=Maria&situacao=TODOS", admin, 200).get("itens")).isEmpty();
        api.post("/auth/login", null, Map.of("email", emailDoAluno, "senha", ApiDeTeste.SENHA), 401);
        api.get("/eu", loginDoAluno, 401);
        assertThat(api.patch("/alunos/" + alunoId + "/situacao", admin, Map.of("ativo", true), 409).get("codigo").asString())
                .isEqualTo("ALUNO_ANONIMIZADO");
        JsonNode detalhe = api.get("/alunos/" + alunoId, admin, 200);
        Map<String, Object> edicao = new LinkedHashMap<>();
        edicao.put("nome", "Maria Fictícia Voltou");
        edicao.put("versao", detalhe.get("versao").asLong());
        assertThat(api.put("/alunos/" + alunoId, admin, edicao, 409).get("codigo").asString()).isEqualTo("ALUNO_ANONIMIZADO");
        assertThat(api.post("/alunos/" + alunoId + "/anonimizar", admin, Map.of("nomeConfirmado", NOME), 409)
                .get("codigo").asString()).isEqualTo("ALUNO_ANONIMIZADO");
        api.post("/alunos/" + alunoId + "/convite", admin, null, 409);

        // A exportação do anonimizado não tem o que foi apagado.
        String exportado = api.get("/alunos/" + alunoId + "/exportacao", admin, 200).toString();
        for (String texto : List.of("Maria", emailDoAluno, OBJETIVO, "Observação fictícia", "Dor leve", "Obs de peso", "Feedback fictício",
                "Ombro")) {
            assertThat(exportado).as(texto).doesNotContain(texto);
        }

        // Auditoria: resumo fixo, sem nome.
        List<Map<String, Object>> linhas = jdbc.queryForList(
                "select resumo, entidade_id from auditoria where acao = 'ALUNO_ANONIMIZADO' and entidade_id = ?::uuid", id);
        assertThat(linhas).hasSize(1);
        assertThat(linhas.get(0).get("resumo")).isEqualTo("Anonimizou o cadastro de um aluno.");
        assertThat(linhas.get(0).get("entidade_id").toString()).isEqualTo(id);
        assertThat(jdbc.queryForObject("select count(*) from auditoria where entidade_id = ?::uuid and resumo like '%Maria%'",
                Integer.class, id)).isZero();
    }
}
