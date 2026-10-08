package br.com.treinos.api.biblioteca;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Seção 15.1, item 7 (links de vídeo), mais biblioteca, catálogo, CSV e receitas padrão. */
@AutoConfigureMockMvc
class BibliotecaIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JsonMapper json;

    private ApiDeTeste api;
    private JsonNode treinador;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        treinador = api.novoTreinador();
    }

    @Test
    void linkDeVideoSoHttpsDoYoutube() throws Exception {
        api.post("/exercicios", treinador, exercicio("Com javascript", "javascript:alert(1)"), 400);
        api.post("/exercicios", treinador, exercicio("Com data", "data:text/html,oi"), 400);
        api.post("/exercicios", treinador, exercicio("Outro host", "https://evil.example.com/watch?v=1"), 400);
        api.post("/exercicios", treinador, exercicio("Http simples", "http://www.youtube.com/watch?v=1"), 400);
        api.post("/exercicios", treinador, exercicio("Com usuário", "https://x@youtube.com/watch?v=1"), 400);
        JsonNode ok = api.post("/exercicios", treinador, exercicio("Com vídeo", "https://youtu.be/abc"), 200);
        assertThat(ok.get("videoUrl").asString()).isEqualTo("https://youtu.be/abc");
    }

    @Test
    void nomeRepetidoInativarEBusca() throws Exception {
        JsonNode e = api.post("/exercicios", treinador, exercicio("Supino Teste", null), 200);
        assertThat(api.post("/exercicios", treinador, exercicio("supino teste", null), 409).get("codigo").asString())
                .isEqualTo("NOME_EM_USO");
        assertThat(api.get("/exercicios?busca=SUPINO", treinador, 200)).hasSize(1);
        assertThat(api.get("/exercicios?busca=%25", treinador, 200)).isEmpty();
        api.delete("/exercicios/" + e.get("id").asString(), treinador, 204);
        assertThat(api.get("/exercicios", treinador, 200)).isEmpty();
        // Inativado libera o nome.
        api.post("/exercicios", treinador, exercicio("Supino Teste", null), 200);
    }

    @Test
    void importarDoCatalogoIgnoraOQueJaExiste() throws Exception {
        JsonNode catalogo = api.get("/catalogo/exercicios?busca=remada&limite=6", treinador, 200).get("itens");
        assertThat(catalogo.size()).isEqualTo(6);
        List<String> ids = catalogo.valueStream().map(c -> c.get("id").asString()).toList();
        JsonNode primeiro = api.post("/exercicios/importar-catalogo", treinador, Map.of("ids", ids), 200);
        assertThat(primeiro.get("importados").asInt()).isEqualTo(ids.size());
        JsonNode segundo = api.post("/exercicios/importar-catalogo", treinador, Map.of("ids", ids), 200);
        assertThat(segundo.get("importados").asInt()).isZero();
        assertThat(segundo.get("ignorados").asInt()).isEqualTo(ids.size());

        JsonNode alimentos = api.get("/catalogo/alimentos?busca=arroz", treinador, 200).get("itens");
        assertThat(alimentos.size()).isGreaterThanOrEqualTo(6);
        assertThat(alimentos.get(0).get("fonte").asString()).contains("TACO");
        api.post("/alimentos/importar-catalogo", treinador,
                Map.of("ids", List.of(alimentos.get(0).get("id").asString())), 200);
        assertThat(api.get("/alimentos", treinador, 200)).hasSize(1);
    }

    @Test
    void buscaDoCatalogoIgnoraAcentoEMostraOTotal() throws Exception {
        JsonNode feijao = api.get("/catalogo/alimentos?busca=feijao&limite=5", treinador, 200);
        assertThat(feijao.get("itens")).hasSize(5);
        assertThat(feijao.get("total").asInt()).isGreaterThan(5);
        assertThat(feijao.get("itens").valueStream().map(a -> a.get("nome").asString()))
                .allMatch(n -> n.toLowerCase(Locale.ROOT).contains("feij"));
        // Com ou sem acento, maiúsculas ou espaços sobrando: mesmo resultado.
        assertThat(api.get("/catalogo/alimentos?busca= FEIJÃO ", treinador, 200).get("total").asInt())
                .isEqualTo(api.get("/catalogo/alimentos?busca=feijao", treinador, 200).get("total").asInt());
        assertThat(api.get("/catalogo/exercicios?busca=triceps", treinador, 200).get("total").asInt())
                .isEqualTo(api.get("/catalogo/exercicios?busca=tríceps", treinador, 200).get("total").asInt())
                .isGreaterThan(5);
        // Curinga digitado é texto, não padrão; limite fora da faixa vira o mínimo/máximo.
        assertThat(api.get("/catalogo/alimentos?busca=%25", treinador, 200).get("total").asInt()).isZero();
        assertThat(api.get("/catalogo/alimentos?limite=0", treinador, 200).get("itens")).hasSize(1);
        assertThat(api.get("/catalogo/alimentos?limite=5000", treinador, 200).get("itens")).hasSize(200);
        assertThat(api.get("/catalogo/alimentos", treinador, 200).get("itens")).hasSize(50);
    }

    @Test
    void catalogoFiltraPorGrupoEExpoeFonteETracos() throws Exception {
        JsonNode grupos = api.get("/catalogo/alimentos/grupos", treinador, 200);
        assertThat(grupos.valueStream().map(JsonNode::asString)).contains("Cereais e derivados", "Carnes e derivados");
        JsonNode cereais = api.get("/catalogo/alimentos?grupo=Cereais e derivados&limite=200", treinador, 200);
        assertThat(cereais.get("itens").valueStream().map(a -> a.get("grupo").asString()))
                .containsOnly("Cereais e derivados");
        JsonNode arroz = api.get("/catalogo/alimentos?busca=arroz&grupo=Cereais e derivados", treinador, 200);
        assertThat(arroz.get("total").asInt()).isLessThanOrEqualTo(cereais.get("total").asInt());
        assertThat(api.get("/catalogo/alimentos?grupo=Inexistente", treinador, 200).get("total").asInt()).isZero();

        JsonNode comTraco = api.get("/catalogo/alimentos?busca=cerveja&limite=200", treinador, 200).get("itens");
        assertThat(comTraco.valueStream().anyMatch(a -> a.get("tracos").size() > 0)).isTrue();
        assertThat(comTraco.get(0).get("codigoFonte").asString()).isNotBlank();

        assertThat(api.get("/catalogo/exercicios/grupos", treinador, 200).valueStream().map(JsonNode::asString))
                .contains("Peito", "Costas", "Quadríceps");
        JsonNode peito = api.get("/catalogo/exercicios?grupo=Peito&modalidade=MAQUINA&limite=200", treinador, 200);
        assertThat(peito.get("total").asInt()).isGreaterThan(0);
        assertThat(peito.get("itens").valueStream().map(e -> e.get("modalidade").asString()))
                .containsOnly("MAQUINA");
        JsonNode agachamento = api.get("/catalogo/exercicios?busca=agachamento bulgaro", treinador, 200).get("itens");
        assertThat(agachamento.size()).isGreaterThan(0);
        assertThat(agachamento.get(0).get("instrucoes").asString()).isNotBlank();
        assertThat(agachamento.get(0).get("fonte").asString()).contains("exercicios-bd-ptbr");
    }

    @Test
    void catalogoExigeTreinador() throws Exception {
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/catalogo/alimentos"))
                .andExpect(status().isUnauthorized());
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/catalogo/exercicios/grupos"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void csvTemPreviaComErrosEConfirmacaoPeloHash() throws Exception {
        String csv = """
                nome;grupo;equipamento;modalidade;video
                Remada cavalinho;Costas;Barra T;livre;
                Pulldown teste;Costas;Polia;Máquina;https://www.youtube.com/watch?v=1
                ;Costas;;;
                Remada cavalinho;Costas;;;
                Agachamento teste;Pernas;;voador;
                """;
        JsonNode previa = csv("/exercicios/importar-csv", csv, 200);
        assertThat(previa.get("validas")).hasSize(2);
        assertThat(previa.get("erros").valueStream().map(e -> e.get("linha").asInt())).containsExactly(4, 5, 6);
        String hash = previa.get("hash").asString();

        csv("/exercicios/importar-csv?confirmar=true&hash=outro", csv, 409);
        JsonNode feito = csv("/exercicios/importar-csv?confirmar=true&hash=" + hash, csv, 200);
        assertThat(feito.get("importados").asInt()).isEqualTo(2);
        assertThat(api.get("/exercicios", treinador, 200)).hasSize(2);

        String alimentos = "nome;quantidade_base;unidade;kcal;proteina;carboidrato;gordura;fonte\n"
                + "Arroz teste;100;g;127,8;2,5;28,1;0,22;Rótulo\n"
                + "Sem unidade;100;kg;1;1;1;1;\n";
        JsonNode previaAlimentos = csv("/alimentos/importar-csv", alimentos, 200);
        assertThat(previaAlimentos.get("validas")).hasSize(1);
        assertThat(previaAlimentos.get("validas").get(0).get("kcal").decimalValue()).isEqualByComparingTo("127.8");
        csv("/alimentos/importar-csv", "nome,errado\nx,y\n", 400);
    }

    @Test
    void consultoriaNovaJaTemAsReceitasPadrao() throws Exception {
        JsonNode receitas = api.get("/receitas", treinador, 200);
        assertThat(receitas).hasSize(13);
        assertThat(api.get("/receitas?tipo=METODOLOGIA", treinador, 200)).hasSize(1);
        assertThat(api.get("/receitas?tipo=SERIES", treinador, 200).valueStream().map(r -> r.get("nome").asString()))
                .contains("Aquecimento + 3 FS + WS + 2 Back off 85%", "Séries simples 3x8-12", "Cardio");
        api.post("/receitas", treinador, Map.of("tipo", "PLANO_TREINO", "nome", "Inválida",
                "conteudo", Map.of("sessoes", "isto não é lista")), 400);
    }

    private static Map<String, Object> exercicio(String nome, String video) {
        Map<String, Object> m = new java.util.LinkedHashMap<>();
        m.put("nome", nome);
        m.put("modalidade", "LIVRE");
        m.put("videoUrl", video);
        return m;
    }

    private JsonNode csv(String caminho, String texto, int esperado) throws Exception {
        return api.ler(mvc.perform(post(caminho).header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(treinador))
                        .contentType(new MediaType("text", "plain", StandardCharsets.UTF_8))
                        .content(texto.getBytes(StandardCharsets.UTF_8)))
                .andExpect(status().is(esperado)).andReturn());
    }
}
