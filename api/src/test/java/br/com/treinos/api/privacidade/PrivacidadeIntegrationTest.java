package br.com.treinos.api.privacidade;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.Documentos;
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
        loginDoAluno = api.post("/publico/convites/aceitar", null,
                Map.of("codigo", codigo, "email", emailDoAluno, "senha", ApiDeTeste.SENHA), 200);
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

    /** Rascunho e versão publicada de treino e de mobilidade com texto livre; a anonimização limpa o texto e mantém o resto. */
    @Test
    void anonimizarLimpaOTextoLivreDentroDosPlanosEMantemIdsSeriesECargas() throws Exception {
        String id = alunoId.toString();
        String pasta = jdbc.queryForObject("select id::text from pasta_plano where aluno_id = ?::uuid", String.class, id);
        JsonNode criado = api.post("/alunos/" + alunoId + "/planos-mobilidade", admin,
                Map.of("titulo", "Mobilidade de " + NOME, "pastaId", pasta), 200);
        String mobilidadeId = criado.get("plano").get("id").asString();
        Map<String, Object> item = Map.of("uid", UUID.randomUUID(), "nome", "Alongamento fictício",
                "prescricao", "Prescrição fictícia QWERTY", "videoUrl", "https://www.youtube.com/watch?v=exemplo");
        Map<String, Object> conteudo = Map.of("orientacoes", "Orientação fictícia QWERTY",
                "secoes", List.of(Map.of("uid", UUID.randomUUID(), "titulo", "Quadril", "itens", List.of(item))));
        JsonNode salvo = api.put("/planos-mobilidade/" + mobilidadeId + "/rascunho", admin,
                ApiDeTeste.rascunho("Mobilidade de " + NOME, conteudo, criado.get("plano").get("versao").asLong()), 200);
        api.post("/planos-mobilidade/" + mobilidadeId + "/publicar", admin,
                Map.of("versao", salvo.get("plano").get("versao").asLong(), "confirmarAvisos", true), 200);
        // Rascunho novo depois de publicado: o texto também está no rascunho, além da versão.
        JsonNode atual = api.get("/planos-mobilidade/" + mobilidadeId, admin, 200);
        api.put("/planos-mobilidade/" + mobilidadeId + "/rascunho", admin,
                ApiDeTeste.rascunho("Mobilidade de " + NOME, conteudo, atual.get("plano").get("versao").asLong()), 200);

        UUID outro = api.criarAluno(admin, "Outro aluno fictício");
        JsonNode outroPlano = api.post("/alunos/" + outro + "/planos-treino", admin, Map.of("titulo", "Treino do outro"), 200);
        api.put("/planos-treino/" + outroPlano.get("plano").get("id").asString() + "/rascunho", admin,
                ApiDeTeste.rascunho("Treino do outro", ApiDeTeste.treino().conteudo(), outroPlano.get("plano").get("versao").asLong()), 200);

        String antes = jdbc.queryForObject("select string_agg(conteudo::text, ' ') from plano_treino_versao v join plano_treino p on p.id = v.plano_id"
                + " where p.aluno_id = ?::uuid", String.class, id);
        assertThat(antes).contains("Objetivo fictício");
        int cargas = jdbc.queryForObject("select count(*) from execucao_serie where aluno_id = ?::uuid and carga is not null", Integer.class, id);

        api.patch("/alunos/" + alunoId + "/situacao", admin, Map.of("ativo", false), 200);
        api.post("/alunos/" + alunoId + "/anonimizar", admin, Map.of("nomeConfirmado", NOME), 200);

        String textos = jdbc.queryForObject("select coalesce(string_agg(t, ' '), '') from (" +
                "select rascunho::text t from plano_treino where aluno_id = ?::uuid " +
                "union all select conteudo::text from plano_treino_versao v join plano_treino p on p.id = v.plano_id where p.aluno_id = ?::uuid " +
                "union all select rascunho::text from plano_mobilidade where aluno_id = ?::uuid " +
                "union all select conteudo::text from plano_mobilidade_versao v join plano_mobilidade p on p.id = v.plano_id where p.aluno_id = ?::uuid" +
                ") x", String.class, id, id, id, id);
        assertThat(textos).doesNotContain("Objetivo fictício").doesNotContain("QWERTY");
        // Fica o que não é texto livre: nomes, ids, séries, repetições e vídeos.
        assertThat(textos).contains("Remada baixa na polia").contains("Alongamento fictício").contains("youtube.com")
                .contains("\"repsMax\": 6");
        assertThat(jdbc.queryForObject("select count(*) from plano_mobilidade_versao v join plano_mobilidade p on p.id = v.plano_id"
                + " where p.aluno_id = ?::uuid", Integer.class, id)).isEqualTo(1);
        assertThat(jdbc.queryForObject("select count(*) from execucao_serie where aluno_id = ?::uuid and carga is not null", Integer.class, id))
                .isEqualTo(cargas);
        // Só os planos DESTE aluno: o de outra pessoa da mesma consultoria segue com o texto.
        assertThat(jdbc.queryForObject("select rascunho::text from plano_treino where aluno_id = ?::uuid", String.class, outro.toString()))
                .contains("Objetivo fictício");
    }

    private JsonNode membro(String nome, Set<String> permissoes) throws Exception {
        String perfil = api.post("/perfis", admin, Map.of("nome", "Perfil " + nome, "permissoes", permissoes), 200)
                .get("id").asString();
        JsonNode convite = api.post("/usuarios/convites", admin,
                Map.of("nome", nome, "email", ApiDeTeste.emailUnico("membro"), "perfilId", perfil), 200);
        return api.post("/publico/convites-equipe/aceitar", null,
                Map.of("codigo", convite.get("codigo").asString(), "senha", ApiDeTeste.SENHA), 200);
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
    void exportarLevaOsItensDeMobilidadeMarcadosEAAnonimizacaoOsMantem() throws Exception {
        var mobilidade = ApiDeTeste.mobilidade();
        api.publicarMobilidade(admin, alunoId, mobilidade.conteudo());
        String versao = api.get("/aluno/mobilidade", loginDoAluno, 200).get("mobilidade").get("id").asString();
        api.post("/aluno/mobilidade/registros", loginDoAluno, Map.of("registros", List.of(Map.of(
                "id", UUID.randomUUID().toString(), "planoVersaoId", versao, "secaoUid", mobilidade.secaoUid().toString(),
                "itemUid", mobilidade.itemUid().toString(), "data", hoje.toString(), "feito", true,
                "alteradoNoAparelhoEm", Instant.now().toString()))), 200);

        JsonNode dados = api.get("/alunos/" + alunoId + "/exportacao", admin, 200);
        assertThat(dados.get("mobilidadeRegistros").get("itens")).hasSize(1);
        assertThat(dados.get("mobilidadeRegistros").get("itens").get(0).get("itemUid").asString())
                .isEqualTo(mobilidade.itemUid().toString());
        assertThat(dados.get("mobilidadeRegistros").get("itens").get(0).get("feito").asBoolean()).isTrue();

        // Sem REGISTRO_LER a seção sai da exportação (e vem listada como omitida), como os registros do treino.
        JsonNode semRegistro = membro("Exportador sem registro",
                Set.of("ALUNO_LER", "ALUNO_SENSIVEL_LER", "ALUNO_EXPORTAR"));
        JsonNode omitida = api.get("/alunos/" + alunoId + "/exportacao", semRegistro, 200);
        assertThat(omitida.has("mobilidadeRegistros")).isFalse();

        // A anonimização mantém os registros: não têm conteúdo pessoal, só feito ou não feito.
        api.patch("/alunos/" + alunoId + "/situacao", admin, Map.of("ativo", false), 200);
        api.post("/alunos/" + alunoId + "/anonimizar", admin, Map.of("nomeConfirmado", NOME), 200);
        assertThat(jdbc.queryForObject("select count(*) from mobilidade_registro where aluno_id = ?::uuid", Integer.class,
                alunoId.toString())).isEqualTo(1);
    }

    @Test
    void exportarLevaAsSessoesConcluidasComOComentarioEAAnonimizacaoApagaSoOComentario() throws Exception {
        String versao = api.get("/aluno/painel", loginDoAluno, 200).get("treino").get("versaoId").asString();
        String sessaoUid = api.get("/aluno/painel", loginDoAluno, 200).get("treino").get("conteudo").get("sessoes").get(0)
                .get("uid").asString();
        Map<String, Object> sessao = new LinkedHashMap<>();
        sessao.put("id", UUID.randomUUID().toString());
        sessao.put("planoVersaoId", versao);
        sessao.put("sessaoUid", sessaoUid);
        sessao.put("data", hoje.toString());
        sessao.put("concluida", true);
        sessao.put("resultado", "PARCIAL");
        sessao.put("duracaoSegundos", 2700);
        sessao.put("comentario", "Comentário fictício da sessão");
        sessao.put("alteradoNoAparelhoEm", Instant.now().toString());
        api.post("/aluno/sessoes-concluidas", loginDoAluno, Map.of("registros", List.of(sessao)), 200);

        // Com ALUNO_SENSIVEL_LER sai o comentário.
        JsonNode dados = api.get("/alunos/" + alunoId + "/exportacao", admin, 200);
        JsonNode item = dados.get("sessoesConcluidas").get("itens").get(0);
        assertThat(dados.get("sessoesConcluidas").get("itens")).hasSize(1);
        assertThat(item.get("resultado").asString()).isEqualTo("PARCIAL");
        assertThat(item.get("duracaoSegundos").asInt()).isEqualTo(2700);
        assertThat(item.get("comentario").asString()).isEqualTo("Comentário fictício da sessão");

        // ALUNO_EXPORTAR depende de ALUNO_SENSIVEL_LER (o perfil sem ela é recusado), então quem exporta sempre lê o comentário;
        // o serviço o deixa nulo sem a permissão por garantia (a rota do treinador, sim, tem o caso: SessaoConcluidaIntegrationTest).
        // Sem REGISTRO_LER a seção fica de fora, listada como omitida.
        JsonNode semRegistro = membro("Exportador sem registro de sessão", Set.of("ALUNO_LER", "ALUNO_SENSIVEL_LER", "ALUNO_EXPORTAR"));
        JsonNode omitida = api.get("/alunos/" + alunoId + "/exportacao", semRegistro, 200);
        assertThat(omitida.has("sessoesConcluidas")).isFalse();
        assertThat(omitida.get("secoesOmitidas").valueStream().map(JsonNode::asString)).contains("sessoesConcluidas");

        // A anonimização apaga o comentário e mantém a linha (resultado, duração e data).
        api.patch("/alunos/" + alunoId + "/situacao", admin, Map.of("ativo", false), 200);
        api.post("/alunos/" + alunoId + "/anonimizar", admin, Map.of("nomeConfirmado", NOME), 200);
        assertThat(jdbc.queryForObject("select count(*) from sessao_concluida where aluno_id = ?::uuid and resultado = 'PARCIAL' "
                + "and duracao_segundos = 2700", Integer.class, alunoId.toString())).isEqualTo(1);
        assertThat(jdbc.queryForObject("select count(*) from sessao_concluida where aluno_id = ?::uuid and comentario is not null",
                Integer.class, alunoId.toString())).isZero();
    }

    @Test
    void exportarSoLeOQueAPermissaoDeCadaSecaoDeixa() throws Exception {
        // Só as três permissões que a dependência garante: nada de plano, registro, atualização, anamnese nem inscrição.
        JsonNode minimo = membro("Exportador mínimo", Set.of("ALUNO_LER", "ALUNO_SENSIVEL_LER", "ALUNO_EXPORTAR"));
        JsonNode dados = api.get("/alunos/" + alunoId + "/exportacao", minimo, 200);
        assertThat(dados.get("secoesOmitidas").valueStream().map(JsonNode::asString))
                .containsExactlyInAnyOrder("treinos", "dietas", "mobilidades", "registros", "mobilidadeRegistros", "sessoesConcluidas",
                        "atualizacoes",
                        "anamneses", "inscricao", "financeiro");
        assertThat(dados.has("treinos")).isFalse();
        assertThat(dados.has("anamneses")).isFalse();
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
    void exportarLevaCpfEnderecoETelefoneEAnonimizarApagaOsTres() throws Exception {
        String cpf = Documentos.cpf();
        JsonNode ficha = api.get("/alunos/" + alunoId, admin, 200);
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("nome", NOME);
        corpo.put("email", emailDoAluno);
        corpo.put("objetivo", OBJETIVO);
        corpo.put("telefone", "(45) 99999-8888");
        corpo.put("cpf", cpf);
        corpo.put("endereco", Map.of("cep", "85800-000", "logradouro", "Rua Fictícia Quinze", "numero", "15", "cidade", "Cidade Exemplo", "uf", "PR"));
        corpo.put("versao", ficha.get("versao").asLong());
        api.put("/alunos/" + alunoId, admin, corpo, 200);

        // A exportação leva os três (cada um atrás da permissão da ficha: telefone com ALUNO_LER, CPF e endereço com SENSIVEL_LER).
        for (JsonNode quem : List.of(admin, membro("Exportador mínimo com cadastro", Set.of("ALUNO_LER", "ALUNO_SENSIVEL_LER", "ALUNO_EXPORTAR")))) {
            JsonNode cadastro = api.get("/alunos/" + alunoId + "/exportacao", quem, 200).get("cadastro");
            assertThat(cadastro.get("cpf").asString()).isEqualTo(cpf);
            assertThat(cadastro.get("telefone").asString()).isEqualTo("(45) 99999-8888");
            assertThat(cadastro.get("endereco").get("logradouro").asString()).isEqualTo("Rua Fictícia Quinze");
            assertThat(cadastro.get("endereco").get("cep").asString()).isEqualTo("85800-000");
        }
        // Nenhum dos três foi parar na auditoria.
        assertThat(jdbc.queryForObject("select count(*) from auditoria where entidade_id = ?::uuid and (resumo like '%Quinze%' or resumo like '%' || ? || '%' or resumo like '%99999%')",
                Integer.class, alunoId.toString(), cpf)).isZero();

        api.patch("/alunos/" + alunoId + "/situacao", admin, Map.of("ativo", false), 200);
        api.post("/alunos/" + alunoId + "/anonimizar", admin, Map.of("nomeConfirmado", NOME), 200);

        String id = alunoId.toString();
        assertThat(jdbc.queryForObject("select count(*) from aluno where id = ?::uuid and cpf is null and cep is null and logradouro is null"
                + " and numero is null and complemento is null and bairro is null and cidade is null and uf is null", Integer.class, id)).isEqualTo(1);
        assertThat(jdbc.queryForObject("select telefone from usuario where id = (select usuario_id from aluno where id = ?::uuid)", String.class, id)).isNull();
        String exportado = api.get("/alunos/" + alunoId + "/exportacao", admin, 200).toString();
        for (String texto : List.of(cpf, Documentos.semPontuacao(cpf), "Quinze", "99999-8888", "85800-000", "Cidade Exemplo")) {
            assertThat(exportado).as("exportação sem o dado apagado").doesNotContain(texto);
        }
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
        // Nada de dado de saúde novo num cadastro anonimizado (peso, lesão, pasta, plano).
        for (var gravar : List.<Map.Entry<String, Map<String, Object>>>of(
                Map.entry("/pesos", Map.of("data", hoje.minusDays(1), "pesoKg", "70.00")),
                Map.entry("/lesoes", Map.of("regiao", "Joelho", "dataInicio", "2026-03-01", "situacao", "ATIVA")),
                Map.entry("/pastas", Map.of("titulo", "Período fictício")),
                Map.entry("/planos-treino", Map.of("titulo", "Treino fictício")))) {
            assertThat(api.post("/alunos/" + alunoId + gravar.getKey(), admin, gravar.getValue(), 409).get("codigo").asString())
                    .as(gravar.getKey()).isEqualTo("ALUNO_ANONIMIZADO");
        }

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
