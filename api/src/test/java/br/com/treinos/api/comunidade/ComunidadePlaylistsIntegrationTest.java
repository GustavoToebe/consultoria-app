package br.com.treinos.api.comunidade;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Playlists de aulões ("coleções" na tela; V088): CRUD, ordem dentro da playlist, lote, isolamento por consultoria (404 uniforme
 * nas rotas com id e no lote, 422 no corpo do aulão), permissões e o que o aluno enxerga. Só dados fictícios; cada teste usa a
 * própria consultoria.
 */
@AutoConfigureMockMvc
class ComunidadePlaylistsIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JsonMapper json;
    @Autowired
    private JdbcTemplate jdbc;

    private ApiDeTeste api;
    private JsonNode admin;
    private JsonNode loginAluno;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        loginAluno = api.convidarEEntrar(admin, api.criarAluno(admin, "Aluna de Coleções"));
    }

    private String playlist(JsonNode login, String nome) throws Exception {
        return api.post("/comunidade/playlists", login, Map.of("nome", nome), 200).get("id").asString();
    }

    private Map<String, Object> corpoDaAula(String playlistId, boolean publicada) {
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("titulo", "Aulão fictício");
        corpo.put("videoUrl", "https://youtube.com/watch?v=abc");
        corpo.put("playlistId", playlistId);
        corpo.put("publicada", publicada);
        return corpo;
    }

    private String aula(JsonNode login, String playlistId, boolean publicada) throws Exception {
        return api.post("/comunidade/aulas", login, corpoDaAula(playlistId, publicada), 200).get("id").asString();
    }

    /** Ids dos aulões da playlist ({@code null} = sem playlist) na ordem em que a lista da equipe os devolve. */
    private List<String> idsDa(String playlistId) throws Exception {
        List<String> r = new ArrayList<>();
        for (JsonNode a : api.get("/comunidade/aulas", admin, 200)) {
            String doAulao = a.get("playlistId").isNull() ? null : a.get("playlistId").asString();
            if (java.util.Objects.equals(doAulao, playlistId)) {
                r.add(a.get("id").asString());
            }
        }
        return r;
    }

    private JsonNode resumoDaAula(String id) throws Exception {
        for (JsonNode a : api.get("/comunidade/aulas", admin, 200)) {
            if (a.get("id").asString().equals(id)) {
                return a;
            }
        }
        throw new AssertionError("Aulão fora da lista.");
    }

    private List<String> idsDasPlaylists(JsonNode login) throws Exception {
        List<String> r = new ArrayList<>();
        api.get("/comunidade/playlists", login, 200).forEach(p -> r.add(p.get("id").asString()));
        return r;
    }

    private JsonNode membro(Set<String> permissoes) throws Exception {
        String perfil = api.post("/perfis", admin, Map.of("nome", "Perfil " + UUID.randomUUID(), "permissoes", permissoes), 200)
                .get("id").asString();
        JsonNode convite = api.post("/usuarios/convites", admin,
                Map.of("nome", "Membro fictício", "email", ApiDeTeste.emailUnico("membro"), "perfilId", perfil), 200);
        return api.post("/publico/convites-equipe/aceitar", null,
                Map.of("codigo", convite.get("codigo").asString(), "senha", ApiDeTeste.SENHA), 200);
    }

    private int contar(String sql, Object... args) {
        return jdbc.queryForObject(sql, Integer.class, args);
    }

    @Test
    void crudDaPlaylistEExcluirDeixaOsAuloesSemPlaylist() throws Exception {
        JsonNode criada = api.post("/comunidade/playlists", admin, Map.of("nome", "  Mobilidade   de ombro "), 200);
        String id = criada.get("id").asString();
        assertThat(criada.get("nome").asString()).isEqualTo("Mobilidade de ombro");
        assertThat(criada.get("totalAulas").asLong()).isZero();
        String segunda = playlist(admin, "Hipertrofia");
        assertThat(idsDasPlaylists(admin)).containsExactly(id, segunda);

        String aula = aula(admin, id, true);
        String segundaAula = aula(admin, id, true);
        assertThat(resumoDaAula(segundaAula).get("ordem").asInt()).isEqualTo(1);
        assertThat(api.put("/comunidade/playlists/" + id, admin, Map.of("nome", "Ombros"), 200).get("totalAulas").asLong()).isEqualTo(2);
        assertThat(api.get("/comunidade/playlists", admin, 200).get(0).get("nome").asString()).isEqualTo("Ombros");

        // Nome repetido (sem diferença de maiúsculas) = 409 no código próprio, sem repetir o valor; vazio ou longo = 422 no campo.
        JsonNode repetido = api.post("/comunidade/playlists", admin, Map.of("nome", "HIPERTROFIA"), 409);
        assertThat(repetido.get("codigo").asString()).isEqualTo("PLAYLIST_NOME_EM_USO");
        assertThat(repetido.toString()).doesNotContain("HIPERTROFIA");
        api.put("/comunidade/playlists/" + segunda, admin, Map.of("nome", "ombros"), 409);
        // Renomear para o mesmo nome (com outra caixa) da própria playlist não conflita.
        api.put("/comunidade/playlists/" + id, admin, Map.of("nome", "OMBROS"), 200);
        for (String ruim : List.of("   ", "x".repeat(61))) {
            JsonNode erro = api.post("/comunidade/playlists", admin, Map.of("nome", ruim), 422);
            assertThat(erro.get("codigo").asString()).isEqualTo("PLAYLIST_INVALIDA");
            assertThat(erro.get("fieldErrors").get(0).get("field").asString()).isEqualTo("nome");
        }

        // Excluir não apaga o aulão: ele perde a playlist e a ordem volta a 0 (sem playlist, ordem 0).
        api.delete("/comunidade/playlists/" + id, admin, 204);
        assertThat(idsDasPlaylists(admin)).containsExactly(segunda);
        assertThat(resumoDaAula(aula).get("playlistId").isNull()).isTrue();
        assertThat(resumoDaAula(aula).get("ordem").asInt()).isZero();
        assertThat(resumoDaAula(segundaAula).get("playlistId").isNull()).isTrue();
        assertThat(resumoDaAula(segundaAula).get("ordem").asInt()).isZero();
        assertThat(contar("select count(*) from comunidade_aula where id = ?::uuid and playlist_id is null and consultoria_id is not null",
                aula)).isEqualTo(1);
        api.delete("/comunidade/playlists/" + id, admin, 404);
    }

    @Test
    void ordemDosAuloesVaiParaOFimEValeDentroDaPlaylist() throws Exception {
        String p1 = playlist(admin, "Primeira");
        String p2 = playlist(admin, "Segunda");
        String a = aula(admin, p1, true);
        String b = aula(admin, p1, true);
        String c = aula(admin, p1, false);
        String solto = aula(admin, null, true);
        assertThat(List.of(a, b, c).stream().map(id -> {
            try {
                return resumoDaAula(id).get("ordem").asInt();
            } catch (Exception e) {
                throw new IllegalStateException(e);
            }
        }).toList()).containsExactly(0, 1, 2);
        assertThat(resumoDaAula(solto).get("ordem").asInt()).isZero();
        assertThat(idsDa(p1)).containsExactly(a, b, c);

        api.put("/comunidade/playlists/" + p1 + "/aulas/ordem", admin, Map.of("ids", List.of(c, a, b)), 204);
        assertThat(idsDa(p1)).containsExactly(c, a, b);
        assertThat(resumoDaAula(c).get("ordem").asInt()).isZero();
        assertThat(resumoDaAula(b).get("ordem").asInt()).isEqualTo(2);

        // Lista incompleta, com repetido ou com aulão da mesma consultoria que está em outra playlist (a tela estava velha): 409 e a
        // ordem não muda. Aulão inexistente: 404 (o de outra consultoria também, no teste de isolamento).
        api.put("/comunidade/playlists/" + p1 + "/aulas/ordem", admin, Map.of("ids", List.of(a, b)), 409);
        api.put("/comunidade/playlists/" + p1 + "/aulas/ordem", admin, Map.of("ids", List.of(a, a, b, c)), 409);
        JsonNode velha = api.put("/comunidade/playlists/" + p1 + "/aulas/ordem", admin, Map.of("ids", List.of(a, b, c, solto)), 409);
        assertThat(velha.get("codigo").asString()).isEqualTo("CONFLITO_EDICAO");
        api.put("/comunidade/playlists/" + p1 + "/aulas/ordem", admin, Map.of("ids", List.of(a, b, solto)), 409);
        api.put("/comunidade/playlists/" + p2 + "/aulas/ordem", admin, Map.of("ids", List.of(a, b, c)), 409);
        api.put("/comunidade/playlists/" + p1 + "/aulas/ordem", admin, Map.of("ids", List.of(a, b, UUID.randomUUID())), 404);
        api.put("/comunidade/playlists/" + p1 + "/aulas/ordem", admin, Map.of("ids", List.of()), 400);
        assertThat(idsDa(p1)).containsExactly(c, a, b);

        // Editar sem trocar de playlist mantém a posição; trocar manda para o fim da nova (a posição na nova começa em 0).
        api.put("/comunidade/aulas/" + a, admin, corpoDaAula(p1, true), 200);
        assertThat(idsDa(p1)).containsExactly(c, a, b);
        assertThat(api.put("/comunidade/aulas/" + a, admin, corpoDaAula(p2, true), 200).get("ordem").asInt()).isZero();
        assertThat(api.put("/comunidade/aulas/" + b, admin, corpoDaAula(p2, true), 200).get("ordem").asInt()).isEqualTo(1);
        assertThat(idsDa(p2)).containsExactly(a, b);
        assertThat(idsDa(p1)).containsExactly(c);
        // Tirar da playlist pelo corpo: playlistId nulo, posição 0.
        JsonNode fora = api.put("/comunidade/aulas/" + a, admin, corpoDaAula(null, true), 200);
        assertThat(fora.get("playlistId").isNull()).isTrue();
        assertThat(fora.get("ordem").asInt()).isZero();
    }

    @Test
    void ordemDasPlaylists() throws Exception {
        String x = playlist(admin, "X");
        String y = playlist(admin, "Y");
        String z = playlist(admin, "Z");
        assertThat(idsDasPlaylists(admin)).containsExactly(x, y, z);

        api.put("/comunidade/playlists/ordem", admin, Map.of("ids", List.of(z, x, y)), 204);
        assertThat(idsDasPlaylists(admin)).containsExactly(z, x, y);
        assertThat(api.get("/comunidade/playlists", admin, 200).get(0).get("ordem").asInt()).isZero();

        // Incompleta ou repetida = 409; id que não existe = 404; a ordem não muda.
        api.put("/comunidade/playlists/ordem", admin, Map.of("ids", List.of(x, y)), 409);
        api.put("/comunidade/playlists/ordem", admin, Map.of("ids", List.of(x, x, y, z)), 409);
        api.put("/comunidade/playlists/ordem", admin, Map.of("ids", List.of(x, y, z, UUID.randomUUID())), 404);
        assertThat(idsDasPlaylists(admin)).containsExactly(z, x, y);
        // Teto do pedido: mais de 500 ids é 400, antes de qualquer consulta.
        api.put("/comunidade/playlists/ordem", admin, Map.of("ids", java.util.stream.Stream.generate(UUID::randomUUID).limit(501).toList()), 400);
    }

    @Test
    void loteMoveParaOFimNaOrdemEnviadaETiraDaPlaylist() throws Exception {
        String p1 = playlist(admin, "Origem");
        String p2 = playlist(admin, "Destino");
        String a = aula(admin, p1, true);
        String b = aula(admin, p1, true);
        String c = aula(admin, null, true);
        String jaNoDestino = aula(admin, p2, true);

        api.put("/comunidade/aulas/playlist", admin, Map.of("aulaIds", List.of(c, a, jaNoDestino, c), "playlistId", p2), 204);
        // O que já estava no destino fica onde estava; os outros entram no fim, na ordem do pedido (o repetido conta uma vez).
        assertThat(idsDa(p2)).containsExactly(jaNoDestino, c, a);
        assertThat(idsDa(p1)).containsExactly(b);

        Map<String, Object> tirar = new LinkedHashMap<>();
        tirar.put("aulaIds", List.of(c, a));
        tirar.put("playlistId", null);
        api.put("/comunidade/aulas/playlist", admin, tirar, 204);
        assertThat(idsDa(p2)).containsExactly(jaNoDestino);
        assertThat(idsDa(null)).containsExactlyInAnyOrder(c, a);

        // Tamanho do pedido: de 1 a 100.
        api.put("/comunidade/aulas/playlist", admin, Map.of("aulaIds", List.of(), "playlistId", p1), 400);
        api.put("/comunidade/aulas/playlist", admin,
                Map.of("aulaIds", java.util.stream.Stream.generate(UUID::randomUUID).limit(101).toList(), "playlistId", p1), 400);
    }

    @Test
    void loteComIdDeOutraConsultoriaOuInexistenteDa404UniformeENadaMuda() throws Exception {
        JsonNode outro = api.novoTreinador();
        String playlistDoOutro = playlist(outro, "Coleção do outro");
        String aulaDoOutro = aula(outro, playlistDoOutro, true);
        String p1 = playlist(admin, "Minha");
        String minha = aula(admin, null, true);

        // Mesmo 404 para "de outra consultoria" e "não existe", na mensagem e no código.
        JsonNode deOutro = api.put("/comunidade/aulas/playlist", admin, Map.of("aulaIds", List.of(minha, aulaDoOutro), "playlistId", p1), 404);
        JsonNode inexistente = api.put("/comunidade/aulas/playlist", admin,
                Map.of("aulaIds", List.of(minha, UUID.randomUUID()), "playlistId", p1), 404);
        assertThat(deOutro.get("message")).isEqualTo(inexistente.get("message"));
        assertThat(deOutro.get("codigo")).isEqualTo(inexistente.get("codigo"));
        // Playlist de destino de outra consultoria ou inexistente: o mesmo 404.
        JsonNode destinoDeOutro = api.put("/comunidade/aulas/playlist", admin,
                Map.of("aulaIds", List.of(minha), "playlistId", playlistDoOutro), 404);
        JsonNode destinoInexistente = api.put("/comunidade/aulas/playlist", admin,
                Map.of("aulaIds", List.of(minha), "playlistId", UUID.randomUUID()), 404);
        assertThat(destinoDeOutro.get("message")).isEqualTo(destinoInexistente.get("message"));
        // Nada se moveu, nem do lado de lá.
        assertThat(idsDa(null)).containsExactly(minha);
        assertThat(contar("select count(*) from comunidade_aula where id = ?::uuid and playlist_id = ?::uuid", aulaDoOutro,
                playlistDoOutro)).isEqualTo(1);
    }

    @Test
    void playlistEAulaoDeOutraConsultoriaDao404NasRotasComIdE422NoCorpoDoAulao() throws Exception {
        JsonNode outro = api.novoTreinador();
        String playlistDoOutro = playlist(outro, "Coleção do outro");
        String aulaDoOutro = aula(outro, playlistDoOutro, true);
        String minha = playlist(admin, "Minha");
        String meuAulao = aula(admin, minha, true);

        api.put("/comunidade/playlists/" + playlistDoOutro, admin, Map.of("nome", "Invadida"), 404);
        api.delete("/comunidade/playlists/" + playlistDoOutro, admin, 404);
        api.put("/comunidade/playlists/" + playlistDoOutro + "/aulas/ordem", admin, Map.of("ids", List.of(aulaDoOutro)), 404);
        JsonNode aulaDeOutro = api.put("/comunidade/playlists/" + minha + "/aulas/ordem", admin,
                Map.of("ids", List.of(meuAulao, aulaDoOutro)), 404);
        JsonNode aulaInexistente = api.put("/comunidade/playlists/" + minha + "/aulas/ordem", admin,
                Map.of("ids", List.of(meuAulao, UUID.randomUUID())), 404);
        assertThat(aulaDeOutro.get("message")).isEqualTo(aulaInexistente.get("message"));
        assertThat(aulaDeOutro.get("codigo")).isEqualTo(aulaInexistente.get("codigo"));
        api.put("/comunidade/playlists/ordem", admin, Map.of("ids", List.of(minha, playlistDoOutro)), 404);
        api.put("/comunidade/playlists/ordem", admin, Map.of("ids", List.of(playlistDoOutro)), 404);

        // No corpo do aulão (criar e alterar): 422 no campo playlistId, e o aulão não nasce nem muda.
        JsonNode erro = api.post("/comunidade/aulas", admin, corpoDaAula(playlistDoOutro, true), 422);
        assertThat(erro.get("fieldErrors").get(0).get("field").asString()).isEqualTo("playlistId");
        assertThat(erro.toString()).doesNotContain(playlistDoOutro);
        api.put("/comunidade/aulas/" + meuAulao, admin, corpoDaAula(playlistDoOutro, true), 422);
        api.post("/comunidade/aulas", admin, corpoDaAula(UUID.randomUUID().toString(), true), 422);
        assertThat(idsDa(minha)).containsExactly(meuAulao);

        // O outro lado segue intacto.
        assertThat(contar("select count(*) from comunidade_playlist where id = ?::uuid and nome = 'Coleção do outro'", playlistDoOutro))
                .isEqualTo(1);
        assertThat(api.get("/comunidade/playlists", outro, 200)).hasSize(1);
    }

    @Test
    void semComunidadeModerarNaoEscreveEAlunoNaoUsaAsRotasDaEquipe() throws Exception {
        String p = playlist(admin, "Da equipe");
        String a = aula(admin, p, true);
        JsonNode soLer = membro(Set.of("TREINO_LER"));

        assertThat(api.get("/comunidade/playlists", soLer, 200)).hasSize(1);
        api.post("/comunidade/playlists", soLer, Map.of("nome", "Nova"), 403);
        api.put("/comunidade/playlists/" + p, soLer, Map.of("nome", "Nova"), 403);
        api.delete("/comunidade/playlists/" + p, soLer, 403);
        api.put("/comunidade/playlists/ordem", soLer, Map.of("ids", List.of(p)), 403);
        api.put("/comunidade/playlists/" + p + "/aulas/ordem", soLer, Map.of("ids", List.of(a)), 403);
        api.put("/comunidade/aulas/playlist", soLer, Map.of("aulaIds", List.of(a), "playlistId", p), 403);
        assertThat(idsDasPlaylists(admin)).containsExactly(p);

        JsonNode semLer = membro(Set.of("ALUNO_LER"));
        api.get("/comunidade/playlists", semLer, 403);
        api.get("/comunidade/playlists", loginAluno, 403);
        api.post("/comunidade/playlists", loginAluno, Map.of("nome", "Nova"), 403);
        api.put("/comunidade/aulas/playlist", loginAluno, Map.of("aulaIds", List.of(a), "playlistId", p), 403);
        api.get("/comunidade/playlists", null, 401);
        // A rota do aluno é só do aluno.
        api.get("/aluno/comunidade/playlists", admin, 403);
        api.get("/aluno/comunidade/playlists", null, 401);
    }

    @Test
    void alunoSoVePlaylistComAulaoPublicadoEOTotalContaSoOsPublicados() throws Exception {
        String vazia = playlist(admin, "Vazia");
        String soRascunho = playlist(admin, "Só rascunho");
        String mista = playlist(admin, "Mista");
        aula(admin, soRascunho, false);
        String publicado = aula(admin, mista, true);
        String rascunho = aula(admin, mista, false);

        JsonNode doAluno = api.get("/aluno/comunidade/playlists", loginAluno, 200);
        assertThat(doAluno).hasSize(1);
        assertThat(doAluno.get(0).get("id").asString()).isEqualTo(mista);
        assertThat(doAluno.get(0).get("totalAulas").asLong()).isEqualTo(1);
        assertThat(doAluno.toString()).doesNotContain(vazia).doesNotContain(soRascunho);
        assertThat(doAluno.get(0).propertyNames()).containsExactlyInAnyOrder("id", "nome", "ordem", "totalAulas");

        // A equipe vê as três e o total inclui o rascunho.
        JsonNode daEquipe = api.get("/comunidade/playlists", admin, 200);
        assertThat(daEquipe).hasSize(3);
        assertThat(daEquipe.get(2).get("totalAulas").asLong()).isEqualTo(2);

        // O aluno vê o aulão publicado com o playlistId e nunca o rascunho.
        JsonNode aulas = api.get("/aluno/comunidade/aulas", loginAluno, 200);
        List<String> ids = new ArrayList<>();
        aulas.forEach(x -> ids.add(x.get("id").asString()));
        assertThat(ids).contains(publicado).doesNotContain(rascunho);
        for (JsonNode x : aulas) {
            if (x.get("id").asString().equals(publicado)) {
                assertThat(x.get("playlistId").asString()).isEqualTo(mista);
            }
        }

        // Despublicar o único publicado faz a playlist sumir para o aluno.
        api.put("/comunidade/aulas/" + publicado, admin, corpoDaAula(mista, false), 200);
        assertThat(api.get("/aluno/comunidade/playlists", loginAluno, 200)).isEmpty();
    }

    /**
     * As rotas literais {@code /playlists/ordem} e {@code /aulas/playlist} não podem cair nas de {@code {id}}: se caíssem, "ordem" e
     * "playlist" não seriam UUID e a resposta seria 400, não 204.
     */
    @Test
    void rotasLiteraisNaoCaemNasRotasComId() throws Exception {
        String p = playlist(admin, "Única");
        String a = aula(admin, null, true);

        api.put("/comunidade/playlists/ordem", admin, Map.of("ids", List.of(p)), 204);
        api.put("/comunidade/aulas/playlist", admin, Map.of("aulaIds", List.of(a), "playlistId", p), 204);
        assertThat(idsDa(p)).containsExactly(a);
        // E as de {id} seguem valendo com id de verdade (o PUT de aulão tem corpo de aulão, não de lote).
        api.put("/comunidade/playlists/" + p, admin, Map.of("nome", "Única renomeada"), 200);
        api.put("/comunidade/aulas/" + a, admin, corpoDaAula(p, true), 200);
    }
}
