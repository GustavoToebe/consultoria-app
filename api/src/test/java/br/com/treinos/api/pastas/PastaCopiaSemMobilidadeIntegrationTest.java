package br.com.treinos.api.pastas;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.conta.ContaLocalRepositorio;
import br.com.treinos.api.conta.DireitosLocais;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Copiar a pasta para outro aluno com a mobilidade fora do plano da consultoria (chave {@code treinos.plano.aplicar}
 * ligada): a mobilidade não é copiada e a resposta diz isso em {@code pulados}, com motivo fixo e sem dado de pessoa.
 * Dados fictícios.
 */
@AutoConfigureMockMvc
@TestPropertySource(properties = "treinos.plano.aplicar=true")
class PastaCopiaSemMobilidadeIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JsonMapper json;
    @Autowired
    private JdbcTemplate banco;
    @Autowired
    private ContaLocalRepositorio contas;

    private ApiDeTeste api;
    private JsonNode treinador;
    private UUID consultoria;
    private UUID aluno;
    private UUID destino;
    private String pasta;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        treinador = api.novoTreinador();
        consultoria = banco.queryForObject("select consultoria_id from usuario where id = ?::uuid", UUID.class,
                treinador.path("usuario").path("id").asString());
        aluno = api.criarAluno(treinador, "Aluno Origem Fictício");
        destino = api.criarAluno(treinador, "Aluno Destino Fictício");
        pasta = api.post("/alunos/" + aluno + "/pastas", treinador,
                Map.of("titulo", "Período fictício", "inicio", "2026-11-02", "fim", "2026-11-29"), 200).path("id").asString();
        api.post("/alunos/" + aluno + "/planos-treino", treinador, Map.of("titulo", "Treino", "pastaId", pasta), 200);
        api.post("/alunos/" + aluno + "/planos-mobilidade", treinador, Map.of("titulo", "Mobilidade", "pastaId", pasta), 200);
    }

    private void funcionalidades(List<String> liberadas) {
        contas.gravarDireitos(new DireitosLocais(consultoria, UUID.randomUUID(), 1, "ATIVA", true, null, null, "PAGO", "Pago",
                Map.of(), liberadas, Instant.now()));
    }

    private JsonNode copiar() throws Exception {
        return api.post("/pastas/" + pasta + "/copiar-para-aluno", treinador,
                Map.of("alunoId", destino, "titulo", "Cópia fictícia", "inicio", "2026-12-01", "fim", "2026-12-28"), 200);
    }

    private int planosDeMobilidadeDoDestino() {
        return banco.queryForObject("select count(*) from plano_mobilidade where aluno_id = ?", Integer.class, destino);
    }

    @Test
    void mobilidadeForaDoPlanoNaoEhCopiadaERespostaDizPuladoComMotivoFixo() throws Exception {
        funcionalidades(List.of("PDF", "EQUIPE")); // sem MOBILIDADE

        JsonNode resposta = copiar();

        assertThat(resposta.path("planos")).hasSize(1);
        assertThat(resposta.path("planos").get(0).path("tipo").asString()).isEqualTo("treino");
        assertThat(resposta.path("pulados")).hasSize(1);
        assertThat(resposta.path("pulados").get(0).path("tipo").asString()).isEqualTo("mobilidade");
        assertThat(resposta.path("pulados").get(0).path("motivo").asString()).isEqualTo("FUNCIONALIDADE_FORA_DO_PLANO");
        assertThat(resposta.path("pulados").get(0).propertyNames()).containsExactlyInAnyOrder("tipo", "motivo");
        assertThat(resposta.toString()).doesNotContain("Fictício");
        assertThat(planosDeMobilidadeDoDestino()).isZero();
    }

    @Test
    void comAMobilidadeNoPlanoCopiaETudoEPuladosVemVazio() throws Exception {
        funcionalidades(List.of("MOBILIDADE", "PDF", "EQUIPE"));

        JsonNode resposta = copiar();

        assertThat(resposta.path("planos")).hasSize(2);
        assertThat(resposta.path("pulados")).isEmpty();
        assertThat(planosDeMobilidadeDoDestino()).isEqualTo(1);
    }

    @Test
    void pastaSemMobilidadeOuComEstaArquivadaNaoTemNadaAPular() throws Exception {
        funcionalidades(List.of("PDF", "EQUIPE"));
        String mobilidade = banco.queryForObject("select id::text from plano_mobilidade where pasta_id = ?::uuid", String.class,
                pasta);
        api.delete("/planos-mobilidade/" + mobilidade, treinador, 204); // arquivar continua valendo com o recurso fora

        JsonNode resposta = copiar();

        assertThat(resposta.path("planos")).hasSize(1);
        assertThat(resposta.path("pulados")).isEmpty();
    }

    @Test
    void quemNaoPodeLerOTreinoNaoSabeQueHaMobilidadeNemPorPulados() throws Exception {
        funcionalidades(List.of("PDF", "EQUIPE"));
        String usuario = treinador.path("usuario").path("id").asString();
        banco.update("update usuario u set perfil_id = p.id from perfil p where u.id = ?::uuid "
                + "and p.consultoria_id = u.consultoria_id and p.nome = 'Assistente'", usuario);
        banco.update("delete from perfil_permissao where perfil_id = (select perfil_id from usuario where id = ?::uuid)", usuario);
        for (String codigo : List.of("ALUNO_LER", "PASTA_ALTERAR", "TREINO_ALTERAR")) { // sem TREINO_LER
            banco.update("insert into perfil_permissao(perfil_id, codigo) select perfil_id, ? from usuario where id = ?::uuid",
                    codigo, usuario);
        }

        JsonNode resposta = copiar();

        assertThat(resposta.path("planos")).hasSize(1);
        assertThat(resposta.path("pulados")).isEmpty();
    }
}
