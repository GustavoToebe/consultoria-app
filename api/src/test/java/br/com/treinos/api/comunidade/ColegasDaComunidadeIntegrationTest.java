package br.com.treinos.api.comunidade;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.fotos.FotosDeTeste;
import br.com.treinos.api.treino.ConteudoTreino;
import br.com.treinos.api.treino.ConteudoTreino.Carga;
import br.com.treinos.api.treino.ConteudoTreino.Cardio;
import br.com.treinos.api.treino.ConteudoTreino.ExercicioPlano;
import br.com.treinos.api.treino.ConteudoTreino.Serie;
import br.com.treinos.api.treino.ConteudoTreino.Sessao;
import br.com.treinos.api.treino.ConteudoTreino.Tecnica;
import br.com.treinos.api.web.Fuso;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

import java.awt.Color;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Colegas na comunidade (V070, passos 4 a 6 do plano {@code perfil-estilo-steam}): perfil estendido, foto, atividade recente
 * (só datas), recordes de carga e a lista de quem não reservou. A consultoria de cada teste é nova, então a lista é só dela.
 * Só dados fictícios.
 */
@AutoConfigureMockMvc
class ColegasDaComunidadeIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;

    private ApiDeTeste api;
    private JsonNode admin;
    private UUID alunoA;
    private UUID alunoB;
    private JsonNode loginA;
    private JsonNode loginB;
    private UUID usuarioB;
    private final LocalDate hoje = LocalDate.now(Fuso.BRASILIA);

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        alunoA = api.criarAluno(admin, "Ana Fictícia Colegas");
        alunoB = api.criarAluno(admin, "Beto Fictício Colegas");
        loginA = api.convidarEEntrar(admin, alunoA);
        loginB = api.convidarEEntrar(admin, alunoB);
        usuarioB = usuarioDoAluno(alunoB);
    }

    private UUID usuarioDoAluno(UUID alunoId) {
        return jdbc.queryForObject("select usuario_id from aluno where id = ?", UUID.class, alunoId);
    }

    private void reservar(UUID alunoId, Boolean escolha) {
        jdbc.update("update aluno set perfil_reservado = ? where id = ?", escolha, alunoId);
    }

    private void nascidoEm(UUID alunoId, LocalDate data) {
        jdbc.update("update aluno set data_nascimento = ? where id = ?", data, alunoId);
    }

    private static List<String> campos(JsonNode no) {
        List<String> lista = new ArrayList<>();
        no.propertyNames().forEach(lista::add);
        return lista;
    }

    /** O 404 sem o que muda de chamada para chamada (hora, id da requisição e o caminho com o id pedido). */
    private String erroNormalizado(String caminho, JsonNode login) throws Exception {
        ObjectNode erro = (ObjectNode) api.get(caminho, login, 404);
        erro.remove("timestamp");
        erro.remove("requestId");
        erro.remove("path");
        return erro.toString();
    }

    private void enviarFoto(JsonNode login, byte[] jpeg) throws Exception {
        mvc.perform(multipart(HttpMethod.PUT, "/aluno/foto-perfil").file(new MockMultipartFile("arquivo", "foto.jpg", "image/jpeg", jpeg))
                .header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(login))).andExpect(status().isOk());
    }

    private byte[] baixar(String caminho, JsonNode login, int esperado) throws Exception {
        return mvc.perform(get(caminho).header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(login)))
                .andExpect(status().is(esperado)).andReturn().getResponse().getContentAsByteArray();
    }

    /** B publica um treino, conclui hoje e registra uma série de ontem (70 kg x 5) num exercício da biblioteca. */
    private ApiDeTeste.TreinoDeTeste treinarB() throws Exception {
        var treino = ApiDeTeste.treino();
        api.publicarTreino(admin, alunoB, treino.conteudo());
        jdbc.update("insert into exercicio (id, consultoria_id, nome, grupo_muscular) "
                + "select ?, consultoria_id, 'Remada baixa na polia', 'Costas' from aluno where id = ?", treino.exercicioId(), alunoB);
        String versao = api.get("/aluno/painel", loginB, 200).get("treino").get("versaoId").asString();

        Map<String, Object> sessao = new LinkedHashMap<>();
        sessao.put("id", UUID.randomUUID().toString());
        sessao.put("planoVersaoId", versao);
        sessao.put("sessaoUid", treino.sessaoUid().toString());
        sessao.put("data", hoje.toString());
        sessao.put("concluida", true);
        sessao.put("resultado", "COMPLETA");
        sessao.put("duracaoSegundos", 3000);
        sessao.put("comentario", "comentário fictício secreto");
        sessao.put("alteradoNoAparelhoEm", Instant.now().toString());
        api.post("/aluno/sessoes-concluidas", loginB, Map.of("registros", List.of(sessao)), 200);

        Map<String, Object> serie = new LinkedHashMap<>();
        serie.put("id", UUID.randomUUID().toString());
        serie.put("planoVersaoId", versao);
        serie.put("sessaoUid", treino.sessaoUid().toString());
        serie.put("exercicioUid", treino.exercicioUid().toString());
        serie.put("serieUid", treino.wsUid().toString());
        serie.put("data", hoje.minusDays(1).toString());
        serie.put("carga", "70");
        serie.put("repeticoes", 5);
        serie.put("concluida", true);
        serie.put("alteradoNoAparelhoEm", Instant.now().toString());
        api.post("/aluno/execucoes/lote", loginB, Map.of("registros", List.of(serie)), 200);
        return treino;
    }

    // ---- perfil ----

    @Test
    void perfilVisivelTrazNivelDestaquesCorMolduraFotoAtividadeSoComDatasERecordes() throws Exception {
        reservar(alunoB, false);
        var treino = treinarB();
        enviarFoto(loginB, FotosDeTeste.jpeg(Color.BLUE));
        assertThat(api.get("/aluno/comunidade/conquistas", loginB, 200)).isNotEmpty();
        api.put("/aluno/comunidade/perfil", loginB, Map.of("perfilReservado", false, "destaques", List.of("PRIMEIRO_TREINO"),
                "cor", "ROXO", "moldura", "DUPLA"), 200);

        JsonNode perfil = api.get("/aluno/comunidade/perfis/" + usuarioB, loginA, 200);
        assertThat(campos(perfil)).containsExactlyInAnyOrder("autorId", "nome", "apelido", "ehVoce", "reservado", "treinosConcluidos",
                "nivel", "conquistas", "destaques", "cor", "moldura", "temFoto", "atividade", "recordes");
        assertThat(perfil.get("reservado").asBoolean()).isFalse();
        assertThat(perfil.get("ehVoce").asBoolean()).isFalse();
        assertThat(perfil.get("treinosConcluidos").asInt()).isEqualTo(1);
        assertThat(perfil.get("nivel").asInt()).isEqualTo(1);
        assertThat(perfil.get("cor").asString()).isEqualTo("ROXO");
        assertThat(perfil.get("moldura").asString()).isEqualTo("DUPLA");
        assertThat(perfil.get("temFoto").asBoolean()).isTrue();

        JsonNode destaque = perfil.get("destaques").get(0);
        assertThat(perfil.get("destaques")).hasSize(1);
        assertThat(campos(destaque)).containsExactlyInAnyOrder("tipo", "titulo", "icone");
        assertThat(destaque.get("tipo").asString()).isEqualTo("PRIMEIRO_TREINO");
        assertThat(destaque.get("titulo").asString()).isEqualTo(TipoConquista.PRIMEIRO_TREINO.titulo());
        assertThat(destaque.get("icone").asString()).isEqualTo(TipoConquista.PRIMEIRO_TREINO.icone());

        // Atividade: só datas (os dias treinados) e as últimas conquistas com tipo, título, ícone e o dia.
        JsonNode atividade = perfil.get("atividade");
        assertThat(campos(atividade)).containsExactlyInAnyOrder("diasTreinadosUltimos30", "ultimasConquistas");
        assertThat(atividade.get("diasTreinadosUltimos30").valueStream().map(JsonNode::asString)).containsExactly(hoje.toString());
        JsonNode ultima = atividade.get("ultimasConquistas").get(0);
        assertThat(campos(ultima)).containsExactlyInAnyOrder("tipo", "titulo", "icone", "data");
        assertThat(ultima.get("data").asString()).matches("\\d{4}-\\d{2}-\\d{2}");

        // Recordes: só exercício e carga.
        assertThat(perfil.get("recordes")).hasSize(1);
        JsonNode recorde = perfil.get("recordes").get(0);
        assertThat(campos(recorde)).containsExactlyInAnyOrder("exercicio", "carga");
        assertThat(recorde.get("exercicio").asString()).isEqualTo("Remada baixa na polia");
        assertThat(recorde.get("carga").decimalValue()).isEqualByComparingTo("70");

        // Nada além disso: nem treino, plano, duração, comentário, horário, contato ou id interno.
        String texto = perfil.toString();
        String email = jdbc.queryForObject("select email from usuario where id = ?", String.class, usuarioB);
        assertThat(texto).doesNotContain("Segunda - Costas").doesNotContain("Plano de teste").doesNotContain("duracao")
                .doesNotContain("3000").doesNotContain("comentario").doesNotContain("secreto").doesNotContain("versaoId")
                .doesNotContain("sessao").doesNotContain("serie").doesNotContain("repeticoes").doesNotContain(email)
                .doesNotContain(alunoB.toString()).doesNotContain("telefone").doesNotContain("cpf").doesNotContain("nascimento")
                .doesNotContain("peso");
        assertThat(texto).doesNotContain(treino.exercicioId().toString());
    }

    @Test
    void perfilReservadoSoTrazNomeEApelidoMasODonoVeTudoDoProprio() throws Exception {
        reservar(alunoB, true);
        treinarB();
        enviarFoto(loginB, FotosDeTeste.jpeg(Color.RED));

        JsonNode visto = api.get("/aluno/comunidade/perfis/" + usuarioB, loginA, 200);
        assertThat(campos(visto)).containsExactlyInAnyOrder("autorId", "nome", "apelido", "ehVoce", "reservado");
        assertThat(visto.get("reservado").asBoolean()).isTrue();
        assertThat(visto.get("ehVoce").asBoolean()).isFalse();
        assertThat(visto.get("nome").asString()).isEqualTo("Beto Fictício Colegas");
        assertThat(visto.toString()).doesNotContain("treinosConcluidos").doesNotContain("recordes").doesNotContain("atividade");

        JsonNode proprio = api.get("/aluno/comunidade/perfis/" + usuarioB, loginB, 200);
        assertThat(proprio.get("ehVoce").asBoolean()).isTrue();
        assertThat(campos(proprio)).contains("nivel", "conquistas", "destaques", "atividade", "recordes", "temFoto");
        assertThat(proprio.get("temFoto").asBoolean()).isTrue();
        // A foto do próprio perfil abre mesmo reservado; a dos outros, não.
        assertThat(baixar("/aluno/comunidade/perfis/" + usuarioB + "/foto", loginB, 200)).isNotEmpty();
        baixar("/aluno/comunidade/perfis/" + usuarioB + "/foto", loginA, 404);
    }

    @Test
    void alunoSemEscolhaESemDataNasceReservadoEComDataDeAdultoFicaVisivel() throws Exception {
        assertThat(api.get("/aluno/comunidade/perfis/" + usuarioB, loginA, 200).get("reservado").asBoolean()).isTrue();
        nascidoEm(alunoB, hoje.minusYears(30));
        assertThat(api.get("/aluno/comunidade/perfis/" + usuarioB, loginA, 200).get("reservado").asBoolean()).isFalse();
        nascidoEm(alunoB, hoje.minusYears(12));
        assertThat(api.get("/aluno/comunidade/perfis/" + usuarioB, loginA, 200).get("reservado").asBoolean()).isTrue();
        // A escolha explícita vale sobre a idade.
        reservar(alunoB, false);
        assertThat(api.get("/aluno/comunidade/perfis/" + usuarioB, loginA, 200).get("reservado").asBoolean()).isFalse();
    }

    @Test
    void conquistasDoColegaNaoTrazemIdNemHorarioMasODonoVeAsDele() throws Exception {
        reservar(alunoB, false);
        treinarB();
        assertThat(api.get("/aluno/comunidade/conquistas", loginB, 200)).isNotEmpty();

        JsonNode doColega = api.get("/aluno/comunidade/perfis/" + usuarioB, loginA, 200).get("conquistas");
        assertThat(doColega).isNotEmpty();
        for (JsonNode c : doColega) {
            assertThat(campos(c)).containsExactlyInAnyOrder("tipo", "titulo", "descricao", "icone");
        }
        assertThat(doColega.toString()).doesNotContain("conquistadaEm").doesNotContain("\"id\"");

        JsonNode doDono = api.get("/aluno/comunidade/perfis/" + usuarioB, loginB, 200).get("conquistas");
        assertThat(doDono).hasSameSizeAs(doColega);
        assertThat(campos(doDono.get(0))).containsExactlyInAnyOrder("id", "tipo", "titulo", "descricao", "icone", "conquistadaEm");
    }

    // ---- balde de leitura do perfil e da lista ----

    @Test
    void perfilEListaGastamUmBaldeDe300PorHoraQueNaoGastaOdasEscritas() throws Exception {
        String caminho = "/aluno/comunidade/perfis/" + UUID.randomUUID();
        for (int i = 0; i < 300; i++) {
            mvc.perform(get(caminho).header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(loginA))).andExpect(status().isNotFound());
        }
        // A 301ª, do perfil ou da lista, cai no mesmo balde (contado antes de qualquer checagem).
        for (String rota : List.of(caminho, "/aluno/comunidade/perfis/" + usuarioB, "/aluno/comunidade/perfis")) {
            mvc.perform(get(rota).header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(loginA)))
                    .andExpect(status().isTooManyRequests()).andExpect(header().exists("Retry-After"));
        }
        // O balde das escritas (120) e o da foto seguem intactos; o de B também.
        api.post("/aluno/comunidade/mural", loginA, Map.of("texto", "Post fictício depois do limite de leitura"), 200);
        baixar("/aluno/comunidade/perfis/" + usuarioB + "/foto", loginA, 404);
        api.get("/aluno/comunidade/perfis/" + usuarioB, loginB, 200);
    }

    // ---- recordes do colega: só série simples confirmada pelo índice da versão ----

    @Test
    void recordesDoColegaNaoTrazSerieDeHojeNemNaoConcluidaNemComTecnicaEtapasCardioNemForaDaBiblioteca() throws Exception {
        reservar(alunoB, false);
        UUID sessaoUid = UUID.randomUUID();
        String[] nomes = {"Controle", "Hoje", "Nao concluida", "Com tecnica", "Com etapas", "Cardio", "Fora da biblioteca", "Fora do indice"};
        UUID[] bibliotecaIds = new UUID[nomes.length];
        UUID[] exercicioUids = new UUID[nomes.length];
        UUID[] serieUids = new UUID[nomes.length];
        List<ExercicioPlano> exercicios = new ArrayList<>();
        for (int i = 0; i < nomes.length; i++) {
            bibliotecaIds[i] = UUID.randomUUID();
            exercicioUids[i] = UUID.randomUUID();
            serieUids[i] = UUID.randomUUID();
            Serie serie = Serie.de(serieUids[i], "WORKING", 3, 6, Carga.de("CARGA_TRABALHO"));
            String modalidade = "MAQUINA";
            String unidade = "kg";
            UUID idNoPlano = bibliotecaIds[i];
            if (i == 3) {
                serie = serie.comTecnica(Tecnica.dropSet(1, 20, null, null));
            } else if (i == 5) {
                serie = Serie.de(serieUids[i], null, null, null, null).comCardio(new Cardio(30, null, null, null, null));
                modalidade = "CARDIO";
                unidade = "nenhuma";
                idNoPlano = null;
            }
            exercicios.add(new ExercicioPlano(exercicioUids[i], idNoPlano, "Exercício fictício " + nomes[i], modalidade, null, null, true,
                    unidade, List.of(serie)));
            if (i != 6) { // o 6 "saiu da biblioteca": o plano o cita, mas não há linha em exercicio
                jdbc.update("insert into exercicio (id, consultoria_id, nome, grupo_muscular) "
                        + "select ?, consultoria_id, ?, 'Costas' from aluno where id = ?", bibliotecaIds[i], "Biblioteca " + nomes[i], alunoB);
            }
        }
        var conteudo = new ConteudoTreino("Objetivo fictício", null,
                List.of(new Sessao(sessaoUid, "Segunda - Costas", 1, "TREINO", null, null, null, exercicios)));
        api.publicarTreino(admin, alunoB, conteudo);
        String versao = api.get("/aluno/painel", loginB, 200).get("treino").get("versaoId").asString();

        List<Map<String, Object>> lote = new ArrayList<>();
        for (int i = 0; i < nomes.length; i++) {
            Map<String, Object> r = new LinkedHashMap<>();
            r.put("id", UUID.randomUUID().toString());
            r.put("planoVersaoId", versao);
            r.put("sessaoUid", sessaoUid.toString());
            r.put("exercicioUid", exercicioUids[i].toString());
            r.put("serieUid", serieUids[i].toString());
            r.put("data", (i == 1 ? hoje : hoje.minusDays(1)).toString());
            if (i != 5) {
                r.put("carga", String.valueOf(100 + i));
                r.put("repeticoes", 5);
            }
            r.put("concluida", i != 2);
            r.put("alteradoNoAparelhoEm", Instant.now().toString());
            lote.add(r);
        }
        api.post("/aluno/execucoes/lote", loginB, Map.of("registros", lote), 200);
        // O cardio e as etapas não chegam ao banco com carga pelo caminho normal: o índice da versão é que tem de barrá-los.
        jdbc.update("update execucao_serie set exercicio_id = ?, carga = 150, repeticoes = 10 where serie_uid = ?", bibliotecaIds[5], serieUids[5]);
        jdbc.update("update execucao_serie set etapas = cast('[{\"posicao\":1,\"repeticoes\":4,\"carga\":140,\"situacao\":\"FEITA\"}]' as jsonb) "
                + "where serie_uid = ?", serieUids[4]);
        // Série cujo uid não está no índice da versão (não deveria acontecer): na regra do colega, não entra.
        jdbc.update("update execucao_serie set serie_uid = ? where serie_uid = ?", UUID.randomUUID(), serieUids[7]);

        JsonNode recordes = api.get("/aluno/comunidade/perfis/" + usuarioB, loginA, 200).get("recordes");
        assertThat(recordes.valueStream().map(r -> r.get("exercicio").asString())).containsExactly("Biblioteca Controle");
        assertThat(recordes.get(0).get("carga").decimalValue()).isEqualByComparingTo("100");
    }

    // ---- recusas: perfil e foto ----

    @Test
    void perfilEFotoDeQualquerOutroCasoDaoOMesmo404SemDistinguir() throws Exception {
        JsonNode outraEquipe = api.novoTreinador();
        UUID alunoDeFora = api.criarAluno(outraEquipe, "Aluno de outra consultoria");
        api.convidarEEntrar(outraEquipe, alunoDeFora);
        reservar(alunoDeFora, false);
        UUID equipe = jdbc.queryForObject("select id from usuario where consultoria_id = (select consultoria_id from aluno where id = ?)"
                + " and papel = 'TREINADOR' limit 1", UUID.class, alunoA);
        UUID inativo = api.criarAluno(admin, "Aluno inativo fictício");
        api.convidarEEntrar(admin, inativo);
        reservar(inativo, false);
        api.patch("/alunos/" + inativo + "/situacao", admin, Map.of("ativo", false), 200);
        UUID anonimizado = api.criarAluno(admin, "Aluno anonimizado fictício");
        JsonNode loginAnonimizado = api.convidarEEntrar(admin, anonimizado);
        reservar(anonimizado, false);
        api.post("/aluno/conta/excluir", loginAnonimizado, Map.of("senha", ApiDeTeste.SENHA, "confirmacao", "EXCLUIR"), 204);
        // O aluno visível sem foto e o reservado com foto também não se distinguem na rota da foto.
        UUID semFoto = api.criarAluno(admin, "Aluno visível sem foto");
        api.convidarEEntrar(admin, semFoto);
        reservar(semFoto, false);
        reservar(alunoB, true);
        enviarFoto(loginB, FotosDeTeste.jpeg(Color.GREEN));

        List<UUID> alvosDoPerfil = List.of(usuarioDoAluno(alunoDeFora), equipe, usuarioDoAluno(inativo), usuarioDoAluno(anonimizado),
                UUID.randomUUID());
        String esperadoDoPerfil = erroNormalizado("/aluno/comunidade/perfis/" + alvosDoPerfil.get(0), loginA);
        for (UUID alvo : alvosDoPerfil) {
            assertThat(erroNormalizado("/aluno/comunidade/perfis/" + alvo, loginA)).isEqualTo(esperadoDoPerfil);
        }

        List<UUID> alvosDaFoto = new ArrayList<>(alvosDoPerfil);
        alvosDaFoto.add(usuarioB);                    // reservado, com foto
        alvosDaFoto.add(usuarioDoAluno(semFoto));     // visível, sem foto
        String esperadoDaFoto = erroNormalizado("/aluno/comunidade/perfis/" + alvosDaFoto.get(0) + "/foto", loginA);
        for (UUID alvo : alvosDaFoto) {
            assertThat(erroNormalizado("/aluno/comunidade/perfis/" + alvo + "/foto", loginA)).isEqualTo(esperadoDaFoto);
        }
        // A mensagem é a mesma do perfil: a foto não conta mais do que ele.
        assertThat(esperadoDaFoto).isEqualTo(esperadoDoPerfil);
    }

    @Test
    void semLoginEComEquipeAsRotasNovasRecusam() throws Exception {
        String perfil = "/aluno/comunidade/perfis/" + usuarioB;
        for (String caminho : List.of(perfil, perfil + "/foto", "/aluno/comunidade/perfis")) {
            api.get(caminho, null, 401);
            api.get(caminho, admin, 403);
        }
    }

    @Test
    void fotoDoColegaVisivelVemSemCacheEIgualAoQueEleEnviou() throws Exception {
        reservar(alunoB, false);
        enviarFoto(loginB, FotosDeTeste.jpeg(Color.BLUE));
        byte[] dele = baixar("/aluno/foto-perfil", loginB, 200);
        var resposta = mvc.perform(get("/aluno/comunidade/perfis/" + usuarioB + "/foto")
                        .header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(loginA)))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CONTENT_TYPE, MediaType.IMAGE_JPEG_VALUE))
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, org.hamcrest.Matchers.containsString("no-store")))
                .andReturn().getResponse();
        assertThat(resposta.getContentAsByteArray()).isEqualTo(dele);
    }

    @Test
    void fotoDoColegaTemBaldeProprioDe300PorHoraPorUsuario() throws Exception {
        String caminho = "/aluno/comunidade/perfis/" + UUID.randomUUID() + "/foto";
        for (int i = 0; i < 300; i++) {
            mvc.perform(get(caminho).header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(loginA))).andExpect(status().isNotFound());
        }
        mvc.perform(get(caminho).header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(loginA)))
                .andExpect(status().isTooManyRequests()).andExpect(header().exists("Retry-After"));
        // O balde é de A e da foto: o perfil, a lista e a foto de B seguem abertos.
        api.get("/aluno/comunidade/perfis/" + usuarioB, loginA, 200);
        api.get("/aluno/comunidade/perfis", loginA, 200);
        baixar("/aluno/comunidade/perfis/" + usuarioB + "/foto", loginB, 404);
    }

    // ---- lista ----

    @Test
    void listaTrazSoQuemNaoReservouSemOProprioEOTotalNaoRevelaQuemReservou() throws Exception {
        JsonNode outraEquipe = api.novoTreinador();
        UUID alunoDeFora = api.criarAluno(outraEquipe, "Aluno de outra consultoria");
        api.convidarEEntrar(outraEquipe, alunoDeFora);
        reservar(alunoDeFora, false);
        UUID inativo = api.criarAluno(admin, "Aluno inativo fictício");
        api.convidarEEntrar(admin, inativo);
        reservar(inativo, false);
        api.patch("/alunos/" + inativo + "/situacao", admin, Map.of("ativo", false), 200);
        UUID anonimizado = api.criarAluno(admin, "Aluno anonimizado fictício");
        JsonNode loginAnonimizado = api.convidarEEntrar(admin, anonimizado);
        reservar(anonimizado, false);
        api.post("/aluno/conta/excluir", loginAnonimizado, Map.of("senha", ApiDeTeste.SENHA, "confirmacao", "EXCLUIR"), 204);
        // Aluno cadastrado mas sem acesso (sem usuário) também não aparece.
        UUID semAcesso = api.criarAluno(admin, "Aluno sem acesso");
        reservar(semAcesso, false);

        // Hoje A é o único aluno com acesso além de B: ambos reservados por padrão (sem data), a lista vem vazia.
        reservar(alunoA, false);
        JsonNode vazia = api.get("/aluno/comunidade/perfis", loginA, 200);
        assertThat(vazia.get("itens")).isEmpty();
        assertThat(vazia.get("total").asLong()).isZero();

        UUID adulto = api.criarAluno(admin, "Édson Adulto");
        api.convidarEEntrar(admin, adulto);
        nascidoEm(adulto, hoje.minusYears(25));
        UUID menor = api.criarAluno(admin, "Zeca Menor");
        api.convidarEEntrar(admin, menor);
        nascidoEm(menor, hoje.minusYears(15));
        UUID semData = api.criarAluno(admin, "Zélia Sem Data");
        api.convidarEEntrar(admin, semData);
        UUID escolheuVisivel = api.criarAluno(admin, "Eduardo Escolheu");
        api.convidarEEntrar(admin, escolheuVisivel);
        reservar(escolheuVisivel, false);
        nascidoEm(escolheuVisivel, hoje.minusYears(10));
        reservar(alunoB, true);
        enviarFoto(loginB, FotosDeTeste.jpeg(Color.GRAY));
        UUID comFoto = api.criarAluno(admin, "Ágata Com Foto");
        JsonNode loginComFoto = api.convidarEEntrar(admin, comFoto);
        reservar(comFoto, false);
        enviarFoto(loginComFoto, FotosDeTeste.jpeg(Color.ORANGE));

        JsonNode lista = api.get("/aluno/comunidade/perfis", loginA, 200);
        assertThat(campos(lista)).containsExactlyInAnyOrder("itens", "total");
        // Ordem por nome sem acento: Ágata, Édson, Eduardo. Nunca A (o próprio), B (reservou), Zeca (menor), Zélia (sem data).
        assertThat(lista.get("itens").valueStream().map(i -> i.get("nome").asString()))
                .containsExactly("Ágata Com Foto", "Édson Adulto", "Eduardo Escolheu");
        assertThat(lista.get("total").asLong()).isEqualTo(3);
        JsonNode primeiro = lista.get("itens").get(0);
        assertThat(campos(primeiro)).containsExactlyInAnyOrder("autorId", "nome", "apelido", "nivel", "temFoto");
        assertThat(primeiro.get("autorId").asString()).isEqualTo(usuarioDoAluno(comFoto).toString());
        assertThat(primeiro.get("temFoto").asBoolean()).isTrue();
        assertThat(primeiro.get("nivel").asInt()).isEqualTo(1);
        assertThat(lista.get("itens").get(1).get("temFoto").asBoolean()).isFalse();
        String texto = lista.toString();
        assertThat(texto).doesNotContain("nascimento").doesNotContain("reservado").doesNotContain("Beto").doesNotContain("Zeca")
                .doesNotContain("Zélia").doesNotContain("Ana Fictícia").doesNotContain("outra consultoria").doesNotContain("inativo")
                .doesNotContain("anonimizado").doesNotContain("sem acesso");

        // Isolamento: a lista de outra consultoria só tem o dela.
        JsonNode loginFora = api.convidarEEntrar(outraEquipe, api.criarAluno(outraEquipe, "Colega de fora"));
        UUID colegaDeFora = api.criarAluno(outraEquipe, "Colega de fora dois");
        api.convidarEEntrar(outraEquipe, colegaDeFora);
        reservar(colegaDeFora, false);
        JsonNode deFora = api.get("/aluno/comunidade/perfis", loginFora, 200);
        assertThat(deFora.get("itens").valueStream().map(i -> i.get("nome").asString()))
                .containsExactlyInAnyOrder("Aluno de outra consultoria", "Colega de fora dois");
        assertThat(deFora.get("total").asLong()).isEqualTo(2);
    }

    @Test
    void listaPaginaComTotalFixoETamanhoLimitadoNoServidor() throws Exception {
        for (String nome : List.of("Carla", "Bruna", "Daniel")) {
            UUID id = api.criarAluno(admin, nome + " Paginada");
            api.convidarEEntrar(admin, id);
            reservar(id, false);
        }
        reservar(alunoA, false);
        reservar(alunoB, false);
        // Ordem: Beto, Bruna, Carla, Daniel (A é o próprio e não entra).
        JsonNode p0 = api.get("/aluno/comunidade/perfis?pagina=0&tamanho=3", loginA, 200);
        JsonNode p1 = api.get("/aluno/comunidade/perfis?pagina=1&tamanho=3", loginA, 200);
        assertThat(p0.get("total").asLong()).isEqualTo(4);
        assertThat(p1.get("total").asLong()).isEqualTo(4);
        assertThat(p0.get("itens")).hasSize(3);
        assertThat(p0.get("itens").get(0).get("nome").asString()).startsWith("Beto");
        assertThat(p1.get("itens")).hasSize(1);
        assertThat(p1.get("itens").get(0).get("nome").asString()).startsWith("Daniel");
        // Tamanho fora da faixa é cortado no servidor (1 a 100); página negativa vira a primeira; além do fim, vazia.
        assertThat(api.get("/aluno/comunidade/perfis?tamanho=0", loginA, 200).get("itens")).hasSize(1);
        assertThat(api.get("/aluno/comunidade/perfis?tamanho=100000", loginA, 200).get("itens")).hasSize(4);
        assertThat(api.get("/aluno/comunidade/perfis?pagina=-5", loginA, 200).get("itens")).hasSize(4);
        JsonNode alem = api.get("/aluno/comunidade/perfis?pagina=9&tamanho=3", loginA, 200);
        assertThat(alem.get("itens")).isEmpty();
        assertThat(alem.get("total").asLong()).isEqualTo(4);
    }
}
