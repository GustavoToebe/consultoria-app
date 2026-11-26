package br.com.treinos.api.planos;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.dieta.ConteudoDieta;
import br.com.treinos.api.dieta.ConteudoDieta.Item;
import br.com.treinos.api.dieta.ConteudoDieta.Opcao;
import br.com.treinos.api.dieta.ConteudoDieta.Refeicao;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Título que o aluno vê depois de publicar (dieta e treino): sem "(rascunho)" e, no nome padrão da importação, "Dieta de
 * <aluno>" / "Treino de <aluno>". Título do treinador e versões já publicadas ficam como estão. Dados fictícios.
 */
@AutoConfigureMockMvc
class TituloDoPlanoPublicadoIntegrationTest extends AbstractIntegrationTest {

    private static final String IMPORTADA = "Importada da planilha (rascunho)";

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JsonMapper json;

    private ApiDeTeste api;
    private JsonNode treinador;
    private UUID aluno;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        treinador = api.novoTreinador();
        aluno = api.criarAluno(treinador, "Aluno Fictício Título");
    }

    private static ConteudoDieta dieta() {
        Item item = new Item(UUID.randomUUID(), null, "Legumes", new BigDecimal("100"), "g", new BigDecimal("45"), null,
                null, null, true);
        return new ConteudoDieta("Objetivo fictício", null, null, List.of(new Refeicao(UUID.randomUUID(), "Almoço", "12:00",
                null, List.of(new Opcao(UUID.randomUUID(), "A", List.of(item))))), List.of(), null, List.of());
    }

    /** Cria o plano com o título, salva o conteúdo (mesmo título) e devolve o detalhe salvo. */
    private JsonNode rascunho(JsonNode login, UUID doAluno, String tipo, String titulo, Object conteudo) throws Exception {
        JsonNode criado = api.post("/alunos/" + doAluno + "/planos-" + tipo, login, Map.of("titulo", titulo), 200);
        return salvar(login, tipo, criado, titulo, conteudo);
    }

    private JsonNode salvar(JsonNode login, String tipo, JsonNode detalhe, String titulo, Object conteudo) throws Exception {
        return api.put("/planos-" + tipo + "/" + detalhe.path("plano").path("id").asString() + "/rascunho", login,
                ApiDeTeste.rascunho(titulo, conteudo, detalhe.path("plano").path("versao").asLong()), 200);
    }

    private JsonNode publicar(JsonNode login, String tipo, JsonNode detalhe) throws Exception {
        return api.post("/planos-" + tipo + "/" + detalhe.path("plano").path("id").asString() + "/publicar", login,
                Map.of("versao", detalhe.path("plano").path("versao").asLong(), "confirmarAvisos", true), 200);
    }

    private String tituloDaVersao(JsonNode login, String tipo, JsonNode detalhe, int numero) throws Exception {
        return api.get("/planos-" + tipo + "/" + detalhe.path("plano").path("id").asString() + "/versoes/" + numero, login, 200)
                .path("titulo").asString();
    }

    private static String titulo(JsonNode detalhe) {
        return detalhe.path("plano").path("titulo").asString();
    }

    @Test
    void dietaImportadaPublicaComDietaDeNomeNoPlanoENaVersao() throws Exception {
        JsonNode salvo = rascunho(treinador, aluno, "dieta", IMPORTADA, dieta());
        JsonNode publicado = publicar(treinador, "dieta", salvo);

        assertThat(titulo(publicado)).isEqualTo("Dieta de Aluno Fictício Título");
        assertThat(tituloDaVersao(treinador, "dieta", publicado, 1)).isEqualTo("Dieta de Aluno Fictício Título");
        // O rascunho que continua editável já traz o título limpo (o editor não contradiz a versão).
        assertThat(titulo(api.get("/planos-dieta/" + publicado.path("plano").path("id").asString(), treinador, 200)))
                .isEqualTo("Dieta de Aluno Fictício Título");
    }

    @Test
    void treinoImportadoPublicaComTreinoDeNome() throws Exception {
        JsonNode salvo = rascunho(treinador, aluno, "treino", "Importada da planilha", ApiDeTeste.treino().conteudo());
        JsonNode publicado = publicar(treinador, "treino", salvo);

        assertThat(titulo(publicado)).isEqualTo("Treino de Aluno Fictício Título");
        assertThat(tituloDaVersao(treinador, "treino", publicado, 1)).isEqualTo("Treino de Aluno Fictício Título");
    }

    @Test
    void tiraORascunhoDoTituloEPreservaOQueOTreinadorEscreveu() throws Exception {
        JsonNode comRascunho = publicar(treinador, "treino",
                rascunho(treinador, aluno, "treino", "Treino A (RASCUNHO)", ApiDeTeste.treino().conteudo()));
        assertThat(titulo(comRascunho)).isEqualTo("Treino A");
        assertThat(tituloDaVersao(treinador, "treino", comRascunho, 1)).isEqualTo("Treino A");

        UUID outro = api.criarAluno(treinador, "Outro Aluno Fictício");
        JsonNode doTreinador = publicar(treinador, "dieta", rascunho(treinador, outro, "dieta", "Cutting do Saraiva", dieta()));
        assertThat(titulo(doTreinador)).isEqualTo("Cutting do Saraiva");
        assertThat(tituloDaVersao(treinador, "dieta", doTreinador, 1)).isEqualTo("Cutting do Saraiva");
    }

    @Test
    void versaoJaPublicadaFicaIntocadaEANovaLevaOTituloLimpo() throws Exception {
        JsonNode v1 = publicar(treinador, "dieta", rascunho(treinador, aluno, "dieta", "Dieta Base", dieta()));
        JsonNode editado = salvar(treinador, "dieta", v1, "Dieta Nova (rascunho)", dieta());
        // Só salvar o rascunho não mexe na versão publicada nem tira o "(rascunho)" (a regra é da publicação).
        assertThat(titulo(editado)).isEqualTo("Dieta Nova (rascunho)");
        assertThat(tituloDaVersao(treinador, "dieta", v1, 1)).isEqualTo("Dieta Base");

        JsonNode v2 = publicar(treinador, "dieta", editado);
        assertThat(titulo(v2)).isEqualTo("Dieta Nova");
        assertThat(tituloDaVersao(treinador, "dieta", v2, 2)).isEqualTo("Dieta Nova");
        assertThat(tituloDaVersao(treinador, "dieta", v2, 1)).isEqualTo("Dieta Base");
    }

    @Test
    void outraConsultoriaNaoEAfetadaNemPublicaPlanoAlheio() throws Exception {
        JsonNode outraConsultoria = api.novoTreinador();
        UUID alunoDeLa = api.criarAluno(outraConsultoria, "Aluno de Outra Consultoria");
        JsonNode deLa = rascunho(outraConsultoria, alunoDeLa, "dieta", IMPORTADA, dieta());

        JsonNode salvo = rascunho(treinador, aluno, "dieta", IMPORTADA, dieta());
        publicar(treinador, "dieta", salvo);

        JsonNode intacto = api.get("/planos-dieta/" + deLa.path("plano").path("id").asString(), outraConsultoria, 200);
        assertThat(titulo(intacto)).isEqualTo(IMPORTADA);
        assertThat(intacto.path("plano").path("versaoPublicada").asInt()).isZero();

        // Publicar o plano de outra consultoria é 404 e nada muda.
        api.post("/planos-dieta/" + salvo.path("plano").path("id").asString() + "/publicar", outraConsultoria,
                Map.of("versao", 0, "confirmarAvisos", true), 404);
    }

    // ---- nome da pasta (o aluno o vê em /aluno/pastas) ----

    private String pasta(JsonNode login, UUID doAluno, String titulo) throws Exception {
        return api.post("/alunos/" + doAluno + "/pastas", login,
                Map.of("titulo", titulo, "inicio", "2026-11-02", "fim", "2026-11-29"), 200).path("id").asString();
    }

    private JsonNode planoNaPasta(JsonNode login, UUID doAluno, String tipo, String pasta, Object conteudo) throws Exception {
        JsonNode criado = api.post("/alunos/" + doAluno + "/planos-" + tipo, login,
                Map.of("titulo", "Plano " + tipo, "pastaId", pasta), 200);
        return salvar(login, tipo, criado, "Plano " + tipo, conteudo);
    }

    private String tituloDaPasta(JsonNode login, UUID doAluno, String pasta) throws Exception {
        for (JsonNode p : api.get("/alunos/" + doAluno + "/pastas", login, 200)) {
            if (pasta.equals(p.path("id").asString())) {
                return p.path("titulo").asString();
            }
        }
        throw new AssertionError("pasta não listada");
    }

    @Test
    void publicarPlanoImportadoRenomeiaAPastaEOAlunoVeONomeNovo() throws Exception {
        JsonNode alunoLogado = api.convidarEEntrar(treinador, aluno);
        String pasta = pasta(treinador, aluno, IMPORTADA);
        publicar(treinador, "dieta", planoNaPasta(treinador, aluno, "dieta", pasta, dieta()));

        assertThat(tituloDaPasta(treinador, aluno, pasta)).isEqualTo("Plano de Aluno Fictício Título");
        assertThat(api.get("/aluno/pastas", alunoLogado, 200).get(0).path("titulo").asString())
                .isEqualTo("Plano de Aluno Fictício Título");
    }

    @Test
    void publicarTudoRenomeiaAPasta() throws Exception {
        String pasta = pasta(treinador, aluno, IMPORTADA);
        JsonNode treino = planoNaPasta(treinador, aluno, "treino", pasta, ApiDeTeste.treino().conteudo());
        JsonNode dieta = planoNaPasta(treinador, aluno, "dieta", pasta, dieta());
        api.post("/pastas/" + pasta + "/publicar", treinador, Map.of("confirmarAvisos", true, "versoes", Map.of(
                treino.path("plano").path("id").asString(), treino.path("plano").path("versao").asLong(),
                dieta.path("plano").path("id").asString(), dieta.path("plano").path("versao").asLong())), 200);

        assertThat(tituloDaPasta(treinador, aluno, pasta)).isEqualTo("Plano de Aluno Fictício Título");
    }

    @Test
    void pastaDoTreinadorFicaIntocadaEPastaJaPublicadaSoMudaNaProximaPublicacao() throws Exception {
        String propria = pasta(treinador, aluno, "Plano 16");
        JsonNode v1 = publicar(treinador, "dieta", planoNaPasta(treinador, aluno, "dieta", propria, dieta()));
        assertThat(tituloDaPasta(treinador, aluno, propria)).isEqualTo("Plano 16");

        api.put("/pastas/" + propria, treinador,
                Map.of("titulo", "Plano 17 (rascunho)", "inicio", "2026-11-02", "fim", "2026-11-29"), 200);
        assertThat(tituloDaPasta(treinador, aluno, propria)).isEqualTo("Plano 17 (rascunho)");
        JsonNode atual = api.get("/planos-dieta/" + v1.path("plano").path("id").asString(), treinador, 200);
        publicar(treinador, "dieta", salvar(treinador, "dieta", atual, titulo(atual), dieta()));
        assertThat(tituloDaPasta(treinador, aluno, propria)).isEqualTo("Plano 17");
    }

    @Test
    void pastaDeOutraConsultoriaNaoEAfetada() throws Exception {
        JsonNode outraConsultoria = api.novoTreinador();
        UUID alunoDeLa = api.criarAluno(outraConsultoria, "Aluno de Outra Consultoria");
        String deLa = pasta(outraConsultoria, alunoDeLa, IMPORTADA);
        planoNaPasta(outraConsultoria, alunoDeLa, "dieta", deLa, dieta());

        String minha = pasta(treinador, aluno, IMPORTADA);
        publicar(treinador, "dieta", planoNaPasta(treinador, aluno, "dieta", minha, dieta()));

        assertThat(tituloDaPasta(outraConsultoria, alunoDeLa, deLa)).isEqualTo(IMPORTADA);
        api.post("/pastas/" + minha + "/publicar", outraConsultoria, Map.of("confirmarAvisos", true, "versoes", Map.of()), 404);
        assertThat(tituloDaPasta(treinador, aluno, minha)).isEqualTo("Plano de Aluno Fictício Título");
    }
}
