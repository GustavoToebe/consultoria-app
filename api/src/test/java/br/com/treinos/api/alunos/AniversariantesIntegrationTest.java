package br.com.treinos.api.alunos;

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
import java.time.MonthDay;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Aniversariantes do Início (plano {@code docs/planos/aniversarios.md}): só com {@code ALUNO_LER}, janelas 0/3/7/15, aluno ativo
 * da consultoria, resposta sem ano nem idade. Cada teste cria a própria consultoria; só dados fictícios. A virada de ano e o 29/02
 * ficam no {@link AniversariantesRegraTest}, porque dependem do dia de hoje.
 */
@AutoConfigureMockMvc
class AniversariantesIntegrationTest extends AbstractIntegrationTest {

    private static final String ROTA = "/alunos/aniversariantes";
    /** 2000 é bissexto: o dia e o mês de hoje + n viram data de nascimento sem perder o 29/02. */
    private static final int ANO_BASE = 2000;

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate banco;
    private ApiDeTeste api;
    private JsonNode treinador;
    private final LocalDate hoje = LocalDate.now(Fuso.BRASILIA);

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        treinador = api.novoTreinador();
    }

    private String criar(JsonNode quem, String nome, int diasAteOAniversario) throws Exception {
        Map<String, Object> c = new LinkedHashMap<>();
        c.put("nome", nome);
        c.put("dataNascimento", MonthDay.from(hoje.plusDays(diasAteOAniversario)).atYear(ANO_BASE).toString());
        return api.post("/alunos", quem, c, 200).path("id").asString();
    }

    private List<String> nomes(JsonNode quem, String consulta) throws Exception {
        List<String> nomes = new ArrayList<>();
        api.get(ROTA + consulta, quem, 200).forEach(a -> nomes.add(a.path("nome").asString()));
        return nomes;
    }

    @Test
    void janelasDe0_3_7_15DiasTrazOsMaisProximosPrimeiroSemAnoNemIdade() throws Exception {
        for (int d : new int[] {16, 15, 8, 7, 3, 0, 1}) {
            criar(treinador, "Aluno " + d, d);
        }
        assertThat(nomes(treinador, "?dias=0")).containsExactly("Aluno 0");
        assertThat(nomes(treinador, "?dias=3")).containsExactly("Aluno 0", "Aluno 1", "Aluno 3");
        assertThat(nomes(treinador, "?dias=7")).containsExactly("Aluno 0", "Aluno 1", "Aluno 3", "Aluno 7");
        assertThat(nomes(treinador, "?dias=15")).containsExactly("Aluno 0", "Aluno 1", "Aluno 3", "Aluno 7", "Aluno 8", "Aluno 15");

        JsonNode hojeNode = api.get(ROTA + "?dias=0", treinador, 200).get(0);
        assertThat(hojeNode.propertyNames()).containsExactlyInAnyOrder("alunoId", "nome", "dia", "mes", "diasAte");
        assertThat(hojeNode.path("dia").asInt()).isEqualTo(hoje.getDayOfMonth());
        assertThat(hojeNode.path("mes").asInt()).isEqualTo(hoje.getMonthValue());
        assertThat(hojeNode.path("diasAte").asInt()).isZero();
        assertThat(api.get(ROTA + "?dias=7", treinador, 200).get(3).path("diasAte").asInt()).isEqualTo(7);
    }

    @Test
    void soAlunoAtivoNaoAnonimizadoSemDataNaoApareceEOutraConsultoriaNaoVe() throws Exception {
        criar(treinador, "Aluno ativo", 1);
        String inativo = criar(treinador, "Aluno inativo", 1);
        String anonimizado = criar(treinador, "Aluno anonimizado", 1);
        api.post("/alunos", treinador, Map.of("nome", "Aluno sem data"), 200);

        api.patch("/alunos/" + inativo + "/situacao", treinador, Map.of("ativo", false), 200);
        api.patch("/alunos/" + anonimizado + "/situacao", treinador, Map.of("ativo", false), 200);
        String nome = api.get("/alunos/" + anonimizado, treinador, 200).path("nome").asString();
        api.post("/alunos/" + anonimizado + "/anonimizar", treinador, Map.of("nomeConfirmado", nome), 200);

        assertThat(nomes(treinador, "?dias=3")).containsExactly("Aluno ativo");

        JsonNode outra = api.novoTreinador();
        criar(outra, "Aluno da outra", 2);
        assertThat(nomes(outra, "?dias=3")).containsExactly("Aluno da outra");
        assertThat(nomes(treinador, "?dias=3")).containsExactly("Aluno ativo");
    }

    /** Mesmo critério do {@code ativosDoEscopo}: "meus" = responsável igual a quem pede, então sem responsável fica só no geral. */
    @Test
    void alunoSemResponsavelEntraNoGeralMasNaoEmMeus() throws Exception {
        String semResponsavel = criar(treinador, "Aluno sem responsável", 2);
        criar(treinador, "Aluno do treinador", 2);
        banco.update("update aluno set responsavel_id = null where id = ?::uuid", semResponsavel);

        assertThat(nomes(treinador, "?dias=3&meus=false")).containsExactlyInAnyOrder("Aluno sem responsável", "Aluno do treinador");
        assertThat(nomes(treinador, "?dias=3&meus=true")).containsExactly("Aluno do treinador");
    }

    /** Sozinho (ativo, com data), para provar que o filtro de anonimizado pesa por si e não pelo de ativo. */
    @Test
    void alunoAnonimizadoNuncaApareceMesmoAtivoEComDataPreenchida() throws Exception {
        String id = criar(treinador, "Aluno anonimizado isolado", 1);
        assertThat(nomes(treinador, "?dias=3")).containsExactly("Aluno anonimizado isolado");
        banco.update("update aluno set anonimizado_em = now() where id = ?::uuid", id);

        assertThat(nomes(treinador, "?dias=3")).isEmpty();
        assertThat(nomes(treinador, "?dias=3&meus=true")).isEmpty();
    }

    @Test
    void meusFiltraPeloResponsavel() throws Exception {
        criar(treinador, "Aluno do treinador", 2);
        JsonNode outroMembro = membro(Set.of("ALUNO_LER", "ALUNO_ALTERAR"));
        criar(outroMembro, "Aluno do outro membro", 2);

        assertThat(nomes(treinador, "?dias=3")).containsExactlyInAnyOrder("Aluno do treinador", "Aluno do outro membro");
        assertThat(nomes(treinador, "?dias=3&meus=true")).containsExactly("Aluno do treinador");
        assertThat(nomes(outroMembro, "?dias=3&meus=true")).containsExactly("Aluno do outro membro");
    }

    @Test
    void semAlunoLerOuComoAlunoDa403EDiasForaDaListaDa400() throws Exception {
        criar(treinador, "Aluno fictício", 0);
        api.get(ROTA + "?dias=7", membro(Set.of("REGISTRO_LER")), 403);
        UUID comAcesso = api.criarAluno(treinador, "Aluno com acesso");
        api.get(ROTA + "?dias=7", api.convidarEEntrar(treinador, comAcesso), 403);
        api.get(ROTA + "?dias=7", membro(Set.of("ALUNO_LER")), 200);

        for (String ruim : new String[] {"?dias=1", "?dias=-3", "?dias=30", "?dias=abc", "", "?dias="}) {
            api.get(ROTA + ruim, treinador, 400);
        }
    }

    private JsonNode membro(Set<String> permissoes) throws Exception {
        String perfil = api.post("/perfis", treinador, Map.of("nome", "Perfil " + UUID.randomUUID(), "permissoes", permissoes), 200)
                .get("id").asString();
        JsonNode convite = api.post("/usuarios/convites", treinador,
                Map.of("nome", "Membro fictício", "email", ApiDeTeste.emailUnico("membro"), "perfilId", perfil), 200);
        return api.post("/publico/convites-equipe/aceitar", null,
                Map.of("codigo", convite.get("codigo").asString(), "senha", ApiDeTeste.SENHA), 200);
    }
}
