package br.com.treinos.api.inscricoes;

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

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * V111: sugestão de planos comerciais na página pública da inscrição (link completo e ficha rápida). Só ativos, só id,
 * nome, periodicidade e o preço apenas com a opção do link ligada; o plano escolhido é conferido (ativo e da consultoria
 * do link, senão 422 com mensagem fixa), vale mais que o texto de "Outro" e volta com o nome na fila e no detalhe. Só dados
 * fictícios.
 */
@AutoConfigureMockMvc
class PlanoNaInscricaoIntegrationTest extends AbstractIntegrationTest {

    private static final String MENSAGEM_FIXA = "Escolha um dos planos disponíveis.";

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate banco;

    private ApiDeTeste api;
    private JsonNode admin;
    private String codigo;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        JsonNode atual = api.get("/inscricoes/configuracao", admin, 200);
        Map<String, Object> corpo = new HashMap<>();
        corpo.put("aberta", true);
        corpo.put("versao", atual.path("versao").isNull() ? null : atual.path("versao").asLong());
        codigo = api.put("/inscricoes/configuracao", admin, corpo, 200).path("codigo").asString();
    }

    private static String whatsappUnico() {
        return "119" + (10_000_000 + ThreadLocalRandom.current().nextInt(89_999_999));
    }

    private JsonNode criarPlano(JsonNode login, String nome, long valor, String periodicidade) throws Exception {
        Map<String, Object> corpo = new HashMap<>();
        corpo.put("nome", nome + " " + UUID.randomUUID());
        corpo.put("valorCentavos", valor);
        corpo.put("periodicidade", periodicidade);
        corpo.put("incluiTreino", true);
        corpo.put("incluiDieta", false);
        corpo.put("linkDePagamento", "https://pagamento.exemplo.invalid/interno");
        if (periodicidade.equals("MENSAL")) { // mínimo e regra de saída só existem no plano mensal
            corpo.put("tempoMinimoMeses", 3);
            corpo.put("regraDeSaida", "Regra interna fictícia");
        }
        return api.post("/financeiro/planos", login, corpo, 200);
    }

    private void arquivar(JsonNode login, JsonNode plano) throws Exception {
        api.post("/financeiro/planos/" + plano.path("id").asString() + "/arquivar", login,
                Map.of("versao", plano.path("versao").asLong()), 200);
    }

    private JsonNode pagina(String codigoDoLink) throws Exception {
        return api.get("/publico/inscricoes/" + codigoDoLink, null, 200);
    }

    /** PUT da configuração do link padrão; {@code mostrar} nulo = campo ausente. */
    private JsonNode configurarPreco(JsonNode login, Boolean mostrar) throws Exception {
        JsonNode atual = api.get("/inscricoes/configuracao", login, 200);
        Map<String, Object> corpo = new HashMap<>();
        corpo.put("aberta", true);
        corpo.put("versao", atual.path("versao").asLong());
        if (mostrar != null) corpo.put("mostrarPrecoDosPlanos", mostrar);
        return api.put("/inscricoes/configuracao", login, corpo, 200);
    }

    private Map<String, Object> corpoDaInscricao(String nome, String whatsapp) {
        Map<String, Object> corpo = new HashMap<>();
        corpo.put("nome", nome);
        corpo.put("whatsapp", whatsapp);
        return corpo;
    }

    private JsonNode inscreverEBuscar(String codigoDoLink, Map<String, Object> corpo, String whatsapp) throws Exception {
        api.post("/publico/inscricoes/" + codigoDoLink, null, corpo, 202);
        return api.get("/inscricoes?situacao=TODAS&busca=" + whatsapp, admin, 200).path("itens").get(0);
    }

    @Test
    void semPlanosAtivosAPaginaVemComListaVaziaEOpcaoDesligada() throws Exception {
        JsonNode arquivado = criarPlano(admin, "Arquivado", 11_00L, "ANUAL");
        arquivar(admin, arquivado);
        JsonNode pagina = pagina(codigo);
        assertThat(pagina.path("planos").isArray()).isTrue();
        assertThat(pagina.path("planos")).isEmpty();
        assertThat(pagina.path("mostrarPrecoDosPlanos").asBoolean()).isFalse();
    }

    @Test
    void paginaListaSoOsAtivosComSoOQueDeveEPrecoSoComAOpcaoLigada() throws Exception {
        JsonNode mensal = criarPlano(admin, "Mensal", 29_90_00L, "MENSAL");
        JsonNode trimestral = criarPlano(admin, "Trimestral", 79_90_00L, "TRIMESTRAL");
        JsonNode arquivado = criarPlano(admin, "Arquivado", 11_11_00L, "ANUAL");
        arquivar(admin, arquivado);
        JsonNode outra = api.novoTreinador();
        JsonNode deOutraConsultoria = criarPlano(outra, "Alheio", 55_55_00L, "SEMESTRAL");

        // Padrão: desligada. Só os ativos, só id, nome, periodicidade e valorCentavos nulo.
        assertThat(api.get("/inscricoes/configuracao", admin, 200).path("mostrarPrecoDosPlanos").asBoolean()).isFalse();
        JsonNode desligada = pagina(codigo);
        assertThat(desligada.path("mostrarPrecoDosPlanos").asBoolean()).isFalse();
        List<String> ids = desligada.path("planos").valueStream().map(p -> p.path("id").asString()).toList();
        assertThat(ids).containsExactlyInAnyOrder(mensal.path("id").asString(), trimestral.path("id").asString())
                .doesNotContain(arquivado.path("id").asString(), deOutraConsultoria.path("id").asString());
        desligada.path("planos").forEach(p -> {
            assertThat(p.propertyNames()).containsExactlyInAnyOrder("id", "nome", "periodicidade", "valorCentavos");
            assertThat(p.path("valorCentavos").isNull()).isTrue();
        });
        // Nada interno do plano (nem o valor) no JSON público.
        assertThat(desligada.toString()).doesNotContain("pagamento.exemplo.invalid", "Regra interna", "kiwify", "incluiTreino",
                "tempoMinimoMeses", "299000", "799000");

        // Ligar mostra o preço; PUT sem o campo mantém o valor gravado.
        assertThat(configurarPreco(admin, true).path("mostrarPrecoDosPlanos").asBoolean()).isTrue();
        JsonNode comPreco = pagina(codigo);
        assertThat(comPreco.path("mostrarPrecoDosPlanos").asBoolean()).isTrue();
        Map<String, Long> valores = new HashMap<>();
        comPreco.path("planos").forEach(p -> valores.put(p.path("id").asString(), p.path("valorCentavos").asLong()));
        assertThat(valores).containsEntry(mensal.path("id").asString(), 29_90_00L)
                .containsEntry(trimestral.path("id").asString(), 79_90_00L).hasSize(2);
        assertThat(configurarPreco(admin, null).path("mostrarPrecoDosPlanos").asBoolean()).isTrue();
        assertThat(api.get("/inscricoes/links", admin, 200).get(0).path("mostrarPrecoDosPlanos").asBoolean()).isTrue();

        // A opção é do link: a ficha rápida nasce desligada; desligar o padrão volta a esconder o preço.
        JsonNode ficha = api.post("/inscricoes/links/ficha-rapida", admin, null, 201);
        assertThat(ficha.path("mostrarPrecoDosPlanos").asBoolean()).isFalse();
        assertThat(pagina(ficha.path("codigo").asString()).path("planos").get(0).path("valorCentavos").isNull()).isTrue();
        assertThat(configurarPreco(admin, false).path("mostrarPrecoDosPlanos").asBoolean()).isFalse();
        assertThat(pagina(codigo).path("planos").get(0).path("valorCentavos").isNull()).isTrue();
        // Outra consultoria não herda a opção desta.
        assertThat(api.get("/inscricoes/configuracao", outra, 200).path("mostrarPrecoDosPlanos").asBoolean()).isFalse();
    }

    @Test
    void inscricaoComPlanoValidoGravaEOPlanoVoltaComNomeNaFilaENoDetalhe() throws Exception {
        JsonNode plano = criarPlano(admin, "Combinado", 99_00L, "MENSAL");
        String whatsapp = whatsappUnico();
        Map<String, Object> corpo = corpoDaInscricao("Pessoa Fictícia Plano", whatsapp);
        corpo.put("planoComercialId", plano.path("id").asString());
        JsonNode resumo = inscreverEBuscar(codigo, corpo, whatsapp);

        assertThat(resumo.path("planoComercialId").asString()).isEqualTo(plano.path("id").asString());
        assertThat(resumo.path("planoComercialNome").asString()).isEqualTo(plano.path("nome").asString());
        String id = resumo.path("id").asString();
        JsonNode detalhe = api.get("/inscricoes/" + id, admin, 200);
        assertThat(detalhe.path("planoComercialId").asString()).isEqualTo(plano.path("id").asString());
        assertThat(detalhe.path("planoComercialNome").asString()).isEqualTo(plano.path("nome").asString());

        // Aceite (cortesia): o detalhe segue com o plano, e arquivar o plano não apaga o nome.
        JsonNode aceite = api.post("/inscricoes/" + id + "/aceitar", admin,
                Map.of("convidar", false, "versao", detalhe.path("versao").asLong(), "semCobranca", true), 200);
        assertThat(aceite.path("planoComercialId").asString()).isEqualTo(plano.path("id").asString());
        assertThat(aceite.path("planoComercialNome").asString()).isEqualTo(plano.path("nome").asString());
        arquivar(admin, plano);
        JsonNode aceita = api.get("/inscricoes/" + id, admin, 200);
        assertThat(aceita.path("situacao").asString()).isEqualTo("ACEITA");
        assertThat(aceita.path("planoComercialNome").asString()).isEqualTo(plano.path("nome").asString());

        // Plano apagado de verdade: a FK limpa só a coluna (a inscrição fica) e o nome some.
        banco.update("delete from plano_comercial where id = ?::uuid", plano.path("id").asString());
        JsonNode semPlano = api.get("/inscricoes/" + id, admin, 200);
        assertThat(semPlano.path("planoComercialId").isNull()).isTrue();
        assertThat(semPlano.path("planoComercialNome").isNull()).isTrue();
        assertThat(api.get("/inscricoes?situacao=TODAS&busca=" + whatsapp, admin, 200).path("itens").get(0)
                .path("planoComercialNome").isNull()).isTrue();

        // Sem plano escolhido: nulos.
        String outroWhats = whatsappUnico();
        JsonNode sem = inscreverEBuscar(codigo, corpoDaInscricao("Pessoa Fictícia Sem Plano", outroWhats), outroWhats);
        assertThat(sem.path("planoComercialId").isNull()).isTrue();
        assertThat(sem.path("planoComercialNome").isNull()).isTrue();
    }

    @Test
    void planoInvalidoNaInscricaoDa422ComMensagemFixaESemGravar() throws Exception {
        JsonNode arquivado = criarPlano(admin, "Velho", 50_00L, "MENSAL");
        arquivar(admin, arquivado);
        JsonNode outra = api.novoTreinador();
        JsonNode deOutra = criarPlano(outra, "Alheio", 50_00L, "MENSAL");
        String whatsapp = whatsappUnico();

        for (String id : List.of(arquivado.path("id").asString(), deOutra.path("id").asString(), UUID.randomUUID().toString())) {
            Map<String, Object> corpo = corpoDaInscricao("Pessoa Fictícia Recusada", whatsapp);
            corpo.put("planoComercialId", id);
            JsonNode erro = api.post("/publico/inscricoes/" + codigo, null, corpo, 422);
            assertThat(erro.path("codigo").asString()).isEqualTo("INSCRICAO_INVALIDA");
            assertThat(erro.path("fieldErrors").get(0).path("field").asString()).isEqualTo("planoComercialId");
            assertThat(erro.path("fieldErrors").get(0).path("message").asString()).isEqualTo(MENSAGEM_FIXA);
            assertThat(erro.toString()).doesNotContain(id);
        }
        assertThat(api.get("/inscricoes?situacao=TODAS&busca=" + whatsapp, admin, 200).path("itens")).isEmpty();
    }

    /** Formulário de inscrição publicado com "plano_combinado" e "cidade" obrigatórias e o link dele aberto; devolve o código. */
    private String linkComPlanoCombinadoObrigatorio() throws Exception {
        JsonNode q = api.post("/questionarios", admin, Map.of("nome", "Inscrição " + UUID.randomUUID(), "origem", "VAZIO",
                "finalidade", "INSCRICAO"), 200);
        String id = q.path("id").asString();
        List<Map<String, Object>> perguntas = List.of(
                Map.of("id", "plano_combinado", "tipo", "TEXTO", "rotulo", "Qual plano combinou?", "obrigatoria", true),
                Map.of("id", "cidade", "tipo", "TEXTO", "rotulo", "Cidade fictícia", "obrigatoria", true));
        Map<String, Object> corpo = new HashMap<>();
        corpo.put("nome", q.path("nome").asString());
        corpo.put("conteudo", Map.of("instrucoes", List.of(), "secoes", List.of(Map.of(
                "uid", q.path("rascunho").path("secoes").get(0).path("uid").asString(), "titulo", "Sobre você",
                "perguntas", perguntas))));
        corpo.put("versao", q.path("versao").asLong());
        JsonNode salvo = api.put("/questionarios/" + id, admin, corpo, 200);
        api.post("/questionarios/" + id + "/publicar", admin, Map.of("versao", salvo.path("versao").asLong(), "confirmarAvisos", true), 200);
        JsonNode link = api.get("/questionarios/" + id + "/link", admin, 200);
        return api.put("/questionarios/" + id + "/link", admin, Map.of("aberta", true, "versao", link.path("versao").asLong()), 200)
                .path("codigo").asString();
    }

    @Test
    void planoEscolhidoDispensaSoOPlanoCombinadoObrigatorio() throws Exception {
        JsonNode plano = criarPlano(admin, "Obrigatório", 70_00L, "MENSAL");
        String codigoDoLink = linkComPlanoCombinadoObrigatorio();
        String versaoId = pagina(codigoDoLink).path("perguntas").path("versaoId").asString();

        // Plano da lista e sem texto de "Outro": aceita.
        String comPlano = whatsappUnico();
        Map<String, Object> corpo = corpoDaInscricao("Pessoa Fictícia Obrigatória", comPlano);
        corpo.put("questionarioVersaoId", versaoId);
        corpo.put("respostas", Map.of("cidade", "Cidade fictícia"));
        corpo.put("planoComercialId", plano.path("id").asString());
        assertThat(inscreverEBuscar(codigoDoLink, corpo, comPlano).path("planoComercialId").asString())
                .isEqualTo(plano.path("id").asString());

        // Com plano, as outras obrigatórias continuam valendo.
        Map<String, Object> semCidade = corpoDaInscricao("Pessoa Fictícia Sem Cidade", whatsappUnico());
        semCidade.put("questionarioVersaoId", versaoId);
        semCidade.put("planoComercialId", plano.path("id").asString());
        JsonNode erroCidade = api.post("/publico/inscricoes/" + codigoDoLink, null, semCidade, 422);
        assertThat(erroCidade.path("codigo").asString()).isEqualTo("INSCRICAO_INVALIDA");
        assertThat(erroCidade.path("fieldErrors").valueStream().map(e -> e.path("field").asString())).containsExactly("cidade");

        // Sem plano e sem texto: a pergunta segue obrigatória.
        String semPlano = whatsappUnico();
        Map<String, Object> semNada = corpoDaInscricao("Pessoa Fictícia Sem Plano", semPlano);
        semNada.put("questionarioVersaoId", versaoId);
        semNada.put("respostas", Map.of("cidade", "Cidade fictícia"));
        JsonNode erro = api.post("/publico/inscricoes/" + codigoDoLink, null, semNada, 422);
        assertThat(erro.path("codigo").asString()).isEqualTo("INSCRICAO_INVALIDA");
        assertThat(erro.path("fieldErrors").valueStream().map(e -> e.path("field").asString())).containsExactly("plano_combinado");
        assertThat(api.get("/inscricoes?situacao=TODAS&busca=" + semPlano, admin, 200).path("itens")).isEmpty();
    }

    @Test
    void fichaRapidaComPlanoDescartaOTextoDeOutroESoTextoContinuaValendo() throws Exception {
        JsonNode plano = criarPlano(admin, "Ficha", 80_00L, "TRIMESTRAL");
        JsonNode ficha = api.post("/inscricoes/links/ficha-rapida", admin, null, 201);
        String codigoFicha = ficha.path("codigo").asString();
        String versaoId = pagina(codigoFicha).path("perguntas").path("versaoId").asString();

        String comPlano = whatsappUnico();
        Map<String, Object> corpo = corpoDaInscricao("Pessoa Fictícia Ficha Plano", comPlano);
        corpo.put("questionarioVersaoId", versaoId);
        corpo.put("respostas", Map.of("plano_combinado", "Texto que deve ser descartado"));
        corpo.put("planoComercialId", plano.path("id").asString());
        JsonNode resumo = inscreverEBuscar(codigoFicha, corpo, comPlano);
        assertThat(resumo.path("planoComercialNome").asString()).isEqualTo(plano.path("nome").asString());
        JsonNode detalhe = api.get("/inscricoes/" + resumo.path("id").asString(), admin, 200);
        assertThat(detalhe.path("respostas").path("respostas").path("plano_combinado").isMissingNode()).isTrue();
        assertThat(detalhe.toString()).doesNotContain("Texto que deve ser descartado");

        String soTexto = whatsappUnico();
        Map<String, Object> outro = corpoDaInscricao("Pessoa Fictícia Ficha Outro", soTexto);
        outro.put("questionarioVersaoId", versaoId);
        outro.put("respostas", Map.of("plano_combinado", "Plano de um amigo"));
        JsonNode resumoOutro = inscreverEBuscar(codigoFicha, outro, soTexto);
        assertThat(resumoOutro.path("planoComercialId").isNull()).isTrue();
        assertThat(api.get("/inscricoes/" + resumoOutro.path("id").asString(), admin, 200)
                .path("respostas").path("respostas").path("plano_combinado").asString()).isEqualTo("Plano de um amigo");
    }
}
