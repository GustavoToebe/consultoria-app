package br.com.treinos.api.atencao;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.web.Fuso;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Regras de atenção (etapa 1): rotas, validações, isolamento, permissões e a avaliação no envio (congelada, idempotente, sem
 * vazar ao aluno), com a lista e o filtro {@code comAtencao} coerentes. Dados fictícios.
 */
@AutoConfigureMockMvc
class RegrasDeAtencaoIntegrationTest extends AbstractIntegrationTest {

    static final String CONTEUDO = """
        {"formato":2,"instrucoes":[],"secoes":[{"uid":"s1","titulo":"Geral","perguntas":[
          {"id":"peso","tipo":"PESO","rotulo":"Peso","obrigatoria":false},
          {"id":"humor","tipo":"NOTA","rotulo":"Humor","obrigatoria":false,"min":1,"max":8},
          {"id":"dor","tipo":"SIM_NAO","rotulo":"Dor","obrigatoria":false},
          {"id":"fome","tipo":"NOTAS_POR_DIA","rotulo":"Fome por dia","obrigatoria":false,"dias":[1,2]}]}]}
        """;

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate banco;
    private ApiDeTeste api;
    private JsonNode treinador;
    private UUID consultoria;
    private UUID questionario;
    private UUID versao;
    private final String nomeDoQuestionario = "Questionário fictício " + UUID.randomUUID();

    record AlunoDeTeste(UUID id, JsonNode login, String pasta) { }

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        treinador = api.novoTreinador();
        consultoria = banco.queryForObject("select consultoria_id from usuario where id = ?::uuid", UUID.class,
                treinador.path("usuario").path("id").asString());
        questionario = UUID.randomUUID();
        versao = UUID.randomUUID();
        banco.update("insert into questionario(id,consultoria_id,nome,rascunho,versao_publicada,publicado_em) values (?,?,?,?::jsonb,1,now())",
                questionario, consultoria, nomeDoQuestionario, CONTEUDO);
        banco.update("insert into questionario_versao(id,consultoria_id,questionario_id,numero,conteudo) values (?,?,?,1,?::jsonb)",
                versao, consultoria, questionario, CONTEUDO);
    }

    // ---- apoio ----

    private AlunoDeTeste aluno(String nome) throws Exception {
        UUID id = api.criarAluno(treinador, nome);
        JsonNode login = api.convidarEEntrar(treinador, id);
        banco.update("update aluno set questionario_id = ? where id = ?", questionario, id);
        LocalDate fim = LocalDate.now(Fuso.BRASILIA);
        String pasta = api.post("/alunos/" + id + "/pastas", treinador,
                Map.of("titulo", "Período fictício", "inicio", fim.minusDays(27), "fim", fim), 200).path("id").asString();
        JsonNode criado = api.post("/alunos/" + id + "/planos-treino", treinador, Map.of("titulo", "Treino fictício", "pastaId", pasta), 200);
        String plano = criado.path("plano").path("id").asString();
        JsonNode salvo = api.put("/planos-treino/" + plano + "/rascunho", treinador,
                ApiDeTeste.rascunho("Treino fictício", ApiDeTeste.treino().conteudo(), criado.path("plano").path("versao").asLong()), 200);
        api.post("/planos-treino/" + plano + "/publicar", treinador,
                Map.of("versao", salvo.path("plano").path("versao").asLong(), "confirmarAvisos", true), 200);
        return new AlunoDeTeste(id, login, pasta);
    }

    private JsonNode enviar(AlunoDeTeste a, Map<String, Object> respostas) throws Exception {
        return api.post("/aluno/atualizacao/enviar", a.login(),
                Map.of("pastaId", a.pasta(), "questionarioVersaoId", versao.toString(), "respostas", respostas), 200);
    }

    static Map<String, Object> regra(String tipo, String pergunta, Object limite) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("tipo", tipo);
        if (pergunta != null) r.put("perguntaId", pergunta);
        if (limite != null) r.put("limite", limite);
        r.put("ativa", true);
        return r;
    }

    private JsonNode salvar(JsonNode login, long versaoDaLista, List<Map<String, Object>> regras, int status) throws Exception {
        return api.put("/regras-de-atencao", login, Map.of("versao", versaoDaLista, "regras", regras), status);
    }

    private JsonNode salvar(List<Map<String, Object>> regras) throws Exception {
        return salvar(treinador, api.get("/regras-de-atencao", treinador, 200).path("versao").asLong(), regras, 200);
    }

    /** As regras como estão, para reenviar (com id). */
    private List<Map<String, Object>> gravadas(JsonNode lista) {
        List<Map<String, Object>> r = new ArrayList<>();
        for (JsonNode g : lista.path("regras")) {
            Map<String, Object> m = regra(g.path("tipo").asString(), g.path("perguntaId").isNull() ? null : g.path("perguntaId").asString(),
                    g.path("limite").isNull() ? null : g.path("limite").decimalValue());
            m.put("id", g.path("id").asString());
            r.add(m);
        }
        return r;
    }

    private static JsonNode porTipo(JsonNode lista, String tipo) {
        for (JsonNode r : lista.path("regras")) if (r.path("tipo").asString().equals(tipo)) return r;
        throw new AssertionError("Sem regra " + tipo);
    }

    private static Map<String, Object> doTipo(List<Map<String, Object>> regras, String tipo) {
        return regras.stream().filter(r -> tipo.equals(r.get("tipo"))).findFirst().orElseThrow();
    }

    private long fatosNoBanco(String atualizacaoId) {
        return banco.queryForObject("select count(*) from atualizacao_atencao where consultoria_id = ? and atualizacao_id = ?::uuid",
                Long.class, consultoria, atualizacaoId);
    }

    private long auditoria(String acao) {
        return banco.queryForObject("select count(*) from auditoria where consultoria_id = ? and acao = ?", Long.class, consultoria, acao);
    }

    private JsonNode itemDaLista(JsonNode lista, UUID aluno) {
        for (JsonNode i : lista) if (i.path("alunoId").asString().equals(aluno.toString())) return i;
        return null;
    }

    private UUID criarPerfil(List<String> codigos) {
        UUID id = UUID.randomUUID();
        banco.update("insert into perfil(id, consultoria_id, nome) values (?, ?, ?)", id, consultoria, "Perfil fictício " + id);
        for (String codigo : codigos) banco.update("insert into perfil_permissao(perfil_id, codigo) values (?, ?)", id, codigo);
        return id;
    }

    // ---- testes ----

    @Test
    void listaTrazPerguntasDosQuestionariosPublicadosVersaoETeto() throws Exception {
        assertThat(api.get("/eu", treinador, 200).path("regrasAtencaoHabilitada").asBoolean()).isTrue();
        JsonNode lista = api.get("/regras-de-atencao", treinador, 200);
        assertThat(lista.path("teto").asInt()).isEqualTo(50);
        assertThat(lista.path("regras")).isEmpty();
        JsonNode sono = null;
        JsonNode dor = null;
        for (JsonNode p : lista.path("perguntas")) {
            if (p.path("perguntaId").asString().equals("humor") && p.path("questionarios").toString().contains(questionario.toString())) sono = p;
            if (p.path("perguntaId").asString().equals("dor")) dor = p;
            // PESO, NOTAS_POR_DIA e o resto não entram.
            assertThat(p.path("tipo").asString()).isIn("NOTA", "SIM_NAO", "ITENS_DO_PLANO");
        }
        assertThat(sono).isNotNull();
        assertThat(sono.path("tipo").asString()).isEqualTo("NOTA");
        assertThat(sono.path("questionarios").toString()).contains(nomeDoQuestionario);
        assertThat(sono.path("escala").path("min").asInt()).isEqualTo(1);
        assertThat(sono.path("escala").path("max").asInt()).isEqualTo(8);
        assertThat(dor.path("tipo").asString()).isEqualTo("SIM_NAO");
        assertThat(dor.path("escala").isNull()).isTrue();

        // Questionário arquivado sai da lista de perguntas.
        banco.update("update questionario set arquivado = true where id = ?", questionario);
        assertThat(api.get("/regras-de-atencao", treinador, 200).path("perguntas").toString()).doesNotContain(questionario.toString());
    }

    @Test
    void salvarEmLoteCriaAlteraERemoveComVersaoEAuditoriaDeResumoFixo() throws Exception {
        JsonNode antes = api.get("/regras-de-atencao", treinador, 200);
        JsonNode criadas = salvar(treinador, antes.path("versao").asLong(), List.of(regra("NOTA_ABAIXO", "humor", 3),
                regra("SIM", "dor", null), regra("PESO_MUDOU", null, 1.5), regra("POUCOS_TREINOS", null, 2)), 200);
        assertThat(criadas.path("regras")).hasSize(4);
        assertThat(criadas.path("versao").asLong()).isNotEqualTo(antes.path("versao").asLong());
        assertThat(criadas.path("regras").get(0).path("alunosComExcecao").asLong()).isZero();
        assertThat(porTipo(criadas, "PESO_MUDOU").path("limite").decimalValue()).isEqualByComparingTo("1.5");
        assertThat(auditoria("REGRA_ATENCAO_CRIADA")).isEqualTo(4);

        // A versão velha dá 409 e nada muda.
        salvar(treinador, antes.path("versao").asLong(), List.of(), 409);
        assertThat(api.get("/regras-de-atencao", treinador, 200).path("regras")).hasSize(4);

        // Sem mudança: mesma versão, nada auditado.
        List<Map<String, Object>> iguais = gravadas(criadas);
        JsonNode mesma = salvar(treinador, criadas.path("versao").asLong(), iguais, 200);
        assertThat(mesma.path("versao").asLong()).isEqualTo(criadas.path("versao").asLong());
        assertThat(auditoria("REGRA_ATENCAO_ALTERADA")).isZero();

        // Desliga uma, troca o número de outra e tira a terceira do corpo (apagada).
        List<Map<String, Object>> mudadas = gravadas(criadas);
        doTipo(mudadas, "NOTA_ABAIXO").put("ativa", false);
        doTipo(mudadas, "PESO_MUDOU").put("limite", 2);
        mudadas.remove(doTipo(mudadas, "SIM"));
        JsonNode depois = salvar(treinador, criadas.path("versao").asLong(), mudadas, 200);
        assertThat(depois.path("regras")).hasSize(3);
        assertThat(porTipo(depois, "NOTA_ABAIXO").path("ativa").asBoolean()).isFalse();
        assertThat(porTipo(depois, "PESO_MUDOU").path("limite").decimalValue()).isEqualByComparingTo("2");
        assertThat(auditoria("REGRA_ATENCAO_ALTERADA")).isEqualTo(2);
        assertThat(auditoria("REGRA_ATENCAO_REMOVIDA")).isEqualTo(1);
        assertThat(banco.queryForList("select distinct resumo from auditoria where consultoria_id = ? and acao like 'REGRA_ATENCAO_%'",
                String.class, consultoria)).containsExactlyInAnyOrder("Criou uma regra de atenção.", "Alterou uma regra de atenção.",
                "Removeu uma regra de atenção.");
    }

    @Test
    void validacoesDao422PorCampoComMensagemFixa() throws Exception {
        long v = api.get("/regras-de-atencao", treinador, 200).path("versao").asLong();
        record Caso(Map<String, Object> regra, String campo) { }
        for (Caso c : List.of(
                new Caso(regra("NOTA_ABAIXO", "humor", 9), "regras[0].limite"),           // fora da escala 1 a 8 da pergunta
                new Caso(regra("NOTA_ABAIXO", "humor", 0), "regras[0].limite"),
                new Caso(regra("NOTA_ABAIXO", "humor", 2.5), "regras[0].limite"),
                new Caso(regra("NOTA_ABAIXO", "inexistente", 3), "regras[0].perguntaId"),
                new Caso(regra("NOTA_ABAIXO", "fome", 3), "regras[0].perguntaId"),         // NOTAS_POR_DIA não entra
                new Caso(regra("NOTA_ABAIXO", "dor", 3), "regras[0].perguntaId"),          // tipo errado
                new Caso(regra("SIM", "humor", null), "regras[0].perguntaId"),
                new Caso(regra("SIM", null, null), "regras[0].perguntaId"),
                new Caso(regra("NOTA_ABAIXO", "humor", null), "regras[0].limite"),
                new Caso(regra("NOTA_CAIU", null, 11), "regras[0].limite"),
                new Caso(regra("NOTA_CAIU", null, 1.5), "regras[0].limite"),
                new Caso(regra("PESO_MUDOU", null, 0.05), "regras[0].limite"),
                new Caso(regra("PESO_MUDOU", null, 50.5), "regras[0].limite"),
                new Caso(regra("POUCOS_TREINOS", null, 32), "regras[0].limite"),
                new Caso(regra("POUCOS_TREINOS", null, 0), "regras[0].limite"),
                new Caso(regra("NOTAS_POR_DIA", null, 1), "regras[0].tipo"))) {
            JsonNode erro = salvar(treinador, v, List.of(c.regra()), 422);
            assertThat(erro.path("codigo").asString()).isEqualTo("REGRA_INVALIDA");
            assertThat(erro.path("fieldErrors").get(0).path("field").asString()).as(c.toString()).isEqualTo(c.campo());
        }
        // Repetida no corpo.
        JsonNode repetida = salvar(treinador, v, List.of(regra("SIM", "dor", null), regra("SIM", "dor", null)), 422);
        assertThat(repetida.path("fieldErrors").get(0).path("field").asString()).isEqualTo("regras[1].perguntaId");
        JsonNode duasDePeso = salvar(treinador, v, List.of(regra("PESO_MUDOU", null, 1), regra("PESO_MUDOU", null, 2)), 422);
        assertThat(duasDePeso.path("fieldErrors").get(0).path("field").asString()).isEqualTo("regras[1].tipo");
        // Acima do teto.
        List<Map<String, Object>> muitas = new ArrayList<>();
        for (int i = 0; i <= RegrasDeAtencaoService.TETO; i++) muitas.add(regra("SIM", "p" + i, null));
        assertThat(salvar(treinador, v, muitas, 422).path("fieldErrors").get(0).path("field").asString()).isEqualTo("regras");
        // A mensagem nunca repete o valor e nada foi gravado.
        assertThat(salvar(treinador, v, List.of(regra("NOTA_CAIU", null, 77)), 422).toString()).doesNotContain("77");
        assertThat(api.get("/regras-de-atencao", treinador, 200).path("regras")).isEmpty();
        // O tipo de uma regra gravada não muda.
        JsonNode gravada = salvar(List.of(regra("SIM", "dor", null)));
        Map<String, Object> outroTipo = regra("NOTA_ABAIXO", "humor", 3);
        outroTipo.put("id", gravada.path("regras").get(0).path("id").asString());
        assertThat(salvar(treinador, gravada.path("versao").asLong(), List.of(outroTipo), 422).path("fieldErrors").get(0).path("field").asString())
                .isEqualTo("regras[0].tipo");
    }

    @Test
    void outraConsultoriaNaoVeNemAlteraERegraDeOutraDa404() throws Exception {
        JsonNode minhas = salvar(List.of(regra("SIM", "dor", null)));
        JsonNode outro = api.novoTreinador();
        JsonNode dela = api.get("/regras-de-atencao", outro, 200);
        assertThat(dela.path("regras")).isEmpty();
        assertThat(dela.path("perguntas").toString()).doesNotContain(questionario.toString());
        Map<String, Object> alheia = regra("SIM", "dor", null);
        alheia.put("id", minhas.path("regras").get(0).path("id").asString());
        salvar(outro, dela.path("versao").asLong(), List.of(alheia), 404);
        assertThat(api.get("/regras-de-atencao", treinador, 200).path("regras")).hasSize(1);
    }

    @Test
    void permissoes() throws Exception {
        AlunoDeTeste a = aluno("Aluno Fictício Permissão");
        api.get("/regras-de-atencao", a.login(), 403);
        api.put("/regras-de-atencao", a.login(), Map.of("versao", 0, "regras", List.of()), 403);
        UUID usuario = UUID.fromString(treinador.path("usuario").path("id").asString());
        // Lê com ATUALIZACAO_LER + ALUNO_SENSIVEL_LER, mas sem REGRA_ATENCAO_ALTERAR não salva.
        banco.update("update usuario set perfil_id = ? where id = ?", criarPerfil(List.of("ALUNO_LER", "ALUNO_SENSIVEL_LER", "ATUALIZACAO_LER")), usuario);
        long v = api.get("/regras-de-atencao", treinador, 200).path("versao").asLong();
        salvar(treinador, v, List.of(regra("SIM", "dor", null)), 403);
        // Com REGRA_ATENCAO_ALTERAR salva.
        banco.update("update usuario set perfil_id = ? where id = ?",
                criarPerfil(List.of("ALUNO_LER", "ALUNO_SENSIVEL_LER", "ATUALIZACAO_LER", "REGRA_ATENCAO_ALTERAR")), usuario);
        salvar(treinador, v, List.of(regra("SIM", "dor", null)), 200);
        // Sem ATUALIZACAO_LER nem lê.
        banco.update("update usuario set perfil_id = ? where id = ?", criarPerfil(List.of("ALUNO_LER", "ALUNO_SENSIVEL_LER")), usuario);
        api.get("/regras-de-atencao", treinador, 403);
    }

    @Test
    void envioAvaliaCongelaNaoVazaAoAlunoEOFiltroComAtencaoECoerente() throws Exception {
        salvar(List.of(regra("NOTA_ABAIXO", "humor", 5), regra("SIM", "dor", null)));
        AlunoDeTeste comPontos = aluno("Aluno Fictício Atenção");
        AlunoDeTeste semPontos = aluno("Aluno Fictício Sem Atenção");

        JsonNode enviada = enviar(comPontos, Map.of("humor", 4, "dor", true, "peso", 80));
        String id = enviada.path("id").asString();
        // A rota do aluno nunca leva os pontos (D5).
        assertThat(enviada.path("atencao").isNull() || enviada.path("atencao").isMissingNode()).isTrue();
        assertThat(api.get("/aluno/atualizacao", comPontos.login(), 200).path("atencao").isNull()).isTrue();
        assertThat(api.get("/aluno/atualizacoes/" + id, comPontos.login(), 200).path("atencao").isNull()).isTrue();
        for (JsonNode h : api.get("/aluno/atualizacoes", comPontos.login(), 200)) assertThat(h.path("atencao").isNull()).isTrue();
        assertThat(api.get("/aluno/painel", comPontos.login(), 200).toString()).doesNotContain("limiteVigente");

        JsonNode detalhe = api.get("/atualizacoes/" + id, treinador, 200);
        assertThat(detalhe.path("atencao")).hasSize(2);
        JsonNode nota = detalhe.path("atencao").get(0);
        assertThat(nota.path("tipo").asString()).isEqualTo("NOTA_ABAIXO");
        assertThat(nota.path("perguntaId").asString()).isEqualTo("humor");
        assertThat(nota.path("limiteVigente").decimalValue()).isEqualByComparingTo("5");
        assertThat(nota.path("valorObservado").decimalValue()).isEqualByComparingTo("4");
        JsonNode sim = detalhe.path("atencao").get(1);
        assertThat(sim.path("tipo").asString()).isEqualTo("SIM");
        assertThat(sim.path("valorObservado").isNull()).isTrue();
        assertThat(api.get("/alunos/" + comPontos.id() + "/atualizacoes", treinador, 200).get(0).path("atencao")).hasSize(2);

        // Sem fato: 0 de verdade (foi avaliada), lista vazia no detalhe.
        String semId = enviar(semPontos, Map.of("humor", 8, "dor", false)).path("id").asString();
        assertThat(api.get("/atualizacoes/" + semId, treinador, 200).path("atencao")).isEmpty();

        JsonNode lista = api.get("/atualizacoes?situacao=PARA_REVISAR", treinador, 200);
        assertThat(itemDaLista(lista, comPontos.id()).path("pontosDeAtencao").asLong()).isEqualTo(2);
        assertThat(itemDaLista(lista, semPontos.id()).path("pontosDeAtencao").asLong()).isZero();
        // Ainda não enviada: nulo.
        AlunoDeTeste aberta = aluno("Aluno Fictício Aberta");
        assertThat(itemDaLista(api.get("/atualizacoes?situacao=PROXIMAS", treinador, 200), aberta.id()).path("pontosDeAtencao").isNull()).isTrue();

        // comAtencao: lista, página e contagens com o mesmo recorte.
        JsonNode filtrada = api.get("/atualizacoes?situacao=PARA_REVISAR&comAtencao=true", treinador, 200);
        assertThat(filtrada).hasSize(1);
        assertThat(itemDaLista(filtrada, comPontos.id())).isNotNull();
        assertThat(api.get("/atualizacoes/pagina?situacao=PARA_REVISAR&comAtencao=true", treinador, 200).path("total").asLong()).isEqualTo(1);
        assertThat(api.get("/atualizacoes/contagens?comAtencao=true", treinador, 200).path("PARA_REVISAR").asLong()).isEqualTo(1);
        assertThat(api.get("/atualizacoes/contagens?comAtencao=true", treinador, 200).path("PROXIMAS").asLong()).isZero();
        assertThat(api.get("/atualizacoes/contagens", treinador, 200).path("PARA_REVISAR").asLong()).isEqualTo(2);

        // Reenvio idempotente: não reavalia nem duplica.
        enviar(comPontos, Map.of("humor", 1, "dor", true));
        assertThat(fatosNoBanco(id)).isEqualTo(2);

        // Mudar e apagar a regra depois não reescreve o fato gravado.
        JsonNode regras = api.get("/regras-de-atencao", treinador, 200);
        List<Map<String, Object>> mudadas = gravadas(regras);
        doTipo(mudadas, "NOTA_ABAIXO").put("limite", 2);
        mudadas.remove(doTipo(mudadas, "SIM"));
        salvar(treinador, regras.path("versao").asLong(), mudadas, 200);
        JsonNode congelado = api.get("/atualizacoes/" + id, treinador, 200).path("atencao");
        assertThat(congelado).hasSize(2);
        assertThat(congelado.get(0).path("limiteVigente").decimalValue()).isEqualByComparingTo("5");

        // Outra consultoria não lê o detalhe.
        api.get("/atualizacoes/" + id, api.novoTreinador(), 404);
    }

    @Test
    void notaCaiuEPesoMudouComparamComAAnteriorEPoucosTreinosUsaOsDiasDoEnvio() throws Exception {
        salvar(List.of(regra("NOTA_CAIU", null, 2), regra("PESO_MUDOU", null, 1), regra("POUCOS_TREINOS", null, 3)));
        AlunoDeTeste a = aluno("Aluno Fictício Anterior");
        // A anterior: enviada, data antes, mesma versão (mesmos ids e tipos).
        UUID pasta = UUID.randomUUID();
        LocalDate antes = LocalDate.now(Fuso.BRASILIA).minusDays(28);
        banco.update("insert into pasta_plano(id,consultoria_id,aluno_id,titulo,inicio,fim) values (?,?,?,'Período fictício anterior',?,?)",
                pasta, consultoria, a.id(), antes.minusDays(27), antes);
        banco.update("insert into atualizacao(id,consultoria_id,aluno_id,pasta_id,data_atualizacao,estado,respostas,enviada_em,questionario_versao_id) "
                + "values (?,?,?,?,?,'ENVIADA',?::jsonb,now(),?)", UUID.randomUUID(), consultoria, a.id(), pasta, antes, "{\"humor\":8,\"peso\":82}", versao);

        JsonNode detalhe = api.get("/atualizacoes/" + enviar(a, Map.of("humor", 6, "peso", 80.5)).path("id").asString(), treinador, 200);
        Map<String, JsonNode> porTipo = new LinkedHashMap<>();
        for (JsonNode f : detalhe.path("atencao")) porTipo.put(f.path("tipo").asString(), f);
        assertThat(porTipo).containsOnlyKeys("NOTA_CAIU", "PESO_MUDOU", "POUCOS_TREINOS");
        assertThat(porTipo.get("NOTA_CAIU").path("perguntaId").asString()).isEqualTo("humor");
        assertThat(porTipo.get("NOTA_CAIU").path("valorObservado").decimalValue()).isEqualByComparingTo("-2");
        assertThat(porTipo.get("PESO_MUDOU").path("perguntaId").asString()).isEqualTo("peso");
        assertThat(porTipo.get("PESO_MUDOU").path("valorObservado").decimalValue()).isEqualByComparingTo("-1.5");
        assertThat(porTipo.get("POUCOS_TREINOS").path("perguntaId").isNull()).isTrue();
        assertThat(porTipo.get("POUCOS_TREINOS").path("valorObservado").decimalValue())
                .isEqualByComparingTo(detalhe.path("resumo").path("diasComTreino").decimalValue());
    }

    @Test
    void semRegraAtivaNenhumPonto() throws Exception {
        JsonNode lista = salvar(List.of(regra("SIM", "dor", null)));
        List<Map<String, Object>> desligada = gravadas(lista);
        desligada.get(0).put("ativa", false);
        salvar(treinador, lista.path("versao").asLong(), desligada, 200);
        AlunoDeTeste a = aluno("Aluno Fictício Sem Regra");
        String id = enviar(a, Map.of("dor", true)).path("id").asString();
        assertThat(fatosNoBanco(id)).isZero();
        assertThat(api.get("/atualizacoes/" + id, treinador, 200).path("atencao")).isEmpty();
    }

    @Test
    void exportacaoLevaOsFatosEAnonimizarOsApaga() throws Exception {
        salvar(List.of(regra("NOTA_ABAIXO", "humor", 5), regra("SIM", "dor", null)));
        AlunoDeTeste a = aluno("Aluno Fictício LGPD");
        AlunoDeTeste vizinho = aluno("Aluno Fictício Vizinho LGPD");
        String id = enviar(a, Map.of("humor", 4, "dor", true)).path("id").asString();
        String doVizinho = enviar(vizinho, Map.of("dor", true)).path("id").asString();

        JsonNode exportada = api.get("/alunos/" + a.id() + "/exportacao", treinador, 200).path("atualizacoes").path("itens").get(0);
        Map<String, JsonNode> porTipo = new LinkedHashMap<>();
        for (JsonNode f : exportada.path("atencao")) porTipo.put(f.path("tipo").asString(), f);
        assertThat(porTipo).containsOnlyKeys("NOTA_ABAIXO", "SIM");
        assertThat(porTipo.get("NOTA_ABAIXO").path("perguntaId").asString()).isEqualTo("humor");
        assertThat(porTipo.get("NOTA_ABAIXO").path("limiteVigente").decimalValue()).isEqualByComparingTo("5");
        assertThat(porTipo.get("NOTA_ABAIXO").path("valorObservado").decimalValue()).isEqualByComparingTo("4");
        // Outra consultoria nunca vê.
        api.get("/alunos/" + a.id() + "/exportacao", api.novoTreinador(), 404);

        api.patch("/alunos/" + a.id() + "/situacao", treinador, Map.of("ativo", false), 200);
        api.post("/alunos/" + a.id() + "/anonimizar", treinador, Map.of("nomeConfirmado", "Aluno Fictício LGPD"), 200);
        assertThat(fatosNoBanco(id)).isZero();
        // Só os do aluno anonimizado.
        assertThat(fatosNoBanco(doVizinho)).isEqualTo(1);
    }
}
