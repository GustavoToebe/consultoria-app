package br.com.treinos.api.numeros;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.LimiteDoTreinadorDeTeste;
import br.com.treinos.api.LimiteDoTreinadorDeTeste.Membro;
import br.com.treinos.api.web.Fuso;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * A tabela da supervisão em Números (D1, D16): {@code equipe} traz uma linha por membro ativo, com os alunos ativos, o limite
 * ao lado e as atualizações atrasadas e para revisar; {@code semResponsavel} traz as mesmas contagens dos alunos sem
 * responsável. Só contagens: nenhum nome nem id de aluno. As atualizações ficam {@code null} sem
 * {@code ATUALIZACAO_LER} e {@code ALUNO_SENSIVEL_LER}, como o resto de Números. Cada linha da {@code equipe} tem
 * {@code usuarioId, nome, limiteDeAlunos, alunosAtivos, atualizacoesAtrasadas, atualizacoesParaRevisar}. Só dados fictícios.
 */
@AutoConfigureMockMvc
class SupervisaoDaEquipeNumerosIntegrationTest extends AbstractIntegrationTest {

    private static final String CONTEUDO = """
        {"formato":2,"instrucoes":[],"secoes":[{"uid":"s1","titulo":"Geral","perguntas":[
          {"id":"sono","tipo":"NOTA","rotulo":"Sono","obrigatoria":false}]}]}
        """;

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate banco;

    private ApiDeTeste api;
    private JsonNode admin;
    private LimiteDoTreinadorDeTeste lim;
    private UUID consultoria;
    private LocalDate hoje;

    /** Cenário: m1 (limite 5) com 4 ativos (1 atrasada, 1 para revisar, 1 revisada) e 1 inativo; m2 sem alunos e sem limite. */
    private Membro m1;
    private Membro m2;
    private Membro inativo;
    private final List<UUID> alunosDoCenario = new ArrayList<>();
    private final List<String> nomesDoCenario = new ArrayList<>();
    private UUID doAdmin;
    private UUID semResponsavel;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        lim = new LimiteDoTreinadorDeTeste(api, admin, banco);
        hoje = LocalDate.now(Fuso.BRASILIA);
        consultoria = banco.queryForObject("select consultoria_id from usuario where id = ?::uuid", UUID.class, lim.idDoAdmin());

        m1 = lim.membro();
        m2 = lim.membro();
        inativo = lim.membro();
        lim.limite(m1, 5);
        UUID versao = versaoDoQuestionario();

        UUID atrasada = guardar(lim.aluno(m1));
        UUID paraRevisar = guardar(lim.aluno(m1));
        UUID revisada = guardar(lim.aluno(m1));
        guardar(lim.aluno(m1));
        UUID dormente = guardar(lim.aluno(m1));
        lim.inativar(dormente);
        atualizacao(atrasada, versao, hoje.minusDays(3), null, "ABERTA");
        atualizacao(paraRevisar, versao, hoje, Timestamp.from(Instant.now()), "ENVIADA");
        atualizacao(revisada, versao, hoje, Timestamp.from(Instant.now()), "REVISADA");

        doAdmin = guardar(lim.aluno(null));
        semResponsavel = guardar(lim.aluno(null));
        banco.update("update aluno set responsavel_id = null where id = ?", semResponsavel);
        atualizacao(semResponsavel, versao, hoje, Timestamp.from(Instant.now()), "ENVIADA");

        // Membro desativado some da tabela (D16).
        String perfil = null;
        for (JsonNode u : api.get("/usuarios", admin, 200)) {
            if (inativo.id().equals(u.path("id").asString())) {
                perfil = u.path("perfilId").asString();
            }
        }
        api.put("/usuarios/" + inativo.id(), admin, Map.of("nome", inativo.nome(), "perfilId", perfil, "ativo", false), 200);
    }

    private UUID guardar(UUID aluno) {
        alunosDoCenario.add(aluno);
        nomesDoCenario.add(lim.nomeDe(aluno));
        return aluno;
    }

    private UUID versaoDoQuestionario() {
        UUID q = UUID.randomUUID();
        UUID v = UUID.randomUUID();
        banco.update("insert into questionario(id,consultoria_id,nome,rascunho,versao_publicada,publicado_em) "
                + "values (?,?,?,?::jsonb,1,now())", q, consultoria, "Fictício " + q, CONTEUDO);
        banco.update("insert into questionario_versao(id,consultoria_id,questionario_id,numero,conteudo) "
                + "values (?,?,?,1,?::jsonb)", v, consultoria, q, CONTEUDO);
        return v;
    }

    /** Uma pasta com treino publicado (a vigente do aluno) e a atualização dela no estado dado. */
    private void atualizacao(UUID aluno, UUID versao, LocalDate data, Timestamp enviadaEm, String estado) {
        UUID pasta = UUID.randomUUID();
        banco.update("insert into pasta_plano(id,consultoria_id,aluno_id,titulo,inicio,fim) values (?,?,?,'Período fictício',?,?)",
                pasta, consultoria, aluno, data.minusDays(27), data);
        banco.update("insert into atualizacao(id,consultoria_id,aluno_id,pasta_id,data_atualizacao,estado,respostas,enviada_em,"
                        + "atraso_ate,questionario_versao_id) values (?,?,?,?,?,?,'{}'::jsonb,?,null,?)",
                UUID.randomUUID(), consultoria, aluno, pasta, data, estado, enviadaEm, enviadaEm == null ? null : versao);
        banco.update("insert into plano_treino(id,consultoria_id,aluno_id,titulo,fim,rascunho,versao_publicada,publicado_em,pasta_id) "
                + "values (?,?,?,'Plano fictício',?,'{}'::jsonb,1,now(),?)", UUID.randomUUID(), consultoria, aluno, data, pasta);
    }

    private JsonNode linha(JsonNode numeros, Membro de) {
        for (JsonNode l : numeros.path("equipe")) {
            if (de.id().equals(l.path("usuarioId").asString())) {
                return l;
            }
        }
        throw new AssertionError("Sem linha para o membro.");
    }

    private JsonNode membroComPermissoes(Set<String> permissoes) throws Exception {
        return lim.membro(permissoes).login();
    }

    @Test
    void umaLinhaPorMembroAtivoComContagemELimiteAoLado() throws Exception {
        JsonNode corpo = api.get("/numeros", admin, 200);
        assertThat(corpo.path("meses")).hasSize(6); // o resto de Números não muda

        // Administrador, m1 e m2: o desativado não aparece.
        List<String> ids = new ArrayList<>();
        corpo.path("equipe").forEach(l -> ids.add(l.path("usuarioId").asString()));
        assertThat(ids).containsExactlyInAnyOrder(lim.idDoAdmin(), m1.id(), m2.id());

        JsonNode l1 = linha(corpo, m1);
        assertThat(l1.path("nome").asString()).isEqualTo(m1.nome());
        assertThat(l1.path("alunosAtivos").asLong()).isEqualTo(4); // o inativo não conta
        assertThat(l1.path("limiteDeAlunos").asInt()).isEqualTo(5);
        assertThat(l1.path("atualizacoesAtrasadas").asLong()).isEqualTo(1);
        assertThat(l1.path("atualizacoesParaRevisar").asLong()).isEqualTo(1); // a revisada não conta

        JsonNode l2 = linha(corpo, m2);
        assertThat(l2.path("alunosAtivos").asLong()).isZero();
        assertThat(l2.has("limiteDeAlunos")).isTrue();
        assertThat(l2.path("limiteDeAlunos").isNull()).as("sem limite").isTrue();
        assertThat(l2.path("atualizacoesAtrasadas").asLong()).isZero();
        assertThat(l2.path("atualizacoesParaRevisar").asLong()).isZero();

        JsonNode lAdmin = linha(corpo, new Membro(admin, lim.idDoAdmin(), "", ""));
        assertThat(lAdmin.path("alunosAtivos").asLong()).isEqualTo(1);
        assertThat(lAdmin.path("limiteDeAlunos").isNull()).isTrue();

        // A linha "Sem responsável": os alunos ativos sem ninguém.
        JsonNode sem = corpo.path("semResponsavel");
        assertThat(sem.path("alunosAtivos").asLong()).isEqualTo(1);
        assertThat(sem.path("atualizacoesAtrasadas").asLong()).isZero();
        assertThat(sem.path("atualizacoesParaRevisar").asLong()).isEqualTo(1);
    }

    @Test
    void limiteApagadoOuMudadoApareceNaMesmaHora() throws Exception {
        lim.limite(m1, 0);
        assertThat(linha(api.get("/numeros", admin, 200), m1).path("limiteDeAlunos").asInt()).isZero();
        lim.limite(m1, null);
        assertThat(linha(api.get("/numeros", admin, 200), m1).path("limiteDeAlunos").isNull()).isTrue();
    }

    /** D16: como o resto de Números, as duas contagens de atualização exigem ATUALIZACAO_LER e ALUNO_SENSIVEL_LER. */
    @Test
    void atualizacoesFicamNulasSemAsDuasPermissoes() throws Exception {
        JsonNode soPainel = api.get("/numeros", membroComPermissoes(Set.of("PAINEL_VER", "EQUIPE_LER")), 200);
        // ATUALIZACAO_LER exige ALUNO_SENSIVEL_LER; o perfil sem ATUALIZACAO_LER mas com o dado sensível também fica nulo.
        JsonNode soSensivel = api.get("/numeros", membroComPermissoes(Set.of("PAINEL_VER", "EQUIPE_LER", "ALUNO_LER", "ALUNO_SENSIVEL_LER")), 200);
        JsonNode completo = api.get("/numeros", membroComPermissoes(
                Set.of("PAINEL_VER", "EQUIPE_LER", "ALUNO_LER", "ALUNO_SENSIVEL_LER", "ATUALIZACAO_LER")), 200);

        for (JsonNode corpo : new JsonNode[] {soPainel, soSensivel}) {
            JsonNode l1 = linha(corpo, m1);
            assertThat(l1.has("atualizacoesAtrasadas")).isTrue();
            assertThat(l1.path("atualizacoesAtrasadas").isNull()).isTrue();
            assertThat(l1.path("atualizacoesParaRevisar").isNull()).isTrue();
            assertThat(l1.path("alunosAtivos").asLong()).isEqualTo(4); // as contagens de alunos seguem abertas
            assertThat(l1.path("limiteDeAlunos").asInt()).isEqualTo(5);
            assertThat(corpo.path("semResponsavel").path("atualizacoesParaRevisar").isNull()).isTrue();
            assertThat(corpo.path("semResponsavel").path("alunosAtivos").asLong()).isEqualTo(1);
        }
        assertThat(linha(completo, m1).path("atualizacoesParaRevisar").asLong()).isEqualTo(1);
        assertThat(completo.path("semResponsavel").path("atualizacoesParaRevisar").asLong()).isEqualTo(1);

        api.get("/numeros", membroComPermissoes(Set.of("ALUNO_LER")), 403);
    }

    /** A supervisão é do dono (Gustavo, 03/11): sem EQUIPE_LER os dois campos saem nulos, não listas vazias; o resto de Números segue. */
    @Test
    void equipeESemResponsavelSoSaemComEquipeLer() throws Exception {
        JsonNode soPainel = api.get("/numeros", membroComPermissoes(Set.of("PAINEL_VER", "ALUNO_LER")), 200);
        assertThat(soPainel.has("equipe")).isTrue();
        assertThat(soPainel.path("equipe").isNull()).isTrue();
        assertThat(soPainel.has("semResponsavel")).isTrue();
        assertThat(soPainel.path("semResponsavel").isNull()).isTrue();
        assertThat(soPainel.path("meses")).hasSize(6);
        assertThat(soPainel.toString()).doesNotContain(m1.id()).doesNotContain(m1.nome());

        JsonNode comEquipe = api.get("/numeros", membroComPermissoes(Set.of("PAINEL_VER", "EQUIPE_LER")), 200);
        assertThat(comEquipe.path("equipe").isArray()).isTrue();
        assertThat(linha(comEquipe, m1).path("alunosAtivos").asLong()).isEqualTo(4);
        assertThat(comEquipe.path("semResponsavel").path("alunosAtivos").asLong()).isEqualTo(1);

        JsonNode oAdmin = api.get("/numeros", admin, 200);
        assertThat(oAdmin.path("equipe").isArray()).isTrue();
        assertThat(oAdmin.path("semResponsavel").isObject()).isTrue();
    }

    @Test
    void nenhumNomeNemIdDeAlunoNaResposta() throws Exception {
        String corpo = api.get("/numeros", admin, 200).toString();
        for (String nome : nomesDoCenario) {
            assertThat(corpo).doesNotContain(nome);
        }
        for (UUID aluno : alunosDoCenario) {
            assertThat(corpo).doesNotContain(aluno.toString());
        }
        assertThat(alunosDoCenario).contains(doAdmin, semResponsavel);
        // Os dados do membro, sim: é a tabela da equipe.
        assertThat(corpo).contains(m1.nome()).contains(m1.id());
        assertThat(corpo).doesNotContain(inativo.nome()).doesNotContain(inativo.id());
    }

    @Test
    void outraConsultoriaNaoEntraNaTabelaNemVeAEquipeDaqui() throws Exception {
        JsonNode estranho = api.novoTreinador();
        LimiteDoTreinadorDeTeste deles = new LimiteDoTreinadorDeTeste(api, estranho, banco);
        deles.aluno(null);
        JsonNode corpo = api.get("/numeros", estranho, 200);
        assertThat(corpo.path("equipe")).hasSize(1);
        assertThat(corpo.path("equipe").get(0).path("usuarioId").asString()).isEqualTo(deles.idDoAdmin());
        assertThat(corpo.path("equipe").get(0).path("alunosAtivos").asLong()).isEqualTo(1);
        assertThat(corpo.path("semResponsavel").path("alunosAtivos").asLong()).isZero();
        assertThat(corpo.toString()).doesNotContain(m1.id()).doesNotContain(m1.nome());

        // E o que o outro fez não mexe na contagem daqui.
        assertThat(linha(api.get("/numeros", admin, 200), m1).path("alunosAtivos").asLong()).isEqualTo(4);
    }

    @Test
    void semLoginResponde401() throws Exception {
        api.get("/numeros", null, 401);
    }
}
