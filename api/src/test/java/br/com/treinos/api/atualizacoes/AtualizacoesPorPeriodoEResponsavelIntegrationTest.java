package br.com.treinos.api.atualizacoes;

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

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * A lista de atualizações por período e por responsável (D14, D19 do plano do calendário): {@code de}/{@code ate} recortam
 * pela data da atualização (a data gravada ou o fim da pasta), {@code responsavel} escolhe o membro como o "Meus alunos"
 * escolhe o próprio usuário, e sem nenhum dos dois a lista é a de sempre. Dados fictícios, uma consultoria por teste.
 */
@AutoConfigureMockMvc
class AtualizacoesPorPeriodoEResponsavelIntegrationTest extends AbstractIntegrationTest {
    @org.springframework.beans.factory.annotation.Autowired
    private org.springframework.jdbc.core.JdbcTemplate banco;


    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    private ApiDeTeste api;
    private JsonNode admin;
    private JsonNode membro;
    private LocalDate hoje;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        hoje = LocalDate.now(Fuso.BRASILIA);
        String perfil = api.post("/perfis", admin, Map.of("nome", "Revisor de check-in",
                "permissoes", Set.of("PAINEL_VER", "ALUNO_LER", "ALUNO_SENSIVEL_LER", "ATUALIZACAO_LER")), 200)
                .path("id").asString();
        JsonNode convite = api.post("/usuarios/convites", admin, Map.of("nome", "Membro fictício",
                "email", ApiDeTeste.emailUnico("membro"), "perfilId", perfil), 200);
        membro = api.post("/publico/convites-equipe/aceitar", null,
                Map.of("codigo", convite.path("codigo").asString(), "senha", ApiDeTeste.SENHA), 200);
    }

    private static String id(JsonNode login) {
        return login.path("usuario").path("id").asString();
    }

    /** Aluno do responsável com uma pasta que termina em {@code fimDaPasta} e um treino publicado (a atualização nasce da pasta). */
    private UUID alunoDe(JsonNode responsavel, String nome, LocalDate fimDaPasta) throws Exception {
        JsonNode criado = api.post("/alunos", admin, Map.of("nome", nome, "responsavelId", id(responsavel)), 200);
        UUID aluno = UUID.fromString(criado.path("id").asString());
        String pasta = api.post("/alunos/" + aluno + "/pastas", admin,
                Map.of("titulo", "Período fictício", "inicio", fimDaPasta.minusDays(27), "fim", fimDaPasta), 200)
                .path("id").asString();
        JsonNode plano = api.post("/alunos/" + aluno + "/planos-treino", admin,
                Map.of("titulo", "Treino fictício", "pastaId", pasta), 200);
        String planoId = plano.path("plano").path("id").asString();
        JsonNode salvo = api.put("/planos-treino/" + planoId + "/rascunho", admin,
                ApiDeTeste.rascunho("Treino fictício", ApiDeTeste.treino().conteudo(), plano.path("plano").path("versao").asLong()), 200);
        api.post("/planos-treino/" + planoId + "/publicar", admin,
                Map.of("versao", salvo.path("plano").path("versao").asLong(), "confirmarAvisos", true), 200);
        return aluno;
    }

    private List<String> nomes(JsonNode quem, String consulta) throws Exception {
        List<String> nomes = new ArrayList<>();
        api.get("/atualizacoes?" + consulta, quem, 200).forEach(item -> nomes.add(item.path("nomeAluno").asString()));
        return nomes.stream().sorted().toList();
    }

    @Test
    void periodoRecortaPelaDataDaAtualizacaoEResponsavelPeloDono() throws Exception {
        alunoDe(admin, "Atrasado do administrador", hoje.minusDays(4));
        alunoDe(membro, "Atrasado do membro", hoje.minusDays(2));
        alunoDe(membro, "Próximo do membro", hoje.plusDays(3));
        alunoDe(admin, "Distante do administrador", hoje.plusDays(12));

        // Sem período nem responsável, a lista é a de sempre.
        assertThat(nomes(admin, "situacao=ATRASADAS")).containsExactly("Atrasado do administrador", "Atrasado do membro");
        assertThat(nomes(admin, "situacao=PROXIMAS")).containsExactly("Próximo do membro");

        // Período recorta pela data (inclusive as pontas).
        assertThat(nomes(admin, "situacao=ATRASADAS&de=" + hoje.minusDays(5) + "&ate=" + hoje.minusDays(3)))
                .containsExactly("Atrasado do administrador");
        assertThat(nomes(admin, "situacao=ATRASADAS&de=" + hoje.minusDays(4) + "&ate=" + hoje.minusDays(2)))
                .containsExactly("Atrasado do administrador", "Atrasado do membro");
        assertThat(nomes(admin, "situacao=ATRASADAS&de=" + hoje.minusDays(1) + "&ate=" + hoje)).isEmpty();

        // Em PROXIMAS o período substitui a janela de 7 dias.
        assertThat(nomes(admin, "situacao=PROXIMAS&de=" + hoje.plusDays(8) + "&ate=" + hoje.plusDays(20)))
                .containsExactly("Distante do administrador");
        assertThat(nomes(admin, "situacao=PROXIMAS&de=" + hoje + "&ate=" + hoje.plusDays(20)))
                .containsExactly("Distante do administrador", "Próximo do membro");

        // Responsável: o mesmo recorte do "Meus alunos", para qualquer membro.
        assertThat(nomes(admin, "situacao=ATRASADAS&responsavel=" + id(membro))).containsExactly("Atrasado do membro");
        assertThat(nomes(admin, "situacao=ATRASADAS&responsavel=" + id(admin))).containsExactly("Atrasado do administrador");
        assertThat(nomes(admin, "situacao=ATRASADAS&responsavel=" + id(membro)))
                .isEqualTo(nomes(membro, "situacao=ATRASADAS&meus=true"));
        assertThat(nomes(admin, "situacao=PROXIMAS&responsavel=" + id(admin))).isEmpty();
        assertThat(nomes(admin, "situacao=PROXIMAS&responsavel=" + id(admin) + "&de=" + hoje + "&ate=" + hoje.plusDays(20)))
                .containsExactly("Distante do administrador");
        assertThat(nomes(admin, "situacao=ATRASADAS&responsavel=" + id(membro) + "&de=" + hoje.minusDays(1) + "&ate=" + hoje))
                .isEmpty();
    }

    /** Aluno sem responsável, com a mesma pasta e treino de {@link #alunoDe}. */
    private UUID alunoSemResponsavel(String nome, LocalDate fimDaPasta) throws Exception {
        UUID aluno = alunoDe(admin, nome, fimDaPasta);
        // O cadastro sempre põe um responsável e nenhuma rota o tira: o teste o tira direto no banco.
        banco.update("update aluno set responsavel_id = null where id = ?", aluno);
        return aluno;
    }

    @Test
    void responsavelRepetivelSemResponsavelEBuscaSemAcento() throws Exception {
        alunoDe(admin, "Álvaro do administrador", hoje.minusDays(4));
        alunoDe(membro, "Bárbara do membro", hoje.minusDays(3));
        alunoSemResponsavel("Cássio sem responsável", hoje.minusDays(2));

        assertThat(nomes(admin, "situacao=ATRASADAS&responsavel=" + id(admin) + "&responsavel=" + id(membro)))
                .containsExactly("Bárbara do membro", "Álvaro do administrador");
        assertThat(nomes(admin, "situacao=ATRASADAS&responsavel=nenhum")).containsExactly("Cássio sem responsável");
        // Vírgula vale como repetição.
        assertThat(nomes(admin, "situacao=ATRASADAS&responsavel=" + id(membro) + ",nenhum"))
                .containsExactly("Bárbara do membro", "Cássio sem responsável");
        // Busca pelo nome sem acento e sem caixa, combinada (E) com o responsável e o período.
        assertThat(nomes(admin, "situacao=ATRASADAS&busca=alvaro")).containsExactly("Álvaro do administrador");
        assertThat(nomes(admin, "situacao=ATRASADAS&busca=BARBARA&responsavel=nenhum")).isEmpty();
        assertThat(nomes(admin, "situacao=ATRASADAS&busca=do&de=" + hoje.minusDays(3) + "&ate=" + hoje))
                .containsExactly("Bárbara do membro");
        assertThat(nomes(admin, "situacao=ATRASADAS&busca=100%")).isEmpty();
    }

    @Test
    void contagensSeguemOsMesmosFiltrosDaLista() throws Exception {
        alunoDe(admin, "Atrasado do administrador", hoje.minusDays(4));
        alunoDe(membro, "Atrasado do membro", hoje.minusDays(2));
        alunoDe(membro, "Próximo do membro", hoje.plusDays(3));

        JsonNode todas = api.get("/atualizacoes/contagens", admin, 200);
        assertThat(todas.path("ATRASADAS").asLong()).isEqualTo(2);
        assertThat(todas.path("PROXIMAS").asLong()).isEqualTo(1);
        assertThat(todas.path("PARA_REVISAR").asLong()).isZero();
        JsonNode doMembro = api.get("/atualizacoes/contagens?responsavel=" + id(membro), admin, 200);
        assertThat(doMembro.path("ATRASADAS").asLong()).isEqualTo(1);
        assertThat(doMembro.path("PROXIMAS").asLong()).isEqualTo(1);
        assertThat(api.get("/atualizacoes/contagens?meus=true", membro, 200)).isEqualTo(doMembro);
        assertThat(api.get("/atualizacoes/contagens?busca=administrador", admin, 200).path("ATRASADAS").asLong()).isEqualTo(1);
        assertThat(api.get("/atualizacoes/contagens?de=" + hoje.minusDays(3) + "&ate=" + hoje, admin, 200)
                .path("ATRASADAS").asLong()).isEqualTo(1);
        // Cada número é o tamanho da lista com os mesmos filtros.
        for (String situacao : AtualizacaoService.SITUACOES) {
            assertThat(nomes(admin, "situacao=" + situacao + "&responsavel=" + id(membro)))
                    .hasSize((int) doMembro.path(situacao).asLong());
        }
        // Recusas e permissão iguais às da lista; outra consultoria não conta nada daqui.
        api.get("/atualizacoes/contagens?meus=true&responsavel=nenhum", admin, 400);
        api.get("/atualizacoes/contagens?de=" + hoje, admin, 400);
        api.get("/atualizacoes/contagens?responsavel=" + UUID.randomUUID(), admin, 404);
        JsonNode outro = api.novoTreinador();
        assertThat(api.get("/atualizacoes/contagens", outro, 200).path("ATRASADAS").asLong()).isZero();
    }

    @Test
    void recusaPedidosMalFormados() throws Exception {
        // meus junto com responsavel
        assertThat(api.get("/atualizacoes?situacao=ATRASADAS&meus=true&responsavel=" + id(membro), admin, 400)
                .path("codigo").asString()).isEqualTo("FILTRO_INVALIDO");
        // período pela metade, invertido ou grande demais
        assertThat(api.get("/atualizacoes?situacao=ATRASADAS&de=" + hoje, admin, 400).path("codigo").asString())
                .isEqualTo("PERIODO_INVALIDO");
        assertThat(api.get("/atualizacoes?situacao=ATRASADAS&ate=" + hoje, admin, 400).path("codigo").asString())
                .isEqualTo("PERIODO_INVALIDO");
        assertThat(api.get("/atualizacoes?situacao=ATRASADAS&de=" + hoje + "&ate=" + hoje.minusDays(1), admin, 400)
                .path("codigo").asString()).isEqualTo("PERIODO_INVALIDO");
        assertThat(api.get("/atualizacoes?situacao=ATRASADAS&de=" + hoje + "&ate=" + hoje.plusDays(366), admin, 400)
                .path("codigo").asString()).isEqualTo("PERIODO_INVALIDO");
        // 366 dias (as duas pontas) é o máximo e passa
        api.get("/atualizacoes?situacao=ATRASADAS&de=" + hoje + "&ate=" + hoje.plusDays(365), admin, 200);
        // data que não é data
        api.get("/atualizacoes?situacao=ATRASADAS&de=ontem&ate=hoje", admin, 400);
        // responsável que não é id nem "nenhum", sem repetir o valor
        JsonNode r = api.get("/atualizacoes?situacao=ATRASADAS&responsavel=alguem", admin, 400);
        assertThat(r.path("codigo").asString()).isEqualTo("FILTRO_INVALIDO");
        assertThat(r.toString()).doesNotContain("alguem");
        // meus junto de "nenhum" também é recusado
        assertThat(api.get("/atualizacoes?situacao=ATRASADAS&meus=true&responsavel=nenhum", admin, 400)
                .path("codigo").asString()).isEqualTo("FILTRO_INVALIDO");
        // mais de 50 valores
        StringBuilder muitos = new StringBuilder();
        for (int i = 0; i < 51; i++) muitos.append("&responsavel=").append(UUID.randomUUID());
        assertThat(api.get("/atualizacoes?situacao=ATRASADAS" + muitos, admin, 400).path("codigo").asString())
                .isEqualTo("FILTRO_INVALIDO");
    }

    @Test
    void responsavelPrecisaSerMembroDestaConsultoria() throws Exception {
        UUID aluno = alunoDe(admin, "Aluno qualquer", hoje.minusDays(2));
        // inexistente
        api.get("/atualizacoes?situacao=ATRASADAS&responsavel=" + UUID.randomUUID(), admin, 404);
        // o login do próprio aluno não é da equipe
        JsonNode loginDoAluno = api.convidarEEntrar(admin, aluno);
        api.get("/atualizacoes?situacao=ATRASADAS&responsavel=" + id(loginDoAluno), admin, 404);
        // membro de outra consultoria
        JsonNode outro = api.novoTreinador();
        api.get("/atualizacoes?situacao=ATRASADAS&responsavel=" + id(outro), admin, 404);
        // e o outro treinador não enxerga nada daqui, nem pedindo o responsável de lá
        assertThat(nomes(outro, "situacao=ATRASADAS&responsavel=" + id(outro))).isEmpty();
        api.get("/atualizacoes?situacao=ATRASADAS&responsavel=" + id(admin), outro, 404);
    }
}
