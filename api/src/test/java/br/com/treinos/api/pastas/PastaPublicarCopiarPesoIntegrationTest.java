package br.com.treinos.api.pastas;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.dieta.ConteudoDieta;
import br.com.treinos.api.dieta.ConteudoDieta.Ergogenico;
import br.com.treinos.api.dieta.ConteudoDieta.Item;
import br.com.treinos.api.dieta.ConteudoDieta.Opcao;
import br.com.treinos.api.dieta.ConteudoDieta.Refeicao;
import br.com.treinos.api.web.Fuso;
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
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pasta: publicar tudo ({@code POST /pastas/{id}/publicar}), copiar para outro aluno
 * ({@code POST /pastas/{id}/copiar-para-aluno}) e peso sugerido do finalizar ({@code GET /pastas/{id}/peso-sugerido}).
 * Dados fictícios.
 */
@AutoConfigureMockMvc
class PastaPublicarCopiarPesoIntegrationTest extends AbstractIntegrationTest {

    private static final String ERGOGENICO = "Item de teste ZP";
    private static final String NO_RASCUNHO = "Só no rascunho ZP";

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JsonMapper json;
    @Autowired
    private JdbcTemplate banco;

    private ApiDeTeste api;
    private JsonNode treinador;
    private UUID aluno;
    private UUID destino;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        treinador = api.novoTreinador();
        aluno = api.criarAluno(treinador, "Aluno Origem Fictício");
        destino = api.criarAluno(treinador, "Aluno Destino Fictício");
    }

    // ---- montagem ----

    private String pasta(UUID doAluno, String titulo) throws Exception {
        return api.post("/alunos/" + doAluno + "/pastas", treinador,
                Map.of("titulo", titulo, "inicio", "2026-11-02", "fim", "2026-11-29"), 200).path("id").asString();
    }

    private String pasta() throws Exception {
        return pasta(aluno, "Período fictício");
    }

    private static ConteudoDieta dieta(String... refeicoes) {
        List<Refeicao> lista = new ArrayList<>();
        for (String nome : refeicoes) {
            Item arroz = new Item(UUID.randomUUID(), UUID.randomUUID(), "Arroz branco cozido", new BigDecimal("150"), "g",
                    new BigDecimal("191.7"), BigDecimal.ONE, BigDecimal.TEN, BigDecimal.ZERO, false);
            lista.add(new Refeicao(UUID.randomUUID(), nome, "12:00", null,
                    List.of(new Opcao(UUID.randomUUID(), "A", List.of(arroz)))));
        }
        Ergogenico medicacao = new Ergogenico(UUID.randomUUID(), ERGOGENICO, "Princípio de Teste", "200 mg/ml",
                "Dose de teste", "Horário de teste", "Observação de teste", "Prescrição de teste");
        return new ConteudoDieta("Objetivo publicado", null, null, lista, List.of(), null, List.of(), List.of(medicacao));
    }

    private ObjectNode comObjetivo(Object conteudo, String objetivo) {
        ObjectNode no = (ObjectNode) json.valueToTree(conteudo);
        no.put("objetivo", objetivo);
        return no;
    }

    /** Treino na pasta; {@code valido} grava o conteúdo de teste (senão fica o rascunho vazio, que não publica). */
    private String treino(String pasta, boolean valido) throws Exception {
        JsonNode p = api.post("/alunos/" + aluno + "/planos-treino", treinador, Map.of("titulo", "Treino", "pastaId", pasta), 200);
        if (valido) {
            api.put("/planos-treino/" + p.path("plano").path("id").asString() + "/rascunho", treinador,
                    ApiDeTeste.rascunho("Treino", ApiDeTeste.treino().conteudo(), p.path("plano").path("versao").asLong()), 200);
        }
        return p.path("plano").path("id").asString();
    }

    private String dieta(String pasta, ConteudoDieta conteudo) throws Exception {
        JsonNode p = api.post("/alunos/" + aluno + "/planos-dieta", treinador, Map.of("titulo", "Dieta", "pastaId", pasta), 200);
        String id = p.path("plano").path("id").asString();
        if (conteudo != null) {
            api.put("/planos-dieta/" + id + "/rascunho", treinador,
                    ApiDeTeste.rascunho("Dieta", conteudo, p.path("plano").path("versao").asLong()), 200);
        }
        return id;
    }

    private String mobilidade(String pasta) throws Exception {
        JsonNode p = api.post("/alunos/" + aluno + "/planos-mobilidade", treinador, Map.of("titulo", "Mobilidade", "pastaId", pasta), 200);
        String id = p.path("plano").path("id").asString();
        api.put("/planos-mobilidade/" + id + "/rascunho", treinador,
                ApiDeTeste.rascunho("Mobilidade", ApiDeTeste.mobilidade().conteudo(), p.path("plano").path("versao").asLong()), 200);
        return id;
    }

    private JsonNode publicar(String pasta, boolean confirmarAvisos, int esperado) throws Exception {
        return api.post("/pastas/" + pasta + "/publicar", treinador, Map.of("confirmarAvisos", confirmarAvisos), esperado);
    }

    private int versoesPublicadas(String tabelaDoPlano, String planoId) {
        return banco.queryForObject("select versao_publicada from " + tabelaDoPlano + " where id = ?::uuid", Integer.class, planoId);
    }

    private int auditorias(String acao) {
        return banco.queryForObject("select count(*) from auditoria where acao = ? and consultoria_id = "
                + "(select consultoria_id from usuario where id = ?::uuid)", Integer.class, acao,
                treinador.path("usuario").path("id").asString());
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

    private boolean algumCampoComecaCom(JsonNode erro, String prefixo) {
        return erro.path("fieldErrors").valueStream().anyMatch(f -> f.path("field").asString().startsWith(prefixo));
    }

    // ---- publicar tudo ----

    @Test
    void treinoValidoEDietaInvalidaNaoPublicaNadaEListaOProblemaDaDieta() throws Exception {
        String pasta = pasta();
        String treino = treino(pasta, true);
        String dieta = dieta(pasta, null); // sem refeição: erro

        JsonNode erro = publicar(pasta, true, 422);

        assertThat(erro.path("codigo").asString()).isEqualTo("PLANO_INVALIDO");
        assertThat(algumCampoComecaCom(erro, "dieta.refeicoes")).isTrue();
        assertThat(algumCampoComecaCom(erro, "treino")).isFalse();
        assertThat(versoesPublicadas("plano_treino", treino)).isZero();
        assertThat(versoesPublicadas("plano_dieta", dieta)).isZero();
        assertThat(auditorias("TREINO_PUBLICADO")).isZero();
        assertThat(banco.queryForObject("select count(*) from plano_treino_versao where plano_id = ?::uuid", Integer.class, treino))
                .isZero();
    }

    @Test
    void publicaOsTresTiposComVersaoEAuditoriaPorPlano() throws Exception {
        String pasta = pasta();
        String treino = treino(pasta, true);
        String dieta = dieta(pasta, dieta("Almoço"));
        String mobilidade = mobilidade(pasta);

        JsonNode resposta = publicar(pasta, true, 200);

        assertThat(resposta.path("pulados")).isEmpty();
        assertThat(resposta.path("publicados")).hasSize(3);
        assertThat(resposta.path("publicados").valueStream().map(p -> p.path("tipo").asString()))
                .containsExactlyInAnyOrder("treino", "dieta", "mobilidade");
        assertThat(resposta.path("publicados").valueStream().map(p -> p.path("versao").asInt())).containsOnly(1);
        assertThat(resposta.path("publicados").valueStream().map(p -> p.path("planoId").asString()))
                .containsExactlyInAnyOrder(treino, dieta, mobilidade);
        assertThat(api.get("/planos-treino/" + treino, treinador, 200).path("plano").path("ativo").asBoolean()).isTrue();
        assertThat(api.get("/planos-dieta/" + dieta + "/versoes/1", treinador, 200).path("conteudo").path("ergogenicos"))
                .hasSize(1);
        assertThat(auditorias("TREINO_PUBLICADO")).isEqualTo(1);
        assertThat(auditorias("DIETA_PUBLICADA")).isEqualTo(1);
        assertThat(auditorias("MOBILIDADE_PUBLICADA")).isEqualTo(1);
        // O nome do item nunca vai para a auditoria.
        assertThat(banco.queryForObject("select count(*) from auditoria where resumo ilike ?", Integer.class, "%" + ERGOGENICO + "%"))
                .isZero();
    }

    @Test
    void planoSemRascunhoAlteradoEPuladoSemVersaoNova() throws Exception {
        String pasta = pasta();
        String treino = treino(pasta, true);
        String dieta = dieta(pasta, dieta("Almoço"));
        publicar(pasta, true, 200);

        // Nada mudou: nada a publicar, sem versão nova nem auditoria nova.
        JsonNode nada = publicar(pasta, true, 200);
        assertThat(nada.path("publicados")).isEmpty();
        assertThat(nada.path("pulados")).hasSize(2);
        assertThat(versoesPublicadas("plano_treino", treino)).isEqualTo(1);
        assertThat(versoesPublicadas("plano_dieta", dieta)).isEqualTo(1);
        assertThat(auditorias("TREINO_PUBLICADO")).isEqualTo(1);

        // Só o treino foi alterado: ele ganha a versão 2 e a dieta segue pulada.
        JsonNode atual = api.get("/planos-treino/" + treino, treinador, 200);
        api.put("/planos-treino/" + treino + "/rascunho", treinador, ApiDeTeste.rascunho("Treino",
                comObjetivo(ApiDeTeste.treino().conteudo(), NO_RASCUNHO), atual.path("plano").path("versao").asLong()), 200);
        JsonNode so = publicar(pasta, true, 200);
        assertThat(so.path("publicados")).hasSize(1);
        assertThat(so.path("publicados").get(0).path("tipo").asString()).isEqualTo("treino");
        assertThat(so.path("publicados").get(0).path("versao").asInt()).isEqualTo(2);
        assertThat(so.path("pulados")).hasSize(1);
        assertThat(so.path("pulados").get(0).path("tipo").asString()).isEqualTo("dieta");
        assertThat(versoesPublicadas("plano_dieta", dieta)).isEqualTo(1);

        // Mudar o período da pasta altera o rascunho dos planos: voltam a ser publicáveis.
        api.put("/pastas/" + pasta, treinador, Map.of("titulo", "Período fictício", "inicio", "2026-11-03", "fim", "2026-11-30"), 200);
        assertThat(publicar(pasta, true, 200).path("publicados")).hasSize(2);
    }

    @Test
    void pastaSemNadaAPublicarEPlanoArquivadoNaoEntram() throws Exception {
        String vazia = pasta();
        JsonNode nada = publicar(vazia, true, 200);
        assertThat(nada.path("publicados")).isEmpty();
        assertThat(nada.path("pulados")).isEmpty();

        String pasta = pasta();
        String treino = treino(pasta, true);
        String dieta = dieta(pasta, dieta("Almoço"));
        api.delete("/planos-treino/" + treino, treinador, 204);
        JsonNode resposta = publicar(pasta, true, 200);
        assertThat(resposta.path("publicados")).hasSize(1);
        assertThat(resposta.path("publicados").get(0).path("planoId").asString()).isEqualTo(dieta);
        assertThat(resposta.path("pulados")).isEmpty();
        assertThat(versoesPublicadas("plano_treino", treino)).isZero();
    }

    @Test
    void avisosExigemConfirmacaoENadaEPublicadoSemEla() throws Exception {
        String pasta = pasta();
        String treino = treino(pasta, true);
        String dieta = dieta(pasta, dieta("Almoço", "Almoço")); // nome repetido: só aviso

        JsonNode aviso = publicar(pasta, false, 422);

        assertThat(aviso.path("codigo").asString()).isEqualTo("CONFIRMAR_AVISOS");
        assertThat(algumCampoComecaCom(aviso, "dieta.")).isTrue();
        assertThat(versoesPublicadas("plano_treino", treino)).isZero();
        assertThat(versoesPublicadas("plano_dieta", dieta)).isZero();

        assertThat(publicar(pasta, true, 200).path("publicados")).hasSize(2);
    }

    @Test
    void semPermissaoDePublicarUmTipoPendenteNadaMuda() throws Exception {
        String pasta = pasta();
        String treino = treino(pasta, true);
        String dieta = dieta(pasta, dieta("Almoço"));

        // Os dois nunca foram publicados: ambos os tipos estão pendentes e os dois pedem a permissão.
        comPermissoes("TREINO_LER", "TREINO_PUBLICAR");
        publicar(pasta, true, 403);
        comPermissoes("DIETA_LER", "DIETA_PUBLICAR");
        publicar(pasta, true, 403);
        comPermissoes("ALUNO_LER");
        publicar(pasta, true, 403);
        assertThat(versoesPublicadas("plano_treino", treino)).isZero();
        assertThat(versoesPublicadas("plano_dieta", dieta)).isZero();
        assertThat(auditorias("TREINO_PUBLICADO")).isZero();
        assertThat(auditorias("DIETA_PUBLICADA")).isZero();

        comPermissoes("TREINO_LER", "TREINO_PUBLICAR", "DIETA_LER", "DIETA_PUBLICAR");
        assertThat(publicar(pasta, true, 200).path("publicados")).hasSize(2);
    }

    /** Altera o rascunho do treino já publicado (fica "alterado desde a publicação"). */
    private void alterarTreino(String treino) throws Exception {
        JsonNode atual = api.get("/planos-treino/" + treino, treinador, 200);
        api.put("/planos-treino/" + treino + "/rascunho", treinador, ApiDeTeste.rascunho("Treino",
                comObjetivo(ApiDeTeste.treino().conteudo(), NO_RASCUNHO), atual.path("plano").path("versao").asLong()), 200);
    }

    private void alterarDieta(String dieta) throws Exception {
        JsonNode atual = api.get("/planos-dieta/" + dieta, treinador, 200);
        api.put("/planos-dieta/" + dieta + "/rascunho", treinador, ApiDeTeste.rascunho("Dieta",
                comObjetivo(dieta("Almoço"), NO_RASCUNHO), atual.path("plano").path("versao").asLong()), 200);
    }

    @Test
    void soOTipoAlteradoPedeAPermissaoNutricionistaPublicaADietaEPulaOTreinoIntacto() throws Exception {
        String pasta = pasta();
        String treino = treino(pasta, true);
        String dieta = dieta(pasta, dieta("Almoço"));
        publicar(pasta, true, 200);
        alterarDieta(dieta);
        int treinosPublicados = auditorias("TREINO_PUBLICADO");
        int dietasPublicadas = auditorias("DIETA_PUBLICADA");

        comPermissoes("DIETA_LER", "DIETA_PUBLICAR"); // sem TREINO_PUBLICAR
        JsonNode resposta = publicar(pasta, true, 200);

        assertThat(resposta.path("publicados")).hasSize(1);
        assertThat(resposta.path("publicados").get(0).path("tipo").asString()).isEqualTo("dieta");
        assertThat(resposta.path("publicados").get(0).path("planoId").asString()).isEqualTo(dieta);
        assertThat(resposta.path("publicados").get(0).path("versao").asInt()).isEqualTo(2);
        assertThat(resposta.path("pulados")).hasSize(1);
        assertThat(resposta.path("pulados").get(0).path("tipo").asString()).isEqualTo("treino");
        assertThat(resposta.path("pulados").get(0).path("planoId").asString()).isEqualTo(treino);
        assertThat(versoesPublicadas("plano_dieta", dieta)).isEqualTo(2);
        assertThat(versoesPublicadas("plano_treino", treino)).isEqualTo(1);
        assertThat(auditorias("DIETA_PUBLICADA")).isEqualTo(dietasPublicadas + 1);
        assertThat(auditorias("TREINO_PUBLICADO")).isEqualTo(treinosPublicados);
    }

    @Test
    void nutricionistaRecebe403QuandoOTreinoTambemTemRascunhoAlteradoENadaEPublicado() throws Exception {
        String pasta = pasta();
        String treino = treino(pasta, true);
        String dieta = dieta(pasta, dieta("Almoço"));
        publicar(pasta, true, 200);
        alterarTreino(treino);
        alterarDieta(dieta);
        int treinosPublicados = auditorias("TREINO_PUBLICADO");
        int dietasPublicadas = auditorias("DIETA_PUBLICADA");

        comPermissoes("DIETA_LER", "DIETA_PUBLICAR"); // falta TREINO_PUBLICAR, e o treino está pendente
        publicar(pasta, true, 403);

        assertThat(versoesPublicadas("plano_dieta", dieta)).isEqualTo(1);
        assertThat(versoesPublicadas("plano_treino", treino)).isEqualTo(1);
        assertThat(auditorias("DIETA_PUBLICADA")).isEqualTo(dietasPublicadas);
        assertThat(auditorias("TREINO_PUBLICADO")).isEqualTo(treinosPublicados);

        comPermissoes("TREINO_LER", "TREINO_PUBLICAR", "DIETA_LER", "DIETA_PUBLICAR");
        assertThat(publicar(pasta, true, 200).path("publicados")).hasSize(2);
    }

    @Test
    void pastaIntactaDa200SemPublicarNadaENaoPedePermissaoDeTipoNenhum() throws Exception {
        String pasta = pasta();
        String treino = treino(pasta, true);
        String dieta = dieta(pasta, dieta("Almoço"));
        publicar(pasta, true, 200);
        int treinosPublicados = auditorias("TREINO_PUBLICADO");
        int dietasPublicadas = auditorias("DIETA_PUBLICADA");

        // Só a permissão de dieta, e depois só a de treino: sem pendentes nenhuma permissão de tipo é exigida.
        for (String permissao : List.of("DIETA_PUBLICAR", "TREINO_PUBLICAR")) {
            comPermissoes(permissao);
            JsonNode nada = publicar(pasta, true, 200);
            assertThat(nada.path("publicados")).isEmpty();
            assertThat(nada.path("pulados")).hasSize(2);
            assertThat(nada.path("pulados").valueStream().map(p -> p.path("planoId").asString()))
                    .containsExactlyInAnyOrder(treino, dieta);
        }
        assertThat(versoesPublicadas("plano_treino", treino)).isEqualTo(1);
        assertThat(versoesPublicadas("plano_dieta", dieta)).isEqualTo(1);
        assertThat(banco.queryForObject("select count(*) from plano_treino_versao where plano_id = ?::uuid", Integer.class, treino))
                .isEqualTo(1);
        assertThat(banco.queryForObject("select count(*) from plano_dieta_versao where plano_id = ?::uuid", Integer.class, dieta))
                .isEqualTo(1);
        assertThat(auditorias("TREINO_PUBLICADO")).isEqualTo(treinosPublicados);
        assertThat(auditorias("DIETA_PUBLICADA")).isEqualTo(dietasPublicadas);
    }

    @Test
    void tipoAusenteNaPastaNaoExigeASuaPermissao() throws Exception {
        String pasta = pasta();
        String treino = treino(pasta, true);

        comPermissoes("TREINO_PUBLICAR");
        assertThat(publicar(pasta, true, 200).path("publicados")).hasSize(1);
        assertThat(versoesPublicadas("plano_treino", treino)).isEqualTo(1);
    }

    @Test
    void outraConsultoriaEPastaArquivadaDao404() throws Exception {
        String pasta = pasta();
        String treino = treino(pasta, true);
        JsonNode outro = api.novoTreinador();

        api.post("/pastas/" + pasta + "/publicar", outro, Map.of("confirmarAvisos", true), 404);
        api.post("/pastas/" + UUID.randomUUID() + "/publicar", treinador, Map.of("confirmarAvisos", true), 404);
        assertThat(versoesPublicadas("plano_treino", treino)).isZero();

        api.delete("/pastas/" + pasta, treinador, 204);
        publicar(pasta, true, 404);
    }

    // ---- copiar a pasta ----

    private Map<String, Object> pedido(UUID alunoId) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("alunoId", alunoId);
        m.put("titulo", "Cópia da pasta fictícia");
        m.put("inicio", "2026-12-01");
        m.put("fim", "2026-12-28");
        return m;
    }

    private JsonNode pastaDoDestino(String id) throws Exception {
        return api.get("/alunos/" + destino + "/pastas", treinador, 200).valueStream()
                .filter(p -> p.path("id").asString().equals(id)).findFirst().orElseThrow();
    }

    @Test
    void copiaChegaEmRascunhoSemErgogenicosEQuestionarioComUmaAuditoriaSo() throws Exception {
        String pasta = pasta();
        // Treino publicado com rascunho novo, dieta publicada com ergogênico, mobilidade só em rascunho.
        String treino = treino(pasta, true);
        String dieta = dieta(pasta, dieta("Almoço"));
        publicar(pasta, true, 200);
        JsonNode atual = api.get("/planos-treino/" + treino, treinador, 200);
        api.put("/planos-treino/" + treino + "/rascunho", treinador, ApiDeTeste.rascunho("Treino",
                comObjetivo(ApiDeTeste.treino().conteudo(), NO_RASCUNHO), atual.path("plano").path("versao").asLong()), 200);
        String mobilidade = mobilidade(pasta);
        String questionario = api.get("/questionarios/opcoes", treinador, 200).get(0).path("id").asString();
        api.put("/pastas/" + pasta + "/questionario", treinador, Map.of("questionarioId", questionario), 200);
        int criadas = auditorias("PASTA_CRIADA");
        int treinosCopiados = auditorias("TREINO_COPIADO");

        JsonNode resposta = api.post("/pastas/" + pasta + "/copiar-para-aluno", treinador, pedido(destino), 200);

        String nova = resposta.path("pastaId").asString();
        assertThat(nova).isNotEqualTo(pasta);
        assertThat(resposta.path("planos")).hasSize(3);
        JsonNode destinoPasta = pastaDoDestino(nova);
        assertThat(destinoPasta.path("titulo").asString()).isEqualTo("Cópia da pasta fictícia");
        assertThat(destinoPasta.path("inicio").asString()).isEqualTo("2026-12-01");
        assertThat(destinoPasta.path("fim").asString()).isEqualTo("2026-12-28");
        assertThat(destinoPasta.path("questionarioId").isNull()).isTrue();
        // A origem segue com o questionário e nada mudou nela.
        assertThat(api.get("/alunos/" + aluno + "/pastas", treinador, 200).valueStream()
                .filter(p -> p.path("id").asString().equals(pasta)).findFirst().orElseThrow().path("questionarioId").asString())
                .isEqualTo(questionario);

        for (JsonNode c : resposta.path("planos")) {
            String tipo = c.path("tipo").asString();
            JsonNode copia = api.get("/planos-" + tipo + "/" + c.path("planoId").asString(), treinador, 200);
            assertThat(copia.path("plano").path("alunoId").asString()).isEqualTo(destino.toString());
            assertThat(copia.path("plano").path("pastaId").asString()).isEqualTo(nova);
            assertThat(copia.path("plano").path("versaoPublicada").asInt()).isZero();
            assertThat(copia.path("plano").path("ativo").asBoolean()).isFalse();
            assertThat(copia.path("plano").path("inicio").asString()).isEqualTo("2026-12-01");
            if (tipo.equals("treino")) {
                // Última versão publicada, não o rascunho.
                assertThat(copia.path("rascunho").path("objetivo").asString()).isEqualTo("Objetivo fictício");
                assertThat(copia.toString()).doesNotContain(NO_RASCUNHO);
            }
            if (tipo.equals("dieta")) {
                assertThat(copia.path("rascunho").path("objetivo").asString()).isEqualTo("Objetivo publicado");
                assertThat(copia.toString()).doesNotContain(ERGOGENICO);
            }
        }
        assertThat(api.get("/planos-treino/" + treino, treinador, 200).path("plano").path("versaoPublicada").asInt()).isEqualTo(1);
        assertThat(api.get("/planos-dieta/" + dieta + "/versoes/1", treinador, 200).path("conteudo").path("ergogenicos")).hasSize(1);
        assertThat(api.get("/planos-mobilidade/" + mobilidade, treinador, 200).path("plano").path("pastaId").asString())
                .isEqualTo(pasta);

        // Uma linha por pasta copiada, sem as linhas por plano nem a de pasta criada.
        assertThat(auditorias("PASTA_COPIADA")).isEqualTo(1);
        assertThat(auditorias("PASTA_CRIADA")).isEqualTo(criadas);
        assertThat(auditorias("TREINO_COPIADO")).isEqualTo(treinosCopiados);
        assertThat(auditorias("DIETA_COPIADA")).isZero();
        assertThat(auditorias("MOBILIDADE_COPIADA")).isZero();
        assertThat(banco.queryForObject("select count(*) from auditoria where acao = 'PASTA_COPIADA' and resumo ilike ?",
                Integer.class, "%Cópia da pasta fictícia%")).isZero();
    }

    @Test
    void planoComOTituloDaPastaFicaComOTituloDaPastaNova() throws Exception {
        String pasta = pasta(aluno, "Plano 16");
        api.post("/alunos/" + aluno + "/planos-treino", treinador, Map.of("titulo", "Plano 16", "pastaId", pasta), 200);

        JsonNode resposta = api.post("/pastas/" + pasta + "/copiar-para-aluno", treinador, pedido(destino), 200);

        JsonNode copia = api.get("/planos-treino/" + resposta.path("planos").get(0).path("planoId").asString(), treinador, 200);
        assertThat(copia.path("plano").path("titulo").asString()).isEqualTo("Cópia da pasta fictícia");
    }

    @Test
    void mesmoAlunoDestinoAnonimizadoEDestinoOuOrigemInexistentesSaoRecusados() throws Exception {
        String pasta = pasta();
        treino(pasta, true);
        int pastas = banco.queryForObject("select count(*) from pasta_plano where aluno_id = ?", Integer.class, destino);

        api.post("/pastas/" + pasta + "/copiar-para-aluno", treinador, pedido(aluno), 400);
        api.post("/pastas/" + pasta + "/copiar-para-aluno", treinador, pedido(UUID.randomUUID()), 404);
        api.post("/pastas/" + UUID.randomUUID() + "/copiar-para-aluno", treinador, pedido(destino), 404);
        banco.update("update aluno set anonimizado_em = now() where id = ?", destino);
        JsonNode recusa = api.post("/pastas/" + pasta + "/copiar-para-aluno", treinador, pedido(destino), 409);
        assertThat(recusa.path("codigo").asString()).isEqualTo("ALUNO_ANONIMIZADO");

        assertThat(banco.queryForObject("select count(*) from pasta_plano where aluno_id = ?", Integer.class, destino))
                .isEqualTo(pastas);
        assertThat(auditorias("PASTA_COPIADA")).isZero();
    }

    @Test
    void origemArquivadaEOutraConsultoriaDao404SemCriarNada() throws Exception {
        String pasta = pasta();
        treino(pasta, true);
        JsonNode outro = api.novoTreinador();
        UUID alunoDeles = api.criarAluno(outro, "Aluno Fictício Alheio");
        String pastaDeles = api.post("/alunos/" + alunoDeles + "/pastas", outro,
                Map.of("titulo", "Pasta alheia", "inicio", "2026-11-02", "fim", "2026-11-29"), 200).path("id").asString();

        // Origem minha, destino deles; origem deles, destino meu.
        api.post("/pastas/" + pasta + "/copiar-para-aluno", treinador, pedido(alunoDeles), 404);
        api.post("/pastas/" + pastaDeles + "/copiar-para-aluno", treinador, pedido(destino), 404);
        api.post("/pastas/" + pasta + "/copiar-para-aluno", outro, pedido(alunoDeles), 404);
        api.delete("/pastas/" + pasta, treinador, 204);
        api.post("/pastas/" + pasta + "/copiar-para-aluno", treinador, pedido(destino), 404);

        assertThat(banco.queryForObject("select count(*) from pasta_plano where aluno_id = ?", Integer.class, destino)).isZero();
        assertThat(banco.queryForObject("select count(*) from pasta_plano where aluno_id = ?", Integer.class, alunoDeles)).isEqualTo(1);
    }

    @Test
    void semAsPermissoesDaCopiaE403ENadaEhCriado() throws Exception {
        String pasta = pasta();
        treino(pasta, true);
        dieta(pasta, dieta("Almoço"));

        comPermissoes("ALUNO_LER", "PASTA_ALTERAR", "TREINO_LER", "DIETA_LER", "TREINO_ALTERAR"); // falta DIETA_ALTERAR
        api.post("/pastas/" + pasta + "/copiar-para-aluno", treinador, pedido(destino), 403);
        comPermissoes("ALUNO_LER", "PASTA_ALTERAR", "TREINO_LER", "DIETA_LER", "DIETA_ALTERAR"); // falta TREINO_ALTERAR
        api.post("/pastas/" + pasta + "/copiar-para-aluno", treinador, pedido(destino), 403);
        comPermissoes("PASTA_ALTERAR", "TREINO_ALTERAR", "DIETA_ALTERAR"); // falta ALUNO_LER (rota)
        api.post("/pastas/" + pasta + "/copiar-para-aluno", treinador, pedido(destino), 403);
        comPermissoes("ALUNO_LER", "TREINO_ALTERAR", "DIETA_ALTERAR"); // falta PASTA_ALTERAR (rota)
        api.post("/pastas/" + pasta + "/copiar-para-aluno", treinador, pedido(destino), 403);
        assertThat(banco.queryForObject("select count(*) from pasta_plano where aluno_id = ?", Integer.class, destino)).isZero();
        assertThat(auditorias("PASTA_COPIADA")).isZero();

        comPermissoes("ALUNO_LER", "PASTA_ALTERAR", "TREINO_ALTERAR", "DIETA_ALTERAR");
        api.post("/pastas/" + pasta + "/copiar-para-aluno", treinador, pedido(destino), 200);
    }

    // ---- peso sugerido ----

    /** Pasta que termina hoje, com treino publicado, para o aluno poder enviar a atualização. */
    private String pastaVigenteDe(UUID doAluno) throws Exception {
        String fim = LocalDate.now(Fuso.BRASILIA).toString();
        String pasta = api.post("/alunos/" + doAluno + "/pastas", treinador,
                Map.of("titulo", "Período fictício", "inicio", LocalDate.now(Fuso.BRASILIA).minusDays(27).toString(), "fim", fim), 200)
                .path("id").asString();
        JsonNode criado = api.post("/alunos/" + doAluno + "/planos-treino", treinador,
                Map.of("titulo", "Treino fictício", "pastaId", pasta), 200);
        String id = criado.path("plano").path("id").asString();
        JsonNode salvo = api.put("/planos-treino/" + id + "/rascunho", treinador,
                ApiDeTeste.rascunho("Treino fictício", ApiDeTeste.treino().conteudo(), criado.path("plano").path("versao").asLong()), 200);
        api.post("/planos-treino/" + id + "/publicar", treinador,
                Map.of("versao", salvo.path("plano").path("versao").asLong(), "confirmarAvisos", true), 200);
        return pasta;
    }

    private void enviarAtualizacao(JsonNode loginAluno, Map<String, Object> respostas) throws Exception {
        JsonNode atual = api.get("/aluno/atualizacao", loginAluno, 200);
        api.post("/aluno/atualizacao/enviar", loginAluno, Map.of("pastaId", atual.path("pastaId").asString(),
                "questionarioVersaoId", atual.path("questionarioVersaoId").asString(), "respostas", respostas), 200);
    }

    @Test
    void pesoSugeridoVemDaAtualizacaoEnviadaDaPasta() throws Exception {
        JsonNode loginAluno = api.convidarEEntrar(treinador, aluno);
        String pasta = pastaVigenteDe(aluno);

        // Sem atualização enviada: nulo (um peso lançado à mão no dia não é "da atualização").
        api.post("/alunos/" + aluno + "/pesos", treinador, Map.of("data", LocalDate.now(Fuso.BRASILIA).toString(), "pesoKg", 70.0), 200);
        JsonNode antes = api.get("/pastas/" + pasta + "/peso-sugerido", treinador, 200);
        assertThat(antes.path("pesoKg").isNull()).isTrue();
        assertThat(antes.path("data").isNull()).isTrue();

        // O envio grava o peso na data da atualização (o fim da pasta) e é ele que volta.
        enviarAtualizacao(loginAluno, new LinkedHashMap<>(Map.of("peso", 80.5, "sono", 7, "alim_desempenho", 8, "treino_desempenho", 6)));
        JsonNode depois = api.get("/pastas/" + pasta + "/peso-sugerido", treinador, 200);
        assertThat(depois.path("pesoKg").decimalValue()).isEqualByComparingTo("80.5");
        assertThat(depois.path("data").asString()).isEqualTo(LocalDate.now(Fuso.BRASILIA).toString());
        // Nada de peso em auditoria.
        assertThat(banco.queryForObject("select count(*) from auditoria where resumo ilike '%80%' and consultoria_id = "
                + "(select consultoria_id from usuario where id = ?::uuid)", Integer.class,
                treinador.path("usuario").path("id").asString())).isZero();
    }

    @Test
    void atualizacaoSemRespostaDePesoNaoSugerePeso() throws Exception {
        JsonNode loginAluno = api.convidarEEntrar(treinador, aluno);
        String pasta = pastaVigenteDe(aluno);
        enviarAtualizacao(loginAluno, new LinkedHashMap<>(Map.of("peso", 80.5, "sono", 7, "alim_desempenho", 8, "treino_desempenho", 6)));
        // Resposta sem o peso (como num questionário sem a pergunta): o registro de peso do dia não conta como da atualização.
        banco.update("update atualizacao set respostas = respostas - 'peso' where pasta_id = ?::uuid", pasta);
        assertThat(api.get("/alunos/" + aluno + "/pesos", treinador, 200)).hasSize(1);

        JsonNode peso = api.get("/pastas/" + pasta + "/peso-sugerido", treinador, 200);
        assertThat(peso.path("pesoKg").isNull()).isTrue();
        assertThat(peso.path("data").isNull()).isTrue();
    }

    @Test
    void pesoSugeridoExigeAsDuasPermissoesEOutraConsultoriaDa404() throws Exception {
        JsonNode loginAluno = api.convidarEEntrar(treinador, aluno);
        String pasta = pastaVigenteDe(aluno);
        enviarAtualizacao(loginAluno, new LinkedHashMap<>(Map.of("peso", 80.5, "sono", 7, "alim_desempenho", 8, "treino_desempenho", 6)));

        comPermissoes("ALUNO_LER", "ALUNO_SENSIVEL_LER");
        api.get("/pastas/" + pasta + "/peso-sugerido", treinador, 403);
        comPermissoes("ALUNO_LER", "ATUALIZACAO_LER");
        api.get("/pastas/" + pasta + "/peso-sugerido", treinador, 403);
        comPermissoes("ALUNO_SENSIVEL_LER", "ATUALIZACAO_LER");
        assertThat(api.get("/pastas/" + pasta + "/peso-sugerido", treinador, 200).path("pesoKg").decimalValue())
                .isEqualByComparingTo("80.5");

        JsonNode outro = api.novoTreinador();
        api.get("/pastas/" + pasta + "/peso-sugerido", outro, 404);
        api.get("/pastas/" + UUID.randomUUID() + "/peso-sugerido", treinador, 404);
    }
}
