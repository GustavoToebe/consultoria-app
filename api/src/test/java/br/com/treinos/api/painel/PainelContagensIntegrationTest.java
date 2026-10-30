package br.com.treinos.api.painel;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.web.Fuso;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Contagens novas do {@code GET /painel} (30/10): pastas a renovar (com a lista), alunos sem pasta com período, "sem
 * registro" sem o teto de 20 e alunos sem acesso. Cada uma isolada por consultoria, com o filtro {@code meus} e com
 * {@code null} (nunca zero) para quem não pode ver. Dados fictícios.
 */
@AutoConfigureMockMvc
class PainelContagensIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    private ApiDeTeste api;
    private JsonNode admin;
    private JsonNode membro;
    private final LocalDate hoje = LocalDate.now(Fuso.BRASILIA);

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        membro = membroCom(Set.of("PAINEL_VER", "ALUNO_LER", "REGISTRO_LER", "TREINO_LER"));
    }

    private JsonNode membroCom(Set<String> permissoes) throws Exception {
        String perfil = api.post("/perfis", admin, Map.of("nome", "Perfil " + UUID.randomUUID(), "permissoes", permissoes), 200)
                .path("id").asString();
        JsonNode convite = api.post("/usuarios/convites", admin, Map.of("nome", "Membro fictício",
                "email", ApiDeTeste.emailUnico("membro"), "perfilId", perfil), 200);
        return api.post("/publico/convites-equipe/aceitar", null,
                Map.of("codigo", convite.path("codigo").asString(), "senha", ApiDeTeste.SENHA), 200);
    }

    private static String idDe(JsonNode login) {
        return login.path("usuario").path("id").asString();
    }

    private UUID aluno(JsonNode responsavel, String nome) throws Exception {
        return UUID.fromString(api.post("/alunos", admin, Map.of("nome", nome, "responsavelId", idDe(responsavel)), 200)
                .path("id").asString());
    }

    private String pasta(UUID aluno, LocalDate inicio, LocalDate fim) throws Exception {
        return api.post("/alunos/" + aluno + "/pastas", admin,
                Map.of("titulo", "Pasta fictícia", "inicio", inicio, "fim", fim), 200).path("id").asString();
    }

    /** Publica um treino na pasta: ela passa a ser a vigente do aluno. */
    private void publicarNaPasta(UUID aluno, String pasta) throws Exception {
        JsonNode plano = api.post("/alunos/" + aluno + "/planos-treino", admin,
                Map.of("titulo", "Treino fictício", "pastaId", pasta), 200);
        String id = plano.path("plano").path("id").asString();
        JsonNode salvo = api.put("/planos-treino/" + id + "/rascunho", admin,
                ApiDeTeste.rascunho("Treino fictício", ApiDeTeste.treino().conteudo(), plano.path("plano").path("versao").asLong()), 200);
        api.post("/planos-treino/" + id + "/publicar", admin,
                Map.of("versao", salvo.path("plano").path("versao").asLong(), "confirmarAvisos", true), 200);
    }

    private JsonNode painel(JsonNode quem, boolean meus) throws Exception {
        return api.get("/painel?meus=" + meus, quem, 200);
    }

    private static List<String> nomesDaLista(JsonNode lista) {
        List<String> nomes = new ArrayList<>();
        lista.forEach(i -> nomes.add(i.path("aluno").path("nome").asString()));
        return nomes;
    }

    @Test
    void pastasARenovarESemPastaComPeriodoSeguemARegraDoApp() throws Exception {
        // Do administrador: A tem pasta vigente que termina em 3 dias (renova); B não tem pasta.
        UUID a = aluno(admin, "Aluno A vigente a renovar");
        publicarNaPasta(a, pasta(a, hoje.minusDays(20), hoje.plusDays(3)));
        aluno(admin, "Aluno B sem pasta");
        // Do membro: C já terminou, sem plano (renova, mas não é vigente); D termina em 10 dias (não renova).
        UUID c = aluno(membro, "Aluno C terminou");
        pasta(c, hoje.minusDays(30), hoje.minusDays(2));
        UUID d = aluno(membro, "Aluno D longe do fim");
        pasta(d, hoje, hoje.plusDays(10));
        // E: a pasta que termina em 2 dias já tem a seguinte (começa depois do fim): não renova nenhuma.
        UUID e = aluno(membro, "Aluno E com a seguinte");
        pasta(e, hoje.minusDays(25), hoje.plusDays(2));
        pasta(e, hoje.plusDays(3), hoje.plusDays(30));
        // F: pasta finalizada não renova. H: pasta arquivada (excluída) não renova.
        UUID f = aluno(membro, "Aluno F finalizada");
        api.post("/pastas/" + pasta(f, hoje.minusDays(25), hoje.plusDays(1)) + "/finalizar", admin, Map.of(), 200);
        UUID h = aluno(membro, "Aluno H arquivada");
        api.delete("/pastas/" + pasta(h, hoje.minusDays(25), hoje.plusDays(1)), admin, 204);
        // G: aluno inativo com pasta a renovar não entra.
        UUID g = aluno(membro, "Aluno G inativo");
        pasta(g, hoje.minusDays(25), hoje.plusDays(1));
        api.patch("/alunos/" + g + "/situacao", admin, Map.of("ativo", false), 200);

        // Outra consultoria, com um aluno e uma pasta que também pediriam renovação: nada disso entra nas contas de cima.
        JsonNode outro = api.novoTreinador();
        UUID deFora = api.criarAluno(outro, "Aluno de outra consultoria");
        api.post("/alunos/" + deFora + "/pastas", outro,
                Map.of("titulo", "Pasta de fora", "inicio", hoje.minusDays(20), "fim", hoje.plusDays(1)), 200);

        JsonNode todos = painel(admin, false);
        assertThat(todos.path("pastasARenovar").asLong()).isEqualTo(2);
        // Mesma consulta da contagem: C (fim há 2 dias) antes de A (fim em 3), com o aluno e o fim.
        assertThat(nomesDaLista(todos.path("pastasParaRenovar"))).containsExactly("Aluno C terminou", "Aluno A vigente a renovar");
        JsonNode primeiro = todos.path("pastasParaRenovar").get(0);
        assertThat(primeiro.path("fim").asString()).isEqualTo(hoje.minusDays(2).toString());
        assertThat(primeiro.path("aluno").path("id").asString()).isEqualTo(c.toString());
        assertThat(primeiro.path("pasta").path("titulo").asString()).isEqualTo("Pasta fictícia");
        assertThat(primeiro.path("pasta").path("id").asString()).isNotEmpty();
        // Sem pasta vigente com período: todos os ativos menos A (B, C, D, E, F e H; G é inativo).
        assertThat(todos.path("alunosSemPastaComPeriodo").asLong()).isEqualTo(6);

        // meus=true: cada um só vê os seus.
        JsonNode meusDoAdmin = painel(admin, true);
        assertThat(meusDoAdmin.path("pastasARenovar").asLong()).isEqualTo(1);
        assertThat(nomesDaLista(meusDoAdmin.path("pastasParaRenovar"))).containsExactly("Aluno A vigente a renovar");
        assertThat(meusDoAdmin.path("alunosSemPastaComPeriodo").asLong()).isEqualTo(1);
        JsonNode meusDoMembro = painel(membro, true);
        assertThat(meusDoMembro.path("pastasARenovar").asLong()).isEqualTo(1);
        assertThat(nomesDaLista(meusDoMembro.path("pastasParaRenovar"))).containsExactly("Aluno C terminou");
        assertThat(meusDoMembro.path("alunosSemPastaComPeriodo").asLong()).isEqualTo(5);
        // "Meus" não restringe quem não pede.
        assertThat(painel(membro, false).path("pastasARenovar").asLong()).isEqualTo(2);
        // A outra consultoria só vê a dela.
        JsonNode deles = painel(outro, false);
        assertThat(deles.path("pastasARenovar").asLong()).isEqualTo(1);
        assertThat(nomesDaLista(deles.path("pastasParaRenovar"))).containsExactly("Aluno de outra consultoria");
        assertThat(deles.path("alunosSemPastaComPeriodo").asLong()).isEqualTo(1);
    }

    @Test
    void listaDePastasARenovarTemTetoDeVinteMasAContagemPassa() throws Exception {
        for (int i = 0; i < 21; i++) {
            UUID aluno = aluno(admin, "Aluno com pasta " + i);
            pasta(aluno, hoje.minusDays(40), hoje.minusDays(i));
        }
        JsonNode p = painel(admin, false);
        assertThat(p.path("pastasARenovar").asLong()).isEqualTo(21);
        assertThat(p.path("pastasParaRenovar")).hasSize(20);
        // Do fim mais antigo ao mais novo: o primeiro terminou há 20 dias.
        assertThat(p.path("pastasParaRenovar").get(0).path("fim").asString()).isEqualTo(hoje.minusDays(20).toString());
        assertThat(p.path("pastasParaRenovar").get(19).path("fim").asString()).isEqualTo(hoje.minusDays(1).toString());
    }

    @Test
    void semRegistroContaAlemDoTetoDaListaEOutraConsultoriaNaoEntra() throws Exception {
        for (int i = 0; i < 21; i++) {
            aluno(admin, "Aluno sem registro " + i);
        }
        for (int i = 0; i < 3; i++) {
            aluno(membro, "Aluno sem registro do membro " + i);
        }
        // Um aluno do administrador que registrou hoje fica de fora.
        UUID registrou = aluno(admin, "Aluno que registrou hoje");
        registrarHoje(registrou);

        JsonNode todos = painel(admin, false);
        assertThat(todos.path("alunosSemRegistroTotal").asLong()).isEqualTo(24);
        assertThat(todos.path("alunosSemRegistro")).hasSize(20);
        JsonNode meusDoAdmin = painel(admin, true);
        assertThat(meusDoAdmin.path("alunosSemRegistroTotal").asLong()).isEqualTo(21);
        assertThat(meusDoAdmin.path("alunosSemRegistro")).hasSize(20);
        assertThat(painel(membro, true).path("alunosSemRegistroTotal").asLong()).isEqualTo(3);
        // O N também vale para a contagem: com 1 dia o aluno que registrou hoje continua de fora.
        assertThat(api.get("/painel?dias=1", admin, 200).path("alunosSemRegistroTotal").asLong()).isEqualTo(24);

        // Outra consultoria: nada disto aparece, e as contagens são zero de verdade (não null).
        JsonNode outro = api.novoTreinador();
        JsonNode p = painel(outro, false);
        for (String campo : List.of("alunosSemRegistroTotal", "pastasARenovar", "alunosSemPastaComPeriodo", "alunosSemAcesso")) {
            assertThat(p.path(campo).isNull()).as(campo).isFalse();
            assertThat(p.path(campo).asLong()).as(campo).isZero();
        }
        assertThat(p.path("pastasParaRenovar")).isEmpty();
        assertThat(p.path("alunosSemRegistro")).isEmpty();
    }

    @Test
    void alunosSemAcessoSaoSubconjuntoDosAtivosEFiltramPorMeus() throws Exception {
        aluno(admin, "Aluno X sem acesso");
        UUID y = aluno(admin, "Aluno Y com acesso");
        api.convidarEEntrar(admin, y);
        UUID z = aluno(admin, "Aluno Z inativo sem acesso");
        api.patch("/alunos/" + z + "/situacao", admin, Map.of("ativo", false), 200);
        aluno(membro, "Aluno W sem acesso do membro");

        JsonNode todos = painel(admin, false);
        assertThat(todos.path("alunosAtivos").asLong()).isEqualTo(3);
        assertThat(todos.path("alunosSemAcesso").asLong()).isEqualTo(2);
        assertThat(todos.path("alunosSemAcesso").asLong()).isLessThanOrEqualTo(todos.path("alunosAtivos").asLong());
        assertThat(painel(admin, true).path("alunosSemAcesso").asLong()).isEqualTo(1);
        assertThat(painel(membro, true).path("alunosSemAcesso").asLong()).isEqualTo(1);

        JsonNode outro = api.novoTreinador();
        assertThat(painel(outro, false).path("alunosSemAcesso").asLong()).isZero();
    }

    @Test
    void semPermissaoAsContagensDePastaERegistroSaoNullNuncaZero() throws Exception {
        UUID a = aluno(admin, "Aluno com pasta e sem registro");
        pasta(a, hoje.minusDays(20), hoje.plusDays(1));
        JsonNode soPainel = membroCom(Set.of("PAINEL_VER", "ALUNO_LER"));

        JsonNode p = painel(soPainel, false);
        assertThat(p.path("pastasARenovar").isNull()).isTrue();
        assertThat(p.path("alunosSemPastaComPeriodo").isNull()).isTrue();
        assertThat(p.path("alunosSemRegistroTotal").isNull()).isTrue();
        assertThat(p.path("pastasParaRenovar")).isEmpty();
        assertThat(p.path("alunosSemRegistro")).isEmpty();
        // Sem acesso segue o alunosAtivos: sem permissão extra.
        assertThat(p.path("alunosSemAcesso").asLong()).isEqualTo(1);

        JsonNode completo = painel(admin, false);
        assertThat(completo.path("pastasARenovar").asLong()).isEqualTo(1);
        assertThat(completo.path("alunosSemRegistroTotal").asLong()).isEqualTo(1);
    }

    // ---- treinos concluídos nos últimos 7 dias (30/10) ----

    /** Um aluno com treino publicado e login, para enviar "Concluir treino" como ele. */
    private record AlunoLogado(JsonNode login, String versaoId, ApiDeTeste.TreinoDeTeste treino) { }

    private AlunoLogado logado(ApiDeTeste apiDoTreinador, JsonNode treinador, UUID aluno) throws Exception {
        ApiDeTeste.TreinoDeTeste treino = ApiDeTeste.treino();
        apiDoTreinador.publicarTreino(treinador, aluno, treino.conteudo());
        JsonNode login = apiDoTreinador.convidarEEntrar(treinador, aluno);
        String versaoId = apiDoTreinador.get("/aluno/painel", login, 200).path("treino").path("versaoId").asString();
        return new AlunoLogado(login, versaoId, treino);
    }

    /** Conclui (ou, com {@code resultado} nulo, reabre) a sessão do treino no dia. */
    private void concluir(AlunoLogado a, LocalDate dia, String resultado) throws Exception {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("id", UUID.randomUUID().toString());
        r.put("planoVersaoId", a.versaoId());
        r.put("sessaoUid", a.treino().sessaoUid().toString());
        r.put("data", dia.toString());
        r.put("concluida", resultado != null);
        r.put("resultado", resultado);
        r.put("duracaoSegundos", null);
        r.put("comentario", null);
        r.put("alteradoNoAparelhoEm", Instant.now().toString());
        JsonNode resposta = api.post("/aluno/sessoes-concluidas", a.login(), Map.of("registros", List.of(r)), 200);
        assertThat(resposta.path("resultados").get(0).path("situacao").asString()).isEqualTo("ACEITO");
    }

    @Test
    void sessoesConcluidasDosSeteDiasContamCompletasEParciaisSoDoEscopo() throws Exception {
        AlunoLogado doAdmin = logado(api, admin, aluno(admin, "Aluno do admin"));
        AlunoLogado doMembro = logado(api, admin, aluno(membro, "Aluno do membro"));
        concluir(doAdmin, hoje, "COMPLETA");
        concluir(doAdmin, hoje.minusDays(6), "PARCIAL");       // o 7º dia da janela: entra
        concluir(doAdmin, hoje.minusDays(7), "COMPLETA");      // fora da janela
        concluir(doAdmin, hoje.minusDays(3), null);            // reaberta: não conta
        concluir(doMembro, hoje, "COMPLETA");

        // Outra consultoria, com sessão concluída hoje, não entra em conta nenhuma.
        JsonNode outro = api.novoTreinador();
        UUID alunoDeFora = api.criarAluno(outro, "Aluno de outra consultoria");
        concluir(logado(api, outro, alunoDeFora), hoje, "COMPLETA");

        assertThat(painel(admin, false).path("sessoesConcluidas7Dias").asLong()).isEqualTo(3);
        assertThat(painel(admin, true).path("sessoesConcluidas7Dias").asLong()).isEqualTo(2);
        assertThat(painel(membro, true).path("sessoesConcluidas7Dias").asLong()).isEqualTo(1);
        assertThat(painel(outro, false).path("sessoesConcluidas7Dias").asLong()).isEqualTo(1);
        // só número: nada de nome nem id junto
        assertThat(painel(admin, false).path("sessoesConcluidas7Dias").isNumber()).isTrue();
    }

    @Test
    void comRetornoLigadoENenhumaSessaoEZeroESemRegistroLerENull() throws Exception {
        aluno(admin, "Aluno sem treino concluído");
        assertThat(painel(admin, false).path("sessoesConcluidas7Dias").isNull()).isFalse();
        assertThat(painel(admin, false).path("sessoesConcluidas7Dias").asLong()).isZero();

        JsonNode soPainel = membroCom(Set.of("PAINEL_VER", "ALUNO_LER"));
        assertThat(painel(soPainel, false).path("sessoesConcluidas7Dias").isNull()).isTrue();
    }

    private void registrarHoje(UUID aluno) throws Exception {
        ApiDeTeste.TreinoDeTeste treino = ApiDeTeste.treino();
        api.publicarTreino(admin, aluno, treino.conteudo());
        JsonNode login = api.convidarEEntrar(admin, aluno);
        String versaoId = api.get("/aluno/painel", login, 200).path("treino").path("versaoId").asString();
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("id", UUID.randomUUID().toString());
        r.put("planoVersaoId", versaoId);
        r.put("sessaoUid", treino.sessaoUid().toString());
        r.put("exercicioUid", treino.exercicioUid().toString());
        r.put("serieUid", treino.wsUid().toString());
        r.put("data", hoje.toString());
        r.put("carga", "50");
        r.put("repeticoes", 8);
        r.put("concluida", true);
        r.put("alteradoNoAparelhoEm", Instant.now().toString());
        JsonNode resposta = api.post("/aluno/execucoes/lote", login, Map.of("registros", List.of(r)), 200);
        assertThat(resposta.path("resultados").get(0).path("situacao").asString()).isEqualTo("ACEITO");
    }
}
