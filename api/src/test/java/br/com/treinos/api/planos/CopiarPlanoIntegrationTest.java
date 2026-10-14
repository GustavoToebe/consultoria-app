package br.com.treinos.api.planos;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.dieta.ConteudoDieta;
import br.com.treinos.api.dieta.ConteudoDieta.Ergogenico;
import br.com.treinos.api.dieta.ConteudoDieta.Item;
import br.com.treinos.api.dieta.ConteudoDieta.Opcao;
import br.com.treinos.api.dieta.ConteudoDieta.Refeicao;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

import java.math.BigDecimal;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Copiar um plano (treino, dieta, mobilidade) para outro aluno: sempre rascunho, a partir da última versão publicada
 * (o rascunho, se nunca publicou), numa pasta existente do destino ou numa pasta nova. Ergogênicos nunca vão.
 */
@AutoConfigureMockMvc
class CopiarPlanoIntegrationTest extends AbstractIntegrationTest {

    private static final String ERGOGENICO = "Item de teste ZC";
    private static final String NO_RASCUNHO = "Só no rascunho";

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JsonMapper json;
    @Autowired
    private JdbcTemplate banco;

    private ApiDeTeste api;
    private JsonNode treinador;
    private UUID origem;
    private UUID destino;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        treinador = api.novoTreinador();
        origem = api.criarAluno(treinador, "Aluno Origem Fictício");
        destino = api.criarAluno(treinador, "Aluno Destino Fictício");
    }

    // ---- montagem ----

    private ObjectNode comCampo(Object conteudo, String campo, String valor) {
        ObjectNode no = (ObjectNode) json.valueToTree(conteudo);
        no.put(campo, valor);
        return no;
    }

    /** Cria o plano de treino, salva o conteúdo e publica. Depois muda o rascunho para um objetivo diferente. */
    private String treinoPublicadoComRascunhoNovo() throws Exception {
        String id = api.publicarTreino(treinador, origem, ApiDeTeste.treino().conteudo()).path("plano").path("id").asString();
        JsonNode atual = api.get("/planos-treino/" + id, treinador, 200);
        api.put("/planos-treino/" + id + "/rascunho", treinador, ApiDeTeste.rascunho("Plano de teste",
                comCampo(ApiDeTeste.treino().conteudo(), "objetivo", NO_RASCUNHO), atual.path("plano").path("versao").asLong()), 200);
        return id;
    }

    private static Ergogenico medicacao() {
        return new Ergogenico(UUID.randomUUID(), ERGOGENICO, "Princípio de Teste", "200 mg/ml", "Dose de teste",
                "Horário de teste", "Observação de teste", "Prescrição de teste");
    }

    private static ConteudoDieta dieta(List<Ergogenico> ergogenicos) {
        Item arroz = new Item(UUID.randomUUID(), UUID.randomUUID(), "Arroz branco cozido", new BigDecimal("150"), "g",
                new BigDecimal("191.7"), BigDecimal.ONE, BigDecimal.TEN, BigDecimal.ZERO, false);
        return new ConteudoDieta("Objetivo publicado", null, null, List.of(new Refeicao(UUID.randomUUID(), "Almoço", "12:00", null,
                List.of(new Opcao(UUID.randomUUID(), "A", List.of(arroz))))), List.of(), null, List.of(), ergogenicos);
    }

    /** Dieta com ergogênico só na versão publicada; o rascunho, depois, perde a lista e ganha outro objetivo. */
    private String dietaPublicadaComRascunhoNovo() throws Exception {
        JsonNode plano = api.post("/alunos/" + origem + "/planos-dieta", treinador, Map.of("titulo", "Dieta"), 200);
        String id = plano.path("plano").path("id").asString();
        JsonNode salvo = api.put("/planos-dieta/" + id + "/rascunho", treinador,
                ApiDeTeste.rascunho("Dieta", dieta(List.of(medicacao())), plano.path("plano").path("versao").asLong()), 200);
        JsonNode publicado = api.post("/planos-dieta/" + id + "/publicar", treinador,
                Map.of("versao", salvo.path("plano").path("versao").asLong(), "confirmarAvisos", true), 200);
        api.put("/planos-dieta/" + id + "/rascunho", treinador, ApiDeTeste.rascunho("Dieta",
                comCampo(dieta(List.of()), "objetivo", NO_RASCUNHO), publicado.path("plano").path("versao").asLong()), 200);
        return id;
    }

    private static Map<String, Object> mobilidade(String orientacoes, UUID secao, UUID item) {
        Map<String, Object> i = new LinkedHashMap<>();
        i.put("uid", item);
        i.put("nome", "Lunge");
        i.put("prescricao", "2 x 20s");
        i.put("videoUrl", "https://www.youtube.com/watch?v=tsGPYSQbZx4");
        Map<String, Object> s = new LinkedHashMap<>();
        s.put("uid", secao);
        s.put("titulo", "Alongamentos");
        s.put("itens", List.of(i));
        return Map.of("orientacoes", orientacoes, "secoes", List.of(s));
    }

    private String mobilidadePublicadaComRascunhoNovo() throws Exception {
        JsonNode plano = api.post("/alunos/" + origem + "/planos-mobilidade", treinador, Map.of("titulo", "Mobilidade"), 200);
        String id = plano.path("plano").path("id").asString();
        JsonNode salvo = api.put("/planos-mobilidade/" + id + "/rascunho", treinador, ApiDeTeste.rascunho("Mobilidade",
                mobilidade("Orientação publicada", UUID.randomUUID(), UUID.randomUUID()), plano.path("plano").path("versao").asLong()), 200);
        JsonNode publicado = api.post("/planos-mobilidade/" + id + "/publicar", treinador,
                Map.of("versao", salvo.path("plano").path("versao").asLong(), "confirmarAvisos", true), 200);
        api.put("/planos-mobilidade/" + id + "/rascunho", treinador, ApiDeTeste.rascunho("Mobilidade",
                mobilidade(NO_RASCUNHO, UUID.randomUUID(), UUID.randomUUID()), publicado.path("plano").path("versao").asLong()), 200);
        return id;
    }

    private Map<String, Object> pedido(UUID aluno, String pastaId) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("alunoId", aluno);
        m.put("titulo", "Cópia fictícia");
        if (pastaId != null) m.put("pastaId", pastaId);
        else {
            m.put("inicio", "2026-11-02");
            m.put("fim", "2026-11-29");
        }
        return m;
    }

    private String pastaDoDestino() throws Exception {
        return api.post("/alunos/" + destino + "/pastas", treinador,
                Map.of("titulo", "Pasta do destino", "inicio", "2026-10-01", "fim", "2026-10-28"), 200).path("id").asString();
    }

    /** Passa o treinador para o perfil Assistente (sem acesso total) com exatamente estas permissões. */
    private void comPermissoes(String... codigos) {
        String usuario = treinador.path("usuario").path("id").asString();
        banco.update("update usuario u set perfil_id = p.id from perfil p where u.id = ?::uuid "
                + "and p.consultoria_id = u.consultoria_id and p.nome = 'Assistente'", usuario);
        banco.update("delete from perfil_permissao where perfil_id = (select perfil_id from usuario where id = ?::uuid)", usuario);
        for (String codigo : codigos) {
            banco.update("insert into perfil_permissao(perfil_id, codigo) select perfil_id, ? from usuario where id = ?::uuid",
                    codigo, usuario);
        }
    }

    private int contar(String acao) {
        return banco.queryForObject("select count(*) from auditoria where acao = ? and consultoria_id = "
                + "(select consultoria_id from usuario where id = ?::uuid)", Integer.class, acao,
                treinador.path("usuario").path("id").asString());
    }

    private static Set<String> uids(JsonNode no) {
        Set<String> achados = new HashSet<>();
        if (no.isObject()) {
            no.properties().forEach(e -> {
                if (e.getKey().equals("uid") && e.getValue().isString()) achados.add(e.getValue().asString());
                achados.addAll(uids(e.getValue()));
            });
        } else if (no.isArray()) {
            no.forEach(f -> achados.addAll(uids(f)));
        }
        return achados;
    }

    // ---- treino ----

    @Test
    void treinoVaiParaPastaNovaComAUltimaVersaoPublicadaEUidsNovos() throws Exception {
        String id = treinoPublicadoComRascunhoNovo();
        JsonNode antes = api.get("/planos-treino/" + id, treinador, 200);
        JsonNode versaoPublicada = api.get("/planos-treino/" + id + "/versoes/1", treinador, 200);

        JsonNode resposta = api.post("/planos-treino/" + id + "/copiar-para-aluno", treinador, pedido(destino, null), 200);

        String pastaId = resposta.path("pastaId").asString();
        JsonNode copia = api.get("/planos-treino/" + resposta.path("planoId").asString(), treinador, 200);
        assertThat(copia.path("plano").path("alunoId").asString()).isEqualTo(destino.toString());
        assertThat(copia.path("plano").path("pastaId").asString()).isEqualTo(pastaId);
        assertThat(copia.path("plano").path("titulo").asString()).isEqualTo("Cópia fictícia");
        assertThat(copia.path("plano").path("inicio").asString()).isEqualTo("2026-11-02");
        assertThat(copia.path("plano").path("fim").asString()).isEqualTo("2026-11-29");
        // Rascunho no destino: nada publicado, nada vigente.
        assertThat(copia.path("plano").path("versaoPublicada").asInt()).isZero();
        assertThat(copia.path("plano").path("ativo").asBoolean()).isFalse();
        // O conteúdo é o da versão publicada, não o do rascunho da origem.
        assertThat(copia.path("rascunho").path("objetivo").asString()).isEqualTo("Objetivo fictício");
        assertThat(copia.toString()).doesNotContain(NO_RASCUNHO);
        // Uids novos em tudo.
        Set<String> daOrigem = uids(versaoPublicada.path("conteudo"));
        assertThat(uids(copia.path("rascunho"))).isNotEmpty().doesNotContainAnyElementsOf(daOrigem);
        // A pasta é do destino e a origem fica como estava.
        assertThat(api.get("/alunos/" + destino + "/pastas", treinador, 200).valueStream()
                .map(p -> p.path("id").asString())).contains(pastaId);
        assertThat(api.get("/planos-treino/" + id, treinador, 200)).isEqualTo(antes);
        assertThat(contar("TREINO_COPIADO")).isEqualTo(1);
        assertThat(contar("PLANO_COPIADO")).isZero();
    }

    @Test
    void origemNuncaPublicadaCopiaORascunho() throws Exception {
        JsonNode plano = api.post("/alunos/" + origem + "/planos-treino", treinador, Map.of("titulo", "Rascunho"), 200);
        String id = plano.path("plano").path("id").asString();
        api.put("/planos-treino/" + id + "/rascunho", treinador, ApiDeTeste.rascunho("Rascunho",
                comCampo(ApiDeTeste.treino().conteudo(), "objetivo", NO_RASCUNHO), plano.path("plano").path("versao").asLong()), 200);

        JsonNode resposta = api.post("/planos-treino/" + id + "/copiar-para-aluno", treinador, pedido(destino, null), 200);

        JsonNode copia = api.get("/planos-treino/" + resposta.path("planoId").asString(), treinador, 200);
        assertThat(copia.path("rascunho").path("objetivo").asString()).isEqualTo(NO_RASCUNHO);
        assertThat(copia.path("plano").path("versaoPublicada").asInt()).isZero();
    }

    @Test
    void pastaExistenteDoDestinoRecebeACopiaComOPeriodoDela() throws Exception {
        String id = treinoPublicadoComRascunhoNovo();
        String pasta = pastaDoDestino();
        int pastasAntes = api.get("/alunos/" + destino + "/pastas", treinador, 200).size();

        JsonNode resposta = api.post("/planos-treino/" + id + "/copiar-para-aluno", treinador, pedido(destino, pasta), 200);

        assertThat(resposta.path("pastaId").asString()).isEqualTo(pasta);
        JsonNode copia = api.get("/planos-treino/" + resposta.path("planoId").asString(), treinador, 200);
        assertThat(copia.path("plano").path("pastaId").asString()).isEqualTo(pasta);
        assertThat(copia.path("plano").path("inicio").asString()).isEqualTo("2026-10-01");
        assertThat(copia.path("plano").path("fim").asString()).isEqualTo("2026-10-28");
        assertThat(api.get("/alunos/" + destino + "/pastas", treinador, 200)).hasSize(pastasAntes);
    }

    // ---- dieta ----

    @Test
    void dietaCopiaAVersaoPublicadaSemOsErgogenicos() throws Exception {
        String id = dietaPublicadaComRascunhoNovo();
        // A versão publicada tem o ergogênico; o rascunho já não tem (e tem outro objetivo).
        assertThat(api.get("/planos-dieta/" + id + "/versoes/1", treinador, 200).path("conteudo").path("ergogenicos")).hasSize(1);

        JsonNode resposta = api.post("/planos-dieta/" + id + "/copiar-para-aluno", treinador, pedido(destino, null), 200);

        JsonNode copia = api.get("/planos-dieta/" + resposta.path("planoId").asString(), treinador, 200);
        assertThat(copia.path("rascunho").path("objetivo").asString()).isEqualTo("Objetivo publicado");
        assertThat(copia.path("rascunho").path("ergogenicos").isNull() || copia.path("rascunho").path("ergogenicos").isEmpty())
                .isTrue();
        assertThat(copia.toString()).doesNotContain(ERGOGENICO);
        assertThat(copia.path("plano").path("versaoPublicada").asInt()).isZero();
        assertThat(contar("DIETA_COPIADA")).isEqualTo(1);
        // O nome do item nunca vai para a auditoria.
        assertThat(banco.queryForObject("select count(*) from auditoria where resumo ilike ?", Integer.class, "%" + ERGOGENICO + "%"))
                .isZero();
    }

    // ---- mobilidade ----

    @Test
    void mobilidadeCopiaAVersaoPublicadaComUidsNovos() throws Exception {
        String id = mobilidadePublicadaComRascunhoNovo();
        JsonNode versaoPublicada = api.get("/planos-mobilidade/" + id + "/versoes/1", treinador, 200);

        JsonNode resposta = api.post("/planos-mobilidade/" + id + "/copiar-para-aluno", treinador, pedido(destino, null), 200);

        JsonNode copia = api.get("/planos-mobilidade/" + resposta.path("planoId").asString(), treinador, 200);
        assertThat(copia.path("plano").path("alunoId").asString()).isEqualTo(destino.toString());
        assertThat(copia.path("rascunho").path("orientacoes").asString()).isEqualTo("Orientação publicada");
        assertThat(copia.path("rascunho").path("secoes").get(0).path("itens").get(0).path("videoUrl").asString())
                .isEqualTo("https://www.youtube.com/watch?v=tsGPYSQbZx4");
        assertThat(uids(copia.path("rascunho"))).hasSize(2).doesNotContainAnyElementsOf(uids(versaoPublicada.path("conteudo")));
        assertThat(copia.path("plano").path("versaoPublicada").asInt()).isZero();
        assertThat(contar("MOBILIDADE_COPIADA")).isEqualTo(1);
    }

    // ---- recusas ----

    @Test
    void mesmoAlunoEAlunoAnonimizadoSaoRecusados() throws Exception {
        String id = treinoPublicadoComRascunhoNovo();
        api.post("/planos-treino/" + id + "/copiar-para-aluno", treinador, pedido(origem, null), 400);

        banco.update("update aluno set anonimizado_em = now() where id = ?", destino);
        JsonNode recusa = api.post("/planos-treino/" + id + "/copiar-para-aluno", treinador, pedido(destino, null), 409);
        assertThat(recusa.path("codigo").asString()).isEqualTo("ALUNO_ANONIMIZADO");
        // Recusado antes de qualquer efeito: nem pasta nem plano nasceram no destino.
        assertThat(banco.queryForObject("select count(*) from pasta_plano where aluno_id = ?", Integer.class, destino)).isZero();
        assertThat(contar("TREINO_COPIADO")).isZero();
    }

    @Test
    void origemArquivadaOuInexistenteEPastaDeOutroAlunoDao404SemCriarPasta() throws Exception {
        String id = treinoPublicadoComRascunhoNovo();
        api.post("/planos-treino/" + UUID.randomUUID() + "/copiar-para-aluno", treinador, pedido(destino, null), 404);
        api.post("/planos-treino/" + id + "/copiar-para-aluno", treinador, pedido(UUID.randomUUID(), null), 404);
        // Pasta que é de outro aluno (a da própria origem) não serve de destino.
        String pastaDaOrigem = api.post("/alunos/" + origem + "/pastas", treinador,
                Map.of("titulo", "Pasta da origem", "inicio", "2026-10-01", "fim", "2026-10-28"), 200).path("id").asString();
        api.post("/planos-treino/" + id + "/copiar-para-aluno", treinador, pedido(destino, pastaDaOrigem), 404);
        api.delete("/planos-treino/" + id, treinador, 204);
        api.post("/planos-treino/" + id + "/copiar-para-aluno", treinador, pedido(destino, null), 404);
        assertThat(banco.queryForObject("select count(*) from pasta_plano where aluno_id = ?", Integer.class, destino)).isZero();
    }

    @Test
    void outraConsultoriaDa404NaOrigemENoDestino() throws Exception {
        String meu = treinoPublicadoComRascunhoNovo();
        JsonNode outro = api.novoTreinador();
        UUID alunoDeles = api.criarAluno(outro, "Aluno Fictício Alheio");
        String planoDeles = api.publicarTreino(outro, alunoDeles, ApiDeTeste.treino().conteudo()).path("plano").path("id").asString();

        // Plano deles, aluno meu.
        api.post("/planos-treino/" + planoDeles + "/copiar-para-aluno", treinador, pedido(destino, null), 404);
        // Plano meu, aluno deles.
        api.post("/planos-treino/" + meu + "/copiar-para-aluno", treinador, pedido(alunoDeles, null), 404);
        // Pasta deles, aluno deles, plano meu.
        String pastaDeles = api.post("/alunos/" + alunoDeles + "/pastas", outro,
                Map.of("titulo", "Pasta alheia", "inicio", "2026-10-01", "fim", "2026-10-28"), 200).path("id").asString();
        api.post("/planos-treino/" + meu + "/copiar-para-aluno", treinador, pedido(alunoDeles, pastaDeles), 404);
        assertThat(api.get("/alunos/" + alunoDeles + "/planos-treino", outro, 200)).hasSize(1);
    }

    @Test
    void copiarPeloCriarSoValeDentroDoMesmoAluno() throws Exception {
        String id = treinoPublicadoComRascunhoNovo();
        // Para outro aluno, só a rota de copiar (auditada, com as permissões dela).
        api.post("/alunos/" + destino + "/planos-treino", treinador,
                Map.of("titulo", "Cópia", "copiarDoPlanoId", id), 404);
        // No mesmo aluno segue valendo.
        api.post("/alunos/" + origem + "/planos-treino", treinador, Map.of("titulo", "Cópia", "copiarDoPlanoId", id), 200);
    }

    @Test
    void semAsPermissoesDaRotaE403() throws Exception {
        String id = treinoPublicadoComRascunhoNovo();
        String dieta = dietaPublicadaComRascunhoNovo();

        // Alterar o tipo e criar pasta não bastam: sem ler o aluno de destino, a rota recusa.
        comPermissoes("TREINO_LER", "TREINO_ALTERAR", "DIETA_LER", "DIETA_ALTERAR", "PASTA_ALTERAR");
        api.post("/planos-treino/" + id + "/copiar-para-aluno", treinador, pedido(destino, null), 403);
        api.post("/planos-dieta/" + dieta + "/copiar-para-aluno", treinador, pedido(destino, null), 403);
        assertThat(banco.queryForObject("select count(*) from pasta_plano where aluno_id = ?", Integer.class, destino)).isZero();

        comPermissoes("ALUNO_LER", "TREINO_LER", "TREINO_ALTERAR", "DIETA_LER", "DIETA_ALTERAR", "PASTA_ALTERAR");
        api.post("/planos-treino/" + id + "/copiar-para-aluno", treinador, pedido(destino, null), 200);
    }

    @Test
    void semAlterarOTipoE403() throws Exception {
        String id = treinoPublicadoComRascunhoNovo();
        String dieta = dietaPublicadaComRascunhoNovo();

        comPermissoes("ALUNO_LER", "TREINO_LER", "TREINO_ALTERAR", "DIETA_LER", "PASTA_ALTERAR");
        api.post("/planos-dieta/" + dieta + "/copiar-para-aluno", treinador, pedido(destino, null), 403);
        api.post("/planos-treino/" + id + "/copiar-para-aluno", treinador, pedido(destino, null), 200);

        // A mobilidade usa as permissões do treino; a checagem vem antes de procurar o plano.
        comPermissoes("ALUNO_LER", "TREINO_LER", "DIETA_LER", "DIETA_ALTERAR", "PASTA_ALTERAR");
        api.post("/planos-treino/" + id + "/copiar-para-aluno", treinador, pedido(destino, null), 403);
        api.post("/planos-mobilidade/" + UUID.randomUUID() + "/copiar-para-aluno", treinador, pedido(destino, null), 403);
    }

    @Test
    void pastaNovaExigePastaAlterarMasPastaExistenteNao() throws Exception {
        String id = treinoPublicadoComRascunhoNovo();
        String pasta = pastaDoDestino();

        comPermissoes("ALUNO_LER", "TREINO_LER", "TREINO_ALTERAR");
        api.post("/planos-treino/" + id + "/copiar-para-aluno", treinador, pedido(destino, null), 403);
        assertThat(banco.queryForObject("select count(*) from pasta_plano where aluno_id = ? and titulo = ?", Integer.class,
                destino, "Cópia fictícia")).isZero();
        api.post("/planos-treino/" + id + "/copiar-para-aluno", treinador, pedido(destino, pasta), 200);
    }
}
