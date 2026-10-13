package br.com.treinos.api.atualizacoes;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.dieta.ConteudoDieta;
import br.com.treinos.api.web.Fuso;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Os quatro contadores do painel e as listas que eles abrem têm de bater, com e sem "Meus alunos".
 * Dados fictícios: dois responsáveis, alunos com e sem linha de atualização gravada (a linha nasce no primeiro
 * envio ou aviso de atraso; antes disso a data vem do fim da pasta).
 */
@AutoConfigureMockMvc
class PainelEListaDeAtualizacoesIntegrationTest extends AbstractIntegrationTest {
    private static final String[] SITUACOES = {"PARA_REVISAR", "ATRASADAS", "AVISARAM_ATRASO", "PROXIMAS"};
    private static final Map<String, String> CAMPO_DO_PAINEL = Map.of(
            "PARA_REVISAR", "atualizacoesParaRevisar", "ATRASADAS", "atualizacoesAtrasadas",
            "AVISARAM_ATRASO", "atualizacoesAvisaramAtraso", "PROXIMAS", "atualizacoesProximas");

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
        membro = api.post("/publico/convites-equipe/" + convite.path("codigo").asString(), null,
                Map.of("senha", ApiDeTeste.SENHA), 200);
    }

    private UUID alunoDe(JsonNode responsavel, String nome, LocalDate fimDaPasta) throws Exception {
        JsonNode criado = api.post("/alunos", admin, Map.of("nome", nome,
                "responsavelId", responsavel.path("usuario").path("id").asString()), 200);
        UUID aluno = UUID.fromString(criado.path("id").asString());
        String pasta = api.post("/alunos/" + aluno + "/pastas", admin,
                Map.of("titulo", "Período fictício", "inicio", fimDaPasta.minusDays(27), "fim", fimDaPasta), 200)
                .path("id").asString();
        JsonNode plano = api.post("/alunos/" + aluno + "/planos-treino", admin,
                Map.of("titulo", "Treino fictício", "pastaId", pasta), 200);
        String id = plano.path("plano").path("id").asString();
        JsonNode salvo = api.put("/planos-treino/" + id + "/rascunho", admin,
                ApiDeTeste.rascunho("Treino fictício", ApiDeTeste.treino().conteudo(),
                        plano.path("plano").path("versao").asLong()), 200);
        api.post("/planos-treino/" + id + "/publicar", admin,
                Map.of("versao", salvo.path("plano").path("versao").asLong(), "confirmarAvisos", true), 200);
        return aluno;
    }

    /** Aluno cuja pasta vigente vem só da dieta publicada (sem treino ativo). */
    private UUID alunoSoComDieta(JsonNode responsavel, String nome, LocalDate fimDaPasta) throws Exception {
        UUID aluno = UUID.fromString(api.post("/alunos", admin, Map.of("nome", nome,
                "responsavelId", responsavel.path("usuario").path("id").asString()), 200).path("id").asString());
        String pasta = api.post("/alunos/" + aluno + "/pastas", admin,
                Map.of("titulo", "Período fictício", "inicio", fimDaPasta.minusDays(27), "fim", fimDaPasta), 200)
                .path("id").asString();
        JsonNode plano = api.post("/alunos/" + aluno + "/planos-dieta", admin,
                Map.of("titulo", "Dieta fictícia", "pastaId", pasta), 200);
        String id = plano.path("plano").path("id").asString();
        ConteudoDieta.Item item = new ConteudoDieta.Item(UUID.randomUUID(), UUID.randomUUID(), "Arroz branco cozido",
                new BigDecimal("150"), "g", new BigDecimal("191.7"), BigDecimal.ONE, BigDecimal.TEN, BigDecimal.ZERO, false);
        ConteudoDieta conteudo = new ConteudoDieta("Objetivo fictício", null, "Treinador Teste", List.of(
                new ConteudoDieta.Refeicao(UUID.randomUUID(), "Almoço", "12:00", null, List.of(
                        new ConteudoDieta.Opcao(UUID.randomUUID(), "A", List.of(item))))),
                List.of(), null, List.of());
        JsonNode salvo = api.put("/planos-dieta/" + id + "/rascunho", admin,
                ApiDeTeste.rascunho("Dieta fictícia", conteudo, plano.path("plano").path("versao").asLong()), 200);
        api.post("/planos-dieta/" + id + "/publicar", admin,
                Map.of("versao", salvo.path("plano").path("versao").asLong(), "confirmarAvisos", true), 200);
        return aluno;
    }

    private JsonNode loginDoAluno(UUID aluno) throws Exception {
        return api.convidarEEntrar(admin, aluno);
    }

    private String pastaAtual(JsonNode loginAluno) throws Exception {
        return api.get("/aluno/atualizacao", loginAluno, 200).path("pastaId").asString();
    }

    private void enviar(JsonNode loginAluno) throws Exception {
        Map<String, Object> respostas = new LinkedHashMap<>(
                Map.of("peso", 80.5, "sono", 7, "alim_desempenho", 8, "treino_desempenho", 6));
        JsonNode atual = api.get("/aluno/atualizacao", loginAluno, 200);
        api.post("/aluno/atualizacao/enviar", loginAluno,
                Map.of("pastaId", atual.path("pastaId").asString(), "questionarioVersaoId", atual.path("questionarioVersaoId").asString(),
                        "respostas", respostas), 200);
    }

    private void avisarAtraso(JsonNode loginAluno, LocalDate novaData) throws Exception {
        api.post("/aluno/atualizacao/atraso", loginAluno,
                Map.of("pastaId", pastaAtual(loginAluno), "novaData", novaData), 200);
    }

    private long noPainel(JsonNode quem, String situacao, boolean meus) throws Exception {
        return api.get("/painel?meus=" + meus, quem, 200).path(CAMPO_DO_PAINEL.get(situacao)).asLong();
    }

    private int naLista(JsonNode quem, String situacao, boolean meus) throws Exception {
        return api.get("/atualizacoes?situacao=" + situacao + "&meus=" + meus, quem, 200).size();
    }

    @Test
    void contadoresDoPainelBatemComAsListasComESemMeusAlunos() throws Exception {
        // Do administrador: atrasada e próxima sem linha gravada; avisou atraso (próxima também).
        alunoDe(admin, "Aluno atrasado do administrador", hoje.minusDays(2));
        alunoDe(admin, "Aluno próximo do administrador", hoje.plusDays(3));
        UUID avisou = alunoDe(admin, "Aluno que avisou atraso", hoje);
        avisarAtraso(loginDoAluno(avisou), hoje.plusDays(2));
        // Do membro: próxima e atrasada sem linha gravada; uma enviada para revisar.
        alunoDe(membro, "Aluno próximo do membro", hoje.plusDays(2));
        alunoDe(membro, "Aluno atrasado do membro", hoje.minusDays(1));
        enviar(loginDoAluno(alunoDe(membro, "Aluno que enviou", hoje)));

        for (JsonNode quem : new JsonNode[]{admin, membro}) {
            for (boolean meus : new boolean[]{false, true}) {
                for (String situacao : SITUACOES) {
                    assertThat((long) naLista(quem, situacao, meus))
                            .as("lista × painel de %s (meus=%s)", situacao, meus)
                            .isEqualTo(noPainel(quem, situacao, meus));
                }
            }
        }
        // Pasta vindo só da dieta entra na mesma conta (atrasada, do membro).
        alunoSoComDieta(membro, "Aluno só com dieta", hoje.minusDays(3));
        assertThat(naLista(membro, "ATRASADAS", true)).isEqualTo(2);
        assertThat(noPainel(membro, "ATRASADAS", true)).isEqualTo(2);
        assertThat(naLista(admin, "ATRASADAS", false)).isEqualTo(3);
        // A lista é leve: o modelo, as respostas e o resumo ficam no detalhe.
        JsonNode item = api.get("/atualizacoes?situacao=PARA_REVISAR", admin, 200).get(0);
        assertThat(item.has("modelo") || item.has("respostas") || item.has("resumo")).isFalse();
        assertThat(item.path("nomeAluno").asString()).isEqualTo("Aluno que enviou");
        JsonNode detalhe = api.get("/atualizacoes/" + item.path("id").asString(), admin, 200);
        assertThat(detalhe.has("modelo")).isTrue();
        // Números esperados, para a igualdade acima não valer com tudo zerado.
        assertThat(naLista(admin, "ATRASADAS", true)).isEqualTo(1);
        assertThat(naLista(admin, "PROXIMAS", false)).isEqualTo(3);
        assertThat(naLista(admin, "PROXIMAS", true)).isEqualTo(2);
        assertThat(naLista(admin, "AVISARAM_ATRASO", true)).isEqualTo(1);
        assertThat(naLista(admin, "PARA_REVISAR", true)).isZero();
        assertThat(naLista(admin, "PARA_REVISAR", false)).isEqualTo(1);
        assertThat(naLista(membro, "PARA_REVISAR", true)).isEqualTo(1);
        assertThat(naLista(membro, "PROXIMAS", true)).isEqualTo(1);
        assertThat(naLista(membro, "AVISARAM_ATRASO", true)).isZero();
        // "Meus" não restringe quem não pede: a mesma lista de antes.
        assertThat(api.get("/atualizacoes?situacao=ATRASADAS", membro, 200)).hasSize(3);
    }

    @Test
    void outraConsultoriaNaoVeNemContaNada() throws Exception {
        alunoDe(admin, "Aluno atrasado", hoje.minusDays(2));
        alunoDe(membro, "Aluno próximo", hoje.plusDays(1));
        JsonNode outro = api.novoTreinador();
        for (boolean meus : new boolean[]{false, true}) {
            for (String situacao : SITUACOES) {
                assertThat(noPainel(outro, situacao, meus)).isZero();
                assertThat(naLista(outro, situacao, meus)).isZero();
            }
        }
    }
}
