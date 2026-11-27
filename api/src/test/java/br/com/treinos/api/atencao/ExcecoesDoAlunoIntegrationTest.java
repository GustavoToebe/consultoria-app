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
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static br.com.treinos.api.atencao.RegrasDeAtencaoIntegrationTest.regra;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * Exceção por aluno (etapa 2, C8): vale no próximo envio e congela, contagem por regra, validações, versão, permissões, isolamento
 * e LGPD (anonimizar e "Excluir minha conta" apagam as exceções e os fatos; a regra apagada leva as exceções). Dados fictícios.
 */
@AutoConfigureMockMvc
class ExcecoesDoAlunoIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate banco;
    private ApiDeTeste api;
    private JsonNode treinador;
    private UUID consultoria;
    private UUID versao;
    private UUID questionario;
    private String nota;
    private String sim;

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
                questionario, consultoria, "Questionário fictício " + questionario, RegrasDeAtencaoIntegrationTest.CONTEUDO);
        banco.update("insert into questionario_versao(id,consultoria_id,questionario_id,numero,conteudo) values (?,?,?,1,?::jsonb)",
                versao, consultoria, questionario, RegrasDeAtencaoIntegrationTest.CONTEUDO);
        JsonNode lista = api.get("/regras-de-atencao", treinador, 200);
        JsonNode salvas = api.put("/regras-de-atencao", treinador, Map.of("versao", lista.path("versao").asLong(),
                "regras", List.of(regra("NOTA_ABAIXO", "humor", 5), regra("SIM", "dor", null))), 200);
        for (JsonNode r : salvas.path("regras")) {
            if (r.path("tipo").asString().equals("NOTA_ABAIXO")) nota = r.path("id").asString();
            else sim = r.path("id").asString();
        }
    }

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

    private String enviar(AlunoDeTeste a, Map<String, Object> respostas) throws Exception {
        return api.post("/aluno/atualizacao/enviar", a.login(),
                Map.of("pastaId", a.pasta(), "questionarioVersaoId", versao.toString(), "respostas", respostas), 200).path("id").asString();
    }

    private static Map<String, Object> corpo(boolean ativa, Object limite, Object versao) {
        Map<String, Object> m = new HashMap<>();
        m.put("ativa", ativa);
        m.put("limite", limite);
        m.put("versao", versao);
        return m;
    }

    private JsonNode definir(JsonNode login, UUID aluno, String regraId, Map<String, Object> corpo, int status) throws Exception {
        return api.put("/alunos/" + aluno + "/regras-de-atencao/" + regraId, login, corpo, status);
    }

    private static JsonNode daRegra(JsonNode lista, String regraId) {
        for (JsonNode r : lista.path("regras")) if (r.path("regraId").asString().equals(regraId)) return r;
        throw new AssertionError("Sem a regra");
    }

    private long excecoesNoBanco(UUID aluno) {
        return banco.queryForObject("select count(*) from regra_de_atencao_aluno where consultoria_id = ? and aluno_id = ?",
                Long.class, consultoria, aluno);
    }

    private long fatosNoBanco(String atualizacaoId) {
        return banco.queryForObject("select count(*) from atualizacao_atencao where consultoria_id = ? and atualizacao_id = ?::uuid",
                Long.class, consultoria, atualizacaoId);
    }

    private long auditoria(String acao) {
        return banco.queryForObject("select count(*) from auditoria where consultoria_id = ? and acao = ?", Long.class, consultoria, acao);
    }

    private UUID criarPerfil(List<String> codigos) {
        UUID id = UUID.randomUUID();
        banco.update("insert into perfil(id, consultoria_id, nome) values (?, ?, ?)", id, consultoria, "Perfil fictício " + id);
        for (String codigo : codigos) banco.update("insert into perfil_permissao(perfil_id, codigo) values (?, ?)", id, codigo);
        return id;
    }

    @Test
    void excecaoValeNoProximoEnvioCongelaEAContagemApareceNasRegras() throws Exception {
        AlunoDeTeste com = aluno("Aluno Fictício Exceção");
        AlunoDeTeste sem = aluno("Aluno Fictício Regra Geral");

        JsonNode inicial = api.get("/alunos/" + com.id() + "/regras-de-atencao", treinador, 200);
        assertThat(inicial.path("regras")).hasSize(2);
        assertThat(daRegra(inicial, nota).path("excecao").isNull()).isTrue();
        assertThat(daRegra(inicial, nota).path("limite").decimalValue()).isEqualByComparingTo("5");

        JsonNode outroNumero = definir(treinador, com.id(), nota, corpo(true, 3, null), 200);
        assertThat(daRegra(outroNumero, nota).path("excecao").path("ativa").asBoolean()).isTrue();
        assertThat(daRegra(outroNumero, nota).path("excecao").path("limite").decimalValue()).isEqualByComparingTo("3");
        long versaoDaNota = daRegra(outroNumero, nota).path("excecao").path("versao").asLong();
        JsonNode desligada = definir(treinador, com.id(), sim, corpo(false, null, null), 200);
        assertThat(daRegra(desligada, sim).path("excecao").path("ativa").asBoolean()).isFalse();
        assertThat(daRegra(desligada, sim).path("excecao").path("limite").isNull()).isTrue();
        assertThat(auditoria("REGRA_ATENCAO_EXCECAO_DEFINIDA")).isEqualTo(2);
        assertThat(banco.queryForList("select distinct resumo from auditoria where consultoria_id = ? and acao = 'REGRA_ATENCAO_EXCECAO_DEFINIDA'",
                String.class, consultoria)).containsExactly("Ajustou uma regra de atenção só para o aluno.");

        // Só a contagem, por regra; o aluno sem exceção não conta.
        for (JsonNode r : api.get("/regras-de-atencao", treinador, 200).path("regras")) {
            assertThat(r.path("alunosComExcecao").asLong()).isEqualTo(1);
        }

        // Nota 4 não bate no 3 do aluno e o Sim está desligado só para ele; o vizinho segue a regra geral.
        String semFato = enviar(com, Map.of("humor", 4, "dor", true));
        assertThat(fatosNoBanco(semFato)).isZero();
        String doVizinho = enviar(sem, Map.of("humor", 4, "dor", true));
        assertThat(fatosNoBanco(doVizinho)).isEqualTo(2);

        // Com nota 3 bate e congela o número do aluno; mudar e apagar a exceção depois não reescreve o fato.
        AlunoDeTeste outro = aluno("Aluno Fictício Exceção Dois");
        definir(treinador, outro.id(), nota, corpo(true, 3, null), 200);
        String comFato = enviar(outro, Map.of("humor", 3, "dor", true));
        JsonNode fatos = api.get("/atualizacoes/" + comFato, treinador, 200).path("atencao");
        assertThat(fatos).hasSize(2);
        for (JsonNode f : fatos) {
            if (f.path("tipo").asString().equals("NOTA_ABAIXO")) assertThat(f.path("limiteVigente").decimalValue()).isEqualByComparingTo("3");
        }
        api.delete("/alunos/" + outro.id() + "/regras-de-atencao/" + nota, treinador, 204);
        for (JsonNode f : api.get("/atualizacoes/" + comFato, treinador, 200).path("atencao")) {
            if (f.path("tipo").asString().equals("NOTA_ABAIXO")) assertThat(f.path("limiteVigente").decimalValue()).isEqualByComparingTo("3");
        }

        // Trocar o número com a versão certa; nada mudou = sem auditoria nova.
        definir(treinador, com.id(), nota, corpo(true, 2, versaoDaNota), 200);
        long antes = auditoria("REGRA_ATENCAO_EXCECAO_DEFINIDA");
        JsonNode igual = api.get("/alunos/" + com.id() + "/regras-de-atencao", treinador, 200);
        definir(treinador, com.id(), nota, corpo(true, 2, daRegra(igual, nota).path("excecao").path("versao").asLong()), 200);
        assertThat(auditoria("REGRA_ATENCAO_EXCECAO_DEFINIDA")).isEqualTo(antes);

        // Voltar à regra geral: idempotente, auditado uma vez.
        api.delete("/alunos/" + com.id() + "/regras-de-atencao/" + sim, treinador, 204);
        api.delete("/alunos/" + com.id() + "/regras-de-atencao/" + sim, treinador, 204);
        assertThat(auditoria("REGRA_ATENCAO_EXCECAO_REMOVIDA")).isEqualTo(2);
        assertThat(daRegra(api.get("/alunos/" + com.id() + "/regras-de-atencao", treinador, 200), sim).path("excecao").isNull()).isTrue();

        // Regra desligada na consultoria some da ficha; apagada no lote, leva as exceções (cascade).
        JsonNode regras = api.get("/regras-de-atencao", treinador, 200);
        Map<String, Object> soSim = regra("SIM", "dor", null);
        soSim.put("id", sim);
        api.put("/regras-de-atencao", treinador, Map.of("versao", regras.path("versao").asLong(), "regras", List.of(soSim)), 200);
        assertThat(excecoesNoBanco(com.id())).isZero();
        assertThat(api.get("/alunos/" + com.id() + "/regras-de-atencao", treinador, 200).path("regras")).hasSize(1);
    }

    @Test
    void validacoesVersaoPermissoesEIsolamento() throws Exception {
        AlunoDeTeste a = aluno("Aluno Fictício Validação");
        record Caso(String regraId, Map<String, Object> corpo, String campo) { }
        for (Caso c : List.of(
                new Caso(sim, corpo(true, null, null), "ativa"),            // Sim não tem número: a exceção só desliga
                new Caso(nota, corpo(true, null, null), "limite"),
                new Caso(nota, corpo(true, 9, null), "limite"),             // fora da escala 1 a 8 da pergunta
                new Caso(nota, corpo(true, 2.5, null), "limite"))) {
            JsonNode erro = definir(treinador, a.id(), c.regraId(), c.corpo(), 422);
            assertThat(erro.path("codigo").asString()).isEqualTo("REGRA_INVALIDA");
            assertThat(erro.path("fieldErrors").get(0).path("field").asString()).isEqualTo(c.campo());
            assertThat(erro.toString()).doesNotContain("2.5");
        }
        assertThat(excecoesNoBanco(a.id())).isZero();

        // Versão: criar sem ela; com exceção gravada, sem versão ou com a velha dá 409.
        definir(treinador, a.id(), nota, corpo(true, 2, 7), 409);
        JsonNode criada = definir(treinador, a.id(), nota, corpo(true, 2, null), 200);
        long v = daRegra(criada, nota).path("excecao").path("versao").asLong();
        definir(treinador, a.id(), nota, corpo(false, null, null), 409);
        definir(treinador, a.id(), nota, corpo(false, null, v + 1), 409);
        definir(treinador, a.id(), nota, corpo(false, null, v), 200);

        // Outra consultoria: aluno e regra dão 404 e nada muda.
        JsonNode outro = api.novoTreinador();
        api.get("/alunos/" + a.id() + "/regras-de-atencao", outro, 404);
        definir(outro, a.id(), sim, corpo(false, null, null), 404);
        api.delete("/alunos/" + a.id() + "/regras-de-atencao/" + nota, outro, 404);
        UUID alunoDela = api.criarAluno(outro, "Aluno Fictício Outra Consultoria");
        definir(outro, alunoDela, sim, corpo(false, null, null), 404);
        definir(treinador, a.id(), UUID.randomUUID().toString(), corpo(false, null, null), 404);
        assertThat(excecoesNoBanco(a.id())).isEqualTo(1);

        // Permissões: o aluno nunca; ler com ATUALIZACAO_LER + ALUNO_SENSIVEL_LER; gravar também com REGRA_ATENCAO_ALTERAR + ALUNO_ALTERAR.
        api.get("/alunos/" + a.id() + "/regras-de-atencao", a.login(), 403);
        UUID usuario = UUID.fromString(treinador.path("usuario").path("id").asString());
        banco.update("update usuario set perfil_id = ? where id = ?", criarPerfil(List.of("ALUNO_LER", "ALUNO_SENSIVEL_LER", "ATUALIZACAO_LER")), usuario);
        api.get("/alunos/" + a.id() + "/regras-de-atencao", treinador, 200);
        definir(treinador, a.id(), sim, corpo(false, null, null), 403);
        banco.update("update usuario set perfil_id = ? where id = ?",
                criarPerfil(List.of("ALUNO_LER", "ALUNO_SENSIVEL_LER", "ATUALIZACAO_LER", "REGRA_ATENCAO_ALTERAR")), usuario);
        definir(treinador, a.id(), sim, corpo(false, null, null), 403);
        api.delete("/alunos/" + a.id() + "/regras-de-atencao/" + nota, treinador, 403);
        banco.update("update usuario set perfil_id = ? where id = ?",
                criarPerfil(List.of("ALUNO_LER", "ALUNO_ALTERAR", "ALUNO_SENSIVEL_LER", "ATUALIZACAO_LER", "REGRA_ATENCAO_ALTERAR")), usuario);
        definir(treinador, a.id(), sim, corpo(false, null, null), 200);
        banco.update("update usuario set perfil_id = ? where id = ?", criarPerfil(List.of("ALUNO_LER", "ATUALIZACAO_LER")), usuario);
        api.get("/alunos/" + a.id() + "/regras-de-atencao", treinador, 403);
    }

    @Test
    void exportacaoDoAlunoLevaAsExcecoesSoDeleComAPermissaoDasAtualizacoes() throws Exception {
        AlunoDeTeste a = aluno("Aluno Fictício Exportação");
        AlunoDeTeste vizinho = aluno("Aluno Fictício Vizinho Exportação");
        definir(treinador, a.id(), sim, corpo(false, null, null), 200);
        definir(treinador, a.id(), nota, corpo(true, 3, null), 200);
        definir(treinador, vizinho.id(), nota, corpo(true, 7, null), 200);

        // As duas exceções saem, só com regraId, ativa e limite (sem texto livre); a do vizinho não.
        JsonNode secao = api.get("/alunos/" + a.id() + "/exportacao", treinador, 200).path("regrasDeAtencao");
        assertThat(secao.path("truncado").asBoolean()).isFalse();
        assertThat(secao.path("itens")).hasSize(2);
        for (JsonNode e : secao.path("itens")) {
            assertThat(e.propertyNames()).containsExactlyInAnyOrder("regraId", "ativa", "limite");
            if (e.path("regraId").asString().equals(sim)) {
                assertThat(e.path("ativa").asBoolean()).isFalse();
                assertThat(e.path("limite").isNull()).isTrue();
            } else {
                assertThat(e.path("regraId").asString()).isEqualTo(nota);
                assertThat(e.path("ativa").asBoolean()).isTrue();
                assertThat(e.path("limite").decimalValue()).isEqualByComparingTo("3");
            }
        }
        assertThat(api.get("/alunos/" + vizinho.id() + "/exportacao", treinador, 200).path("regrasDeAtencao").path("itens")).hasSize(1);

        // Outra consultoria não exporta o aluno (404) e a exportação dela não leva exceção alheia.
        JsonNode outro = api.novoTreinador();
        api.get("/alunos/" + a.id() + "/exportacao", outro, 404);
        UUID alunoDela = api.criarAluno(outro, "Aluno Fictício Outra Consultoria Exportação");
        assertThat(api.get("/alunos/" + alunoDela + "/exportacao", outro, 200).path("regrasDeAtencao").path("itens")).isEmpty();

        // Sem ATUALIZACAO_LER a seção fica de fora e vem listada como omitida.
        UUID usuario = UUID.fromString(treinador.path("usuario").path("id").asString());
        banco.update("update usuario set perfil_id = ? where id = ?",
                criarPerfil(List.of("ALUNO_LER", "ALUNO_SENSIVEL_LER", "ALUNO_EXPORTAR")), usuario);
        JsonNode sem = api.get("/alunos/" + a.id() + "/exportacao", treinador, 200);
        assertThat(sem.has("regrasDeAtencao")).isFalse();
        assertThat(sem.path("secoesOmitidas").valueStream().map(JsonNode::asString)).contains("regrasDeAtencao");
    }

    @Test
    void anonimizarEExcluirMinhaContaApagamExcecoesEFatos() throws Exception {
        AlunoDeTeste anonimizado = aluno("Aluno Fictício Anonimizar");
        AlunoDeTeste excluiu = aluno("Aluno Fictício Excluir Conta");
        AlunoDeTeste vizinho = aluno("Aluno Fictício Vizinho");
        for (AlunoDeTeste a : List.of(anonimizado, excluiu, vizinho)) definir(treinador, a.id(), nota, corpo(true, 4, null), 200);
        String fatoAnonimizado = enviar(anonimizado, Map.of("humor", 2, "dor", true));
        String fatoExcluiu = enviar(excluiu, Map.of("humor", 2, "dor", true));
        String fatoVizinho = enviar(vizinho, Map.of("humor", 2, "dor", true));
        assertThat(fatosNoBanco(fatoExcluiu)).isEqualTo(2);

        api.patch("/alunos/" + anonimizado.id() + "/situacao", treinador, Map.of("ativo", false), 200);
        api.post("/alunos/" + anonimizado.id() + "/anonimizar", treinador, Map.of("nomeConfirmado", "Aluno Fictício Anonimizar"), 200);
        api.post("/aluno/conta/excluir", excluiu.login(), Map.of("senha", ApiDeTeste.SENHA, "confirmacao", "EXCLUIR"), 204);

        for (AlunoDeTeste a : List.of(anonimizado, excluiu)) assertThat(excecoesNoBanco(a.id())).isZero();
        assertThat(fatosNoBanco(fatoAnonimizado)).isZero();
        assertThat(fatosNoBanco(fatoExcluiu)).isZero();
        // Só os deles: o vizinho fica com a exceção e os fatos.
        assertThat(excecoesNoBanco(vizinho.id())).isEqualTo(1);
        assertThat(fatosNoBanco(fatoVizinho)).isEqualTo(2);
        // Anonimizado não ganha exceção nova.
        assertThat(definir(treinador, anonimizado.id(), nota, corpo(true, 4, null), 409).path("codigo").asString()).isEqualTo("ALUNO_ANONIMIZADO");
    }
}
