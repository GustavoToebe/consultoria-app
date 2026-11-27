package br.com.treinos.api.contratos;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.Documentos;
import br.com.treinos.api.inscricoes.CodigoDeInscricao;
import br.com.treinos.api.security.OpaqueTokenGenerator;
import br.com.treinos.api.web.Fuso;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Contrato digital, passo 4 (V109, {@code docs/planos/contrato-digital.md}, S1 a S5 e D28): o responsável assina por um link sem conta
 * (código só na resposta que o cria, CPF conferido antes do texto, uso único, mesmo 404 para todo link que não vale, erro de CPF
 * limitado por código), o par aluno + responsável de 16 a 17 anos, o menor de 16, cancelar e prorrogar do grupo, renovar o link e o PDF
 * próprio pelo link. Só dados fictícios; nada de código, CPF, nome ou texto em log nem na auditoria.
 */
@AutoConfigureMockMvc
class ContratosResponsavelIntegrationTest extends AbstractIntegrationTest {

    private static final LocalDate HOJE = LocalDate.now(Fuso.BRASILIA);
    private static final String FRASE_SIGILOSA = "Cláusula sigilosa do contrato do responsável";
    private static final String TEXTO = FRASE_SIGILOSA + " de {aluno_nome}, CPF {aluno_cpf}, com a {consultoria}.";
    private static final String NOME_DIGITADO = "Marta Responsável Fictícia";

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;

    private ApiDeTeste api;
    private JsonNode admin;
    private UUID consultoria;
    private JsonNode modelo;
    private String nomeDoAluno;
    private UUID aluno;
    private String cpfDoResponsavel;
    private ListAppender<ILoggingEvent> log;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        consultoria = UUID.fromString(jdbc.queryForObject("select consultoria_id::text from usuario where id = ?::uuid", String.class,
                admin.get("usuario").get("id").asString()));
        modelo = api.post("/contratos/modelos", admin, Map.of("nome", "Modelo " + UUID.randomUUID(), "texto", TEXTO), 201);
        nomeDoAluno = "Joana Contratante " + UUID.randomUUID().toString().substring(0, 8);
        cpfDoResponsavel = Documentos.cpf();
        aluno = novoAluno(nomeDoAluno, null);
        definirResponsavel(aluno, "Marta Responsável Cadastrada", cpfDoResponsavel);
        log = new ListAppender<>();
        log.start();
        ((Logger) LoggerFactory.getLogger(Logger.ROOT_LOGGER_NAME)).addAppender(log);
    }

    @AfterEach
    void soltarOLog() {
        ((Logger) LoggerFactory.getLogger(Logger.ROOT_LOGGER_NAME)).detachAppender(log);
    }

    // ---- ajudantes ----

    private UUID novoAluno(String nome, LocalDate nascimento) throws Exception {
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("nome", nome);
        corpo.put("cpf", Documentos.cpf());
        if (nascimento != null) {
            corpo.put("dataNascimento", nascimento.toString());
        }
        return UUID.fromString(api.post("/alunos", admin, corpo, 200).get("id").asString());
    }

    private void definirResponsavel(UUID doAluno, String nome, String cpf) throws Exception {
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("nome", nome);
        corpo.put("parentesco", "Mãe");
        corpo.put("cpf", cpf);
        api.put("/alunos/" + doAluno + "/responsavel-financeiro", admin, corpo, 200);
    }

    private Map<String, Object> pedido(UUID pedidoId, String signatario) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("pedidoId", pedidoId.toString());
        m.put("modeloId", modelo.get("id").asString());
        if (signatario != null) {
            m.put("signatario", signatario);
        }
        return m;
    }

    private JsonNode gerar(UUID doAluno, UUID pedidoId, String signatario, int esperado) throws Exception {
        return api.post("/alunos/" + doAluno + "/contratos", admin, pedido(pedidoId, signatario), esperado);
    }

    private JsonNode gerarParaOResponsavel() throws Exception {
        return gerar(aluno, UUID.randomUUID(), "RESPONSAVEL", 201);
    }

    private static String codigoDe(JsonNode contrato) {
        return contrato.get("link").get("codigo").asString();
    }

    private static Map<String, Object> corpo(String codigo, String cpf) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("codigo", codigo);
        m.put("cpf", cpf);
        return m;
    }

    private static Map<String, Object> corpoDeAssinar(String codigo, String cpf, String sha, String nome, Boolean aceite, Boolean declaro) {
        Map<String, Object> m = corpo(codigo, cpf);
        m.put("sha256", sha);
        m.put("nome", nome);
        m.put("aceite", aceite);
        m.put("declaroResponsavelLegal", declaro);
        return m;
    }

    private JsonNode consultar(String codigo, int esperado) throws Exception {
        return api.post("/publico/contratos/consultar", null, Map.of("codigo", codigo), esperado);
    }

    private JsonNode abrir(String codigo, String cpf, int esperado) throws Exception {
        return api.post("/publico/contratos/abrir", null, corpo(codigo, cpf), esperado);
    }

    private JsonNode assinarPeloLink(String codigo, String cpf, String sha, int esperado) throws Exception {
        return api.post("/publico/contratos/assinar", null, corpoDeAssinar(codigo, cpf, sha, NOME_DIGITADO, true, true), esperado);
    }

    private MvcResult postBruto(String caminho, Object corpo) throws Exception {
        return mvc.perform(post(caminho).contentType(MediaType.APPLICATION_JSON).content(api.paraJson(corpo))).andReturn();
    }

    private MvcResult arquivoPublico(String codigo, String cpf, int esperado) throws Exception {
        MvcResult r = postBruto("/publico/contratos/arquivo", corpo(codigo, cpf));
        assertThat(r.getResponse().getStatus()).isEqualTo(esperado);
        return r;
    }

    private int contar(String sql, Object... args) {
        return jdbc.queryForObject(sql, Integer.class, args);
    }

    private static Set<String> campos(JsonNode erro) {
        Set<String> nomes = new TreeSet<>();
        erro.get("fieldErrors").forEach(f -> nomes.add(f.get("field").asString()));
        return nomes;
    }

    /** Todas as quatro rotas públicas respondem o mesmo 404, com o mesmo corpo, que o de um código que nunca existiu. */
    private void exigirOMesmo404(String codigo) throws Exception {
        JsonNode base = consultar(CodigoDeInscricao.novo(), 404);
        List<JsonNode> respostas = List.of(
                consultar(codigo, 404),
                abrir(codigo, cpfDoResponsavel, 404),
                api.post("/publico/contratos/assinar", null, corpoDeAssinar(codigo, cpfDoResponsavel, "0".repeat(64), NOME_DIGITADO, true, true), 404),
                api.ler(arquivoPublico(codigo, cpfDoResponsavel, 404)));
        for (JsonNode r : respostas) {
            assertThat(r.get("codigo")).isEqualTo(base.get("codigo"));
            assertThat(r.get("message")).isEqualTo(base.get("message"));
        }
    }

    private JsonNode membro(String nome, Set<String> permissoes) throws Exception {
        String perfil = api.post("/perfis", admin, Map.of("nome", "Perfil " + nome + UUID.randomUUID(), "permissoes", permissoes), 200)
                .get("id").asString();
        JsonNode convite = api.post("/usuarios/convites", admin,
                Map.of("nome", nome, "email", ApiDeTeste.emailUnico("membro"), "perfilId", perfil), 200);
        return api.post("/publico/convites-equipe/aceitar", null,
                Map.of("codigo", convite.get("codigo").asString(), "senha", ApiDeTeste.SENHA), 200);
    }

    private static Map<String, Object> assinaturaDoAluno(String sha256, String nome) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("sha256", sha256);
        m.put("nome", nome);
        m.put("aceite", true);
        return m;
    }

    // ---- gerar ----

    @Test
    void gerarParaOResponsavelTemLinkSoNoCriarEOCodigoNuncaVaiAoBanco() throws Exception {
        JsonNode criado = gerarParaOResponsavel();
        String id = criado.get("id").asString();
        String codigo = codigoDe(criado);

        assertThat(criado.get("signatario").asString()).isEqualTo("RESPONSAVEL");
        assertThat(criado.get("situacao").asString()).isEqualTo("PENDENTE");
        assertThat(criado.get("grupoId").isNull()).isTrue();
        assertThat(codigo).hasSize(24).matches("[A-Za-z0-9_-]{24}");
        assertThat(criado.get("link").get("contratoId").asString()).isEqualTo(id);
        // Sem prazo na consultoria, o link vale 30 dias (S5).
        Instant expira = Instant.parse(criado.get("link").get("expiraEm").asString());
        assertThat(expira).isBetween(Instant.now().plus(29, ChronoUnit.DAYS), Instant.now().plus(31, ChronoUnit.DAYS));

        // No banco só o hash do código; o código em si não está em lugar nenhum da linha.
        assertThat(jdbc.queryForObject("select link_hash from contrato_aluno where id = ?::uuid", String.class, id))
                .isEqualTo(OpaqueTokenGenerator.hash(codigo)).isNotEqualTo(codigo);
        assertThat(contar("select count(*) from contrato_aluno where id = ?::uuid and (titulo like ? or coalesce(texto, '') like ?)",
                id, "%" + codigo + "%", "%" + codigo + "%")).isZero();

        // As leituras trazem o link sem o código, só com a validade.
        JsonNode lido = api.get("/contratos/" + id, admin, 200);
        assertThat(lido.get("link").get("codigo").isNull()).isTrue();
        assertThat(lido.get("link").get("expiraEm").asString()).isEqualTo(criado.get("link").get("expiraEm").asString());
        JsonNode resumo = api.get("/alunos/" + aluno + "/contratos", admin, 200).get(0);
        assertThat(resumo.get("signatario").asString()).isEqualTo("RESPONSAVEL");
        assertThat(resumo.get("linkExpiraEm").isNull()).isFalse();

        // O mesmo pedido: 200, o mesmo contrato e o código nulo (o treinador renova), sem gerar nem auditar de novo.
        UUID pedido = UUID.fromString(jdbc.queryForObject("select pedido_id::text from contrato_aluno where id = ?::uuid", String.class, id));
        JsonNode repetido = gerar(aluno, pedido, "RESPONSAVEL", 200);
        assertThat(repetido.get("id").asString()).isEqualTo(id);
        assertThat(repetido.get("link").get("codigo").isNull()).isTrue();
        assertThat(contar("select count(*) from contrato_aluno where aluno_id = ?::uuid", aluno.toString())).isEqualTo(1);
        assertThat(contar("select count(*) from auditoria where acao = 'CONTRATO_GERADO' and entidade_id = ?::uuid", id)).isEqualTo(1);

        // Contrato do aluno não tem link.
        JsonNode doAluno = gerar(aluno, UUID.randomUUID(), null, 201);
        assertThat(doAluno.get("signatario").asString()).isEqualTo("ALUNO");
        assertThat(doAluno.get("link").isNull()).isTrue();
    }

    @Test
    void responsavelSemCpfOuSemCadastroE422ComAFaltaEPrevia() throws Exception {
        UUID semResponsavel = novoAluno("Sem Responsavel " + UUID.randomUUID(), null);
        JsonNode previa = api.post("/alunos/" + semResponsavel + "/contratos/previa", admin, pedido(UUID.randomUUID(), "RESPONSAVEL"), 200);
        assertThat(previa.get("podeGerar").asBoolean()).isFalse();

        JsonNode erro = gerar(semResponsavel, UUID.randomUUID(), "RESPONSAVEL", 422);
        assertThat(erro.get("codigo").asString()).isEqualTo("CONTRATO_INCOMPLETO");
        assertThat(campos(erro)).containsExactlyInAnyOrder("responsavel_nome", "responsavel_cpf");

        UUID semCpf = novoAluno("Sem Cpf Do Responsavel " + UUID.randomUUID(), null);
        definirResponsavel(semCpf, "Responsável Sem Cpf", null);
        JsonNode soCpf = gerar(semCpf, UUID.randomUUID(), "RESPONSAVEL", 422);
        assertThat(soCpf.get("codigo").asString()).isEqualTo("CONTRATO_INCOMPLETO");
        assertThat(campos(soCpf)).containsExactly("responsavel_cpf");
        assertThat(soCpf.get("fieldErrors").get(0).get("message").asString()).isEqualTo("Falta o CPF do responsável.");
        assertThat(contar("select count(*) from contrato_aluno where aluno_id in (?::uuid, ?::uuid)", semResponsavel.toString(),
                semCpf.toString())).isZero();

        // Signatário que não existe: 422 no campo.
        assertThat(campos(gerar(aluno, UUID.randomUUID(), "AVO", 422))).containsExactly("signatario");
    }

    // ---- a página do responsável ----

    @Test
    void consultarAbrirEAssinarSaoFelizesGravamAsEvidenciasENadaVazaEmLogOuAuditoria() throws Exception {
        JsonNode criado = gerarParaOResponsavel();
        String id = criado.get("id").asString();
        String codigo = codigoDe(criado);
        String sha = criado.get("sha256").asString();

        // O link sozinho mostra só a marca e o título: nada do aluno nem do texto (S3).
        JsonNode consulta = consultar(codigo, 200);
        assertThat(consulta.get("titulo").asString()).isEqualTo(criado.get("titulo").asString());
        assertThat(consulta.get("consultoria").get("nome").asString()).isNotBlank();
        assertThat(consulta.toString()).doesNotContain(nomeDoAluno).doesNotContain(FRASE_SIGILOSA);
        assertThat(consulta.has("texto")).isFalse();

        // Com o CPF (formatado ou só os dígitos) vem o texto e o hash.
        JsonNode aberto = abrir(codigo, Documentos.semPontuacao(cpfDoResponsavel), 200);
        assertThat(aberto.get("origem").asString()).isEqualTo("MODELO");
        assertThat(aberto.get("temArquivo").asBoolean()).isFalse();
        assertThat(aberto.get("texto").asString()).contains(FRASE_SIGILOSA).contains(nomeDoAluno);
        assertThat(aberto.get("sha256").asString()).isEqualTo(sha);

        // Assinar: o servidor grava o CPF do cadastro, a declaração e as evidências, sem conta e sem o link.
        MvcResult resposta = mvc.perform(post("/publico/contratos/assinar").header(HttpHeaders.USER_AGENT, "A".repeat(400))
                .contentType(MediaType.APPLICATION_JSON)
                .content(api.paraJson(corpoDeAssinar(codigo, cpfDoResponsavel, sha, "  " + NOME_DIGITADO + "  ", true, true))))
                .andExpect(status().isOk()).andReturn();
        JsonNode assinado = api.ler(resposta);
        assertThat(assinado.get("assinanteNome").asString()).isEqualTo(NOME_DIGITADO);
        assertThat(assinado.get("sha256").asString()).isEqualTo(sha);
        assertThat(assinado.get("texto").asString()).contains(FRASE_SIGILOSA);

        var linha = jdbc.queryForMap("select situacao, assinado_por_usuario_id, assinante_nome, assinante_cpf, assinante_ip,"
                + " length(assinante_agente) as agente, assinante_declarou_responsavel, link_hash, link_expira_em"
                + " from contrato_aluno where id = ?::uuid", id);
        assertThat(linha.get("situacao")).isEqualTo("ASSINADO");
        assertThat(linha.get("assinado_por_usuario_id")).isNull();
        assertThat(linha.get("assinante_nome")).isEqualTo(NOME_DIGITADO);
        assertThat(linha.get("assinante_cpf")).isEqualTo(cpfDoResponsavel);
        assertThat(linha.get("assinante_ip").toString()).isNotBlank();
        assertThat(linha.get("agente")).isEqualTo(300);
        assertThat(linha.get("assinante_declarou_responsavel")).isEqualTo(true);
        assertThat(linha.get("link_hash")).isNull();
        assertThat(linha.get("link_expira_em")).isNull();

        // A equipe vê as evidências e a declaração; o link usado deixa de valer (o mesmo 404).
        JsonNode daEquipe = api.get("/contratos/" + id, admin, 200);
        assertThat(daEquipe.get("assinatura").get("nome").asString()).isEqualTo(NOME_DIGITADO);
        assertThat(daEquipe.get("assinatura").get("declarouResponsavel").asBoolean()).isTrue();
        assertThat(daEquipe.get("link").isNull()).isTrue();
        exigirOMesmo404(codigo);
        assertThat(contar("select count(*) from auditoria where acao = 'CONTRATO_ASSINADO' and entidade_id = ?::uuid", id)).isEqualTo(1);

        // Nada do código, do CPF, do nome nem do texto em log ou na auditoria.
        String logs = log.list.stream().map(ILoggingEvent::getFormattedMessage).collect(Collectors.joining("\n"));
        List<String> resumos = jdbc.queryForList("select resumo from auditoria where entidade_id = ?::uuid", String.class, id);
        for (String segredo : List.of(codigo, cpfDoResponsavel, Documentos.semPontuacao(cpfDoResponsavel), NOME_DIGITADO, FRASE_SIGILOSA, nomeDoAluno)) {
            assertThat(logs).doesNotContain(segredo);
            assertThat(String.join("\n", resumos)).doesNotContain(segredo);
        }
    }

    @Test
    void codigoInexistenteVencidoUsadoOuDeContratoCanceladoDaOMesmo404() throws Exception {
        // Fora do formato e que nunca existiu.
        exigirOMesmo404("curto");
        exigirOMesmo404(CodigoDeInscricao.novo());

        // Vencido.
        JsonNode vencido = gerarParaOResponsavel();
        jdbc.update("update contrato_aluno set link_expira_em = now() - interval '1 hour' where id = ?::uuid", vencido.get("id").asString());
        exigirOMesmo404(codigoDe(vencido));

        // Cancelado.
        JsonNode cancelado = gerarParaOResponsavel();
        api.post("/contratos/" + cancelado.get("id").asString() + "/cancelar", admin,
                Map.of("motivo", "Gerado por engano", "versao", cancelado.get("versao").asLong()), 200);
        exigirOMesmo404(codigoDe(cancelado));

        // Usado: assinou.
        JsonNode usado = gerarParaOResponsavel();
        assinarPeloLink(codigoDe(usado), cpfDoResponsavel, usado.get("sha256").asString(), 200);
        exigirOMesmo404(codigoDe(usado));
    }

    @Test
    void cpfErradoE422EAsTentativasDoCodigoTerminamEm429QueSoUmLinkNovoDesfaz() throws Exception {
        JsonNode criado = gerarParaOResponsavel();
        String id = criado.get("id").asString();
        String codigo = codigoDe(criado);
        String sha = criado.get("sha256").asString();
        String errado = Documentos.cpf();

        // Cinco erros (o padrão por código): 422, nada é mostrado nem gravado.
        for (int i = 0; i < 5; i++) {
            JsonNode erro = (i % 2 == 0) ? abrir(codigo, errado, 422) : assinarPeloLink(codigo, errado, sha, 422);
            assertThat(erro.get("codigo").asString()).isEqualTo("CPF_NAO_CONFERE");
            assertThat(campos(erro)).containsExactly("cpf");
            assertThat(erro.toString()).doesNotContain(FRASE_SIGILOSA).doesNotContain(Documentos.semPontuacao(cpfDoResponsavel));
        }
        // O sexto e o seguinte já são 429 com Retry-After, mesmo com o CPF certo (senão o chute de CPF não se fecharia).
        MvcResult bloqueado = postBruto("/publico/contratos/abrir", corpo(codigo, errado));
        assertThat(bloqueado.getResponse().getStatus()).isEqualTo(429);
        assertThat(bloqueado.getResponse().getHeader("Retry-After")).isNotBlank();
        assertThat(postBruto("/publico/contratos/abrir", corpo(codigo, cpfDoResponsavel)).getResponse().getStatus()).isEqualTo(429);
        assertThat(contar("select count(*) from contrato_aluno where id = ?::uuid and situacao = 'PENDENTE'", id)).isEqualTo(1);

        // O limite é do código: o link renovado tem outro contador e o CPF certo funciona.
        JsonNode novo = api.post("/contratos/" + id + "/link", admin, Map.of(), 200);
        assertThat(abrir(novo.get("codigo").asString(), cpfDoResponsavel, 200).get("sha256").asString()).isEqualTo(sha);
    }

    @Test
    void responsavelRemovidoDepoisDeGerarDaOMesmo404SemContarTentativaDeCpf() throws Exception {
        JsonNode criado = gerarParaOResponsavel();
        String id = criado.get("id").asString();
        String codigo = codigoDe(criado);
        api.delete("/alunos/" + aluno + "/responsavel-financeiro", admin, 204);

        // Sem cadastro para conferir, o link vale como inválido: sempre o 404 (nunca o 429 de tentativas), e nada é gravado.
        for (int i = 0; i < 7; i++) {
            abrir(codigo, cpfDoResponsavel, 404);
        }
        assertThat(contar("select count(*) from contrato_aluno where id = ?::uuid and situacao = 'PENDENTE'", id)).isEqualTo(1);

        // Cadastrado de novo, o mesmo link volta a funcionar: ninguém foi bloqueado no meio.
        definirResponsavel(aluno, "Responsavel Refeito", cpfDoResponsavel);
        assertThat(abrir(codigo, cpfDoResponsavel, 200).get("sha256").asString()).isEqualTo(criado.get("sha256").asString());
    }

    @Test
    void hashTrocadoE409EAceiteDeclaracaoENomeFaltandoSao422SemGravarNada() throws Exception {
        JsonNode criado = gerarParaOResponsavel();
        String id = criado.get("id").asString();
        String codigo = codigoDe(criado);
        String sha = criado.get("sha256").asString();

        assertThat(assinarPeloLink(codigo, cpfDoResponsavel, "0".repeat(64), 409).get("codigo").asString()).isEqualTo("CONTRATO_ALTERADO");

        JsonNode semAceite = api.post("/publico/contratos/assinar", null,
                corpoDeAssinar(codigo, cpfDoResponsavel, sha, NOME_DIGITADO, false, true), 422);
        assertThat(semAceite.get("codigo").asString()).isEqualTo("ASSINATURA_INVALIDA");
        assertThat(campos(semAceite)).containsExactly("aceite");
        assertThat(campos(api.post("/publico/contratos/assinar", null,
                corpoDeAssinar(codigo, cpfDoResponsavel, sha, NOME_DIGITADO, true, null), 422))).containsExactly("declaroResponsavelLegal");
        assertThat(campos(api.post("/publico/contratos/assinar", null,
                corpoDeAssinar(codigo, cpfDoResponsavel, sha, "Marta", true, true), 422))).containsExactly("nome");
        assertThat(campos(api.post("/publico/contratos/assinar", null,
                corpoDeAssinar(codigo, cpfDoResponsavel, sha, "  ", null, false), 422)))
                .containsExactlyInAnyOrder("aceite", "declaroResponsavelLegal", "nome");

        assertThat(contar("select count(*) from contrato_aluno where id = ?::uuid and situacao = 'PENDENTE'", id)).isEqualTo(1);
        // Erro de aceite, declaração ou nome não conta como CPF errado: o link segue aberto.
        assertThat(abrir(codigo, cpfDoResponsavel, 200).get("sha256").asString()).isEqualTo(sha);
    }

    @Test
    void duasAssinaturasAoMesmoTempoGravamUmaSoEAOutraRecebeOMesmo404() throws Exception {
        JsonNode criado = gerarParaOResponsavel();
        String id = criado.get("id").asString();
        Map<String, Object> corpo = corpoDeAssinar(codigoDe(criado), cpfDoResponsavel, criado.get("sha256").asString(), NOME_DIGITADO, true, true);

        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            CountDownLatch largada = new CountDownLatch(1);
            Callable<Integer> assinar = () -> {
                largada.await();
                return postBruto("/publico/contratos/assinar", corpo).getResponse().getStatus();
            };
            Future<Integer> a = pool.submit(assinar);
            Future<Integer> b = pool.submit(assinar);
            largada.countDown();
            List<Integer> estados = List.of(a.get(60, TimeUnit.SECONDS), b.get(60, TimeUnit.SECONDS)).stream().sorted().toList();
            assertThat(estados).containsExactly(200, 404);
        } finally {
            pool.shutdownNow();
        }
        assertThat(contar("select count(*) from auditoria where acao = 'CONTRATO_ASSINADO' and entidade_id = ?::uuid", id)).isEqualTo(1);
    }

    @Test
    void outraConsultoriaNaoVeNemMexeNoContratoDoResponsavel() throws Exception {
        JsonNode criado = gerarParaOResponsavel();
        String id = criado.get("id").asString();
        JsonNode outro = api.novoTreinador();

        api.get("/contratos/" + id, outro, 404);
        api.get("/alunos/" + aluno + "/contratos", outro, 404);
        api.post("/contratos/" + id + "/link", outro, Map.of(), 404);
        api.post("/contratos/" + id + "/cancelar", outro, Map.of("motivo", "x", "versao", 0), 404);
        api.post("/contratos/" + id + "/prorrogar", outro, Map.of("dias", 3, "versao", 0), 404);
        assertThat(contar("select count(*) from contrato_aluno where id = ?::uuid and situacao = 'PENDENTE'", id)).isEqualTo(1);
    }

    // ---- menor de idade (D28) ----

    @Test
    void menorDeDezesseisSoOResponsavelAssinaMesmoPedindoOAluno() throws Exception {
        UUID menor = novoAluno("Menor Dez Anos " + UUID.randomUUID(), HOJE.minusYears(10));
        definirResponsavel(menor, "Responsável Do Menor", cpfDoResponsavel);

        JsonNode criado = gerar(menor, UUID.randomUUID(), "ALUNO", 201);

        assertThat(criado.get("signatario").asString()).isEqualTo("RESPONSAVEL");
        assertThat(criado.get("grupoId").isNull()).isTrue();
        assertThat(criado.get("link").get("contratoId").asString()).isEqualTo(criado.get("id").asString());
        assertThat(codigoDe(criado)).hasSize(24);
        assertThat(contar("select count(*) from contrato_aluno where aluno_id = ?::uuid", menor.toString())).isEqualTo(1);
    }

    @Test
    void deDezesseisADezesseteGeraOParComOsMesmosTextoEHashEDoisAceites() throws Exception {
        UUID jovem = novoAluno("Jovem Dezessete " + UUID.randomUUID(), HOJE.minusYears(17).minusDays(10));
        definirResponsavel(jovem, "Responsável Do Jovem", cpfDoResponsavel);
        JsonNode loginDoJovem = api.convidarEEntrar(admin, jovem);
        UUID pedido = UUID.randomUUID();

        JsonNode criado = gerar(jovem, pedido, null, 201);
        String idDoAluno = criado.get("id").asString();
        String idDoResponsavel = criado.get("link").get("contratoId").asString();
        String codigo = codigoDe(criado);
        String sha = criado.get("sha256").asString();

        // O corpo é o do aluno; o link é o do responsável, e os dois levam o mesmo grupo, texto e hash.
        assertThat(criado.get("signatario").asString()).isEqualTo("ALUNO");
        assertThat(idDoResponsavel).isNotEqualTo(idDoAluno);
        assertThat(criado.get("grupoId").isNull()).isFalse();
        assertThat(contar("select count(*) from contrato_aluno where grupo_id = ?::uuid and sha256 = ? and texto = "
                + "(select texto from contrato_aluno where id = ?::uuid)", criado.get("grupoId").asString(), sha, idDoAluno)).isEqualTo(2);
        assertThat(jdbc.queryForObject("select signatario from contrato_aluno where id = ?::uuid", String.class, idDoResponsavel))
                .isEqualTo("RESPONSAVEL");
        assertThat(jdbc.queryForObject("select pedido_id::text from contrato_aluno where id = ?::uuid", String.class, idDoResponsavel))
                .isEqualTo(ContratoService.pedidoDoResponsavel(pedido).toString());

        // O mesmo pedido: 200, o contrato do aluno de novo, o código nulo, e nada de contrato a mais.
        JsonNode repetido = gerar(jovem, pedido, null, 200);
        assertThat(repetido.get("id").asString()).isEqualTo(idDoAluno);
        assertThat(repetido.get("link").get("codigo").isNull()).isTrue();
        assertThat(repetido.get("link").get("contratoId").asString()).isEqualTo(idDoResponsavel);
        assertThat(contar("select count(*) from contrato_aluno where aluno_id = ?::uuid", jovem.toString())).isEqualTo(2);

        // O aluno vê os dois (o do responsável como "aguardando") e assina só o dele; o do responsável segue pendente.
        JsonNode lista = api.get("/aluno/contratos", loginDoJovem, 200);
        assertThat(lista).extracting(c -> c.get("signatario").asString()).containsExactlyInAnyOrder("ALUNO", "RESPONSAVEL");
        api.post("/aluno/contratos/" + idDoAluno + "/assinar", loginDoJovem, assinaturaDoAluno(sha, jovemNome(jovem)), 200);
        assertThat(api.post("/aluno/contratos/" + idDoResponsavel + "/assinar", loginDoJovem, assinaturaDoAluno(sha, jovemNome(jovem)), 409)
                .get("codigo").asString()).isEqualTo("CONTRATO_SIGNATARIO");
        assertThat(contar("select count(*) from contrato_aluno where id = ?::uuid and situacao = 'PENDENTE'", idDoResponsavel)).isEqualTo(1);

        // O responsável assina pelo link: dois aceites, cada contrato com as suas evidências.
        assinarPeloLink(codigo, cpfDoResponsavel, sha, 200);
        assertThat(contar("select count(*) from contrato_aluno where grupo_id = ?::uuid and situacao = 'ASSINADO'",
                criado.get("grupoId").asString())).isEqualTo(2);
        assertThat(jdbc.queryForObject("select assinado_por_usuario_id is not null from contrato_aluno where id = ?::uuid", Boolean.class,
                idDoAluno)).isTrue();
        assertThat(jdbc.queryForObject("select assinante_declarou_responsavel from contrato_aluno where id = ?::uuid", Boolean.class,
                idDoResponsavel)).isTrue();
    }

    private String jovemNome(UUID doAluno) {
        return jdbc.queryForObject("select nome from aluno where id = ?::uuid", String.class, doAluno.toString());
    }

    @Test
    void cancelarOuProrrogarUmDoParValeParaOsPendentesDoGrupoEOAssinadoNuncaMuda() throws Exception {
        jdbc.update("update consultoria set contrato_prazo_dias = 5 where id = ?", consultoria);
        UUID jovem = novoAluno("Jovem Grupo " + UUID.randomUUID(), HOJE.minusYears(16).minusDays(30));
        definirResponsavel(jovem, "Responsável Do Grupo", cpfDoResponsavel);

        // Prorrogar: os dois pendentes ganham o mesmo prazo e o link do responsável acompanha.
        JsonNode par = gerar(jovem, UUID.randomUUID(), null, 201);
        String idDoAluno = par.get("id").asString();
        String idDoResponsavel = par.get("link").get("contratoId").asString();
        JsonNode prorrogado = api.post("/contratos/" + idDoAluno + "/prorrogar", admin, Map.of("dias", 3, "versao", par.get("versao").asLong()), 200);
        assertThat(Instant.parse(prorrogado.get("prazoAte").asString())).isAfter(Instant.parse(par.get("prazoAte").asString()));
        assertThat(jdbc.queryForObject("select count(distinct prazo_ate) from contrato_aluno where grupo_id = ?::uuid", Integer.class,
                par.get("grupoId").asString())).isEqualTo(1);
        assertThat(jdbc.queryForObject("select link_expira_em = prazo_ate from contrato_aluno where id = ?::uuid", Boolean.class,
                idDoResponsavel)).isTrue();
        assertThat(prorrogado.get("link").get("expiraEm").asString()).isEqualTo(prorrogado.get("prazoAte").asString());

        // Cancelar o do aluno cancela o do responsável: o link morre e o aluno não vê nenhum.
        api.post("/contratos/" + idDoAluno + "/cancelar", admin,
                Map.of("motivo", "Gerado por engano", "versao", prorrogado.get("versao").asLong()), 200);
        assertThat(contar("select count(*) from contrato_aluno where grupo_id = ?::uuid and situacao = 'CANCELADO'",
                par.get("grupoId").asString())).isEqualTo(2);
        exigirOMesmo404(codigoDe(par));

        // Outro par: o responsável assina, e cancelar o do aluno deixa o assinado como está.
        JsonNode outro = gerar(jovem, UUID.randomUUID(), null, 201);
        assinarPeloLink(codigoDe(outro), cpfDoResponsavel, outro.get("sha256").asString(), 200);
        api.post("/contratos/" + outro.get("id").asString() + "/cancelar", admin,
                Map.of("motivo", "Aluno não vai assinar", "versao", outro.get("versao").asLong()), 200);
        assertThat(jdbc.queryForObject("select situacao from contrato_aluno where id = ?::uuid", String.class,
                outro.get("link").get("contratoId").asString())).isEqualTo("ASSINADO");
        assertThat(jdbc.queryForObject("select situacao from contrato_aluno where id = ?::uuid", String.class,
                outro.get("id").asString())).isEqualTo("CANCELADO");
    }

    // ---- link: prorrogar, renovar ----

    @Test
    void prorrogarMoveOLinkERenovarInvalidaOCodigoAnteriorSoNoResponsavelPendente() throws Exception {
        jdbc.update("update consultoria set contrato_prazo_dias = 5 where id = ?", consultoria);
        JsonNode criado = gerarParaOResponsavel();
        String id = criado.get("id").asString();
        String primeiro = codigoDe(criado);
        // Com prazo no futuro, o link vale até o prazo (S5).
        assertThat(criado.get("link").get("expiraEm").asString()).isEqualTo(criado.get("prazoAte").asString());

        JsonNode prorrogado = api.post("/contratos/" + id + "/prorrogar", admin, Map.of("dias", 4, "versao", criado.get("versao").asLong()), 200);
        assertThat(prorrogado.get("link").get("expiraEm").asString()).isEqualTo(prorrogado.get("prazoAte").asString());
        assertThat(jdbc.queryForObject("select link_expira_em = prazo_ate from contrato_aluno where id = ?::uuid", Boolean.class, id)).isTrue();
        assertThat(consultar(primeiro, 200).get("titulo").asString()).isNotBlank();

        // Renovar: código novo só nesta resposta; o anterior deixa de valer na hora; auditoria de resumo fixo.
        JsonNode renovado = api.post("/contratos/" + id + "/link", admin, Map.of(), 200);
        String segundo = renovado.get("codigo").asString();
        assertThat(renovado.get("contratoId").asString()).isEqualTo(id);
        assertThat(segundo).hasSize(24).isNotEqualTo(primeiro);
        exigirOMesmo404(primeiro);
        assertThat(consultar(segundo, 200).get("titulo").asString()).isNotBlank();
        assertThat(api.get("/contratos/" + id, admin, 200).get("link").get("codigo").isNull()).isTrue();
        assertThat(jdbc.queryForList("select resumo from auditoria where acao = 'CONTRATO_LINK_GERADO' and entidade_id = ?::uuid",
                String.class, id)).hasSize(1).allSatisfy(r -> assertThat(r).doesNotContain(segundo).doesNotContain(primeiro));

        // Prazo já vencido: renovar volta a valer 30 dias a partir de agora.
        jdbc.update("update contrato_aluno set prazo_ate = now() - interval '1 day', link_expira_em = now() - interval '1 day' where id = ?::uuid", id);
        Instant expira = Instant.parse(api.post("/contratos/" + id + "/link", admin, Map.of(), 200).get("expiraEm").asString());
        assertThat(expira).isBetween(Instant.now().plus(29, ChronoUnit.DAYS), Instant.now().plus(31, ChronoUnit.DAYS));

        // Só o contrato do responsável pendente tem link; só a permissão de alterar renova.
        JsonNode doAluno = gerar(aluno, UUID.randomUUID(), null, 201);
        assertThat(api.post("/contratos/" + doAluno.get("id").asString() + "/link", admin, Map.of(), 409).get("codigo").asString())
                .isEqualTo("CONTRATO_SEM_LINK");
        JsonNode leitor = membro("Leitor", Set.of("ALUNO_LER", "ALUNO_SENSIVEL_LER", "CONTRATO_LER"));
        api.post("/contratos/" + id + "/link", leitor, Map.of(), 403);
        assinarPeloLink(api.post("/contratos/" + id + "/link", admin, Map.of(), 200).get("codigo").asString(), cpfDoResponsavel,
                criado.get("sha256").asString(), 200);
        assertThat(api.post("/contratos/" + id + "/link", admin, Map.of(), 409).get("codigo").asString()).isEqualTo("CONTRATO_NAO_PENDENTE");
    }

    @Test
    void alunoNaoAssinaOContratoDoResponsavelEOVeComoResponsavel() throws Exception {
        JsonNode loginDoAluno = api.convidarEEntrar(admin, aluno);
        JsonNode criado = gerarParaOResponsavel();
        String id = criado.get("id").asString();

        JsonNode lista = api.get("/aluno/contratos", loginDoAluno, 200);
        assertThat(lista).hasSize(1);
        assertThat(lista.get(0).get("signatario").asString()).isEqualTo("RESPONSAVEL");
        assertThat(api.get("/aluno/contratos/" + id, loginDoAluno, 200).get("signatario").asString()).isEqualTo("RESPONSAVEL");
        assertThat(api.post("/aluno/contratos/" + id + "/assinar", loginDoAluno,
                assinaturaDoAluno(criado.get("sha256").asString(), nomeDoAluno), 409).get("codigo").asString()).isEqualTo("CONTRATO_SIGNATARIO");
    }

    // ---- PDF próprio pelo link ----

    @Test
    void pdfProprioSeBaixaPeloLinkSoComOCpfEAssinaComOHashDoArquivo() throws Exception {
        byte[] pdf = ("%PDF-1.4\n% " + UUID.randomUUID() + "\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n").getBytes(StandardCharsets.UTF_8);
        Map<String, Object> dados = new LinkedHashMap<>();
        dados.put("pedidoId", UUID.randomUUID().toString());
        dados.put("titulo", "Contrato em PDF do responsável");
        dados.put("signatario", "RESPONSAVEL");
        MvcResult enviado = mvc.perform(multipart(HttpMethod.POST, "/alunos/" + aluno + "/contratos")
                        .file(new MockMultipartFile("arquivo", "contrato.pdf", "application/pdf", pdf))
                        .file(new MockMultipartFile("dados", "", "application/json", api.paraJson(dados).getBytes(StandardCharsets.UTF_8)))
                        .header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(admin)))
                .andExpect(status().isCreated()).andReturn();
        JsonNode criado = api.ler(enviado);
        String codigo = codigoDe(criado);
        String sha = criado.get("sha256").asString();
        assertThat(criado.get("origem").asString()).isEqualTo("PDF");
        assertThat(criado.get("texto").isNull()).isTrue();

        // O CPF errado não entrega os bytes (e conta tentativa); o certo, sim, como anexo e sem cache.
        assertThat(api.ler(arquivoPublico(codigo, Documentos.cpf(), 422)).get("codigo").asString()).isEqualTo("CPF_NAO_CONFERE");
        MvcResult baixado = arquivoPublico(codigo, cpfDoResponsavel, 200);
        assertThat(baixado.getResponse().getContentAsByteArray()).isEqualTo(pdf);
        assertThat(baixado.getResponse().getContentType()).isEqualTo(MediaType.APPLICATION_PDF_VALUE);
        assertThat(baixado.getResponse().getHeader(HttpHeaders.CONTENT_DISPOSITION)).isEqualTo("attachment; filename=\"contrato.pdf\"");
        assertThat(baixado.getResponse().getHeader(HttpHeaders.CACHE_CONTROL)).contains("no-store");

        JsonNode aberto = abrir(codigo, cpfDoResponsavel, 200);
        assertThat(aberto.get("origem").asString()).isEqualTo("PDF");
        assertThat(aberto.get("temArquivo").asBoolean()).isTrue();
        assertThat(aberto.get("texto").isNull()).isTrue();
        assertThat(aberto.get("sha256").asString()).isEqualTo(sha);

        JsonNode assinado = assinarPeloLink(codigo, cpfDoResponsavel, sha, 200);
        assertThat(assinado.get("texto").isNull()).isTrue();

        // Contrato de modelo não tem arquivo: o mesmo 404 (o CPF e o link valem, o arquivo não existe).
        JsonNode doModelo = gerarParaOResponsavel();
        JsonNode semArquivo = api.ler(arquivoPublico(codigoDe(doModelo), cpfDoResponsavel, 404));
        assertThat(semArquivo.get("message")).isEqualTo(consultar(CodigoDeInscricao.novo(), 404).get("message"));
    }
}
