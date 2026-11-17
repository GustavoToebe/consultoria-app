package br.com.treinos.api.dieta;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.biblioteca.dto.BibliotecaDtos.AlimentoRequest;
import br.com.treinos.api.dieta.ConteudoDieta.Ergogenico;
import br.com.treinos.api.dieta.ConteudoDieta.Item;
import br.com.treinos.api.dieta.ConteudoDieta.Opcao;
import br.com.treinos.api.dieta.ConteudoDieta.Refeicao;
import br.com.treinos.api.dieta.ConteudoDieta.Variacao;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Dieta por dia da semana (plano {@code dieta-por-dia-da-semana}, passo 2): {@code ConteudoDieta.variacoes} sobrevive a
 * toda cópia e leitura do conteúdo (rascunho de quem não tem ERGOGENICO_ALTERAR, leitura sem ERGOGENICO_LER, publicar,
 * copiar, replicar, modelo, pacote, exportação e anonimização) e o validador recusa o que não fecha a semana, sem repetir
 * o rótulo (texto do treinador) em mensagem nem auditoria. Dados fictícios.
 */
@AutoConfigureMockMvc
class DietaVariacoesIntegrationTest extends AbstractIntegrationTest {

    private static final String ERGOGENICO = "Item ergogênico fictício VR";

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JsonMapper json;
    @Autowired
    private JdbcTemplate jdbc;

    private static String rotulo(String prefixo) {
        return prefixo + "-" + UUID.randomUUID().toString().substring(0, 8);
    }

    private static Item item(UUID alimentoId, String nome) {
        return new Item(UUID.randomUUID(), alimentoId, nome, new BigDecimal("100"), "g", new BigDecimal("100"),
                BigDecimal.ONE, BigDecimal.TEN, BigDecimal.ZERO, alimentoId == null);
    }

    private static Refeicao refeicao(UUID alimentoId, String nomeDoItem) {
        return new Refeicao(UUID.randomUUID(), "Almoço", "12:00", null,
                List.of(new Opcao(UUID.randomUUID(), "A", List.of(item(alimentoId, nomeDoItem)))));
    }

    /** Raiz vazia; A em seg, qua, sex e dom (com o alimento da biblioteca); B em ter, qui e sáb. */
    private static ConteudoDieta duasVariacoes(String rotuloA, String rotuloB, UUID alimentoId, boolean comErgogenico) {
        List<Ergogenico> medicacao = comErgogenico
                ? List.of(new Ergogenico(UUID.randomUUID(), ERGOGENICO, null, null, "1 dose", null, null, null)) : null;
        return new ConteudoDieta("Objetivo fictício", null, null, List.of(), List.of(), null, List.of(), medicacao,
                new BigDecimal("2.5"), List.of(
                new Variacao(UUID.randomUUID(), rotuloA, List.of(1, 3, 5, 7),
                        List.of(refeicao(alimentoId, "Cereal fictício cozido"))),
                new Variacao(UUID.randomUUID(), rotuloB, List.of(2, 4, 6), List.of(refeicao(null, "Item manual")))));
    }

    private static AlimentoRequest alimento(String nome, String fatorCorrecao, String fatorCoccao) {
        return new AlimentoRequest(nome, new BigDecimal("100"), "g", new BigDecimal("100"), BigDecimal.ONE,
                BigDecimal.TEN, BigDecimal.ZERO, null, null, new BigDecimal(fatorCorrecao), new BigDecimal(fatorCoccao),
                null, null, null, null, null, null, null, null);
    }

    private void trocarPerfil(JsonNode login, String nome) {
        jdbc.update("update usuario u set perfil_id = p.id from perfil p where u.id = ?::uuid "
                + "and p.consultoria_id = u.consultoria_id and p.nome = ?", login.path("usuario").path("id").asString(), nome);
    }

    private JsonNode membro(ApiDeTeste api, JsonNode admin, Set<String> permissoes) throws Exception {
        String perfil = api.post("/perfis", admin, Map.of("nome", "Perfil " + UUID.randomUUID(), "permissoes", permissoes), 200)
                .get("id").asString();
        JsonNode convite = api.post("/usuarios/convites", admin,
                Map.of("nome", "Membro fictício", "email", ApiDeTeste.emailUnico("membro"), "perfilId", perfil), 200);
        return api.post("/publico/convites-equipe/aceitar", null,
                Map.of("codigo", convite.get("codigo").asString(), "senha", ApiDeTeste.SENHA), 200);
    }

    private JsonNode salvar(ApiDeTeste api, JsonNode login, String id, ConteudoDieta c, JsonNode detalhe) throws Exception {
        return api.put("/planos-dieta/" + id + "/rascunho", login,
                ApiDeTeste.rascunho("Dieta", c, detalhe.path("plano").path("versao").asLong()), 200);
    }

    private JsonNode publicar(ApiDeTeste api, JsonNode login, String id, JsonNode detalhe, int esperado) throws Exception {
        return api.post("/planos-dieta/" + id + "/publicar", login,
                Map.of("versao", detalhe.path("plano").path("versao").asLong(), "confirmarAvisos", true), esperado);
    }

    private static List<String> uids(JsonNode variacoes) {
        List<String> lista = new ArrayList<>();
        variacoes.forEach(v -> lista.add(v.path("uid").asString()));
        return lista;
    }

    /** Duas variações com os mesmos rótulos e dias e uids diferentes dos da origem (também as refeições). */
    private static void assertLevouAsVariacoesComUidsNovos(JsonNode copia, JsonNode origem, String rotuloA, String rotuloB) {
        assertThat(copia.path("variacoes")).hasSize(2);
        assertThat(copia.path("refeicoes")).isEmpty();
        assertThat(copia.path("variacoes").get(0).path("rotulo").asString()).isEqualTo(rotuloA);
        assertThat(copia.path("variacoes").get(1).path("rotulo").asString()).isEqualTo(rotuloB);
        assertThat(copia.path("variacoes").get(0).path("dias").valueStream().map(JsonNode::asInt)).containsExactly(1, 3, 5, 7);
        assertThat(copia.path("variacoes").get(1).path("dias").valueStream().map(JsonNode::asInt)).containsExactly(2, 4, 6);
        assertThat(uids(copia.path("variacoes"))).doesNotContainAnyElementsOf(uids(origem.path("variacoes")));
        for (int i = 0; i < 2; i++) {
            assertThat(copia.path("variacoes").get(i).path("refeicoes").get(0).path("uid").asString())
                    .isNotEqualTo(origem.path("variacoes").get(i).path("refeicoes").get(0).path("uid").asString());
        }
    }

    @Test
    void salvaPublicaELeDeVoltaComOsMesmosDiasECopiaOsFatoresDentroDasVariacoes() throws Exception {
        ApiDeTeste api = new ApiDeTeste(mvc, json);
        JsonNode treinador = api.novoTreinador();
        UUID aluno = api.criarAluno(treinador, "Aluno Fictício");
        JsonNode alunoLogado = api.convidarEEntrar(treinador, aluno);
        UUID alimento = UUID.fromString(api.post("/alimentos", treinador,
                alimento("Cereal fictício cozido", "1.10", "2.50"), 200).get("id").asString());
        String a = rotulo("Carbo alto");
        String b = rotulo("Carbo zero");

        JsonNode plano = api.post("/alunos/" + aluno + "/planos-dieta", treinador, Map.of("titulo", "Dieta"), 200);
        String id = plano.get("plano").get("id").asString();
        JsonNode salvo = salvar(api, treinador, id, duasVariacoes(a, b, alimento, false), plano);
        assertThat(salvo.get("rascunho").get("variacoes")).hasSize(2);
        assertThat(api.post("/planos-dieta/" + id + "/validar", treinador, null, 200).get("erros")).isEmpty();
        publicar(api, treinador, id, salvo, 200);

        // O aluno lê as duas variações, a raiz vazia e a água global.
        JsonNode lida = api.get("/aluno/dieta", alunoLogado, 200).get("dieta").get("conteudo");
        assertThat(lida.get("refeicoes")).isEmpty();
        assertThat(lida.get("variacoes")).hasSize(2);
        assertThat(lida.get("variacoes").get(0).get("rotulo").asString()).isEqualTo(a);
        assertThat(lida.get("variacoes").get(0).get("dias").valueStream().map(JsonNode::asInt)).containsExactly(1, 3, 5, 7);
        assertThat(lida.get("variacoes").get(1).get("dias").valueStream().map(JsonNode::asInt)).containsExactly(2, 4, 6);
        assertThat(lida.get("aguaLitros").decimalValue()).isEqualByComparingTo("2.5");

        // Fator e grupo vêm do alimento da biblioteca também dentro da variação (e o rascunho não muda).
        JsonNode itemDaVariacao = lida.get("variacoes").get(0).get("refeicoes").get(0).get("opcoes").get(0).get("itens").get(0);
        assertThat(itemDaVariacao.get("fatorCorrecao").decimalValue()).isEqualByComparingTo("1.10");
        assertThat(itemDaVariacao.get("fatorCoccao").decimalValue()).isEqualByComparingTo("2.50");
        JsonNode manual = lida.get("variacoes").get(1).get("refeicoes").get(0).get("opcoes").get(0).get("itens").get(0);
        assertThat(manual.get("fatorCorrecao").isNull()).isTrue();
        JsonNode doRascunho = api.get("/planos-dieta/" + id, treinador, 200).get("rascunho").get("variacoes").get(0)
                .get("refeicoes").get(0).get("opcoes").get(0).get("itens").get(0);
        assertThat(doRascunho.get("fatorCorrecao").isNull()).isTrue();

        // Sem variação, a dieta continua valendo como antes: a raiz tem as refeições e variacoes vem como lista vazia.
        JsonNode simples = api.post("/alunos/" + aluno + "/planos-dieta", treinador, Map.of("titulo", "Simples"), 200);
        assertThat(simples.get("rascunho").get("variacoes")).isEmpty();
    }

    @Test
    void publicarRecusaDiaRepetidoEDescobertoSemRepetirORotuloNaResposta() throws Exception {
        ApiDeTeste api = new ApiDeTeste(mvc, json);
        JsonNode treinador = api.novoTreinador();
        UUID aluno = api.criarAluno(treinador, "Aluno Fictício");
        String a = rotulo("Rotulo-sigiloso-A");
        String b = rotulo("Rotulo-sigiloso-B");
        JsonNode plano = api.post("/alunos/" + aluno + "/planos-dieta", treinador, Map.of("titulo", "Dieta"), 200);
        String id = plano.get("plano").get("id").asString();
        ConteudoDieta ruim = new ConteudoDieta(null, null, null, List.of(), List.of(), null, List.of(), null, null, List.of(
                new Variacao(UUID.randomUUID(), a, List.of(1, 2, 3, 4, 5), List.of(refeicao(null, "Item manual"))),
                new Variacao(UUID.randomUUID(), b, List.of(5, 6), List.of(refeicao(null, "Item manual")))));
        JsonNode salvo = salvar(api, treinador, id, ruim, plano);

        JsonNode erro = publicar(api, treinador, id, salvo, 422);
        assertThat(erro.get("codigo").asString()).isEqualTo("PLANO_INVALIDO");
        assertThat(erro.get("fieldErrors").valueStream().map(e -> e.get("field").asString()))
                .containsExactlyInAnyOrder("variacoes[1].dias", "variacoes");
        assertThat(erro.toString()).doesNotContain(a).doesNotContain(b).contains("domingo");

        // Nada foi publicado e a auditoria nunca guarda o rótulo.
        assertThat(api.get("/planos-dieta/" + id, treinador, 200).get("plano").get("versaoPublicada").asInt()).isZero();
        assertThat(jdbc.queryForObject("select count(*) from auditoria where resumo like ? or acao like ?", Integer.class,
                "%Rotulo-sigiloso%", "%Rotulo-sigiloso%")).isZero();

        // Refeições na raiz junto com variações também não publica.
        ConteudoDieta junto = new ConteudoDieta(null, null, null, List.of(refeicao(null, "Item manual")), List.of(), null,
                List.of(), null, null, List.of(new Variacao(UUID.randomUUID(), a, List.of(1, 2, 3, 4, 5, 6, 7),
                List.of(refeicao(null, "Item manual")))));
        JsonNode salvoJunto = salvar(api, treinador, id, junto, api.get("/planos-dieta/" + id, treinador, 200));
        assertThat(publicar(api, treinador, id, salvoJunto, 422).get("fieldErrors").valueStream()
                .map(e -> e.get("field").asString())).containsExactly("refeicoes");

        // Bean validation do corpo: dia fora de 1 a 7 e mais de 7 variações (400, sem publicar nada).
        ConteudoDieta dia9 = new ConteudoDieta(null, null, null, List.of(), List.of(), null, List.of(), null, null,
                List.of(new Variacao(UUID.randomUUID(), a, List.of(9), List.of(refeicao(null, "Item manual")))));
        api.put("/planos-dieta/" + id + "/rascunho", treinador, ApiDeTeste.rascunho("Dieta", dia9,
                api.get("/planos-dieta/" + id, treinador, 200).get("plano").get("versao").asLong()), 400);
    }

    @Test
    void quemNaoTemErgogenicoAlterarNemLerSalvaPublicaELeSemPerderVariacaoNenhuma() throws Exception {
        ApiDeTeste api = new ApiDeTeste(mvc, json);
        JsonNode login = api.novoTreinador();
        UUID aluno = api.criarAluno(login, "Aluno Fictício");
        JsonNode alunoLogado = api.convidarEEntrar(login, aluno);
        String a = rotulo("Carbo alto");
        String b = rotulo("Carbo zero");
        String novoA = rotulo("Carbo medio");
        JsonNode plano = api.post("/alunos/" + aluno + "/planos-dieta", login, Map.of("titulo", "Dieta"), 200);
        String id = plano.get("plano").get("id").asString();
        JsonNode salvo = salvar(api, login, id, duasVariacoes(a, b, null, true), plano);

        // Sem ERGOGENICO_LER a leitura traz as variações e esconde só a medicação (rascunho e versão publicada).
        trocarPerfil(login, "Nutricionista");
        JsonNode lido = api.get("/planos-dieta/" + id, login, 200);
        assertThat(lido.get("rascunho").get("variacoes")).hasSize(2);
        assertThat(lido.get("rascunho").get("ergogenicos").isNull()).isTrue();
        assertThat(lido.toString()).doesNotContain(ERGOGENICO);

        // Sem ERGOGENICO_ALTERAR, "Salvar" mexe nas variações e não apaga a medicação que ele não vê.
        JsonNode editado = salvar(api, login, id, duasVariacoes(novoA, b, null, false), lido);
        assertThat(editado.get("rascunho").get("variacoes")).hasSize(2);
        assertThat(editado.get("rascunho").get("variacoes").get(0).get("rotulo").asString()).isEqualTo(novoA);
        assertThat(editado.get("rascunho").get("ergogenicos").isNull()).isTrue();

        publicar(api, login, id, editado, 200);
        assertThat(api.get("/planos-dieta/" + id + "/versoes/1", login, 200).get("conteudo").get("variacoes")).hasSize(2);

        // O aluno vê as duas variações e a própria medicação; quem tem a permissão vê tudo igual.
        JsonNode doAluno = api.get("/aluno/dieta", alunoLogado, 200).get("dieta").get("conteudo");
        assertThat(doAluno.get("variacoes")).hasSize(2);
        assertThat(doAluno.get("ergogenicos")).hasSize(1);
        trocarPerfil(login, "Administrador");
        JsonNode completo = api.get("/planos-dieta/" + id, login, 200).get("rascunho");
        assertThat(completo.get("variacoes")).hasSize(2);
        assertThat(completo.get("variacoes").get(0).get("rotulo").asString()).isEqualTo(novoA);
        assertThat(completo.get("ergogenicos")).hasSize(1);
    }

    @Test
    void copiarParaOutroAlunoReplicarOPlanoEAPastaLevamAsVariacoesComUidsNovos() throws Exception {
        ApiDeTeste api = new ApiDeTeste(mvc, json);
        JsonNode login = api.novoTreinador();
        UUID aluno = api.criarAluno(login, "Aluno Fictício");
        UUID outro = api.criarAluno(login, "Outro Aluno Fictício");
        String a = rotulo("Carbo alto");
        String b = rotulo("Carbo zero");
        String pasta = api.post("/alunos/" + aluno + "/pastas", login,
                Map.of("titulo", "Pasta fictícia", "inicio", "2026-11-02", "fim", "2026-11-29"), 200).get("id").asString();
        JsonNode plano = api.post("/alunos/" + aluno + "/planos-dieta", login,
                Map.of("titulo", "Dieta", "pastaId", pasta), 200);
        String id = plano.get("plano").get("id").asString();
        JsonNode salvo = salvar(api, login, id, duasVariacoes(a, b, null, true), plano);
        publicar(api, login, id, salvo, 200);
        JsonNode origem = api.get("/planos-dieta/" + id, login, 200).get("rascunho");

        // Copiar para OUTRO aluno: variações com uids novos, sem a medicação.
        JsonNode resposta = api.post("/planos-dieta/" + id + "/copiar-para-aluno", login,
                Map.of("alunoId", outro, "titulo", "Cópia", "inicio", "2026-11-02", "fim", "2026-11-29"), 200);
        JsonNode paraOutro = api.get("/planos-dieta/" + resposta.get("planoId").asString(), login, 200);
        assertLevouAsVariacoesComUidsNovos(paraOutro.get("rascunho"), origem, a, b);
        assertThat(paraOutro.get("rascunho").get("ergogenicos").isNull()).isTrue();
        assertThat(paraOutro.toString()).doesNotContain(ERGOGENICO);

        // Replicar o plano para o próximo ciclo (a última versão publicada).
        JsonNode replica = api.post("/planos-dieta/" + id + "/replicar", login, Map.of("titulo", "Replica"), 200);
        assertLevouAsVariacoesComUidsNovos(replica.get("rascunho"), origem, a, b);

        // Replicar a pasta inteira.
        JsonNode nova = api.post("/pastas/" + pasta + "/replicar", login,
                Map.of("titulo", "Pasta 2", "inicio", "2026-11-30", "fim", "2026-12-27"), 200);
        JsonNode dietaDaPastaNova = null;
        for (JsonNode p : api.get("/alunos/" + aluno + "/planos-dieta", login, 200)) {
            if (nova.get("id").asString().equals(p.path("pastaId").asString(null))) {
                dietaDaPastaNova = api.get("/planos-dieta/" + p.get("id").asString(), login, 200).get("rascunho");
            }
        }
        assertThat(dietaDaPastaNova).isNotNull();
        assertLevouAsVariacoesComUidsNovos(dietaDaPastaNova, origem, a, b);
    }

    @Test
    void modeloDeDietaEPacoteLevamAsVariacoesSemMedicacaoEComUidsNovos() throws Exception {
        ApiDeTeste api = new ApiDeTeste(mvc, json);
        JsonNode login = api.novoTreinador();
        UUID aluno = api.criarAluno(login, "Aluno Fictício");
        UUID outro = api.criarAluno(login, "Outro Aluno Fictício");
        String a = rotulo("Carbo alto");
        String b = rotulo("Carbo zero");
        String pasta = api.post("/alunos/" + aluno + "/pastas", login,
                Map.of("titulo", "Pasta fictícia", "inicio", "2026-11-02", "fim", "2026-11-29"), 200).get("id").asString();
        JsonNode plano = api.post("/alunos/" + aluno + "/planos-dieta", login,
                Map.of("titulo", "Dieta", "pastaId", pasta), 200);
        String id = plano.get("plano").get("id").asString();
        salvar(api, login, id, duasVariacoes(a, b, null, true), plano);
        JsonNode origem = api.get("/planos-dieta/" + id, login, 200).get("rascunho");

        // Salvar o plano como modelo de dieta: leva as variações, nunca a medicação.
        String modelo = api.post("/planos-dieta/" + id + "/salvar-como-receita", login, Map.of("nome", "Modelo fictício"), 200)
                .get("id").asString();
        JsonNode doModelo = api.get("/receitas/" + modelo, login, 200).get("conteudo");
        assertThat(doModelo.get("variacoes")).hasSize(2);
        assertThat(doModelo.get("ergogenicos").isNull()).isTrue();

        // Dieta nova a partir do modelo (o criar com receitaId) e "Aplicar ao aluno": variações com uids novos.
        JsonNode daReceita = api.post("/alunos/" + outro + "/planos-dieta", login,
                Map.of("titulo", "Do modelo", "receitaId", modelo), 200);
        assertLevouAsVariacoesComUidsNovos(daReceita.get("rascunho"), origem, a, b);
        JsonNode aplicado = api.post("/receitas/" + modelo + "/aplicar", login,
                Map.of("alunoId", outro, "titulo", "Aplicado"), 200);
        JsonNode doAplicado = api.get("/planos-dieta/" + aplicado.get("planoId").asString(), login, 200).get("rascunho");
        assertLevouAsVariacoesComUidsNovos(doAplicado, origem, a, b);

        // Salvar a pasta como pacote (lê o rascunho) e aplicar o pacote em outro aluno.
        String pacote = api.post("/pastas/" + pasta + "/salvar-como-modelo", login, Map.of("nome", "Pacote fictício"), 200)
                .get("id").asString();
        JsonNode dietaDoPacote = api.get("/receitas/" + pacote, login, 200).get("conteudo").get("planos").get(0).get("dieta");
        assertThat(dietaDoPacote.get("variacoes")).hasSize(2);
        assertThat(dietaDoPacote.get("ergogenicos").isNull()).isTrue();
        JsonNode pastaNova = api.post("/receitas/" + pacote + "/aplicar", login,
                Map.of("alunoId", outro, "titulo", "Pacote aplicado", "inicio", "2026-11-02", "fim", "2026-11-29"), 200);
        JsonNode doPacote = null;
        for (JsonNode p : api.get("/alunos/" + outro + "/planos-dieta", login, 200)) {
            if (pastaNova.get("pastaId").asString().equals(p.path("pastaId").asString(null))) {
                doPacote = api.get("/planos-dieta/" + p.get("id").asString(), login, 200).get("rascunho");
            }
        }
        assertThat(doPacote).isNotNull();
        assertLevouAsVariacoesComUidsNovos(doPacote, origem, a, b);

        // O modelo de uma refeição não tem variações: uma refeição só, sem variacoes.
        ConteudoDieta refeicaoComVariacao = new ConteudoDieta(null, null, null, List.of(refeicao(null, "Item manual")),
                List.of(), null, List.of(), null, null, List.of(new Variacao(UUID.randomUUID(), a,
                List.of(1, 2, 3, 4, 5, 6, 7), List.of(refeicao(null, "Item manual")))));
        api.post("/receitas", login, Map.of("tipo", "REFEICAO", "nome", "Refeição fictícia " + a,
                "conteudo", refeicaoComVariacao), 400);
    }

    @Test
    void exportacaoTrazAsVariacoesSemAMedicacaoDeQuemNaoTemPermissaoEAAnonimizacaoApagaORotulo() throws Exception {
        ApiDeTeste api = new ApiDeTeste(mvc, json);
        JsonNode admin = api.novoTreinador();
        UUID aluno = api.criarAluno(admin, "Aluno Fictício");
        String a = rotulo("Rotulo-lgpd-A");
        String b = rotulo("Rotulo-lgpd-B");
        JsonNode plano = api.post("/alunos/" + aluno + "/planos-dieta", admin, Map.of("titulo", "Dieta"), 200);
        String id = plano.get("plano").get("id").asString();
        JsonNode salvo = salvar(api, admin, id, duasVariacoes(a, b, null, true), plano);
        publicar(api, admin, id, salvo, 200);
        // Um rascunho novo depois de publicado: o rótulo também mora no rascunho, além da versão.
        salvar(api, admin, id, duasVariacoes(a, b, null, true), api.get("/planos-dieta/" + id, admin, 200));

        JsonNode completa = api.get("/alunos/" + aluno + "/exportacao", admin, 200)
                .get("dietas").get("itens").get(0).get("versoes").get(0).get("conteudo");
        assertThat(completa.get("variacoes")).hasSize(2);
        assertThat(completa.get("variacoes").get(0).get("rotulo").asString()).isEqualTo(a);
        assertThat(completa.get("ergogenicos")).hasSize(1);

        JsonNode semMedicacao = membro(api, admin, Set.of("ALUNO_LER", "ALUNO_SENSIVEL_LER", "ALUNO_EXPORTAR", "DIETA_LER"));
        JsonNode exportado = api.get("/alunos/" + aluno + "/exportacao", semMedicacao, 200)
                .get("dietas").get("itens").get(0).get("versoes").get(0).get("conteudo");
        assertThat(exportado.get("variacoes")).hasSize(2);
        assertThat(exportado.path("ergogenicos").isMissingNode() || exportado.path("ergogenicos").isNull()).isTrue();

        // Anonimizar apaga a dieta inteira (rascunho e versões), rótulo incluído; a auditoria nunca o guardou.
        api.patch("/alunos/" + aluno + "/situacao", admin, Map.of("ativo", false), 200);
        api.post("/alunos/" + aluno + "/anonimizar", admin, Map.of("nomeConfirmado", "Aluno Fictício"), 200);
        assertThat(jdbc.queryForObject("select count(*) from plano_dieta where aluno_id = ?::uuid", Integer.class,
                aluno.toString())).isZero();
        assertThat(jdbc.queryForObject("select count(*) from plano_dieta_versao where conteudo::text like ?",
                Integer.class, "%Rotulo-lgpd-%")).isZero();
        assertThat(jdbc.queryForObject("select count(*) from plano_dieta where rascunho::text like ?",
                Integer.class, "%Rotulo-lgpd-%")).isZero();
        assertThat(jdbc.queryForObject("select count(*) from auditoria where resumo like ? or acao like ?", Integer.class,
                "%Rotulo-lgpd-%", "%Rotulo-lgpd-%")).isZero();
    }
}
