package br.com.treinos.api.biblioteca;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.fotos.FotosDeTeste;
import br.com.treinos.api.treino.ConteudoTreino;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Imagem ou GIF do exercício: as fotos do catálogo chegam à biblioteca, o treinador envia, troca e remove a imagem
 * própria (GIF limpo de comentário e aplicação), o aluno só vê a dos exercícios do plano dele e outra consultoria não vê
 * nada. Só dados fictícios; as imagens são geradas aqui.
 */
@AutoConfigureMockMvc
class ExercicioImagemIntegrationTest extends AbstractIntegrationTest {

    private static final String COMENTARIO = "COMENTARIO-FICTICIO-GPS-23.55S";

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;

    private ApiDeTeste api;
    private JsonNode treinador;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        treinador = api.novoTreinador();
    }

    // ---- imagens de teste ----

    /** GIF animado de dois quadros 1x1 com comentário e uma extensão de aplicação, tudo à mão. */
    private static byte[] gifComComentario() {
        ByteArrayOutputStream s = new ByteArrayOutputStream();
        byte[] cab = {'G', 'I', 'F', '8', '9', 'a', 1, 0, 1, 0, (byte) 0x80, 0, 0, 0, 0, 0, (byte) 0xFF, (byte) 0xFF, (byte) 0xFF};
        s.write(cab, 0, cab.length);
        byte[] laco = {0x21, (byte) 0xFF, 11, 'N', 'E', 'T', 'S', 'C', 'A', 'P', 'E', '2', '.', '0', 3, 1, 0, 0, 0};
        s.write(laco, 0, laco.length);
        s.write(new byte[] {0x21, (byte) 0xFE, (byte) COMENTARIO.length()}, 0, 3);
        s.write(COMENTARIO.getBytes(StandardCharsets.ISO_8859_1), 0, COMENTARIO.length());
        s.write(0);
        byte[] quadro = {0x21, (byte) 0xF9, 4, 0, 10, 0, 0, 0, 0x2C, 0, 0, 0, 0, 1, 0, 1, 0, 0, 2, 2, 0x44, 1, 0};
        s.write(quadro, 0, quadro.length);
        s.write(quadro, 0, quadro.length);
        s.write(0x3B);
        return s.toByteArray();
    }

    private static byte[] png(int lado) throws Exception {
        BufferedImage img = new BufferedImage(lado, lado, BufferedImage.TYPE_INT_RGB);
        var g = img.createGraphics();
        g.setColor(Color.BLUE);
        g.fillRect(0, 0, lado, lado);
        g.dispose();
        ByteArrayOutputStream s = new ByteArrayOutputStream();
        ImageIO.write(img, "png", s);
        return s.toByteArray();
    }

    // ---- chamadas ----

    private MvcResult enviar(String caminho, JsonNode login, String nomeDoArquivo, byte[] bytes, int esperado) throws Exception {
        return mvc.perform(multipart(HttpMethod.PUT, caminho)
                        .file(new MockMultipartFile("arquivo", nomeDoArquivo, "application/octet-stream", bytes))
                        .header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(login)))
                .andExpect(status().is(esperado)).andReturn();
    }

    private MvcResult ver(String caminho, JsonNode login, int esperado) throws Exception {
        return mvc.perform(get(caminho).header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(login)))
                .andExpect(status().is(esperado)).andReturn();
    }

    private UUID novoExercicio(JsonNode login, String nome) throws Exception {
        JsonNode e = api.post("/exercicios", login, Map.of("nome", nome, "modalidade", "LIVRE"), 200);
        return UUID.fromString(e.get("id").asString());
    }

    private JsonNode daBiblioteca(JsonNode login, String nome) throws Exception {
        for (JsonNode e : api.get("/exercicios", login, 200)) {
            if (nome.equals(e.get("nome").asString())) {
                return e;
            }
        }
        throw new AssertionError("exercício fora da biblioteca: " + nome);
    }

    private JsonNode doTreino(JsonNode login, UUID id) throws Exception {
        for (JsonNode e : api.get("/exercicios", login, 200)) {
            if (id.toString().equals(e.get("id").asString())) {
                return e;
            }
        }
        throw new AssertionError("exercício fora da lista");
    }

    /** Treino publicado para o aluno com este exercício da biblioteca. */
    private void publicarComExercicio(JsonNode login, UUID aluno, UUID exercicioId) throws Exception {
        ObjectNode arvore = (ObjectNode) json.valueToTree(ApiDeTeste.treino().conteudo());
        ((ObjectNode) arvore.get("sessoes").get(0).get("exercicios").get(0)).put("exercicioId", exercicioId.toString());
        api.publicarTreino(login, aluno, json.treeToValue(arvore, ConteudoTreino.class));
    }

    /** Plano de treino do aluno com este exercício, salvo só como rascunho (nunca publicado). */
    private void rascunhoComExercicio(JsonNode login, UUID aluno, UUID exercicioId) throws Exception {
        ObjectNode arvore = (ObjectNode) json.valueToTree(ApiDeTeste.treino().conteudo());
        ((ObjectNode) arvore.get("sessoes").get(0).get("exercicios").get(0)).put("exercicioId", exercicioId.toString());
        JsonNode plano = api.post("/alunos/" + aluno + "/planos-treino", login, Map.of("titulo", "Rascunho de teste"), 200);
        api.put("/planos-treino/" + plano.get("plano").get("id").asString() + "/rascunho", login,
                ApiDeTeste.rascunho("Rascunho de teste", arvore, plano.get("plano").get("versao").asLong()), 200);
    }

    private int auditorias(String acao, UUID exercicio) {
        return jdbc.queryForObject("select count(*) from auditoria where acao = ? and entidade_id = ?::uuid", Integer.class, acao, exercicio);
    }

    // ---- catálogo ----

    @Test
    void catalogoTrazAsFotosEAImportacaoGuardaDeOndeVeio() throws Exception {
        JsonNode pagina = api.get("/catalogo/exercicios?busca=remada&limite=6", treinador, 200);
        JsonNode catalogo = pagina.get("itens").get(0);
        List<String> fotos = List.of(catalogo.get("imagens").get(0).asString(), catalogo.get("imagens").get(1).asString());
        assertThat(fotos).allMatch(c -> c.matches("[A-Za-z0-9_-]+/[01]\\.jpg"));
        UUID catalogoId = UUID.fromString(catalogo.get("id").asString());

        api.post("/exercicios/importar-catalogo", treinador, Map.of("ids", List.of(catalogoId)), 200);

        JsonNode importado = daBiblioteca(treinador, catalogo.get("nome").asString());
        assertThat(importado.get("origem").asString()).isEqualTo("CATALOGO");
        assertThat(importado.get("imagens")).hasSize(2);
        assertThat(importado.get("imagens").get(0).asString()).isEqualTo(fotos.get(0));
        assertThat(importado.get("imagemPropriaEm").isNull()).isTrue();
        assertThat(jdbc.queryForObject("select catalogo_id from exercicio where id = ?::uuid", UUID.class, importado.get("id").asString()))
                .isEqualTo(catalogoId);
        // Exercício que o treinador cria não tem fotos nem origem no catálogo.
        UUID manual = novoExercicio(treinador, "Exercício manual fictício");
        assertThat(doTreino(treinador, manual).get("imagens")).isEmpty();
        assertThat(jdbc.queryForObject("select catalogo_id from exercicio where id = ?", UUID.class, manual)).isNull();
    }

    @Test
    void migracaoLigaPeloNomeSoOsDoCatalogoEDeixaOResto() throws Exception {
        Map<String, Object> catalogo = jdbc.queryForMap("select id, nome from catalogo_exercicio order by nome limit 1");
        String nome = (String) catalogo.get("nome");
        UUID doCatalogo = novoExercicio(treinador, nome);
        UUID manualComMesmoNome = novoExercicio(treinador, nome + " (manual)");
        UUID renomeado = novoExercicio(treinador, "Renomeado fictício depois da importação");
        jdbc.update("update exercicio set origem = 'CATALOGO' where id in (?, ?)", doCatalogo, renomeado);
        jdbc.update("update exercicio set catalogo_id = null where id in (?, ?, ?)", doCatalogo, manualComMesmoNome, renomeado);

        String sql = new String(new ClassPathResource("db/migration/V021__exercicio_catalogo_e_imagem.sql")
                .getContentAsByteArray(), StandardCharsets.UTF_8);
        Matcher m = Pattern.compile("UPDATE exercicio e SET catalogo_id.*?;", Pattern.DOTALL).matcher(sql);
        assertThat(m.find()).isTrue();
        jdbc.update(m.group());

        assertThat(jdbc.queryForObject("select catalogo_id from exercicio where id = ?", UUID.class, doCatalogo))
                .isEqualTo(catalogo.get("id"));
        assertThat(jdbc.queryForObject("select catalogo_id from exercicio where id = ?", UUID.class, manualComMesmoNome)).isNull();
        assertThat(jdbc.queryForObject("select catalogo_id from exercicio where id = ?", UUID.class, renomeado)).isNull();
    }

    // ---- equipe ----

    @Test
    void treinadorEnviaTrocaEVeAImagemEUmGifSaiSemComentario() throws Exception {
        UUID id = novoExercicio(treinador, "Remada fictícia com imagem");
        ver("/exercicios/" + id + "/imagem", treinador, 404);
        assertThat(doTreino(treinador, id).get("imagemPropriaEm").isNull()).isTrue();

        byte[] gif = gifComComentario();
        assertThat(FotosDeTeste.contem(gif, COMENTARIO)).isTrue();
        JsonNode resposta = api.ler(enviar("/exercicios/" + id + "/imagem", treinador, "demo.gif", gif, 200));
        assertThat(resposta.get("imagemPropriaEm").asString()).isNotBlank();
        assertThat(doTreino(treinador, id).get("imagemPropriaEm").asString()).isNotBlank();

        MvcResult baixada = ver("/exercicios/" + id + "/imagem", treinador, 200);
        assertThat(baixada.getResponse().getContentType()).isEqualTo("image/gif");
        assertThat(baixada.getResponse().getHeader(HttpHeaders.CACHE_CONTROL)).contains("no-store");
        assertThat(baixada.getResponse().getHeader("X-Content-Type-Options")).isEqualTo("nosniff");
        byte[] guardado = baixada.getResponse().getContentAsByteArray();
        assertThat(FotosDeTeste.contem(guardado, COMENTARIO)).isFalse();
        assertThat(FotosDeTeste.contem(guardado, "NETSCAPE2.0")).isTrue();

        // Trocar substitui (uma por exercício), e o tipo vem dos bytes: um PNG com nome .gif é PNG.
        enviar("/exercicios/" + id + "/imagem", treinador, "foto.gif", png(64), 200);
        assertThat(jdbc.queryForObject("select count(*) from exercicio_imagem where exercicio_id = ?", Integer.class, id)).isEqualTo(1);
        assertThat(ver("/exercicios/" + id + "/imagem", treinador, 200).getResponse().getContentType()).isEqualTo("image/png");
        enviar("/exercicios/" + id + "/imagem", treinador, "foto.jpg", FotosDeTeste.comMetadados(FotosDeTeste.jpeg(Color.GREEN)), 200);
        byte[] jpeg = ver("/exercicios/" + id + "/imagem", treinador, 200).getResponse().getContentAsByteArray();
        assertThat(FotosDeTeste.contem(jpeg, FotosDeTeste.MARCA_EXIF)).isFalse();

        assertThat(auditorias("EXERCICIO_IMAGEM_ALTERADA", id)).isEqualTo(3);
        assertThat(jdbc.queryForObject("select resumo from auditoria where acao = 'EXERCICIO_IMAGEM_ALTERADA' and entidade_id = ?::uuid limit 1",
                String.class, id)).isEqualTo("Alterou a imagem de um exercício da biblioteca.");

        api.delete("/exercicios/" + id + "/imagem", treinador, 200);
        assertThat(doTreino(treinador, id).get("imagemPropriaEm").isNull()).isTrue();
        ver("/exercicios/" + id + "/imagem", treinador, 404);
        api.delete("/exercicios/" + id + "/imagem", treinador, 404);
        assertThat(auditorias("EXERCICIO_IMAGEM_REMOVIDA", id)).isEqualTo(1);
    }

    @Test
    void imagemInvalidaOuGrandeDemaisDa422ComCodigo() throws Exception {
        UUID id = novoExercicio(treinador, "Exercício fictício de erro");
        String rota = "/exercicios/" + id + "/imagem";
        String invalida = "IMAGEM_EXERCICIO_INVALIDA";
        // Texto, SVG e vazio: o tipo vem dos bytes e a extensão não conta.
        assertThat(api.ler(enviar(rota, treinador, "a.gif", "não é imagem".getBytes(StandardCharsets.UTF_8), 422)).get("codigo").asString()).isEqualTo(invalida);
        assertThat(api.ler(enviar(rota, treinador, "a.png", "<svg xmlns='http://www.w3.org/2000/svg'/>".getBytes(StandardCharsets.UTF_8), 422)).get("codigo").asString()).isEqualTo(invalida);
        assertThat(api.ler(enviar(rota, treinador, "a.jpg", new byte[0], 422)).get("codigo").asString()).isEqualTo(invalida);
        // GIF truncado (sem o final).
        byte[] gif = gifComComentario();
        assertThat(api.ler(enviar(rota, treinador, "a.gif", java.util.Arrays.copyOf(gif, gif.length - 1), 422)).get("codigo").asString()).isEqualTo(invalida);
        // Lado acima de 800 px, no JPEG e no PNG.
        assertThat(api.ler(enviar(rota, treinador, "a.jpg", FotosDeTeste.jpeg(Color.RED, 900, false), 422)).get("codigo").asString()).isEqualTo(invalida);
        assertThat(api.ler(enviar(rota, treinador, "a.png", png(900), 422)).get("codigo").asString()).isEqualTo(invalida);
        // Acima de 1 MB.
        byte[] enorme = new byte[1_000_001];
        System.arraycopy(gif, 0, enorme, 0, gif.length);
        assertThat(api.ler(enviar(rota, treinador, "a.gif", enorme, 422)).get("codigo").asString()).isEqualTo("IMAGEM_EXERCICIO_GRANDE_DEMAIS");
        assertThat(jdbc.queryForObject("select count(*) from exercicio_imagem where exercicio_id = ?", Integer.class, id)).isZero();
        // Exercício inexistente.
        enviar("/exercicios/" + UUID.randomUUID() + "/imagem", treinador, "a.gif", gif, 404);
    }

    @Test
    void soQuemAlteraAbibliotecaEnviaOutraConsultoriaNaoVeNemAltera() throws Exception {
        UUID id = novoExercicio(treinador, "Exercício fictício de permissão");
        enviar("/exercicios/" + id + "/imagem", treinador, "a.gif", gifComComentario(), 200);

        // Aluno não é equipe: nenhuma das três rotas da equipe.
        UUID aluno = api.criarAluno(treinador, "Aluno Fictício Imagem");
        JsonNode loginAluno = api.convidarEEntrar(treinador, aluno);
        ver("/exercicios/" + id + "/imagem", loginAluno, 403);
        enviar("/exercicios/" + id + "/imagem", loginAluno, "a.gif", gifComComentario(), 403);
        api.delete("/exercicios/" + id + "/imagem", loginAluno, 403);

        // Outra consultoria: 404 em tudo, como se não existisse.
        JsonNode outro = api.novoTreinador();
        ver("/exercicios/" + id + "/imagem", outro, 404);
        enviar("/exercicios/" + id + "/imagem", outro, "a.gif", gifComComentario(), 404);
        api.delete("/exercicios/" + id + "/imagem", outro, 404);
        assertThat(jdbc.queryForObject("select count(*) from exercicio_imagem where exercicio_id = ?", Integer.class, id)).isEqualTo(1);
        // E a lista dela não traz o exercício nem a marca da imagem.
        assertThat(api.get("/exercicios", outro, 200).toString()).doesNotContain(id.toString());
    }

    // ---- aluno ----

    @Test
    void alunoSoVeADemonstracaoDosExerciciosDoPlanoPublicadoDele() throws Exception {
        UUID noPlano = novoExercicio(treinador, "Exercício fictício no plano");
        UUID foraDoPlano = novoExercicio(treinador, "Exercício fictício fora do plano");
        enviar("/exercicios/" + noPlano + "/imagem", treinador, "a.gif", gifComComentario(), 200);
        enviar("/exercicios/" + foraDoPlano + "/imagem", treinador, "b.gif", gifComComentario(), 200);

        UUID aluno = api.criarAluno(treinador, "Aluno Fictício Demonstração");
        JsonNode loginAluno = api.convidarEEntrar(treinador, aluno);

        // Sem plano publicado: nada na lista e a imagem é 404 (mesmo existindo na biblioteca).
        assertThat(api.get("/aluno/exercicios/demonstracoes", loginAluno, 200)).isEmpty();
        ver("/aluno/exercicios/" + noPlano + "/imagem", loginAluno, 404);

        publicarComExercicio(treinador, aluno, noPlano);

        JsonNode lista = api.get("/aluno/exercicios/demonstracoes", loginAluno, 200);
        assertThat(lista).hasSize(1);
        assertThat(lista.get(0).get("exercicioId").asString()).isEqualTo(noPlano.toString());
        assertThat(lista.get(0).get("imagemPropriaEm").asString()).isNotBlank();
        MvcResult imagem = ver("/aluno/exercicios/" + noPlano + "/imagem", loginAluno, 200);
        assertThat(imagem.getResponse().getContentType()).isEqualTo("image/gif");
        assertThat(imagem.getResponse().getHeader(HttpHeaders.CACHE_CONTROL)).contains("no-store");
        // Fora do plano dele: 404, igual a um id que não existe.
        ver("/aluno/exercicios/" + foraDoPlano + "/imagem", loginAluno, 404);
        ver("/aluno/exercicios/" + UUID.randomUUID() + "/imagem", loginAluno, 404);

        // Outro aluno da mesma consultoria, sem esse exercício no plano, também não vê.
        JsonNode loginOutroAluno = api.convidarEEntrar(treinador, api.criarAluno(treinador, "Outro Aluno Fictício"));
        ver("/aluno/exercicios/" + noPlano + "/imagem", loginOutroAluno, 404);
        assertThat(api.get("/aluno/exercicios/demonstracoes", loginOutroAluno, 200)).isEmpty();

        // Aluno de outra consultoria: 404; a equipe não usa a rota do aluno.
        JsonNode outro = api.novoTreinador();
        JsonNode loginDeFora = api.convidarEEntrar(outro, api.criarAluno(outro, "Aluno Fictício de Fora"));
        ver("/aluno/exercicios/" + noPlano + "/imagem", loginDeFora, 404);
        ver("/aluno/exercicios/" + noPlano + "/imagem", treinador, 403);
        api.get("/aluno/exercicios/demonstracoes", treinador, 403);

        // Tirar a imagem tira da lista e da rota.
        api.delete("/exercicios/" + noPlano + "/imagem", treinador, 200);
        assertThat(api.get("/aluno/exercicios/demonstracoes", loginAluno, 200)).isEmpty();
        ver("/aluno/exercicios/" + noPlano + "/imagem", loginAluno, 404);
    }

    @Test
    void exercicioSoEmRascunhoOuNoPlanoDeOutroAlunoDa404() throws Exception {
        UUID soNoRascunho = novoExercicio(treinador, "Exercício fictício só no rascunho");
        UUID noPlanoDeOutro = novoExercicio(treinador, "Exercício fictício no plano de outro aluno");
        enviar("/exercicios/" + soNoRascunho + "/imagem", treinador, "a.gif", gifComComentario(), 200);
        enviar("/exercicios/" + noPlanoDeOutro + "/imagem", treinador, "b.gif", gifComComentario(), 200);

        // Rascunho nunca conta: o plano existe, mas nenhuma versão foi publicada.
        UUID aluno = api.criarAluno(treinador, "Aluno Fictício Rascunho");
        JsonNode loginAluno = api.convidarEEntrar(treinador, aluno);
        rascunhoComExercicio(treinador, aluno, soNoRascunho);
        ver("/aluno/exercicios/" + soNoRascunho + "/imagem", loginAluno, 404);
        assertThat(api.get("/aluno/exercicios/demonstracoes", loginAluno, 200)).isEmpty();

        // Plano publicado de OUTRO aluno da mesma consultoria não abre a imagem para quem tem plano próprio.
        UUID outroAluno = api.criarAluno(treinador, "Outro Aluno Fictício Publicado");
        publicarComExercicio(treinador, outroAluno, noPlanoDeOutro);
        ver("/aluno/exercicios/" + noPlanoDeOutro + "/imagem", loginAluno, 404);
        assertThat(api.get("/aluno/exercicios/demonstracoes", loginAluno, 200)).isEmpty();
        JsonNode loginOutro = api.convidarEEntrar(treinador, outroAluno);
        ver("/aluno/exercicios/" + noPlanoDeOutro + "/imagem", loginOutro, 200);
        ver("/aluno/exercicios/" + soNoRascunho + "/imagem", loginOutro, 404);
    }

    @Test
    void alunoRecebeAsFotosDoCatalogoDoExercicioDoPlanoSemImagemPropria() throws Exception {
        JsonNode catalogo = api.get("/catalogo/exercicios?busca=remada&limite=6", treinador, 200).get("itens").get(0);
        api.post("/exercicios/importar-catalogo", treinador, Map.of("ids", List.of(catalogo.get("id").asString())), 200);
        UUID importado = UUID.fromString(daBiblioteca(treinador, catalogo.get("nome").asString()).get("id").asString());
        UUID aluno = api.criarAluno(treinador, "Aluno Fictício Catálogo");
        JsonNode loginAluno = api.convidarEEntrar(treinador, aluno);
        publicarComExercicio(treinador, aluno, importado);

        JsonNode lista = api.get("/aluno/exercicios/demonstracoes", loginAluno, 200);
        assertThat(lista).hasSize(1);
        assertThat(lista.get(0).get("imagens")).hasSize(2);
        assertThat(lista.get(0).get("imagemPropriaEm").isNull()).isTrue();
        // As fotos do catálogo não passam pela API: sem imagem própria a rota não tem o que devolver.
        ver("/aluno/exercicios/" + importado + "/imagem", loginAluno, 404);
    }
}
