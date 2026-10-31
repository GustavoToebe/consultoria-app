package br.com.treinos.api.alunos;

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
 * Filtros avançados de {@code GET /alunos} (31/10): cada filtro, combinações (E entre filtros, OU dentro de um), total e
 * paginação com filtro calculado, 403 sem a permissão do filtro, 400 {@code FILTRO_INVALIDO} e 404 de responsável de outra
 * consultoria. Cada teste cria a própria consultoria; a outra consultoria nunca aparece. Dados fictícios.
 */
@AutoConfigureMockMvc
class AlunoFiltrosIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    private ApiDeTeste api;
    private JsonNode admin;
    private final LocalDate hoje = LocalDate.now(Fuso.BRASILIA);

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
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

    private UUID aluno(String nome) throws Exception {
        return api.criarAluno(admin, nome);
    }

    private UUID aluno(String nome, JsonNode responsavel) throws Exception {
        return UUID.fromString(api.post("/alunos", admin, Map.of("nome", nome, "responsavelId", idDe(responsavel)), 200)
                .path("id").asString());
    }

    private String pasta(UUID aluno, LocalDate inicio, LocalDate fim) throws Exception {
        return api.post("/alunos/" + aluno + "/pastas", admin,
                Map.of("titulo", "Pasta fictícia", "inicio", inicio, "fim", fim), 200).path("id").asString();
    }

    /** Publica um treino na pasta: ela vira a vigente e o aluno passa a ter plano de treino ativo. */
    private void publicarNaPasta(UUID aluno, String pasta) throws Exception {
        JsonNode plano = api.post("/alunos/" + aluno + "/planos-treino", admin,
                Map.of("titulo", "Treino fictício", "pastaId", pasta), 200);
        String id = plano.path("plano").path("id").asString();
        JsonNode salvo = api.put("/planos-treino/" + id + "/rascunho", admin,
                ApiDeTeste.rascunho("Treino fictício", ApiDeTeste.treino().conteudo(), plano.path("plano").path("versao").asLong()), 200);
        api.post("/planos-treino/" + id + "/publicar", admin,
                Map.of("versao", salvo.path("plano").path("versao").asLong(), "confirmarAvisos", true), 200);
    }

    private JsonNode listar(JsonNode quem, String consulta) throws Exception {
        return api.get("/alunos?situacao=TODOS&" + consulta, quem, 200);
    }

    private static List<String> nomes(JsonNode pagina) {
        List<String> nomes = new ArrayList<>();
        pagina.path("itens").forEach(i -> nomes.add(i.path("nome").asString()));
        return nomes;
    }

    @Test
    void acessoComSemEAguardandoSeCombinamComOu() throws Exception {
        aluno("Ana sem acesso");
        UUID bruno = aluno("Bruno com acesso");
        api.convidarEEntrar(admin, bruno);
        UUID carla = aluno("Carla aguardando");
        api.put("/alunos/" + carla + "/acesso", admin, Map.of("email", ApiDeTeste.emailUnico("carla"), "senha", "provisoria-123"), 200);

        assertThat(nomes(listar(admin, "acesso=SEM"))).containsExactly("Ana sem acesso");
        // COM = tem usuário, inclusive quem ainda não trocou a senha provisória.
        assertThat(nomes(listar(admin, "acesso=COM"))).containsExactly("Bruno com acesso", "Carla aguardando");
        assertThat(nomes(listar(admin, "acesso=AGUARDANDO"))).containsExactly("Carla aguardando");
        JsonNode dois = listar(admin, "acesso=SEM&acesso=aguardando");
        assertThat(nomes(dois)).containsExactly("Ana sem acesso", "Carla aguardando");
        assertThat(dois.path("total").asLong()).isEqualTo(2);
        // E com a busca e a situação.
        assertThat(nomes(listar(admin, "acesso=COM&busca=bruno"))).containsExactly("Bruno com acesso");
        api.patch("/alunos/" + bruno + "/situacao", admin, Map.of("ativo", false), 200);
        assertThat(nomes(api.get("/alunos?situacao=ATIVO&acesso=COM", admin, 200))).containsExactly("Carla aguardando");
    }

    @Test
    void responsavelPorMembroOuSemResponsavel() throws Exception {
        JsonNode membro = membroCom(Set.of("ALUNO_LER"));
        aluno("Aluno do membro", membro);
        aluno("Aluno do admin", admin);
        aluno("Aluno sem responsável");

        assertThat(nomes(listar(admin, "responsavel=" + idDe(membro)))).containsExactly("Aluno do membro");
        assertThat(nomes(listar(admin, "responsavel=nenhum"))).containsExactly("Aluno sem responsável");
        assertThat(nomes(listar(admin, "responsavel=" + idDe(membro) + "&responsavel=nenhum")))
                .containsExactly("Aluno do membro", "Aluno sem responsável");
        // "Meus" continua igual: o próprio usuário como responsável.
        assertThat(nomes(listar(admin, "meus=true"))).containsExactly("Aluno do admin");
    }

    @Test
    void responsavelComMeusOuInvalidoE400EDeOutraConsultoriaE404() throws Exception {
        aluno("Aluno qualquer");
        JsonNode recusa = api.get("/alunos?meus=true&responsavel=nenhum", admin, 400);
        assertThat(recusa.path("codigo").asString()).isEqualTo("FILTRO_INVALIDO");
        assertThat(api.get("/alunos?responsavel=nao-e-um-id", admin, 400).path("codigo").asString()).isEqualTo("FILTRO_INVALIDO");

        JsonNode outro = api.novoTreinador();
        api.get("/alunos?responsavel=" + idDe(outro), admin, 404);
        api.get("/alunos?responsavel=" + UUID.randomUUID(), admin, 404);
    }

    @Test
    void atualizacaoPlanoEPastaARenovar() throws Exception {
        // A: pasta vigente que termina em 2 dias (fase AVISO, a renovar). B: termina em 20 dias (NENHUMA, não renova).
        // C: sem pasta (SEM_PASTA, sem plano). D: terminou há 2 dias e ninguém enviou (ATRASADA, a renovar).
        UUID a = aluno("Aluno A aviso");
        publicarNaPasta(a, pasta(a, hoje.minusDays(20), hoje.plusDays(2)));
        UUID b = aluno("Aluno B longe");
        publicarNaPasta(b, pasta(b, hoje.minusDays(5), hoje.plusDays(20)));
        aluno("Aluno C sem pasta");
        UUID d = aluno("Aluno D atrasado");
        publicarNaPasta(d, pasta(d, hoje.minusDays(30), hoje.minusDays(2)));

        assertThat(nomes(listar(admin, "atualizacao=ATRASADA"))).containsExactly("Aluno D atrasado");
        assertThat(nomes(listar(admin, "atualizacao=ATRASADA&atualizacao=AVISO"))).containsExactly("Aluno A aviso", "Aluno D atrasado");
        assertThat(nomes(listar(admin, "atualizacao=SEM_PASTA"))).containsExactly("Aluno C sem pasta");
        assertThat(nomes(listar(admin, "atualizacao=ENVIADA"))).isEmpty();
        assertThat(nomes(listar(admin, "plano=SEM"))).containsExactly("Aluno C sem pasta");
        assertThat(nomes(listar(admin, "plano=COM"))).containsExactly("Aluno A aviso", "Aluno B longe", "Aluno D atrasado");
        assertThat(nomes(listar(admin, "pasta=A_RENOVAR"))).containsExactly("Aluno A aviso", "Aluno D atrasado");
        // E entre filtros: plano em uso e fase NENHUMA; a renovar e aviso.
        assertThat(nomes(listar(admin, "plano=COM&atualizacao=NENHUMA"))).containsExactly("Aluno B longe");
        JsonNode combinado = listar(admin, "pasta=A_RENOVAR&atualizacao=AVISO");
        assertThat(nomes(combinado)).containsExactly("Aluno A aviso");
        assertThat(combinado.path("total").asLong()).isEqualTo(1);
        // A resposta continua igual: a linha traz a atualização da pasta vigente.
        assertThat(combinado.path("itens").get(0).path("atualizacao").path("fase").asString()).isEqualTo("AVISO");
    }

    @Test
    void registroNuncaEHaMaisDeNDiasSaoSeparados() throws Exception {
        UUID dez = aluno("Aluno registrou há 10 dias");
        registrarEm(dez, hoje.minusDays(10));
        UUID hojeAluno = aluno("Aluno registrou hoje");
        registrarEm(hojeAluno, hoje);
        aluno("Aluno nunca registrou");

        assertThat(nomes(listar(admin, "registro=NUNCA"))).containsExactly("Aluno nunca registrou");
        // HA_MAIS_DE_N não inclui quem nunca registrou (decisão de 31/10: isso é o NUNCA).
        assertThat(nomes(listar(admin, "registro=HA_MAIS_DE_7"))).containsExactly("Aluno registrou há 10 dias");
        assertThat(nomes(listar(admin, "registro=HA_MAIS_DE_14"))).isEmpty();
        assertThat(nomes(listar(admin, "registro=HA_MAIS_DE_30"))).isEmpty();
        // Acesso (no banco) e registro (calculado) juntos: só os dois que registraram têm acesso.
        assertThat(nomes(listar(admin, "registro=HA_MAIS_DE_7&acesso=COM"))).containsExactly("Aluno registrou há 10 dias");
    }

    @Test
    void comFiltroCalculadoOTotalEAPaginacaoContamSoQuemPassou() throws Exception {
        for (int i = 0; i < 33; i++) {
            aluno(String.format("Aluno sem pasta %02d", i));
        }
        UUID comPasta = aluno("Aluno com pasta");
        publicarNaPasta(comPasta, pasta(comPasta, hoje.minusDays(5), hoje.plusDays(20)));

        JsonNode primeira = listar(admin, "atualizacao=SEM_PASTA&pagina=0&tamanho=30");
        assertThat(primeira.path("total").asLong()).isEqualTo(33);
        assertThat(primeira.path("itens")).hasSize(30);
        assertThat(nomes(primeira).getFirst()).isEqualTo("Aluno sem pasta 00");
        JsonNode segunda = listar(admin, "atualizacao=SEM_PASTA&pagina=1&tamanho=30");
        assertThat(segunda.path("total").asLong()).isEqualTo(33);
        assertThat(nomes(segunda)).containsExactly("Aluno sem pasta 30", "Aluno sem pasta 31", "Aluno sem pasta 32");
        assertThat(listar(admin, "atualizacao=SEM_PASTA&pagina=5&tamanho=30").path("itens")).isEmpty();
        // Sem filtro calculado, a página sai do banco com o total de todos.
        assertThat(listar(admin, "pagina=1&tamanho=30").path("total").asLong()).isEqualTo(34);
    }

    @Test
    void semAPermissaoDoFiltroE403() throws Exception {
        aluno("Aluno qualquer");
        JsonNode soAlunos = membroCom(Set.of("ALUNO_LER"));
        assertThat(api.get("/alunos?atualizacao=ATRASADA", soAlunos, 403).path("codigo").asString()).isEqualTo("PERMISSAO_NEGADA");
        api.get("/alunos?plano=COM", soAlunos, 403);
        api.get("/alunos?pasta=A_RENOVAR", soAlunos, 403);
        api.get("/alunos?registro=NUNCA", soAlunos, 403);
        // Acesso e responsável não pedem permissão além da lista.
        assertThat(nomes(api.get("/alunos?acesso=SEM&responsavel=nenhum", soAlunos, 200))).containsExactly("Aluno qualquer");
        // Atualização pede as duas: sem a sensível, 403.
        JsonNode semSensivel = membroCom(Set.of("ALUNO_LER", "ATUALIZACAO_LER"));
        api.get("/alunos?atualizacao=SEM_PASTA", semSensivel, 403);
    }

    @Test
    void valorDesconhecidoE400SemRepetirOValor() throws Exception {
        for (String consulta : List.of("acesso=TALVEZ", "atualizacao=QUALQUERCOISA", "plano=TALVEZ", "pasta=VENCIDA",
                "registro=HA_MAIS_DE_3", "situacao=ALGUNS")) {
            JsonNode erro = api.get("/alunos?" + consulta, admin, 400);
            assertThat(erro.path("codigo").asString()).as(consulta).isEqualTo("FILTRO_INVALIDO");
            String valor = consulta.substring(consulta.indexOf('=') + 1);
            assertThat(erro.toString()).as(consulta).doesNotContain(valor);
        }
    }

    @Test
    void outraConsultoriaNuncaAparece() throws Exception {
        aluno("Aluno daqui sem acesso");
        JsonNode outro = api.novoTreinador();
        api.criarAluno(outro, "Aluno de lá sem acesso");

        for (String consulta : List.of("acesso=SEM", "responsavel=nenhum", "atualizacao=SEM_PASTA", "plano=SEM", "registro=NUNCA")) {
            assertThat(nomes(listar(admin, consulta))).as(consulta).containsExactly("Aluno daqui sem acesso");
            assertThat(nomes(listar(outro, consulta))).as(consulta).containsExactly("Aluno de lá sem acesso");
        }
    }

    private void registrarEm(UUID aluno, LocalDate dia) throws Exception {
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
        r.put("data", dia.toString());
        r.put("carga", "50");
        r.put("repeticoes", 8);
        r.put("concluida", true);
        r.put("alteradoNoAparelhoEm", Instant.now().toString());
        JsonNode resposta = api.post("/aluno/execucoes/lote", login, Map.of("registros", List.of(r)), 200);
        assertThat(resposta.path("resultados").get(0).path("situacao").asString()).isEqualTo("ACEITO");
    }
}
