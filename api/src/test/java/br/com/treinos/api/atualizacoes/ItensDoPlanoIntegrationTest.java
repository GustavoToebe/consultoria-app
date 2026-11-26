package br.com.treinos.api.atualizacoes;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.dieta.ConteudoDieta;
import br.com.treinos.api.web.Fuso;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pergunta ITENS_DO_PLANO no envio da atualização: o servidor confere cada id contra a versão publicada da pasta (e os
 * registros do aluno) e grava o nome lido dela. O questionário é gravado direto no banco (como a migration do padrão), porque
 * o rascunho ainda não leva a configuração da pergunta. Dados fictícios.
 */
@AutoConfigureMockMvc
class ItensDoPlanoIntegrationTest extends AbstractIntegrationTest {

    private static final String SEGREDO = "SEGREDO-DO-MOTIVO";

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate banco;
    private ApiDeTeste api;
    private JsonNode treinador;
    private JsonNode loginAluno;
    private UUID aluno;
    private String pasta;
    private LocalDate hoje;
    private ApiDeTeste.TreinoDeTeste treino;
    private UUID frango;
    private UUID frangoDaOpcaoB;
    private UUID arroz;
    private String planoDaDieta;

    @BeforeEach void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        treinador = api.novoTreinador();
        aluno = api.criarAluno(treinador, "Aluno Fictício Itens");
        loginAluno = api.convidarEEntrar(treinador, aluno);
        hoje = LocalDate.now(Fuso.BRASILIA);
        pasta = api.post("/alunos/" + aluno + "/pastas", treinador,
                Map.of("titulo", "Período fictício", "inicio", hoje.minusDays(27), "fim", hoje), 200).path("id").asString();
        treino = ApiDeTeste.treino();
        publicar("planos-treino", "Treino fictício", treino.conteudo());
        frango = UUID.randomUUID();
        frangoDaOpcaoB = UUID.randomUUID();
        arroz = UUID.randomUUID();
        planoDaDieta = publicar("planos-dieta", "Dieta fictícia", dieta());
        UUID questionario = questionarioComItens();
        banco.update("update pasta_plano set questionario_id = ? where id = ?", questionario, UUID.fromString(pasta));
    }

    private ConteudoDieta dieta() {
        return new ConteudoDieta("Objetivo fictício", null, "Treinador Teste", List.of(
                new ConteudoDieta.Refeicao(UUID.randomUUID(), "Almoço", "12:00", null, List.of(
                        new ConteudoDieta.Opcao(UUID.randomUUID(), "A", List.of(item(frango, "Frango grelhado"), item(arroz, "Arroz branco cozido"))),
                        new ConteudoDieta.Opcao(UUID.randomUUID(), "B", List.of(item(frangoDaOpcaoB, "frango grelhado"))))),
                new ConteudoDieta.Refeicao(UUID.randomUUID(), "Jantar", "20:00", null, List.of(
                        new ConteudoDieta.Opcao(UUID.randomUUID(), "A", List.of(item(UUID.randomUUID(), "Batata-doce"))))))
                , List.of(), null, List.of());
    }

    private static ConteudoDieta.Item item(UUID uid, String nome) {
        return new ConteudoDieta.Item(uid, UUID.randomUUID(), nome, new BigDecimal("150"), "g", new BigDecimal("191.7"),
                BigDecimal.ONE, BigDecimal.TEN, BigDecimal.ZERO, false);
    }

    private String publicar(String rota, String titulo, Object conteudo) throws Exception {
        JsonNode criado = api.post("/alunos/" + aluno + "/" + rota, treinador, Map.of("titulo", titulo, "pastaId", pasta), 200);
        String id = criado.path("plano").path("id").asString();
        JsonNode salvo = api.put("/" + rota + "/" + id + "/rascunho", treinador,
                ApiDeTeste.rascunho(titulo, conteudo, criado.path("plano").path("versao").asLong()), 200);
        api.post("/" + rota + "/" + id + "/publicar", treinador,
                Map.of("versao", salvo.path("plano").path("versao").asLong(), "confirmarAvisos", true), 200);
        return id;
    }

    /** Três perguntas: alimentos (motivo opcional), exercício (um só, motivo obrigatório) e dia treinado (um só, motivo obrigatório). */
    private UUID questionarioComItens() {
        String conteudo = ("{'formato':2,'instrucoes':[],'secoes':[{'uid':'s1','titulo':'Itens','perguntas':["
                + "{'id':'alim','tipo':'ITENS_DO_PLANO','rotulo':'Quer trocar algum alimento?','fonte':'ALIMENTOS_DA_DIETA','motivo':'OPCIONAL','rotuloMotivo':'Por quê?'},"
                + "{'id':'dor','tipo':'ITENS_DO_PLANO','rotulo':'Onde doeu?','fonte':'EXERCICIOS_DO_TREINO','max':1,'motivo':'OBRIGATORIO'},"
                + "{'id':'dia','tipo':'ITENS_DO_PLANO','rotulo':'Dia mais desgastante?','fonte':'DIAS_TREINADOS','max':1,'motivo':'OBRIGATORIO'}"
                + "]}]}").replace('\'', '"');
        UUID consultoria = banco.queryForObject("select consultoria_id from aluno where id = ?", UUID.class, aluno);
        UUID id = UUID.randomUUID();
        banco.update("insert into questionario(id, consultoria_id, nome, padrao, rascunho, versao_publicada, publicado_em, finalidade)"
                + " values (?, ?, 'Itens fictício', false, ?::jsonb, 1, now(), 'ATUALIZACAO')", id, consultoria, conteudo);
        banco.update("insert into questionario_versao(id, consultoria_id, questionario_id, numero, conteudo) values (?, ?, ?, 1, ?::jsonb)",
                UUID.randomUUID(), consultoria, id, conteudo);
        return id;
    }

    private JsonNode enviar(Map<String, Object> respostas, int status) throws Exception {
        JsonNode atual = api.get("/aluno/atualizacao", loginAluno, 200);
        assertThat(atual.path("pastaId").asString()).isEqualTo(pasta);
        return api.post("/aluno/atualizacao/enviar", loginAluno, Map.of("pastaId", pasta,
                "questionarioVersaoId", atual.path("questionarioVersaoId").asString(), "respostas", respostas), status);
    }

    private static Map<String, Object> escolha(String id, String motivo) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", id);
        if (motivo != null) {
            m.put("motivo", motivo);
        }
        return m;
    }

    private static Map<String, Object> respostas(Object... paresChaveValor) {
        Map<String, Object> r = new LinkedHashMap<>();
        for (int i = 0; i < paresChaveValor.length; i += 2) {
            r.put((String) paresChaveValor[i], paresChaveValor[i + 1]);
        }
        return r;
    }

    private String campoDoErro(JsonNode erro) {
        return erro.path("fieldErrors").get(0).path("field").asString();
    }

    private void registrarSerieConcluida(LocalDate dia) throws Exception {
        String versaoId = api.get("/aluno/painel", loginAluno, 200).path("treino").path("versaoId").asString();
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("id", UUID.randomUUID().toString());
        r.put("planoVersaoId", versaoId);
        r.put("sessaoUid", treino.sessaoUid().toString());
        r.put("exercicioUid", treino.exercicioUid().toString());
        r.put("serieUid", treino.wsUid().toString());
        r.put("data", dia.toString());
        r.put("carga", "30");
        r.put("repeticoes", 8);
        r.put("concluida", true);
        r.put("alteradoNoAparelhoEm", Instant.now().toString());
        api.post("/aluno/execucoes/lote", loginAluno, Map.of("registros", List.of(r)), 200);
    }

    @Test void gravaONomeLidoDaVersaoPublicadaEIgnoraOQueOClienteMandou() throws Exception {
        JsonNode enviada = enviar(respostas(
                "alim", List.of(escolha(frango.toString(), "  enjoei  "), escolha(arroz.toString(), null)),
                "dor", List.of(escolha(treino.exercicioUid().toString(), "Ombro direito")),
                "dia", List.of(escolha("3", "Cansaço"))), 200);
        JsonNode r = enviada.path("respostas");
        assertThat(r.path("alim")).hasSize(2);
        assertThat(r.path("alim").get(0).path("nome").asString()).isEqualTo("Frango grelhado");
        assertThat(r.path("alim").get(0).path("motivo").asString()).isEqualTo("enjoei");
        assertThat(r.path("alim").get(1).path("nome").asString()).isEqualTo("Arroz branco cozido");
        assertThat(r.path("alim").get(1).has("motivo")).isFalse();
        assertThat(r.path("dor").get(0).path("nome").asString()).isEqualTo("Remada baixa na polia");
        assertThat(r.path("dia").get(0).path("nome").asString()).isEqualTo("Quarta-feira");
        // o que ficou no banco é o mesmo, e o treinador lê o mesmo texto
        String gravado = banco.queryForObject("select respostas::text from atualizacao where pasta_id = ?", String.class, UUID.fromString(pasta));
        assertThat(json.readTree(gravado).path("alim").get(0).path("nome").asString()).isEqualTo("Frango grelhado");
        assertThat(api.get("/alunos/" + aluno + "/atualizacao", treinador, 200).path("respostas").path("dor").get(0).path("nome").asString())
                .isEqualTo("Remada baixa na polia");
    }

    @Test void recusaComMensagemFixaSemRepetirNadaDoQueFoiEnviado() throws Exception {
        String foraDaLista = UUID.randomUUID().toString();
        Map<String, Object> comNomeDoCliente = escolha(frango.toString(), SEGREDO);
        comNomeDoCliente.put("nome", "Nome do cliente " + SEGREDO);
        for (Map<String, Object> ruim : List.of(
                respostas("alim", List.of(escolha(foraDaLista, SEGREDO))),
                respostas("alim", List.of(comNomeDoCliente)),
                respostas("alim", List.of(escolha(frango.toString(), SEGREDO), escolha(frango.toString(), SEGREDO))),
                // o mesmo alimento em outra opção da dieta (outro uid, mesmo nome) é o mesmo item
                respostas("alim", List.of(escolha(frango.toString(), SEGREDO), escolha(frangoDaOpcaoB.toString(), SEGREDO))),
                respostas("alim", List.of(escolha(frango.toString(), "x".repeat(301)))),
                respostas("dor", List.of(escolha(treino.exercicioUid().toString(), null))),
                respostas("dor", List.of(escolha(treino.exercicioUid().toString(), "   "))),
                respostas("dor", List.of(escolha(treino.exercicioUid().toString(), SEGREDO), escolha(foraDaLista, SEGREDO))),
                // exercício que não existe no treino da pasta
                respostas("dor", List.of(escolha(treino.exercicioId().toString(), SEGREDO))))) {
            JsonNode erro = enviar(ruim, 422);
            assertThat(erro.path("codigo").asString()).isEqualTo("ATUALIZACAO_INVALIDA");
            assertThat(campoDoErro(erro)).isIn("alim", "dor");
            String corpo = erro.toString();
            assertThat(corpo).doesNotContain(SEGREDO).doesNotContain("Frango").doesNotContain(foraDaLista).doesNotContain(frango.toString());
        }
        // nada foi gravado pelos envios recusados
        assertThat(banco.queryForObject("select count(*) from atualizacao where pasta_id = ?", Integer.class, UUID.fromString(pasta))).isZero();
    }

    @Test void itemDeOutroAlunoDaMesmaConsultoriaNaoEAceito() throws Exception {
        UUID outro = api.criarAluno(treinador, "Outro Aluno Fictício");
        String pastaDoOutro = api.post("/alunos/" + outro + "/pastas", treinador,
                Map.of("titulo", "Período do outro", "inicio", hoje.minusDays(27), "fim", hoje), 200).path("id").asString();
        UUID alimentoDele = UUID.randomUUID();
        JsonNode criado = api.post("/alunos/" + outro + "/planos-dieta", treinador, Map.of("titulo", "Dieta do outro", "pastaId", pastaDoOutro), 200);
        String id = criado.path("plano").path("id").asString();
        ConteudoDieta dele = new ConteudoDieta("Objetivo fictício", null, "Treinador Teste", List.of(
                new ConteudoDieta.Refeicao(UUID.randomUUID(), "Almoço", "12:00", null, List.of(
                        new ConteudoDieta.Opcao(UUID.randomUUID(), "A", List.of(item(alimentoDele, "Peixe fictício")))))),
                List.of(), null, List.of());
        JsonNode salvo = api.put("/planos-dieta/" + id + "/rascunho", treinador,
                ApiDeTeste.rascunho("Dieta do outro", dele, criado.path("plano").path("versao").asLong()), 200);
        api.post("/planos-dieta/" + id + "/publicar", treinador,
                Map.of("versao", salvo.path("plano").path("versao").asLong(), "confirmarAvisos", true), 200);
        assertThat(campoDoErro(enviar(respostas("alim", List.of(escolha(alimentoDele.toString(), null))), 422))).isEqualTo("alim");
    }

    private static String abreviado(LocalDate dia) {
        String[] abreviados = {"Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"};
        return "%s %02d/%02d".formatted(abreviados[dia.getDayOfWeek().getValue() - 1], dia.getDayOfMonth(), dia.getMonthValue());
    }

    @Test void semRegistroDiasTreinadosAceitamASemana() throws Exception {
        JsonNode enviada = enviar(respostas("dia", List.of(escolha("3", "Cansaço"))), 200);
        assertThat(enviada.path("respostas").path("dia").get(0).path("nome").asString()).isEqualTo("Quarta-feira");
    }

    @Test void semRegistroDiasTreinadosAceitamQualquerDataDoPeriodoMasNaoDeFora() throws Exception {
        // fora do período (antes do início da pasta, depois da data da atualização) e formato torto: recusados
        for (String ruim : List.of(hoje.minusDays(28).toString(), hoje.plusDays(1).toString(), "8", "0", "17/11")) {
            assertThat(campoDoErro(enviar(respostas("dia", List.of(escolha(ruim, "x"))), 422))).as(ruim).isEqualTo("dia");
        }
        LocalDate dia = hoje.minusDays(5);
        JsonNode enviada = enviar(respostas("dia", List.of(escolha(dia.toString(), "Cansaço"))), 200);
        assertThat(enviada.path("respostas").path("dia").get(0).path("nome").asString()).isEqualTo(abreviado(dia));
    }

    @Test void comRegistroDiasTreinadosSoAceitamOsDiasComSerieConcluida() throws Exception {
        LocalDate treinou = hoje.minusDays(2);
        registrarSerieConcluida(treinou);
        // com registro: a semana e as outras datas do período são recusadas
        for (String ruim : List.of("3", hoje.minusDays(5).toString(), hoje.toString())) {
            assertThat(campoDoErro(enviar(respostas("dia", List.of(escolha(ruim, "x"))), 422))).as(ruim).isEqualTo("dia");
        }
        JsonNode enviada = enviar(respostas("dia", List.of(escolha(treinou.toString(), "Cansaço"))), 200);
        String esperado = abreviado(treinou) + " · Segunda - Costas";
        assertThat(enviada.path("respostas").path("dia").get(0).path("id").asString()).isEqualTo(treinou.toString());
        assertThat(enviada.path("respostas").path("dia").get(0).path("nome").asString()).isEqualTo(esperado);
    }

    @Test void versaoAgendadaNaoEntraNaListaDeItens() throws Exception {
        // nova versão da dieta, com um alimento novo, agendada para daqui a uns dias: o aluno segue na versão anterior
        UUID peixe = UUID.randomUUID();
        JsonNode atual = api.get("/planos-dieta/" + planoDaDieta, treinador, 200);
        ConteudoDieta nova = new ConteudoDieta("Objetivo fictício", null, "Treinador Teste", List.of(
                new ConteudoDieta.Refeicao(UUID.randomUUID(), "Almoço", "12:00", null, List.of(
                        new ConteudoDieta.Opcao(UUID.randomUUID(), "A", List.of(item(peixe, "Peixe agendado")))))),
                List.of(), null, List.of());
        JsonNode salvo = api.put("/planos-dieta/" + planoDaDieta + "/rascunho", treinador,
                ApiDeTeste.rascunho("Dieta fictícia", nova, atual.path("plano").path("versao").asLong()), 200);
        api.post("/planos-dieta/" + planoDaDieta + "/publicar", treinador, Map.of("versao", salvo.path("plano").path("versao").asLong(),
                "confirmarAvisos", true, "liberarEm", hoje.plusDays(4).toString()), 200);
        assertThat(campoDoErro(enviar(respostas("alim", List.of(escolha(peixe.toString(), null))), 422))).isEqualTo("alim");
        JsonNode enviada = enviar(respostas("alim", List.of(escolha(frango.toString(), null))), 200);
        assertThat(enviada.path("respostas").path("alim").get(0).path("nome").asString()).isEqualTo("Frango grelhado");
    }

    @Test void semAPerguntaNaoHaConsultaEOEnvioComumSegue() throws Exception {
        // pergunta opcional não respondida: nada a conferir, o envio passa
        JsonNode enviada = enviar(respostas("dor", List.of(escolha(treino.exercicioUid().toString(), "Ombro")), "dia", List.of(escolha("1", "x"))), 200);
        assertThat(enviada.path("respostas").has("alim")).isFalse();
    }
}
