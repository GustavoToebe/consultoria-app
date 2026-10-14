package br.com.treinos.api.dieta;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.dieta.ConteudoDieta.Ergogenico;
import br.com.treinos.api.dieta.ConteudoDieta.Item;
import br.com.treinos.api.dieta.ConteudoDieta.Opcao;
import br.com.treinos.api.dieta.ConteudoDieta.Refeicao;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Medicação e ergogênicos na dieta do aluno (dado sensível): só sai para quem tem ERGOGENICO_LER, só muda com
 * ERGOGENICO_ALTERAR, nunca vai para modelo nem para a cópia de outro aluno e o aluno vê a própria lista.
 */
@AutoConfigureMockMvc
class DietaErgogenicosIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JsonMapper json;
    @Autowired
    private JdbcTemplate jdbc;

    private static final String NOME = "Item de teste ZQ";

    private static Ergogenico medicacao(String nome) {
        return new Ergogenico(UUID.randomUUID(), nome, "Princípio de Teste", "200 mg/ml", "Dose de teste",
                "Horário de teste", "Observação de teste", "Prescrição de teste");
    }

    private static ConteudoDieta dieta(List<Ergogenico> ergogenicos) {
        Item arroz = new Item(UUID.randomUUID(), UUID.randomUUID(), "Arroz branco cozido", new BigDecimal("150"), "g",
                new BigDecimal("191.7"), BigDecimal.ONE, BigDecimal.TEN, BigDecimal.ZERO, false);
        return new ConteudoDieta(null, null, null, List.of(new Refeicao(UUID.randomUUID(), "Almoço", "12:00", null,
                List.of(new Opcao(UUID.randomUUID(), "A", List.of(arroz))))), List.of(), null, List.of(), ergogenicos);
    }

    private void trocarPerfil(JsonNode login, String nome) {
        jdbc.update("update usuario u set perfil_id = p.id from perfil p where u.id = ?::uuid "
                + "and p.consultoria_id = u.consultoria_id and p.nome = ?", login.path("usuario").path("id").asString(), nome);
    }

    private void darPermissao(JsonNode login, String codigo) {
        jdbc.update("insert into perfil_permissao(perfil_id, codigo) select p.id, ? from perfil p "
                + "join usuario u on u.perfil_id = p.id where u.id = ?::uuid on conflict do nothing", codigo, login.path("usuario").path("id").asString());
    }

    private JsonNode salvar(ApiDeTeste api, JsonNode login, String id, ConteudoDieta c, JsonNode detalhe) throws Exception {
        return api.put("/planos-dieta/" + id + "/rascunho", login,
                ApiDeTeste.rascunho("Dieta", c, detalhe.path("plano").path("versao").asLong()), 200);
    }

    private JsonNode publicar(ApiDeTeste api, JsonNode login, String id, JsonNode detalhe) throws Exception {
        return api.post("/planos-dieta/" + id + "/publicar", login,
                Map.of("versao", detalhe.path("plano").path("versao").asLong(), "confirmarAvisos", true), 200);
    }

    @Test
    void semErgogenicoLerALeituraSaiNulaComLerSaiALista() throws Exception {
        var api = new ApiDeTeste(mvc, json);
        var login = api.novoTreinador();
        UUID aluno = api.criarAluno(login, "Aluno Fictício");
        JsonNode plano = api.post("/alunos/" + aluno + "/planos-dieta", login, Map.of("titulo", "Dieta"), 200);
        String id = plano.path("plano").path("id").asString();
        JsonNode salvo = salvar(api, login, id, dieta(List.of(medicacao(NOME))), plano);
        assertThat(salvo.path("rascunho").path("ergogenicos")).hasSize(1);
        publicar(api, login, id, salvo);

        trocarPerfil(login, "Nutricionista");
        assertThat(api.get("/planos-dieta/" + id, login, 200).path("rascunho").path("ergogenicos").isNull()).isTrue();
        assertThat(api.get("/planos-dieta/" + id + "/versoes/1", login, 200).path("conteudo").path("ergogenicos").isNull())
                .isTrue();
        assertThat(api.get("/planos-dieta/" + id, login, 200).toString()).doesNotContain(NOME);

        trocarPerfil(login, "Administrador");
        assertThat(api.get("/planos-dieta/" + id, login, 200).path("rascunho").path("ergogenicos")).hasSize(1);
        assertThat(api.get("/planos-dieta/" + id + "/versoes/1", login, 200).path("conteudo").path("ergogenicos")).hasSize(1);
    }

    @Test
    void semErgogenicoAlterarAListaExistenteFicaComoEstaMesmoComLerSomente() throws Exception {
        var api = new ApiDeTeste(mvc, json);
        var login = api.novoTreinador();
        UUID aluno = api.criarAluno(login, "Aluno Fictício");
        JsonNode plano = api.post("/alunos/" + aluno + "/planos-dieta", login, Map.of("titulo", "Dieta"), 200);
        String id = plano.path("plano").path("id").asString();
        JsonNode salvo = salvar(api, login, id, dieta(List.of(medicacao(NOME))), plano);

        // Quem não vê salva a dieta sem apagar o que não enxerga; o que vier no corpo é ignorado.
        trocarPerfil(login, "Nutricionista");
        JsonNode salvoSemVer = salvar(api, login, id, dieta(List.of(medicacao("Item de teste ZR"))), salvo);
        assertThat(salvoSemVer.path("rascunho").path("ergogenicos").isNull()).isTrue();

        trocarPerfil(login, "Administrador");
        JsonNode lista = api.get("/planos-dieta/" + id, login, 200).path("rascunho").path("ergogenicos");
        assertThat(lista).hasSize(1);
        assertThat(lista.get(0).path("nome").asString()).isEqualTo(NOME);

        // Só LER: vê, mas o corpo não altera.
        trocarPerfil(login, "Assistente");
        darPermissao(login, "ERGOGENICO_LER");
        darPermissao(login, "DIETA_ALTERAR");
        darPermissao(login, "DIETA_LER");
        JsonNode atual = api.get("/planos-dieta/" + id, login, 200);
        assertThat(atual.path("rascunho").path("ergogenicos")).hasSize(1);
        JsonNode tentativa = salvar(api, login, id, dieta(List.of()), atual);
        assertThat(tentativa.path("rascunho").path("ergogenicos")).hasSize(1);
        assertThat(tentativa.path("rascunho").path("ergogenicos").get(0).path("nome").asString()).isEqualTo(NOME);
    }

    @Test
    void modeloNuncaLevaErgogenicosMasCopiaDoMesmoAlunoLeva() throws Exception {        var api = new ApiDeTeste(mvc, json);
        var login = api.novoTreinador();
        UUID aluno = api.criarAluno(login, "Aluno Fictício");
        JsonNode plano = api.post("/alunos/" + aluno + "/planos-dieta", login, Map.of("titulo", "Dieta"), 200);
        String id = plano.path("plano").path("id").asString();
        salvar(api, login, id, dieta(List.of(medicacao(NOME))), plano);

        JsonNode receita = api.post("/planos-dieta/" + id + "/salvar-como-receita", login,
                Map.of("nome", "Modelo de teste"), 200);
        String receitaId = receita.path("id").asString();
        assertThat(api.get("/receitas/" + receitaId, login, 200).toString()).doesNotContain(NOME);

        // Pelo corpo da receita também: o conteúdo é regravado sem a lista.
        ConteudoDieta comLista = dieta(List.of(medicacao(NOME)));
        long versaoDaReceita = api.get("/receitas/" + receitaId, login, 200).path("versao").asLong();
        api.put("/receitas/" + receitaId + "/conteudo", login,
                Map.of("nome", "Modelo de teste", "conteudo", json.valueToTree(comLista), "versao", versaoDaReceita), 200);
        assertThat(api.get("/receitas/" + receitaId, login, 200).toString()).doesNotContain(NOME);

        // Dieta nova a partir do modelo nasce sem a lista.
        JsonNode doModelo = api.post("/alunos/" + aluno + "/planos-dieta", login,
                Map.of("titulo", "Do modelo", "receitaId", receitaId), 200);
        assertThat(doModelo.path("rascunho").path("ergogenicos").isNull()).isTrue();

        // Copiar o plano do mesmo aluno (Administrador) mantém a lista, com uids novos.
        JsonNode copia = api.post("/alunos/" + aluno + "/planos-dieta", login,
                Map.of("titulo", "Cópia", "copiarDoPlanoId", id), 200);
        JsonNode copiados = copia.path("rascunho").path("ergogenicos");
        assertThat(copiados).hasSize(1);
        JsonNode origem = api.get("/planos-dieta/" + id, login, 200).path("rascunho").path("ergogenicos");
        assertThat(copiados.get(0).path("uid").asString()).isNotEqualTo(origem.get(0).path("uid").asString());

        // Copiar para OUTRO aluno não leva, e só a rota de copiar para aluno faz isso (o criar recusa).
        UUID outro = api.criarAluno(login, "Outro Aluno Fictício");
        api.post("/alunos/" + outro + "/planos-dieta", login, Map.of("titulo", "Cópia", "copiarDoPlanoId", id), 404);
        JsonNode resposta = api.post("/planos-dieta/" + id + "/copiar-para-aluno", login,
                Map.of("alunoId", outro, "titulo", "Cópia", "inicio", "2026-11-02", "fim", "2026-11-29"), 200);
        JsonNode paraOutro = api.get("/planos-dieta/" + resposta.path("planoId").asString(), login, 200);
        assertThat(paraOutro.path("rascunho").path("ergogenicos").isNull()).isTrue();
        assertThat(paraOutro.toString()).doesNotContain(NOME);
    }

    @Test
    void replicarCopiaComUidsNovosEOAlunoVeAPropriaLista() throws Exception {
        var api = new ApiDeTeste(mvc, json);
        var login = api.novoTreinador();
        UUID aluno = api.criarAluno(login, "Aluno Fictício");
        JsonNode alunoLogado = api.convidarEEntrar(login, aluno);
        JsonNode plano = api.post("/alunos/" + aluno + "/planos-dieta", login, Map.of("titulo", "Dieta"), 200);
        String id = plano.path("plano").path("id").asString();
        JsonNode salvo = salvar(api, login, id, dieta(List.of(medicacao(NOME))), plano);

        // Quem publica sem ERGOGENICO_LER não derruba a lista: o aluno continua vendo.
        trocarPerfil(login, "Nutricionista");
        publicar(api, login, id, salvo);
        JsonNode doAluno = api.get("/aluno/dieta", alunoLogado, 200).path("dieta").path("conteudo").path("ergogenicos");
        assertThat(doAluno).hasSize(1);
        assertThat(doAluno.get(0).path("nome").asString()).isEqualTo(NOME);
        assertThat(doAluno.get(0).path("dose").asString()).isEqualTo("Dose de teste");

        trocarPerfil(login, "Administrador");
        JsonNode replica = api.post("/planos-dieta/" + id + "/replicar", login, Map.of("titulo", "Replica"), 200);
        JsonNode copiada = replica.path("rascunho").path("ergogenicos");
        assertThat(copiada).hasSize(1);
        assertThat(copiada.get(0).path("uid").asString()).isNotEqualTo(doAluno.get(0).path("uid").asString());
        assertThat(copiada.get(0).path("nome").asString()).isEqualTo(NOME);
    }

    @Test
    void nomeDoItemNuncaVaiParaAAuditoria() throws Exception {
        var api = new ApiDeTeste(mvc, json);
        var login = api.novoTreinador();
        UUID aluno = api.criarAluno(login, "Aluno Fictício");
        JsonNode plano = api.post("/alunos/" + aluno + "/planos-dieta", login, Map.of("titulo", "Dieta"), 200);
        String id = plano.path("plano").path("id").asString();
        JsonNode salvo = salvar(api, login, id, dieta(List.of(medicacao(NOME))), plano);
        publicar(api, login, id, salvo);
        api.post("/planos-dieta/" + id + "/replicar", login, Map.of("titulo", "Replica"), 200);

        Integer achados = jdbc.queryForObject("select count(*) from auditoria where resumo ilike ? or entidade ilike ? "
                + "or acao ilike ?", Integer.class, "%" + NOME + "%", "%" + NOME + "%", "%" + NOME + "%");
        assertThat(achados).isZero();
    }

    @Test
    void validadorApontaItemSemNomeEUidRepetido() throws Exception {
        var api = new ApiDeTeste(mvc, json);
        var login = api.novoTreinador();
        UUID aluno = api.criarAluno(login, "Aluno Fictício");
        JsonNode plano = api.post("/alunos/" + aluno + "/planos-dieta", login, Map.of("titulo", "Dieta"), 200);
        String id = plano.path("plano").path("id").asString();
        UUID repetido = UUID.randomUUID();
        salvar(api, login, id, dieta(List.of(
                new Ergogenico(repetido, " ", null, null, "Dose de teste", null, null, null),
                new Ergogenico(repetido, NOME, null, null, null, null, null, null))), plano);
        JsonNode v = api.post("/planos-dieta/" + id + "/validar", login, null, 200);
        assertThat(v.path("erros").valueStream().map(e -> e.path("caminho").asString()))
                .contains("ergogenicos[0].nome", "ergogenicos[1].uid");
    }

    @Test
    void linhaEmBrancoNaoTravaAPublicacaoDeQuemNaoVeALista() throws Exception {
        var api = new ApiDeTeste(mvc, json);
        var login = api.novoTreinador();
        UUID aluno = api.criarAluno(login, "Aluno Fictício");
        JsonNode plano = api.post("/alunos/" + aluno + "/planos-dieta", login, Map.of("titulo", "Dieta"), 200);
        String id = plano.path("plano").path("id").asString();
        // "Adicionar linha" sem preencher: o autosave grava a linha vazia.
        salvar(api, login, id, dieta(List.of(new Ergogenico(UUID.randomUUID(), "", "", "", "", "", "", ""))), plano);

        trocarPerfil(login, "Nutricionista");
        JsonNode atual = api.get("/planos-dieta/" + id, login, 200);
        JsonNode v = api.post("/planos-dieta/" + id + "/validar", login, null, 200);
        assertThat(v.path("erros").valueStream().map(e -> e.path("caminho").asString())).noneMatch(c -> c.startsWith("ergogenicos"));
        publicar(api, login, id, atual);
    }

    @Test
    void comPermissaoCorpoSemAListaMantemEListaVaziaApaga() throws Exception {
        var api = new ApiDeTeste(mvc, json);
        var login = api.novoTreinador();
        UUID aluno = api.criarAluno(login, "Aluno Fictício");
        JsonNode plano = api.post("/alunos/" + aluno + "/planos-dieta", login, Map.of("titulo", "Dieta"), 200);
        String id = plano.path("plano").path("id").asString();
        JsonNode salvo = salvar(api, login, id, dieta(List.of(medicacao(NOME))), plano);

        // Editor aberto antes de ganhar a permissão: manda a lista nula e não pode apagá-la.
        JsonNode semLista = salvar(api, login, id, dieta(null), salvo);
        assertThat(semLista.path("rascunho").path("ergogenicos")).hasSize(1);

        JsonNode vazia = salvar(api, login, id, dieta(List.of()), semLista);
        assertThat(vazia.path("rascunho").path("ergogenicos")).isEmpty();
    }
}
