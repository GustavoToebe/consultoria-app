package br.com.treinos.api.receitas;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Aplicar um modelo cria treino, dieta ou mobilidade: quem aplica precisa também ler o aluno e poder alterar aquilo
 * que o modelo cria. Salvar uma pasta como modelo lê treino e dieta. Dados fictícios.
 */
@AutoConfigureMockMvc
class AplicarModeloPermissoesIntegrationTest extends AbstractIntegrationTest {
    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    private ApiDeTeste api;
    private JsonNode admin;
    private UUID aluno;
    private String treino;
    private String dieta;
    private String mobilidade;
    private String pacote;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        aluno = api.criarAluno(admin, "Aluno fictício de permissões");
        var dietaVazia = Map.of("refeicoes", List.of(), "orientacoes", List.of(), "suplementacao", List.of());
        var item = Map.of("nome", "Lunge Stretch", "prescricao", "2 x 20s cada lado");
        var mob = Map.of("orientacoes", "Todos os dias.", "secoes", List.of(Map.of("titulo", "Alongamentos", "itens", List.of(item))));
        treino = modelo("PLANO_TREINO", ApiDeTeste.treino().conteudo());
        dieta = modelo("PLANO_DIETA", dietaVazia);
        mobilidade = modelo("MOBILIDADE", mob);
        pacote = modelo("PASTA_PLANO", Map.of("planos", List.of(
                Map.of("titulo", "Semana fictícia", "treino", ApiDeTeste.treino().conteudo()),
                Map.of("titulo", "Dieta fictícia", "dieta", dietaVazia))));
    }

    private String modelo(String tipo, Object conteudo) throws Exception {
        return api.post("/receitas", admin, Map.of("tipo", tipo, "nome", "Modelo " + tipo, "conteudo", conteudo), 200)
                .get("id").asString();
    }

    /** Membro novo da equipe com um perfil só com as permissões informadas. */
    private JsonNode membro(Set<String> permissoes) throws Exception {
        String perfil = api.post("/perfis", admin, Map.of("nome", "Perfil " + UUID.randomUUID(), "permissoes", permissoes), 200)
                .get("id").asString();
        JsonNode convite = api.post("/usuarios/convites", admin,
                Map.of("nome", "Membro fictício", "email", ApiDeTeste.emailUnico("membro"), "perfilId", perfil), 200);
        return api.post("/publico/convites-equipe/" + convite.get("codigo").asString(), null,
                Map.of("senha", ApiDeTeste.SENHA), 200);
    }

    private int criados() throws Exception {
        return api.get("/alunos/" + aluno + "/pastas", admin, 200).size()
                + api.get("/alunos/" + aluno + "/planos-treino", admin, 200).size()
                + api.get("/alunos/" + aluno + "/planos-dieta", admin, 200).size()
                + api.get("/alunos/" + aluno + "/planos-mobilidade", admin, 200).size();
    }

    private void aplicar(JsonNode quem, String modelo, int esperado) throws Exception {
        api.post("/receitas/" + modelo + "/aplicar", quem, Map.of("alunoId", aluno, "titulo", "Cópia fictícia"), esperado);
    }

    @Test
    void semAPermissaoDoQueOModeloCriaRecusaSemCriarNada() throws Exception {
        JsonNode soTreino = membro(Set.of("MODELO_LER", "MODELO_APLICAR", "ALUNO_LER", "PASTA_ALTERAR", "TREINO_LER", "TREINO_ALTERAR"));
        aplicar(soTreino, dieta, 403);
        aplicar(soTreino, pacote, 403);
        assertThat(criados()).isZero();
        // Treino e mobilidade (que usa a permissão do treino) passam.
        aplicar(soTreino, treino, 200);
        aplicar(soTreino, mobilidade, 200);
        assertThat(criados()).isEqualTo(4);
    }

    @Test
    void semDietaAlterarNaoAplicaDietaMasComTudoAplicaOPacote() throws Exception {
        JsonNode soDieta = membro(Set.of("MODELO_LER", "MODELO_APLICAR", "ALUNO_LER", "PASTA_ALTERAR", "DIETA_LER", "DIETA_ALTERAR"));
        aplicar(soDieta, treino, 403);
        aplicar(soDieta, mobilidade, 403);
        aplicar(soDieta, pacote, 403);
        assertThat(criados()).isZero();
        aplicar(soDieta, dieta, 200);
        JsonNode completo = membro(Set.of("MODELO_LER", "MODELO_APLICAR", "ALUNO_LER", "PASTA_ALTERAR", "TREINO_LER",
                "TREINO_ALTERAR", "DIETA_LER", "DIETA_ALTERAR"));
        aplicar(completo, pacote, 200);
    }

    @Test
    void semPastaAlterarSoAplicaEmPastaQueJaExiste() throws Exception {
        JsonNode semPasta = membro(Set.of("MODELO_LER", "MODELO_APLICAR", "ALUNO_LER", "TREINO_LER", "TREINO_ALTERAR"));
        aplicar(semPasta, treino, 403);
        aplicar(semPasta, pacote, 403);
        assertThat(criados()).isZero();
        String pasta = api.post("/alunos/" + aluno + "/pastas", admin,
                Map.of("titulo", "Pasta existente", "inicio", "2026-10-05", "fim", "2026-10-20"), 200).get("id").asString();
        int antes = criados();
        api.post("/receitas/" + treino + "/aplicar", semPasta,
                Map.of("alunoId", aluno, "pastaId", pasta, "titulo", "Cópia fictícia"), 200);
        assertThat(criados()).isEqualTo(antes + 1);
    }

    @Test
    void semLerOAlunoNaoAplicaNada() throws Exception {
        JsonNode semAluno = membro(Set.of("MODELO_LER", "MODELO_APLICAR", "TREINO_LER", "TREINO_ALTERAR"));
        aplicar(semAluno, treino, 403);
        assertThat(criados()).isZero();
    }

    @Test
    void salvarPastaComoModeloExigeLerTreinoEDieta() throws Exception {
        String pasta = api.post("/alunos/" + aluno + "/pastas", admin,
                Map.of("titulo", "Pasta fictícia", "inicio", "2026-10-05", "fim", "2026-10-20"), 200).get("id").asString();
        Map<String, Object> corpo = Map.of("nome", "Pasta como modelo");
        JsonNode semDieta = membro(Set.of("MODELO_LER", "MODELO_ALTERAR", "ALUNO_LER", "TREINO_LER"));
        api.post("/pastas/" + pasta + "/salvar-como-modelo", semDieta, corpo, 403);
        JsonNode semTreino = membro(Set.of("MODELO_LER", "MODELO_ALTERAR", "ALUNO_LER", "DIETA_LER"));
        api.post("/pastas/" + pasta + "/salvar-como-modelo", semTreino, corpo, 403);
        JsonNode comAmbos = membro(Set.of("MODELO_LER", "MODELO_ALTERAR", "ALUNO_LER", "TREINO_LER", "DIETA_LER"));
        api.post("/pastas/" + pasta + "/salvar-como-modelo", comAmbos, corpo, 200);
    }
}
