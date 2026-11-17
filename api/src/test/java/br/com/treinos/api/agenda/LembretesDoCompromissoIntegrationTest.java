package br.com.treinos.api.agenda;

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
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Lembretes do compromisso (V084, plano lembretes-do-compromisso): padrão {@code [30]}, lista própria de 0 a 5 itens de 1 a
 * 40320 minutos sem repetir, 422 {@code COMPROMISSO_INVALIDO} no campo certo e sem repetir o valor, o aluno vê a lista, remarcar
 * (sem o campo) e o grupo preservam, e outra consultoria recebe 404. Só dados fictícios.
 */
@AutoConfigureMockMvc
class LembretesDoCompromissoIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;

    private ApiDeTeste api;
    private JsonNode admin;
    private UUID aluno;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        aluno = api.criarAluno(admin, "Aluno Fictício dos Lembretes");
    }

    private String responsavel() {
        return admin.path("usuario").path("id").asString();
    }

    private static LocalDate dia() {
        return LocalDate.now(Fuso.BRASILIA).plusDays(3);
    }

    private Map<String, Object> pedido(List<UUID> alunos, String hora) {
        Map<String, Object> corpo = new HashMap<>();
        corpo.put("alunoIds", alunos);
        corpo.put("responsavelId", responsavel());
        corpo.put("data", dia().toString());
        corpo.put("hora", hora);
        corpo.put("duracaoMinutos", 30);
        return corpo;
    }

    private JsonNode marcar(Object lembretes, String hora, int status) throws Exception {
        Map<String, Object> corpo = pedido(List.of(aluno), hora);
        if (lembretes != null) corpo.put("lembretesMinutos", lembretes);
        return api.post("/agenda/compromissos", admin, corpo, status);
    }

    private static List<Integer> lista(JsonNode no) {
        List<Integer> r = new ArrayList<>();
        no.path("lembretesMinutos").forEach(n -> r.add(n.asInt()));
        return r;
    }

    private List<String> camposDoErro(JsonNode erro) {
        List<String> campos = new ArrayList<>();
        erro.path("fieldErrors").forEach(f -> campos.add(f.path("field").asString()));
        return campos;
    }

    @Test
    void semOCampoVale30MinutosEAListaPropriaFicaComoVeio() throws Exception {
        JsonNode padrao = marcar(null, "08:00", 200);
        assertThat(lista(padrao)).containsExactly(30);

        JsonNode propria = marcar(List.of(1440, 10, 40320, 1, 60), "09:00", 200);
        assertThat(lista(propria)).containsExactly(1440, 10, 40320, 1, 60);
        assertThat(lista(api.get("/agenda/compromissos/" + propria.path("id").asString(), admin, 200)))
                .containsExactly(1440, 10, 40320, 1, 60);

        JsonNode vazia = marcar(List.of(), "10:00", 200);
        assertThat(vazia.path("lembretesMinutos").isArray()).isTrue();
        assertThat(lista(vazia)).isEmpty();
    }

    @Test
    void listaInvalidaDa422NoCampoCertoSemRepetirOValor() throws Exception {
        JsonNode seis = marcar(List.of(1, 2, 3, 4, 5, 6), "08:00", 422);
        assertThat(seis.path("codigo").asString()).isEqualTo("COMPROMISSO_INVALIDO");
        assertThat(camposDoErro(seis)).containsExactly("lembretesMinutos");

        JsonNode zero = marcar(List.of(30, 0), "08:00", 422);
        assertThat(camposDoErro(zero)).containsExactly("lembretesMinutos[1]");

        JsonNode alto = marcar(List.of(40321), "08:00", 422);
        assertThat(camposDoErro(alto)).containsExactly("lembretesMinutos[0]");
        assertThat(alto.toString()).doesNotContain("40321");

        JsonNode repetido = marcar(List.of(15, 60, 15), "08:00", 422);
        assertThat(camposDoErro(repetido)).containsExactly("lembretesMinutos");

        List<Integer> comNulo = new ArrayList<>(List.of(30));
        comNulo.add(null);
        assertThat(camposDoErro(marcar(comNulo, "08:00", 422))).containsExactly("lembretesMinutos[1]");

        // Nada foi gravado pelos pedidos recusados.
        assertThat(api.get("/agenda/compromissos?de=" + dia() + "&ate=" + dia(), admin, 200)).isEmpty();
    }

    @Test
    void listaEnormeDa422ComUmSoErroERespostaPequena() throws Exception {
        JsonNode enorme = marcar(Collections.nCopies(2000, 0), "08:00", 422);
        assertThat(enorme.path("codigo").asString()).isEqualTo("COMPROMISSO_INVALIDO");
        assertThat(camposDoErro(enorme)).containsExactly("lembretesMinutos");
        assertThat(enorme.toString().length()).isLessThan(1000);
    }

    @Test
    void numeroFracionadoETextoNumericoSaoCoagidosPeloJackson() throws Exception {
        // Comportamento do Jackson 3 (padrão): 30.5 vira 30 (trunca) e "30" vira 30; não há 400 por isso.
        assertThat(lista(marcar(List.of(30.5), "08:00", 200))).containsExactly(30);
        assertThat(lista(marcar(List.of("45"), "09:00", 200))).containsExactly(45);
        // Texto que não é número e objeto não passam: 400 do corpo ilegível.
        marcar(List.of("abc"), "10:00", 400);
        marcar(List.of(Map.of("a", 1)), "11:00", 400);
    }

    @Test
    void serieGravaTrocaPorEscopoEPreservaNoPutSemOCampoEnoCancelar() throws Exception {
        Map<String, Object> repeticao = Map.of("tipo", "DIARIA", "vezes", 3);
        Map<String, Object> criar = pedido(List.of(aluno), "08:00");
        criar.put("repeticao", repeticao);
        criar.put("lembretesMinutos", List.of(15, 60));
        JsonNode primeira = api.post("/agenda/compromissos", admin, criar, 200);
        assertThat(listas()).containsExactly(List.of(15, 60), List.of(15, 60), List.of(15, 60));

        // TODAS: troca as três.
        alterar(0, "TODAS", List.of(10), "08:00");
        assertThat(listas()).containsExactly(List.of(10), List.of(10), List.of(10));

        // SEGUINTES a partir da segunda: a primeira fica.
        alterar(1, "SEGUINTES", List.of(20), "08:00");
        assertThat(listas()).containsExactly(List.of(10), List.of(20), List.of(20));

        // ESTA com lista vazia: só a terceira, as irmãs não mudam.
        alterar(2, "ESTA", List.of(), "08:00");
        assertThat(listas()).containsExactly(List.of(10), List.of(20), List.of());

        // PUT sem o campo mantém a lista de cada ocorrência (aqui remarca a hora das duas últimas).
        alterar(1, "SEGUINTES", null, "09:00");
        assertThat(listas()).containsExactly(List.of(10), List.of(20), List.of());
        assertThat(ocorrencias().get(2).path("hora").asString()).isEqualTo("09:00");

        // Cancelar e reabrir a série preserva as listas.
        String id = primeira.path("id").asString();
        api.post("/agenda/compromissos/" + id + "/situacao?escopo=TODAS", admin,
                Map.of("cancelado", true, "versao", ocorrencias().get(0).path("versao").asLong()), 200);
        assertThat(ocorrencias()).allMatch(c -> c.path("cancelado").asBoolean());
        assertThat(listas()).containsExactly(List.of(10), List.of(20), List.of());
        api.post("/agenda/compromissos/" + id + "/situacao?escopo=TODAS", admin,
                Map.of("cancelado", false, "versao", ocorrencias().get(0).path("versao").asLong()), 200);
        assertThat(ocorrencias()).noneMatch(c -> c.path("cancelado").asBoolean());
        assertThat(listas()).containsExactly(List.of(10), List.of(20), List.of());
    }

    /** As ocorrências da série (o dia e os dois seguintes), em ordem de início. */
    private List<JsonNode> ocorrencias() throws Exception {
        List<JsonNode> r = new ArrayList<>();
        api.get("/agenda/compromissos?de=" + dia() + "&ate=" + dia().plusDays(2), admin, 200).forEach(r::add);
        r.sort(Comparator.comparing(c -> c.path("inicio").asString()));
        assertThat(r).hasSize(3);
        return r;
    }

    private List<List<Integer>> listas() throws Exception {
        return ocorrencias().stream().map(LembretesDoCompromissoIntegrationTest::lista).toList();
    }

    /** PUT na i-ésima ocorrência com a data dela, versão lida na hora; {@code lembretes} nulo = sem o campo. */
    private void alterar(int i, String escopo, List<Integer> lembretes, String hora) throws Exception {
        JsonNode c = ocorrencias().get(i);
        Map<String, Object> corpo = pedido(List.of(aluno), hora);
        corpo.put("data", c.path("data").asString());
        corpo.put("versao", c.path("versao").asLong());
        if (lembretes != null) corpo.put("lembretesMinutos", lembretes);
        api.put("/agenda/compromissos/" + c.path("id").asString() + "?escopo=" + escopo, admin, corpo, 200);
    }

    @Test
    void remarcarSemOCampoMantemEComOCampoTroca() throws Exception {
        JsonNode c = marcar(List.of(5, 120), "08:00", 200);
        String id = c.path("id").asString();

        Map<String, Object> remarcar = pedido(List.of(aluno), "11:00");
        remarcar.put("versao", c.path("versao").asLong());
        JsonNode remarcado = api.put("/agenda/compromissos/" + id, admin, remarcar, 200);
        assertThat(lista(remarcado)).containsExactly(5, 120);

        Map<String, Object> troca = pedido(List.of(aluno), "11:00");
        troca.put("versao", remarcado.path("versao").asLong());
        troca.put("lembretesMinutos", List.of());
        JsonNode semLembrete = api.put("/agenda/compromissos/" + id, admin, troca, 200);
        assertThat(lista(semLembrete)).isEmpty();

        Map<String, Object> invalido = pedido(List.of(aluno), "11:00");
        invalido.put("versao", semLembrete.path("versao").asLong());
        invalido.put("lembretesMinutos", List.of(0));
        assertThat(camposDoErro(api.put("/agenda/compromissos/" + id, admin, invalido, 422)))
                .containsExactly("lembretesMinutos[0]");
        assertThat(lista(api.get("/agenda/compromissos/" + id, admin, 200))).isEmpty();
    }

    @Test
    void oAlunoVeAsAntecedenciasDoCompromissoEmGrupoTambem() throws Exception {
        UUID bruna = api.criarAluno(admin, "Bruna Fictícia dos Lembretes");
        JsonNode login = api.convidarEEntrar(admin, aluno);

        marcar(List.of(45, 1440), "08:00", 200);
        Map<String, Object> grupo = pedido(List.of(aluno, bruna), "09:00");
        grupo.put("lembretesMinutos", List.of(30, 2880));
        api.post("/agenda/compromissos", admin, grupo, 200);
        marcar(null, "10:00", 200);

        JsonNode meus = api.get("/aluno/compromissos", login, 200);
        assertThat(meus).hasSize(3);
        assertThat(lista(meus.get(0))).containsExactly(45, 1440);
        assertThat(lista(meus.get(1))).containsExactly(30, 2880);
        assertThat(lista(meus.get(2))).containsExactly(30);
    }

    @Test
    void outraConsultoriaRecebe404AoLerOuMudarOsLembretes() throws Exception {
        JsonNode c = marcar(List.of(15), "08:00", 200);
        String id = c.path("id").asString();
        JsonNode outra = api.novoTreinador();
        UUID alunoDaOutra = api.criarAluno(outra, "Aluno Fictício da Outra");

        api.get("/agenda/compromissos/" + id, outra, 404);
        Map<String, Object> corpo = pedido(List.of(alunoDaOutra), "08:00");
        corpo.put("responsavelId", outra.path("usuario").path("id").asString());
        corpo.put("versao", c.path("versao").asLong());
        corpo.put("lembretesMinutos", List.of(99));
        api.put("/agenda/compromissos/" + id, outra, corpo, 404);
        assertThat(lista(api.get("/agenda/compromissos/" + id, admin, 200))).containsExactly(15);
    }
}
