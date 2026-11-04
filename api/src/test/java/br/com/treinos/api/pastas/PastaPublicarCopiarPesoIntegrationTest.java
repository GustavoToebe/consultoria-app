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
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import com.zaxxer.hikari.HikariDataSource;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

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

    /** "A tela viu o estado de agora": id e versão (lock otimista) de cada plano não arquivado da pasta. */
    private Map<String, Long> versoesDaPasta(String pasta) {
        Map<String, Long> versoes = new LinkedHashMap<>();
        for (String tabela : List.of("plano_treino", "plano_dieta", "plano_mobilidade")) {
            for (Map<String, Object> linha : banco.queryForList(
                    "select id, versao from " + tabela + " where pasta_id = ?::uuid and not arquivado", pasta)) {
                versoes.put(linha.get("id").toString(), ((Number) linha.get("versao")).longValue());
            }
        }
        return versoes;
    }

    /** Publica como a tela: com as versões que ela viu (aqui, as de agora). */
    private JsonNode publicar(String pasta, boolean confirmarAvisos, int esperado) throws Exception {
        return publicarCom(pasta, confirmarAvisos, versoesDaPasta(pasta), esperado);
    }

    private JsonNode publicarCom(String pasta, boolean confirmarAvisos, Map<String, Long> versoes, int esperado)
            throws Exception {
        return api.post("/pastas/" + pasta + "/publicar", treinador,
                Map.of("confirmarAvisos", confirmarAvisos, "versoes", versoes), esperado);
    }

    private int versoesGravadas(String tabelaDasVersoes, String planoId) {
        return banco.queryForObject("select count(*) from " + tabelaDasVersoes + " where plano_id = ?::uuid", Integer.class,
                planoId);
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
        // Sem TREINO_LER, o treino intacto nem aparece em pulados (decisão 3: só os tipos que a pessoa pode ler).
        assertThat(resposta.path("pulados")).isEmpty();
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
        // Sem nenhum *_LER, pulados vem vazio (decisão 3); com os dois *_LER, traz os dois planos intactos.
        for (String permissao : List.of("DIETA_PUBLICAR", "TREINO_PUBLICAR")) {
            comPermissoes(permissao);
            JsonNode nada = publicar(pasta, true, 200);
            assertThat(nada.path("publicados")).isEmpty();
            assertThat(nada.path("pulados")).isEmpty();
        }
        comPermissoes("DIETA_PUBLICAR", "DIETA_LER", "TREINO_LER");
        JsonNode nada = publicar(pasta, true, 200);
        assertThat(nada.path("publicados")).isEmpty();
        assertThat(nada.path("pulados")).hasSize(2);
        assertThat(nada.path("pulados").valueStream().map(p -> p.path("planoId").asString()))
                .containsExactlyInAnyOrder(treino, dieta);
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

        api.post("/pastas/" + pasta + "/publicar", outro, Map.of("confirmarAvisos", true, "versoes", Map.of()), 404);
        api.post("/pastas/" + UUID.randomUUID() + "/publicar", treinador,
                Map.of("confirmarAvisos", true, "versoes", Map.of()), 404);
        assertThat(versoesPublicadas("plano_treino", treino)).isZero();

        api.delete("/pastas/" + pasta, treinador, 204);
        publicar(pasta, true, 404);
    }

    // ---- publicar tudo: versões que a tela viu, tipos duplicados, simultaneidade, pulados ----

    @Test
    void versaoVelhaOuAusenteDa409AntesDeQualquerEfeitoEAntesDoConfirmarAvisos() throws Exception {
        String pasta = pasta();
        String treino = treino(pasta, true);
        String dieta = dieta(pasta, dieta("Almoço", "Almoço")); // só aviso: com confirmarAvisos passaria
        Map<String, Long> vistas = versoesDaPasta(pasta);
        alterarTreino(treino); // outra pessoa salvou o rascunho depois que a tela abriu

        for (boolean confirmar : List.of(true, false)) {
            JsonNode erro = publicarCom(pasta, confirmar, vistas, 409);
            // CONFLITO_EDICAO vem antes do CONFIRMAR_AVISOS: ninguém confirma aviso de versão que não viu.
            assertThat(erro.path("codigo").asString()).isEqualTo("CONFLITO_EDICAO");
        }
        // Plano pendente fora do mapa, mapa vazio e id a mais sem o pendente: também 409.
        Map<String, Long> atuais = versoesDaPasta(pasta);
        Map<String, Long> semADieta = new LinkedHashMap<>(atuais);
        semADieta.remove(dieta);
        publicarCom(pasta, true, semADieta, 409);
        publicarCom(pasta, true, Map.of(), 409);
        publicarCom(pasta, true, Map.of(UUID.randomUUID().toString(), 0L), 409);

        // Nada foi criado: nem publicação, nem versão, nem auditoria.
        assertThat(versoesPublicadas("plano_treino", treino)).isZero();
        assertThat(versoesPublicadas("plano_dieta", dieta)).isZero();
        assertThat(versoesGravadas("plano_treino_versao", treino)).isZero();
        assertThat(versoesGravadas("plano_dieta_versao", dieta)).isZero();
        assertThat(auditorias("TREINO_PUBLICADO")).isZero();
        assertThat(auditorias("DIETA_PUBLICADA")).isZero();

        // Com as versões certas (e um id a mais, que é ignorado) publica.
        Map<String, Long> certas = new LinkedHashMap<>(atuais);
        certas.put(UUID.randomUUID().toString(), 7L);
        assertThat(publicarCom(pasta, true, certas, 200).path("publicados")).hasSize(2);
        assertThat(auditorias("TREINO_PUBLICADO")).isEqualTo(1);
        assertThat(auditorias("DIETA_PUBLICADA")).isEqualTo(1);
    }

    @Test
    void planoQueFicouPendenteDepoisDeATelaAbrirDa409() throws Exception {
        String pasta = pasta();
        String treino = treino(pasta, true);
        String dieta = dieta(pasta, dieta("Almoço"));
        publicar(pasta, true, 200);
        Map<String, Long> vistas = versoesDaPasta(pasta); // tudo publicado e intacto: nada pendente
        alterarTreino(treino); // agora o treino tem rascunho novo que a tela não viu

        publicarCom(pasta, true, vistas, 409); // o mapa tem o treino, mas com a versão de antes de salvar
        assertThat(versoesPublicadas("plano_treino", treino)).isEqualTo(1);
        assertThat(versoesPublicadas("plano_dieta", dieta)).isEqualTo(1);
        assertThat(auditorias("TREINO_PUBLICADO")).isEqualTo(1);

        JsonNode resposta = publicar(pasta, true, 200);
        assertThat(resposta.path("publicados")).hasSize(1);
        assertThat(versoesPublicadas("plano_treino", treino)).isEqualTo(2);
    }

    @Test
    void corpoSemVersoesOuComVersaoNulaE400() throws Exception {
        String pasta = pasta();
        treino(pasta, true);
        api.post("/pastas/" + pasta + "/publicar", treinador, Map.of("confirmarAvisos", true), 400);
        Map<String, Object> nula = new LinkedHashMap<>();
        nula.put(UUID.randomUUID().toString(), null);
        api.post("/pastas/" + pasta + "/publicar", treinador, Map.of("confirmarAvisos", true, "versoes", nula), 400);
    }

    @Test
    void doisPendentesDoMesmoTipoDa409ComCodigoProprioENadaEPublicado() throws Exception {
        String pasta = pasta();
        String treino1 = treino(pasta, true);
        String treino2 = treino(pasta, true);
        String dieta = dieta(pasta, dieta("Almoço"));

        JsonNode erro = publicar(pasta, true, 409);

        assertThat(erro.path("codigo").asString()).isEqualTo("PLANOS_PENDENTES_DUPLICADOS");
        assertThat(erro.path("message").asString()).contains("treino").doesNotContain("dieta");
        assertThat(erro.path("fieldErrors").get(0).path("field").asString()).isEqualTo("treino");
        assertThat(erro.path("fieldErrors").valueStream().map(f -> f.path("message").asString()))
                .containsExactlyInAnyOrder(treino1, treino2);
        assertThat(versoesPublicadas("plano_treino", treino1)).isZero();
        assertThat(versoesPublicadas("plano_treino", treino2)).isZero();
        assertThat(versoesPublicadas("plano_dieta", dieta)).isZero(); // nem o tipo que estava certo
        assertThat(auditorias("TREINO_PUBLICADO")).isZero();
        assertThat(auditorias("DIETA_PUBLICADA")).isZero();

        // Duas dietas também: o erro nomeia os dois tipos, na ordem treino, dieta.
        String dieta2 = dieta(pasta, dieta("Jantar"));
        JsonNode dois = publicar(pasta, true, 409);
        assertThat(dois.path("codigo").asString()).isEqualTo("PLANOS_PENDENTES_DUPLICADOS");
        assertThat(dois.path("message").asString()).contains("treino e de dieta");
        assertThat(dois.path("fieldErrors").valueStream().map(f -> f.path("field").asString()))
                .containsExactly("treino", "treino", "dieta", "dieta");

        // Arquivar um de cada tipo resolve.
        api.delete("/planos-treino/" + treino2, treinador, 204);
        api.delete("/planos-dieta/" + dieta2, treinador, 204);
        assertThat(publicar(pasta, true, 200).path("publicados")).hasSize(2);
    }

    @Test
    void doisDoMesmoTipoSoUmPendenteNaoEhDuplicado() throws Exception {
        String pasta = pasta();
        String publicado = treino(pasta, true);
        publicar(pasta, true, 200);
        String novo = treino(pasta, true); // o outro treino já está publicado e intacto

        JsonNode resposta = publicar(pasta, true, 200);

        assertThat(resposta.path("publicados")).hasSize(1);
        assertThat(resposta.path("publicados").get(0).path("planoId").asString()).isEqualTo(novo);
        assertThat(resposta.path("pulados")).hasSize(1);
        assertThat(resposta.path("pulados").get(0).path("planoId").asString()).isEqualTo(publicado);
    }

    @Test
    void puladosSoTrazOsTiposQueAPessoaPodeLer() throws Exception {
        String pasta = pasta();
        String treino = treino(pasta, true);
        String dieta = dieta(pasta, dieta("Almoço"));
        String mobilidade = mobilidade(pasta);
        publicar(pasta, true, 200);

        // Pode ler treino (e mobilidade, que usa a permissão do treino), mas não a dieta: a dieta nem aparece.
        comPermissoes("TREINO_LER", "TREINO_PUBLICAR");
        JsonNode semDieta = publicar(pasta, true, 200);
        assertThat(semDieta.path("publicados")).isEmpty();
        assertThat(semDieta.path("pulados").valueStream().map(p -> p.path("tipo").asString()))
                .containsExactlyInAnyOrder("treino", "mobilidade");
        assertThat(semDieta.path("pulados").valueStream().map(p -> p.path("planoId").asString()))
                .containsExactlyInAnyOrder(treino, mobilidade);
        assertThat(semDieta.toString()).doesNotContain(dieta);

        // Pode ler só a dieta: nem treino nem mobilidade aparecem.
        comPermissoes("DIETA_LER", "DIETA_PUBLICAR");
        JsonNode soDieta = publicar(pasta, true, 200);
        assertThat(soDieta.path("pulados")).hasSize(1);
        assertThat(soDieta.path("pulados").get(0).path("tipo").asString()).isEqualTo("dieta");
        assertThat(soDieta.path("pulados").get(0).path("planoId").asString()).isEqualTo(dieta);
        assertThat(soDieta.toString()).doesNotContain(treino).doesNotContain(mobilidade);

        // Nenhum *_LER: nenhum tipo aparece.
        comPermissoes("DIETA_PUBLICAR", "TREINO_PUBLICAR");
        assertThat(publicar(pasta, true, 200).path("pulados")).isEmpty();
    }

    /**
     * Duas chamadas ao mesmo tempo: as duas leem o plano como pendente (a tela viu a mesma versão) e só uma publica. Para
     * forçar a sobreposição, uma conexão do teste segura a linha do plano ({@code for update}) por 2 s; ao soltar, a
     * segunda esbarra na versão única ou no lock otimista.
     */
    @Test
    void duasChamadasSimultaneasPublicamUmaVezSoEAOutraDa409NuncaDa500() throws Exception {
        String pasta = pasta();
        String treino = treino(pasta, true);
        String corpo = json.writeValueAsString(Map.of("confirmarAvisos", true, "versoes", versoesDaPasta(pasta)));
        // Duas pessoas da equipe: a mesma pessoa chamando duas vezes se serializa sozinha na leitura do próprio usuário.
        String perfil = null;
        for (JsonNode p : api.get("/perfis", treinador, 200)) {
            if (p.path("nome").asString().equals("Treinador")) perfil = p.path("id").asString();
        }
        JsonNode convite = api.post("/usuarios/convites", treinador, Map.of("nome", "Colega Fictício",
                "email", ApiDeTeste.emailUnico("colega"), "perfilId", perfil), 200);
        JsonNode colega = api.post("/publico/convites-equipe/aceitar", null,
                Map.of("codigo", convite.path("codigo").asString(), "senha", ApiDeTeste.SENHA), 200);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        // Conexão avulsa, fora do pool: o pool dos testes tem só 3 e as duas chamadas já usam duas.
        HikariDataSource hikari = banco.getDataSource().unwrap(HikariDataSource.class);
        try (Connection trava = DriverManager.getConnection(hikari.getJdbcUrl(), hikari.getUsername(), hikari.getPassword())) {
            trava.setAutoCommit(false);
            try (PreparedStatement st = trava.prepareStatement("select 1 from plano_treino where id = ?::uuid for update")) {
                st.setString(1, treino);
                st.execute();
            }
            List<Future<MvcResult>> chamadas = new ArrayList<>();
            for (JsonNode quem : List.of(treinador, colega)) {
                chamadas.add(pool.submit(() -> mvc.perform(MockMvcRequestBuilders.post("/pastas/" + pasta + "/publicar")
                        .header("X-Treinos-Cliente", "nativo").header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(quem))
                        .contentType(MediaType.APPLICATION_JSON).content(corpo)).andReturn()));
            }
            // Tempo para as duas chamadas chegarem ao bloqueio (a FK da versão pede a linha do plano). Se alguma ainda
            // não chegou, o resultado é o mesmo: a segunda esbarra na versão do plano e também dá 409.
            Thread.sleep(2000);
            trava.rollback(); // solta a linha: as duas seguem juntas
            List<Integer> status = new ArrayList<>();
            JsonNode derrotada = null;
            for (Future<MvcResult> f : chamadas) {
                MvcResult r = f.get(30, TimeUnit.SECONDS);
                status.add(r.getResponse().getStatus());
                if (r.getResponse().getStatus() != 200) {
                    derrotada = json.readTree(r.getResponse().getContentAsString(StandardCharsets.UTF_8));
                }
            }
            assertThat(status).containsExactlyInAnyOrder(200, 409);
            assertThat(derrotada).isNotNull();
            assertThat(derrotada.path("codigo").asString()).isEqualTo("CONFLITO_EDICAO");
        } finally {
            pool.shutdownNow();
        }
        // Uma publicação só: uma versão, uma auditoria, o plano na versão 1.
        assertThat(versoesPublicadas("plano_treino", treino)).isEqualTo(1);
        assertThat(versoesGravadas("plano_treino_versao", treino)).isEqualTo(1);
        assertThat(auditorias("TREINO_PUBLICADO")).isEqualTo(1);
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
        assertThat(resposta.path("pulados")).isEmpty(); // com a mobilidade liberada, nada deixou de ser copiado
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
