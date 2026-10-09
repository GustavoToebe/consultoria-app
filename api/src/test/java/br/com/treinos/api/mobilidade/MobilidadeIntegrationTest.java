package br.com.treinos.api.mobilidade;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Plano de mobilidade da pasta: mesmo ciclo da dieta, com as permissões do treino. */
@AutoConfigureMockMvc
class MobilidadeIntegrationTest extends AbstractIntegrationTest {

    private static final String VIDEO = "https://www.youtube.com/watch?v=tsGPYSQbZx4";

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JsonMapper json;
    @Autowired
    private JdbcTemplate banco;

    private ApiDeTeste api;
    private JsonNode treinador;
    private UUID aluno;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        treinador = api.novoTreinador();
        aluno = api.criarAluno(treinador, "Aluno Fictício");
    }

    private static Map<String, Object> item(String nome, String prescricao, String video, UUID uid) {
        Map<String, Object> m = new java.util.LinkedHashMap<>();
        if (uid != null) m.put("uid", uid);
        m.put("nome", nome);
        m.put("prescricao", prescricao);
        m.put("videoUrl", video);
        return m;
    }

    private static Map<String, Object> secao(String titulo, UUID uid, Object... itens) {
        Map<String, Object> m = new java.util.LinkedHashMap<>();
        if (uid != null) m.put("uid", uid);
        m.put("titulo", titulo);
        m.put("itens", List.of(itens));
        return m;
    }

    private static Map<String, Object> conteudo(Object... secoes) {
        return Map.of("orientacoes", "Todos os dias.", "secoes", List.of(secoes));
    }

    private JsonNode modelo() throws Exception {
        return api.post("/receitas", treinador, Map.of("tipo", "MOBILIDADE", "nome", "Mobilidade fictícia",
                "conteudo", conteudo(secao("Alongamentos", null, item("Lunge Stretch", "2 x 20s", VIDEO, null),
                        item("Gato e vaca", null, null, null)))), 200);
    }

    private JsonNode pasta(JsonNode quem, UUID doAluno) throws Exception {
        return api.post("/alunos/" + doAluno + "/pastas", quem,
                Map.of("titulo", "Pasta fictícia", "inicio", "2026-10-01", "fim", "2026-10-14"), 200);
    }

    @Test
    void criaDoModeloNaPastaHerdaPeriodoValidaEPublicaVersoesImutaveis() throws Exception {
        String receita = modelo().get("id").asString();
        String pasta = pasta(treinador, aluno).get("id").asString();
        JsonNode criado = api.post("/alunos/" + aluno + "/planos-mobilidade", treinador,
                Map.of("titulo", "Mobilidade da pasta", "receitaId", receita, "pastaId", pasta,
                        "inicio", "2030-01-01", "fim", "2030-01-02"), 200);
        String id = criado.get("plano").get("id").asString();
        assertThat(criado.get("plano").get("inicio").asString()).isEqualTo("2026-10-01");
        assertThat(criado.get("plano").get("fim").asString()).isEqualTo("2026-10-14");
        assertThat(criado.get("plano").get("pastaId").asString()).isEqualTo(pasta);

        // Criar do modelo dá uid novo a toda seção e item (o modelo importado não tem uid).
        Set<String> uids = new HashSet<>();
        for (JsonNode s : criado.get("rascunho").get("secoes")) {
            uids.add(s.get("uid").asString());
            for (JsonNode i : s.get("itens")) uids.add(i.get("uid").asString());
        }
        assertThat(uids).hasSize(3);

        // Lock otimista: salvar com a versão antiga é 409.
        long v0 = criado.get("plano").get("versao").asLong();
        JsonNode salvo = api.put("/planos-mobilidade/" + id + "/rascunho", treinador,
                ApiDeTeste.rascunho("Mobilidade da pasta", criado.get("rascunho"), v0), 200);
        assertThat(api.put("/planos-mobilidade/" + id + "/rascunho", treinador,
                ApiDeTeste.rascunho("Mobilidade da pasta", criado.get("rascunho"), v0), 409).get("codigo").asString())
                .isEqualTo("CONFLITO_EDICAO");

        // Rascunho ruim: validar aponta cada problema e publicar volta 422 com fieldErrors.
        UUID repetido = UUID.randomUUID();
        Map<String, Object> ruim = conteudo(
                secao("", repetido, item("", "x", "https://exemplo.com/v", repetido)),
                secao("Vazia", null));
        JsonNode comErros = api.put("/planos-mobilidade/" + id + "/rascunho", treinador,
                ApiDeTeste.rascunho("Mobilidade da pasta", ruim, salvo.get("plano").get("versao").asLong()), 200);
        JsonNode v = api.post("/planos-mobilidade/" + id + "/validar", treinador, null, 200);
        assertThat(v.get("erros").valueStream().map(e -> e.get("caminho").asString())).contains(
                "secoes[0].itens[0].nome", "secoes[0].itens[0].videoUrl", "secoes[0].itens[0].uid",
                "secoes[1].uid", "secoes[1].itens");
        assertThat(v.get("avisos").valueStream().map(e -> e.get("caminho").asString())).contains("secoes[0].titulo");
        JsonNode recusa = api.post("/planos-mobilidade/" + id + "/publicar", treinador,
                Map.of("versao", comErros.get("plano").get("versao").asLong(), "confirmarAvisos", true), 422);
        assertThat(recusa.get("codigo").asString()).isEqualTo("PLANO_INVALIDO");
        assertThat(recusa.get("fieldErrors")).isNotEmpty();

        // Rascunho bom: publica v1; mudar e publicar de novo cria v2 e a v1 segue igual.
        UUID s1 = UUID.randomUUID();
        UUID i1 = UUID.randomUUID();
        JsonNode bom = api.put("/planos-mobilidade/" + id + "/rascunho", treinador, ApiDeTeste.rascunho(
                "Mobilidade da pasta", conteudo(secao("Alongamentos", s1, item("Lunge", "2 x 20s", VIDEO, i1))),
                comErros.get("plano").get("versao").asLong()), 200);
        assertThat(api.post("/planos-mobilidade/" + id + "/validar", treinador, null, 200).get("erros")).isEmpty();
        JsonNode p1 = api.post("/planos-mobilidade/" + id + "/publicar", treinador,
                Map.of("versao", bom.get("plano").get("versao").asLong(), "confirmarAvisos", false), 200);
        assertThat(p1.get("plano").get("versaoPublicada").asInt()).isEqualTo(1);
        assertThat(p1.get("plano").get("ativo").asBoolean()).isTrue();

        JsonNode outro = api.put("/planos-mobilidade/" + id + "/rascunho", treinador, ApiDeTeste.rascunho(
                "Mobilidade da pasta", conteudo(secao("Alongamentos", s1, item("Lunge", "3 x 30s", VIDEO, i1))),
                p1.get("plano").get("versao").asLong()), 200);
        api.post("/planos-mobilidade/" + id + "/publicar", treinador,
                Map.of("versao", outro.get("plano").get("versao").asLong(), "confirmarAvisos", false), 200);
        JsonNode v1 = api.get("/planos-mobilidade/" + id + "/versoes/1", treinador, 200);
        JsonNode v2 = api.get("/planos-mobilidade/" + id + "/versoes/2", treinador, 200);
        assertThat(v1.get("conteudo").get("secoes").get(0).get("itens").get(0).get("prescricao").asString())
                .isEqualTo("2 x 20s");
        assertThat(v2.get("conteudo").get("secoes").get(0).get("itens").get(0).get("prescricao").asString())
                .isEqualTo("3 x 30s");
        api.get("/planos-mobilidade/" + id + "/versoes/3", treinador, 404);
        assertThat(api.get("/alunos/" + aluno + "/planos-mobilidade", treinador, 200)).hasSize(1);
    }

    @Test
    void replicarDaUidsNovosEExcluirArquivaSemApagarVersoes() throws Exception {
        String receita = modelo().get("id").asString();
        JsonNode criado = api.post("/alunos/" + aluno + "/planos-mobilidade", treinador,
                Map.of("titulo", "Origem", "receitaId", receita), 200);
        String id = criado.get("plano").get("id").asString();
        JsonNode p = api.post("/planos-mobilidade/" + id + "/publicar", treinador,
                Map.of("versao", criado.get("plano").get("versao").asLong(), "confirmarAvisos", true), 200);
        JsonNode copia = api.post("/planos-mobilidade/" + id + "/replicar", treinador,
                Map.of("titulo", "Próximo ciclo", "inicio", "2026-11-01", "fim", "2026-11-14"), 200);
        assertThat(copia.get("plano").get("id").asString()).isNotEqualTo(id);
        assertThat(copia.get("plano").get("versaoPublicada").asInt()).isZero();
        assertThat(copia.get("rascunho").get("secoes").get(0).get("uid").asString())
                .isNotEqualTo(p.get("rascunho").get("secoes").get(0).get("uid").asString());

        api.delete("/planos-mobilidade/" + id, treinador, 204);
        assertThat(api.get("/alunos/" + aluno + "/planos-mobilidade", treinador, 200)).hasSize(1);
        api.get("/planos-mobilidade/" + id + "/versoes/1", treinador, 200);
    }

    @Test
    void salvarComoReceitaGravaModeloDeMobilidade() throws Exception {
        String receita = modelo().get("id").asString();
        JsonNode criado = api.post("/alunos/" + aluno + "/planos-mobilidade", treinador,
                Map.of("titulo", "Origem", "receitaId", receita), 200);
        String id = criado.get("plano").get("id").asString();
        JsonNode nova = api.post("/planos-mobilidade/" + id + "/salvar-como-receita", treinador,
                Map.of("nome", "Meu modelo de mobilidade"), 200);
        assertThat(nova.get("tipo").asString()).isEqualTo("MOBILIDADE");
        assertThat(api.get("/receitas?tipo=MOBILIDADE", treinador, 200)).hasSize(2);
    }

    @Test
    void outraConsultoriaEOutroAlunoRecebem404() throws Exception {
        String receita = modelo().get("id").asString();
        JsonNode criado = api.post("/alunos/" + aluno + "/planos-mobilidade", treinador,
                Map.of("titulo", "Mobilidade", "receitaId", receita), 200);
        String id = criado.get("plano").get("id").asString();
        api.post("/planos-mobilidade/" + id + "/publicar", treinador,
                Map.of("versao", criado.get("plano").get("versao").asLong(), "confirmarAvisos", true), 200);

        JsonNode estranho = api.novoTreinador();
        String msg = api.get("/planos-mobilidade/" + id, estranho, 404).get("message").asString();
        assertThat(msg).isEqualTo("Plano de mobilidade não encontrado.");
        api.get("/planos-mobilidade/" + id + "/versoes/1", estranho, 404);
        api.post("/planos-mobilidade/" + id + "/validar", estranho, null, 404);
        api.get("/alunos/" + aluno + "/planos-mobilidade", estranho, 404);
        api.post("/alunos/" + aluno + "/planos-mobilidade", estranho, Map.of("titulo", "X"), 404);

        // Pasta de outro aluno também é 404.
        UUID outroAluno = api.criarAluno(treinador, "Outro Aluno Fictício");
        String pastaAlheia = pasta(treinador, outroAluno).get("id").asString();
        api.post("/alunos/" + aluno + "/planos-mobilidade", treinador,
                Map.of("titulo", "X", "pastaId", pastaAlheia), 404);
    }

    @Test
    void perfisUsamAsPermissoesDoTreinoEAuditoriaGravaMobilidadePublicada() throws Exception {
        String receita = modelo().get("id").asString();
        JsonNode criado = api.post("/alunos/" + aluno + "/planos-mobilidade", treinador,
                Map.of("titulo", "Mobilidade", "receitaId", receita), 200);
        String id = criado.get("plano").get("id").asString();
        long versao = criado.get("plano").get("versao").asLong();
        UUID uid = UUID.fromString(treinador.path("usuario").path("id").asString());
        UUID cid = banco.queryForObject("select consultoria_id from usuario where id=?", UUID.class, uid);

        // Sem perfil de leitura: tudo 403.
        UUID vazio = UUID.randomUUID();
        banco.update("insert into perfil(id,consultoria_id,nome) values(?,?,'Sem treino')", vazio, cid);
        banco.update("update usuario set perfil_id=? where id=?", vazio, uid);
        api.get("/planos-mobilidade/" + id, treinador, 403);
        api.get("/alunos/" + aluno + "/planos-mobilidade", treinador, 403);

        // Assistente e Nutricionista têm TREINO_LER: leem, mas não criam, salvam rascunho nem publicam.
        for (String perfil : List.of("Assistente", "Nutricionista")) {
            banco.update("update usuario u set perfil_id=p.id from perfil p where u.id=? "
                    + "and p.consultoria_id=u.consultoria_id and p.nome=?", uid, perfil);
            api.get("/planos-mobilidade/" + id, treinador, 200);
            api.get("/alunos/" + aluno + "/planos-mobilidade", treinador, 200);
            api.post("/planos-mobilidade/" + id + "/validar", treinador, null, 200);
            api.post("/planos-mobilidade/" + id + "/publicar", treinador,
                    Map.of("versao", versao, "confirmarAvisos", true), 403);
            api.post("/alunos/" + aluno + "/planos-mobilidade", treinador, Map.of("titulo", "X"), 403);
            api.put("/planos-mobilidade/" + id + "/rascunho", treinador,
                    ApiDeTeste.rascunho("Mobilidade", conteudo(), versao), 403);
            // Salvar como modelo pede também MODELO_ALTERAR: o Assistente não tem, a Nutricionista tem.
            api.post("/planos-mobilidade/" + id + "/salvar-como-receita", treinador, Map.of("nome", "X " + perfil),
                    perfil.equals("Assistente") ? 403 : 200);
        }
        assertThat(banco.queryForObject("select count(*) from auditoria where consultoria_id=? "
                + "and acao='MOBILIDADE_PUBLICADA'", Integer.class, cid)).isZero();

        // Treinador publica e a auditoria grava a ação própria, com resumo fixo.
        banco.update("update usuario u set perfil_id=p.id from perfil p where u.id=? "
                + "and p.consultoria_id=u.consultoria_id and p.nome='Treinador'", uid);
        api.post("/planos-mobilidade/" + id + "/publicar", treinador,
                Map.of("versao", versao, "confirmarAvisos", true), 200);
        assertThat(banco.queryForList("select entidade, resumo from auditoria where consultoria_id=? "
                + "and acao='MOBILIDADE_PUBLICADA'", cid)).singleElement().satisfies(linha -> {
            assertThat(linha.get("entidade")).isEqualTo("MOBILIDADE");
            assertThat(linha.get("resumo")).isEqualTo("Publicou uma versão de mobilidade (v1).");
        });
        assertThat(banco.queryForObject("select count(*) from auditoria where consultoria_id=? "
                + "and acao in ('DIETA_PUBLICADA','TREINO_PUBLICADO')", Integer.class, cid)).isZero();
    }
}
