package br.com.treinos.api.pagamentos;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static br.com.treinos.api.pagamentos.ContratoDeTeste.HOJE;
import static br.com.treinos.api.pagamentos.ContratoDeTeste.corpo;
import static br.com.treinos.api.pagamentos.ContratoDeTeste.entrada;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * {@code GET /financeiro/alunos-em-atraso} (V098, D8): os alunos com ao menos uma cobrança ABERTA vencida (Brasília), com o mesmo
 * "meus" dos inadimplentes. Só ids, nunca nome nem valor. Só dados fictícios; cada teste cria a própria consultoria.
 */
@AutoConfigureMockMvc
class AlunosEmAtrasoIntegrationTest extends AbstractIntegrationTest {

    private static final String ROTA = "/financeiro/alunos-em-atraso";

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;

    private ApiDeTeste api;
    private JsonNode admin;
    private JsonNode leitor;
    private ContratoDeTeste contrato;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        leitor = membro(Set.of("FINANCEIRO_LER", "ALUNO_LER"));
        contrato = new ContratoDeTeste(api, admin);
    }

    private JsonNode membro(Set<String> permissoes) throws Exception {
        String perfil = api.post("/perfis", admin, Map.of("nome", "Perfil " + UUID.randomUUID(), "permissoes", permissoes), 200)
                .get("id").asString();
        JsonNode convite = api.post("/usuarios/convites", admin, Map.of("nome", "Membro fictício",
                "email", ApiDeTeste.emailUnico("membro"), "perfilId", perfil), 200);
        return api.post("/publico/convites-equipe/aceitar", null,
                Map.of("codigo", convite.get("codigo").asString(), "senha", ApiDeTeste.SENHA), 200);
    }

    private static String idDe(JsonNode login) {
        return login.path("usuario").path("id").asString();
    }

    /** Aluno do responsável com uma entrada em aberto vencendo em {@code vencimento}. */
    private UUID alunoComEntrada(JsonNode quem, JsonNode responsavel, LocalDate vencimento, boolean paga) throws Exception {
        UUID aluno = UUID.fromString(api.post("/alunos", quem, Map.of("nome", "Aluno Fictício " + UUID.randomUUID(),
                "responsavelId", idDe(responsavel)), 200).get("id").asString());
        ContratoDeTeste c = new ContratoDeTeste(api, quem);
        c.contratar(aluno, corpo(c.plano("MENSAL"), "SALDO_ABERTO", 10_000L, entrada(2_000, vencimento, paga, null), null), 200);
        return aluno;
    }

    private List<String> alunos(JsonNode quem, String consulta) throws Exception {
        List<String> ids = new ArrayList<>();
        api.get(ROTA + consulta, quem, 200).get("alunoIds").forEach(i -> ids.add(i.asString()));
        return ids;
    }

    @Test
    void listaSoQuemTemAbertaVencidaECadaAlunoUmaVezSo() throws Exception {
        UUID atrasado = alunoComEntrada(admin, admin, HOJE.minusDays(3), false);
        UUID venceHoje = alunoComEntrada(admin, admin, HOJE, false);
        UUID aVencer = alunoComEntrada(admin, admin, HOJE.plusDays(5), false);
        UUID quitado = alunoComEntrada(admin, admin, HOJE.minusDays(3), true);
        // Segunda vencida do mesmo aluno: ele continua aparecendo uma vez.
        api.post("/contratacoes/" + contrato.contratacao(atrasado).get("id").asString() + "/pagamentos-do-saldo", admin,
                Map.of("pedidoId", UUID.randomUUID().toString(), "valorCentavos", 1_000, "vencimento", HOJE.minusDays(1).toString()), 201);

        JsonNode resposta = api.get(ROTA, admin, 200);
        List<String> ids = alunos(admin, "");

        assertThat(ids).containsExactly(atrasado.toString());
        assertThat(ids).doesNotContain(venceHoje.toString(), aVencer.toString(), quitado.toString());
        assertThat(resposta.get("truncado").asBoolean()).isFalse();
        assertThat(resposta.toString()).as("só ids: nada de nome nem valor").doesNotContain("Aluno Fictício").doesNotContain("valor");
    }

    @Test
    void cobrancaCanceladaOuPagaDepoisTiraOAlunoDaLista() throws Exception {
        UUID aluno = alunoComEntrada(admin, admin, HOJE.minusDays(2), false);
        assertThat(alunos(admin, "")).containsExactly(aluno.toString());

        JsonNode entrada = contrato.doTipo(aluno, "AVULSA").get(0);
        contrato.baixar(entrada);

        assertThat(alunos(admin, "")).isEmpty();
    }

    @Test
    void meusFiltraPeloResponsavelComoOsInadimplentes() throws Exception {
        UUID doAdmin = alunoComEntrada(admin, admin, HOJE.minusDays(2), false);
        UUID doLeitor = alunoComEntrada(admin, leitor, HOJE.minusDays(2), false);

        assertThat(alunos(admin, "?meus=false")).containsExactlyInAnyOrder(doAdmin.toString(), doLeitor.toString());
        assertThat(alunos(admin, "?meus=true")).containsExactly(doAdmin.toString());
        assertThat(alunos(leitor, "?meus=true")).containsExactly(doLeitor.toString());
        assertThat(alunos(leitor, "")).containsExactlyInAnyOrder(doAdmin.toString(), doLeitor.toString());
    }

    @Test
    void outraConsultoriaNuncaEntraNemVeAsDeOutra() throws Exception {
        UUID aluno = alunoComEntrada(admin, admin, HOJE.minusDays(2), false);
        JsonNode outro = api.novoTreinador();
        UUID doOutro = alunoComEntrada(outro, outro, HOJE.minusDays(4), false);

        assertThat(alunos(admin, "")).containsExactly(aluno.toString());
        assertThat(alunos(outro, "")).containsExactly(doOutro.toString());
    }

    @Test
    void semAsDuasPermissoesDeLeituraDa403() throws Exception {
        api.get(ROTA, membro(Set.of("ALUNO_LER")), 403);
        api.get(ROTA, membro(Set.of("FINANCEIRO_LER", "ALUNO_LER")), 200);
        // Sem login.
        api.get(ROTA, null, 401);
    }
}
