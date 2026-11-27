package br.com.treinos.api.consultoria;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.equipe.CatalogoPermissoes;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** {@code PUT /consultoria/documentos-pdf} (V107): modelo escolhido + opções sobrescritas, com versão. */
@AutoConfigureMockMvc
class DocumentosPdfIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JsonMapper json;
    @Autowired
    private JdbcTemplate jdbc;

    private ApiDeTeste api;
    private JsonNode treinador;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        treinador = api.novoTreinador();
    }

    private long versao(JsonNode login) throws Exception {
        return api.get("/consultoria", login, 200).get("versao").asLong();
    }

    private JsonNode gravar(JsonNode login, Object modelo, Object opcoes, long versao, int esperado) throws Exception {
        var corpo = new LinkedHashMap<String, Object>();
        corpo.put("modelo", modelo);
        if (opcoes != null) corpo.put("opcoes", opcoes);
        corpo.put("versao", versao);
        return api.put("/consultoria/documentos-pdf", login, corpo, esperado);
    }

    @Test
    void padraoGravaELeEPresencaNoLoginNoEuENoPainelDoAluno() throws Exception {
        JsonNode padrao = api.get("/consultoria", treinador, 200).get("marca");
        assertThat(padrao.get("temaPdf").asString()).isEqualTo("CLASSICO");
        assertThat(padrao.get("opcoesPdf").isObject()).isTrue();
        assertThat(padrao.get("opcoesPdf").isEmpty()).isTrue();

        Map<String, Object> opcoes = Map.of(
                "cores", Map.of("destaque", "AZUL"),
                "texto", Map.of("fonte", "SERIFADA", "tamanho", "G"),
                "cabecalho", Map.of("estilo", "CARTAO", "logo", "CENTRO", "tamanhoLogo", "P", "mostrarNome", false),
                "tabelas", Map.of("estilo", "LISTRADA", "densidade", "ESPACOSA"));
        for (Consultoria.ModeloPdf modelo : Consultoria.ModeloPdf.values()) {
            JsonNode salva = gravar(treinador, modelo.name(), opcoes, versao(treinador), 200);
            assertThat(salva.get("marca").get("temaPdf").asString()).isEqualTo(modelo.name());
            assertThat(salva.get("marca").get("opcoesPdf")).isEqualTo(json.valueToTree(opcoes));
            assertThat(salva.get("versao").asLong()).isEqualTo(versao(treinador));
        }

        // Só as sobrescritas; seção vazia some.
        JsonNode parcial = gravar(treinador, "ESPORTIVO", Map.of("cores", Map.of("destaque", "MARCA"), "texto", Map.of()),
                versao(treinador), 200).get("marca");
        assertThat(parcial.get("opcoesPdf")).isEqualTo(json.valueToTree(Map.of("cores", Map.of("destaque", "MARCA"))));
        assertThat(jdbc.queryForObject("select opcoes_pdf::text from consultoria where id = ?::uuid", String.class,
                parcial.get("id").asString())).doesNotContain("texto");

        // Sem opções = tudo do modelo.
        assertThat(gravar(treinador, "COMPACTO", null, versao(treinador), 200).get("marca").get("opcoesPdf").isEmpty()).isTrue();
        gravar(treinador, "COMPACTO", Map.of("cores", Map.of("destaque", "VERDE")), versao(treinador), 200);

        // Login, /eu e painel do aluno trazem o modelo e as opções.
        JsonNode marcaDoTreinador = api.get("/consultoria", treinador, 200).get("marca");
        JsonNode login = api.post("/auth/login", null, Map.of("email", treinador.get("usuario").get("email").asString(),
                "senha", ApiDeTeste.SENHA), 200);
        assertThat(login.get("marca").get("temaPdf").asString()).isEqualTo("COMPACTO");
        assertThat(login.get("marca").get("opcoesPdf").get("cores").get("destaque").asString()).isEqualTo("VERDE");
        assertThat(api.get("/eu", treinador, 200).get("marca").get("opcoesPdf")).isEqualTo(marcaDoTreinador.get("opcoesPdf"));

        JsonNode aluno = api.convidarEEntrar(treinador, api.criarAluno(treinador, "Aluno Documentos Fictício"));
        assertThat(aluno.get("marca").get("temaPdf").asString()).isEqualTo("COMPACTO");
        assertThat(api.get("/eu", aluno, 200).get("marca").get("opcoesPdf")).isEqualTo(marcaDoTreinador.get("opcoesPdf"));
        JsonNode painel = api.get("/aluno/painel", aluno, 200).get("marca");
        assertThat(painel.get("temaPdf").asString()).isEqualTo("COMPACTO");
        assertThat(painel.get("opcoesPdf")).isEqualTo(marcaDoTreinador.get("opcoesPdf"));
    }

    @Test
    void versaoDiferenteDa409ESemVersaoDa400() throws Exception {
        long velha = versao(treinador);
        gravar(treinador, "MARCANTE", null, velha, 200);
        JsonNode erro = gravar(treinador, "MINIMALISTA", null, velha, 409);
        assertThat(erro.path("codigo").asString()).isEqualTo("CONFLITO_EDICAO");
        assertThat(api.get("/consultoria", treinador, 200).get("marca").get("temaPdf").asString()).isEqualTo("MARCANTE");
        api.put("/consultoria/documentos-pdf", treinador, Map.of("modelo", "MARCANTE"), 400);
    }

    @Test
    void modeloForaDaListaOuAusenteE400SemRepetirOValor() throws Exception {
        for (String fora : List.of("OUTRO", "minimalista", "")) {
            JsonNode erro = gravar(treinador, fora, null, versao(treinador), 400);
            assertThat(erro.path("codigo").asString()).isEqualTo("DADOS_INVALIDOS");
            if (!fora.isEmpty()) assertThat(erro.toString()).doesNotContain(fora);
        }
        api.put("/consultoria/documentos-pdf", treinador, Map.of("versao", versao(treinador)), 400);
        assertThat(api.get("/consultoria", treinador, 200).get("marca").get("temaPdf").asString()).isEqualTo("CLASSICO");
    }

    @Test
    void chaveOuValorDesconhecidoE422NoCampoSemRepetirEGravaNada() throws Exception {
        String segredo = "valor-estranho-" + UUID.randomUUID();
        record Caso(Object opcoes, String campo, String mensagem) {
        }
        List<Caso> casos = List.of(
                new Caso(Map.of("cores", Map.of("destaque", segredo)), "opcoes.cores.destaque", OpcoesPdf.MENSAGEM_VALOR),
                new Caso(Map.of("cores", Map.of("destaque", "azul")), "opcoes.cores.destaque", OpcoesPdf.MENSAGEM_VALOR),
                new Caso(Map.of("cores", Map.of("destaque", 3)), "opcoes.cores.destaque", OpcoesPdf.MENSAGEM_VALOR),
                new Caso(Map.of("cabecalho", Map.of("mostrarNome", "true")), "opcoes.cabecalho.mostrarNome", OpcoesPdf.MENSAGEM_VALOR),
                new Caso(Map.of("texto", Map.of("tamanho", "GG")), "opcoes.texto.tamanho", OpcoesPdf.MENSAGEM_VALOR),
                new Caso(Map.of("tabelas", Map.of(segredo, "LINHAS")), "opcoes.tabelas", OpcoesPdf.MENSAGEM_CHAVE),
                new Caso(Map.of(segredo, Map.of("a", "b")), "opcoes", OpcoesPdf.MENSAGEM_CHAVE),
                new Caso(Map.of("cores", "AZUL"), "opcoes.cores", OpcoesPdf.MENSAGEM_VALOR),
                new Caso(List.of("cores"), "opcoes", OpcoesPdf.MENSAGEM_VALOR),
                new Caso("AZUL", "opcoes", OpcoesPdf.MENSAGEM_VALOR));
        for (Caso c : casos) {
            JsonNode erro = gravar(treinador, "MARCANTE", c.opcoes(), versao(treinador), 422);
            assertThat(erro.path("codigo").asString()).isEqualTo(OpcoesPdf.CODIGO_INVALIDO);
            assertThat(erro.toString()).doesNotContain(segredo);
            assertThat(erro.path("fieldErrors").get(0).path("field").asString()).isEqualTo(c.campo());
            assertThat(erro.path("fieldErrors").get(0).path("message").asString()).isEqualTo(c.mensagem());
        }
        // Vários erros no mesmo pedido saem todos.
        JsonNode varios = gravar(treinador, "MARCANTE", Map.of("cores", Map.of("destaque", "X"), "texto", Map.of("fonte", "Y")),
                versao(treinador), 422);
        assertThat(varios.path("fieldErrors")).hasSize(2);
        // Nada do pedido recusado foi gravado (nem o modelo).
        JsonNode marca = api.get("/consultoria", treinador, 200).get("marca");
        assertThat(marca.get("temaPdf").asString()).isEqualTo("CLASSICO");
        assertThat(marca.get("opcoesPdf").isEmpty()).isTrue();
    }

    @Test
    void soAdministradorGravaEOutraConsultoriaNaoETocada() throws Exception {
        JsonNode outra = api.novoTreinador();
        gravar(treinador, "ELEGANTE", Map.of("cores", Map.of("destaque", "BRONZE")), versao(treinador), 200);

        String perfil = api.post("/perfis", treinador, Map.of("nome", "Perfil " + UUID.randomUUID(),
                "permissoes", CatalogoPermissoes.comDependencias(Set.of("TREINO_LER", "MARCA_ALTERAR"))), 200).get("id").asString();
        JsonNode convite = api.post("/usuarios/convites", treinador,
                Map.of("nome", "Membro fictício", "email", ApiDeTeste.emailUnico("membro"), "perfilId", perfil), 200);
        JsonNode membro = api.post("/publico/convites-equipe/aceitar", null,
                Map.of("codigo", convite.get("codigo").asString(), "senha", ApiDeTeste.SENHA), 200);
        gravar(membro, "MARCANTE", null, versao(membro), 403);
        // Aluno (sem a permissão) também é barrado.
        JsonNode aluno = api.convidarEEntrar(treinador, api.criarAluno(treinador, "Aluno Barrado Fictício"));
        gravar(aluno, "MARCANTE", null, 0, 403);
        JsonNode marca = api.get("/consultoria", membro, 200).get("marca");
        assertThat(marca.get("temaPdf").asString()).isEqualTo("ELEGANTE");

        // A outra consultoria continua no padrão e grava a sua sem afetar a primeira.
        JsonNode marcaOutra = api.get("/consultoria", outra, 200).get("marca");
        assertThat(marcaOutra.get("temaPdf").asString()).isEqualTo("CLASSICO");
        assertThat(marcaOutra.get("opcoesPdf").isEmpty()).isTrue();
        gravar(outra, "ESPORTIVO", null, versao(outra), 200);
        JsonNode primeira = api.get("/consultoria", treinador, 200).get("marca");
        assertThat(primeira.get("temaPdf").asString()).isEqualTo("ELEGANTE");
        assertThat(primeira.get("opcoesPdf").get("cores").get("destaque").asString()).isEqualTo("BRONZE");
    }

    @Test
    void auditoriaTemResumoFixoSemOConteudo() throws Exception {
        UUID consultoriaId = UUID.fromString(api.get("/consultoria", treinador, 200).get("marca").get("id").asString());
        gravar(treinador, "MARCANTE", Map.of("cores", Map.of("destaque", "TURQUESA")), versao(treinador), 200);
        List<String> resumos = jdbc.queryForList("select resumo from auditoria where consultoria_id = ? and acao = 'MARCA_ALTERADA'",
                String.class, consultoriaId);
        assertThat(resumos).containsExactly("Alterou o modelo e as opções dos PDFs da consultoria.");
    }
}
