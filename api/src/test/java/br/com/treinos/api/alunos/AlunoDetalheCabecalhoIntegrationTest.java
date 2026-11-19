package br.com.treinos.api.alunos;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.dieta.ConteudoDieta;
import br.com.treinos.api.equipe.CatalogoPermissoes;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Cabeçalho da ficha (GET /alunos/{id}): {@code cadastroAlteradoEm}, {@code ultimoAcesso} (só LOGIN: o módulo de sessão não
 * expõe o último uso do refresh) e {@code ultimoPlanoPublicado} (data e autor, só dos tipos que quem pede pode ler).
 * Só dados fictícios; cada teste consulta apenas o aluno que criou.
 */
@AutoConfigureMockMvc
class AlunoDetalheCabecalhoIntegrationTest extends AbstractIntegrationTest {

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

    // ---- apoio ----

    private JsonNode membro(Set<String> permissoes) throws Exception {
        String perfil = api.post("/perfis", treinador,
                Map.of("nome", "Perfil " + UUID.randomUUID(), "permissoes", CatalogoPermissoes.comDependencias(permissoes)), 200)
                .get("id").asString();
        JsonNode convite = api.post("/usuarios/convites", treinador,
                Map.of("nome", "Membro fictício", "email", ApiDeTeste.emailUnico("membro"), "perfilId", perfil), 200);
        return api.post("/publico/convites-equipe/aceitar", null,
                Map.of("codigo", convite.get("codigo").asString(), "senha", ApiDeTeste.SENHA), 200);
    }

    private JsonNode ficha(UUID aluno, JsonNode quem) throws Exception {
        return api.get("/alunos/" + aluno, quem, 200);
    }

    private void publicarDieta(UUID aluno) throws Exception {
        JsonNode plano = api.post("/alunos/" + aluno + "/planos-dieta", treinador, Map.of("titulo", "Dieta fictícia"), 200);
        String id = plano.path("plano").path("id").asString();
        ConteudoDieta.Item item = new ConteudoDieta.Item(UUID.randomUUID(), UUID.randomUUID(), "Arroz branco cozido",
                new BigDecimal("150"), "g", new BigDecimal("191.7"), BigDecimal.ONE, BigDecimal.TEN, BigDecimal.ZERO, false);
        ConteudoDieta conteudo = new ConteudoDieta("Objetivo fictício", null, "Treinador Teste", List.of(
                new ConteudoDieta.Refeicao(UUID.randomUUID(), "Almoço", "12:00", null, List.of(
                        new ConteudoDieta.Opcao(UUID.randomUUID(), "A", List.of(item))))),
                List.of(), null, List.of());
        JsonNode salvo = api.put("/planos-dieta/" + id + "/rascunho", treinador,
                ApiDeTeste.rascunho("Dieta fictícia", conteudo, plano.path("plano").path("versao").asLong()), 200);
        api.post("/planos-dieta/" + id + "/publicar", treinador,
                Map.of("versao", salvo.path("plano").path("versao").asLong(), "confirmarAvisos", true), 200);
    }

    private Instant publicadaEm(String tabela, String tabelaDoPlano, UUID aluno) {
        Timestamp t = banco.queryForObject("select max(v.publicado_em) from " + tabela + " v join " + tabelaDoPlano
                + " p on p.id = v.plano_id where p.aluno_id = ?", Timestamp.class, aluno);
        return t.toInstant();
    }

    private static Instant instante(JsonNode no) {
        return Instant.parse(no.asString()).truncatedTo(ChronoUnit.MILLIS);
    }

    // ---- cadastroAlteradoEm ----

    @Test
    void cadastroAlteradoEmVemDoCadastroEAvancaAoEditar() throws Exception {
        UUID aluno = api.criarAluno(treinador, "Aluno Cabeçalho Fictício");
        JsonNode antes = ficha(aluno, treinador);
        assertThat(antes.has("cadastroAlteradoEm")).isTrue();
        Instant gravado = banco.queryForObject("select atualizado_em from aluno where id = ?", Timestamp.class, aluno).toInstant();
        assertThat(instante(antes.get("cadastroAlteradoEm"))).isEqualTo(gravado.truncatedTo(ChronoUnit.MILLIS));

        api.put("/alunos/" + aluno, treinador,
                Map.of("nome", "Aluno Cabeçalho Editado", "versao", antes.get("versao").asLong()), 200);
        JsonNode depois = ficha(aluno, treinador);
        assertThat(instante(depois.get("cadastroAlteradoEm"))).isAfter(instante(antes.get("cadastroAlteradoEm")));
    }

    // ---- ultimoAcesso ----

    @Test
    void alunoSemUsuarioNaoTemUltimoAcesso() throws Exception {
        UUID aluno = api.criarAluno(treinador, "Aluno Sem Acesso Fictício");
        JsonNode ficha = ficha(aluno, treinador);
        assertThat(ficha.has("ultimoAcesso")).isTrue();
        assertThat(ficha.get("ultimoAcesso").isNull()).isTrue();
    }

    @Test
    void ultimoAcessoEOUltimoLoginComTipoLogin() throws Exception {
        UUID aluno = api.criarAluno(treinador, "Aluno Com Acesso Fictício");
        String email = ApiDeTeste.emailUnico("aluno");
        api.put("/alunos/" + aluno + "/acesso", treinador, Map.of("email", email, "senha", "provisoria-de-teste-123"), 200);
        mvc.perform(post("/auth/login").header("X-Treinos-Cliente", "nativo").contentType(MediaType.APPLICATION_JSON)
                        .content(api.paraJson(Map.of("email", email, "senha", "provisoria-de-teste-123",
                                "novaSenha", ApiDeTeste.SENHA))))
                .andExpect(status().isOk());

        JsonNode acesso = ficha(aluno, treinador).get("ultimoAcesso");
        Instant login = banco.queryForObject("select ultimo_login_em from usuario where aluno_id = ?", Timestamp.class, aluno)
                .toInstant();
        assertThat(acesso.get("tipo").asString()).isEqualTo("LOGIN");
        assertThat(instante(acesso.get("em"))).isEqualTo(login.truncatedTo(ChronoUnit.MILLIS));
    }

    @Test
    void quemAceitaOConviteTambemTemUltimoAcessoComTipoLogin() throws Exception {
        UUID aluno = api.criarAluno(treinador, "Aluno Convidado Fictício");
        assertThat(ficha(aluno, treinador).get("ultimoAcesso").isNull()).isTrue();

        // O aceite abre a sessão sem passar pelo login: o último acesso tem de ficar gravado do mesmo jeito.
        api.convidarEEntrar(treinador, aluno);

        JsonNode acesso = ficha(aluno, treinador).get("ultimoAcesso");
        Instant login = banco.queryForObject("select ultimo_login_em from usuario where aluno_id = ?", Timestamp.class, aluno)
                .toInstant();
        assertThat(acesso.get("tipo").asString()).isEqualTo("LOGIN");
        assertThat(instante(acesso.get("em"))).isEqualTo(login.truncatedTo(ChronoUnit.MILLIS));
    }

    // ---- ultimoPlanoPublicado ----

    @Test
    void alunoAnonimizadoNaoMostraOUltimoPlanoPublicado() throws Exception {
        UUID aluno = api.criarAluno(treinador, "Aluno Anonimizado Fictício");
        api.publicarTreino(treinador, aluno, ApiDeTeste.treino().conteudo());
        assertThat(ficha(aluno, treinador).get("ultimoPlanoPublicado").get("porNome").asString()).isEqualTo("Treinador Teste");

        api.patch("/alunos/" + aluno + "/situacao", treinador, Map.of("ativo", false), 200);
        api.post("/alunos/" + aluno + "/anonimizar", treinador, Map.of("nomeConfirmado", "Aluno Anonimizado Fictício"), 200);

        JsonNode anonimizado = ficha(aluno, treinador);
        assertThat(anonimizado.get("anonimizado").asBoolean()).isTrue();
        assertThat(anonimizado.get("ultimoPlanoPublicado").isNull()).isTrue();
    }

    @Test
    void semPublicacaoOuSoComRascunhoOCampoVemNulo() throws Exception {
        UUID aluno = api.criarAluno(treinador, "Aluno Sem Plano Fictício");
        assertThat(ficha(aluno, treinador).get("ultimoPlanoPublicado").isNull()).isTrue();

        JsonNode plano = api.post("/alunos/" + aluno + "/planos-treino", treinador, Map.of("titulo", "Só rascunho"), 200);
        api.put("/planos-treino/" + plano.path("plano").path("id").asString() + "/rascunho", treinador,
                ApiDeTeste.rascunho("Só rascunho", ApiDeTeste.treino().conteudo(), plano.path("plano").path("versao").asLong()), 200);
        assertThat(ficha(aluno, treinador).get("ultimoPlanoPublicado").isNull()).isTrue();
    }

    @Test
    void trazADataMaisRecenteEntreTreinoDietaEMobilidadeComONomeDoAutor() throws Exception {
        UUID aluno = api.criarAluno(treinador, "Aluno Planos Fictício");
        api.publicarTreino(treinador, aluno, ApiDeTeste.treino().conteudo());
        JsonNode soTreino = ficha(aluno, treinador).get("ultimoPlanoPublicado");
        assertThat(instante(soTreino.get("em")))
                .isEqualTo(publicadaEm("plano_treino_versao", "plano_treino", aluno).truncatedTo(ChronoUnit.MILLIS));
        assertThat(soTreino.get("porNome").asString()).isEqualTo("Treinador Teste");

        publicarDieta(aluno);
        assertThat(instante(ficha(aluno, treinador).get("ultimoPlanoPublicado").get("em")))
                .isEqualTo(publicadaEm("plano_dieta_versao", "plano_dieta", aluno).truncatedTo(ChronoUnit.MILLIS));

        api.publicarMobilidade(treinador, aluno, ApiDeTeste.mobilidade().conteudo());
        assertThat(instante(ficha(aluno, treinador).get("ultimoPlanoPublicado").get("em")))
                .isEqualTo(publicadaEm("plano_mobilidade_versao", "plano_mobilidade", aluno).truncatedTo(ChronoUnit.MILLIS));
    }

    @Test
    void cadaPermissaoSoVeOsTiposQuePodeLer() throws Exception {
        JsonNode semPlanos = membro(Set.of("ALUNO_LER"));
        JsonNode soDieta = membro(Set.of("ALUNO_LER", "DIETA_LER"));
        JsonNode soTreino = membro(Set.of("ALUNO_LER", "TREINO_LER"));
        UUID aluno = api.criarAluno(treinador, "Aluno Permissões Fictício");

        api.publicarTreino(treinador, aluno, ApiDeTeste.treino().conteudo());
        assertThat(ficha(aluno, semPlanos).get("ultimoPlanoPublicado").isNull()).isTrue();
        assertThat(ficha(aluno, soDieta).get("ultimoPlanoPublicado").isNull()).isTrue();
        assertThat(ficha(aluno, soTreino).get("ultimoPlanoPublicado").get("em").isString()).isTrue();

        publicarDieta(aluno);
        Instant dieta = publicadaEm("plano_dieta_versao", "plano_dieta", aluno).truncatedTo(ChronoUnit.MILLIS);
        Instant treino = publicadaEm("plano_treino_versao", "plano_treino", aluno).truncatedTo(ChronoUnit.MILLIS);
        assertThat(ficha(aluno, semPlanos).get("ultimoPlanoPublicado").isNull()).isTrue();
        assertThat(instante(ficha(aluno, soDieta).get("ultimoPlanoPublicado").get("em"))).isEqualTo(dieta);
        assertThat(instante(ficha(aluno, soTreino).get("ultimoPlanoPublicado").get("em"))).isEqualTo(treino);
        assertThat(ficha(aluno, soDieta).get("ultimoPlanoPublicado").get("porNome").asString()).isEqualTo("Treinador Teste");
    }
}
