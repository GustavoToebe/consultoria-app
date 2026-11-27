package br.com.treinos.api.contratos;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.Documentos;
import br.com.treinos.api.web.Fuso;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Contrato digital, passo 3 (PDF próprio, D14 e D22; {@code docs/planos/contrato-digital.md}): gerar por multipart, hash dos bytes como
 * vieram, idempotência do pedido, conferência do arquivo e do título, baixar pela equipe e pelo aluno, isolamento, cancelado, assinatura
 * com o hash do arquivo e exportação sem os bytes. Só dados fictícios; os PDFs de teste são bytes mínimos que começam com {@code %PDF-}.
 */
@AutoConfigureMockMvc
class ContratosPdfIntegrationTest extends AbstractIntegrationTest {

    private static final LocalDate HOJE = LocalDate.now(Fuso.BRASILIA);
    private static final String NOME_DO_ARQUIVO = "contrato-sigiloso-da-joana.pdf";

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;

    private ApiDeTeste api;
    private JsonNode admin;
    private String nomeDoAluno;
    private UUID aluno;
    private JsonNode loginDoAluno;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        nomeDoAluno = "Joana Pdf " + UUID.randomUUID().toString().substring(0, 8);
        aluno = UUID.fromString(api.post("/alunos", admin, Map.of("nome", nomeDoAluno, "cpf", Documentos.cpf()), 200).get("id").asString());
        loginDoAluno = api.convidarEEntrar(admin, aluno);
    }

    // ---- ajudantes ----

    /** PDF fictício: só o começo certo e um texto único (o conteúdo nunca deve aparecer fora do download). */
    private static byte[] pdf(String segredo) {
        return ("%PDF-1.4\n% " + segredo + "\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n").getBytes(StandardCharsets.UTF_8);
    }

    private static Map<String, Object> dados(UUID pedidoId, String titulo) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("pedidoId", pedidoId == null ? null : pedidoId.toString());
        m.put("titulo", titulo);
        return m;
    }

    /** POST multipart; {@code dados} pode ser um mapa (vira JSON) ou um texto cru; nulo omite a parte. */
    private MvcResult enviar(JsonNode login, UUID doAluno, byte[] arquivo, Object dados, int esperado) throws Exception {
        var req = multipart(HttpMethod.POST, "/alunos/" + doAluno + "/contratos").header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(login));
        if (arquivo != null) {
            req.file(new MockMultipartFile("arquivo", NOME_DO_ARQUIVO, "application/pdf", arquivo));
        }
        if (dados != null) {
            String texto = dados instanceof String s ? s : api.paraJson(dados);
            req.file(new MockMultipartFile("dados", "", "application/json", texto.getBytes(StandardCharsets.UTF_8)));
        }
        return mvc.perform(req).andExpect(status().is(esperado)).andReturn();
    }

    private JsonNode gerarPdf(byte[] arquivo, int esperado) throws Exception {
        return api.ler(enviar(admin, aluno, arquivo, dados(UUID.randomUUID(), "Contrato em PDF"), esperado));
    }

    private MvcResult baixar(JsonNode login, String caminho, int esperado) throws Exception {
        return mvc.perform(get(caminho).header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(login))).andExpect(status().is(esperado)).andReturn();
    }

    private static Map<String, Object> assinatura(String sha256, String nome) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("sha256", sha256);
        m.put("nome", nome);
        m.put("aceite", true);
        return m;
    }

    private JsonNode membro(String nome, Set<String> permissoes) throws Exception {
        String perfil = api.post("/perfis", admin, Map.of("nome", "Perfil " + nome + UUID.randomUUID(), "permissoes", permissoes), 200)
                .get("id").asString();
        JsonNode convite = api.post("/usuarios/convites", admin,
                Map.of("nome", nome, "email", ApiDeTeste.emailUnico("membro"), "perfilId", perfil), 200);
        return api.post("/publico/convites-equipe/aceitar", null,
                Map.of("codigo", convite.get("codigo").asString(), "senha", ApiDeTeste.SENHA), 200);
    }

    private int contar(String sql, Object... args) {
        return jdbc.queryForObject(sql, Integer.class, args);
    }

    private static Set<String> campos(JsonNode erro) {
        Set<String> nomes = new TreeSet<>();
        erro.get("fieldErrors").forEach(f -> nomes.add(f.get("field").asString()));
        return nomes;
    }

    private void confereCabecalhos(MvcResult r, byte[] esperado) {
        var resp = r.getResponse();
        assertThat(resp.getContentType()).isEqualTo("application/pdf");
        assertThat(resp.getHeader(HttpHeaders.CONTENT_DISPOSITION)).isEqualTo("attachment; filename=\"contrato.pdf\"");
        assertThat(resp.getHeader(HttpHeaders.CACHE_CONTROL)).contains("no-store");
        assertThat(resp.getContentAsByteArray()).isEqualTo(esperado);
    }

    // ---- gerar e baixar ----

    @Test
    void gerarPdfGravaOHashDosBytesRepetirOPedidoDevolveOMesmoEAmbosBaixam() throws Exception {
        byte[] arquivo = pdf("Cláusula " + UUID.randomUUID());
        UUID pedido = UUID.randomUUID();

        JsonNode criado = api.ler(enviar(admin, aluno, arquivo, dados(pedido, "  Contrato em PDF  "), 201));

        assertThat(criado.get("origem").asString()).isEqualTo("PDF");
        assertThat(criado.get("situacao").asString()).isEqualTo("PENDENTE");
        assertThat(criado.get("titulo").asString()).isEqualTo("Contrato em PDF");
        assertThat(criado.get("texto").isNull()).isTrue();
        String id = criado.get("id").asString();
        // O hash cobre os bytes como vieram; os bytes ficam no banco, iguais.
        assertThat(criado.get("sha256").asString()).isEqualTo(TextoDoContrato.sha256(arquivo));
        assertThat(jdbc.queryForObject("select bytes from contrato_arquivo where contrato_id = ?::uuid", byte[].class, id)).isEqualTo(arquivo);
        assertThat(contar("select count(*) from contrato_aluno where id = ?::uuid and texto is null and modelo_id is null", id)).isEqualTo(1);

        // O mesmo pedido com outro arquivo: 409, para o contrato nunca ficar ligado ao PDF errado.
        assertThat(api.ler(enviar(admin, aluno, pdf("outro"), dados(pedido, "Outro título"), 409)).get("codigo").asString())
                .isEqualTo("PEDIDO_JA_USADO");

        // O mesmo pedido com o mesmo arquivo: 200, o mesmo contrato, sem regravar nem auditar de novo.
        JsonNode repetido = api.ler(enviar(admin, aluno, arquivo, dados(pedido, "Outro título"), 200));
        assertThat(repetido.get("id").asString()).isEqualTo(id);
        assertThat(repetido.get("sha256").asString()).isEqualTo(criado.get("sha256").asString());
        assertThat(contar("select count(*) from contrato_aluno where aluno_id = ?::uuid", aluno.toString())).isEqualTo(1);
        assertThat(contar("select count(*) from contrato_arquivo where contrato_id = ?::uuid", id)).isEqualTo(1);
        assertThat(jdbc.queryForList("select resumo from auditoria where acao = 'CONTRATO_GERADO' and entidade_id = ?::uuid", String.class, id))
                .containsExactly("Gerou um contrato para o aluno.");

        // O mesmo pedido em outro aluno: 409.
        UUID outro = api.criarAluno(admin, "Outro Aluno " + UUID.randomUUID());
        assertThat(api.ler(enviar(admin, outro, arquivo, dados(pedido, "x"), 409)).get("codigo").asString()).isEqualTo("PEDIDO_JA_USADO");

        // Equipe e aluno baixam o mesmo PDF, com os cabeçalhos de documento pessoal (nunca o nome do arquivo enviado).
        confereCabecalhos(baixar(admin, "/contratos/" + id + "/arquivo", 200), arquivo);
        confereCabecalhos(baixar(loginDoAluno, "/aluno/contratos/" + id + "/arquivo", 200), arquivo);
        JsonNode doAluno = api.get("/aluno/contratos/" + id, loginDoAluno, 200);
        assertThat(doAluno.get("origem").asString()).isEqualTo("PDF");
        assertThat(doAluno.get("texto").isNull()).isTrue();
    }

    @Test
    void alunoAssinaOPdfComOHashDoArquivo() throws Exception {
        byte[] arquivo = pdf("Para assinar " + UUID.randomUUID());
        JsonNode criado = gerarPdf(arquivo, 201);
        String id = criado.get("id").asString();
        String sha = api.get("/aluno/contratos/" + id, loginDoAluno, 200).get("sha256").asString();
        assertThat(sha).isEqualTo(TextoDoContrato.sha256(arquivo));

        api.post("/aluno/contratos/" + id + "/assinar", loginDoAluno, assinatura("0".repeat(64), nomeDoAluno), 409);
        JsonNode assinado = api.post("/aluno/contratos/" + id + "/assinar", loginDoAluno, assinatura(sha, nomeDoAluno), 200);

        assertThat(assinado.get("situacao").asString()).isEqualTo("ASSINADO");
        assertThat(assinado.get("assinatura").get("nome").asString()).isEqualTo(nomeDoAluno);
        // Assinado, o PDF segue baixável pelos dois.
        confereCabecalhos(baixar(loginDoAluno, "/aluno/contratos/" + id + "/arquivo", 200), arquivo);
        confereCabecalhos(baixar(admin, "/contratos/" + id + "/arquivo", 200), arquivo);
    }

    // ---- conferência ----

    @Test
    void arquivoETituloInvalidosSao422PorCampoSemRepetirONomeNemOConteudo() throws Exception {
        UUID pedido = UUID.randomUUID();
        String tituloBom = "Contrato em PDF";

        // Sem a parte, vazio, texto que não é PDF e %PDF- fora do começo: o mesmo erro no campo arquivo.
        JsonNode semParte = api.ler(enviar(admin, aluno, null, dados(pedido, tituloBom), 422));
        assertThat(semParte.get("codigo").asString()).isEqualTo("CONTRATO_INVALIDO");
        assertThat(campos(semParte)).containsExactly("arquivo");
        assertThat(semParte.get("fieldErrors").get(0).get("message").asString()).isEqualTo("Envie um arquivo PDF.");
        for (byte[] ruim : new byte[][]{new byte[0], "Isto nao e um PDF, conteudo-sigiloso".getBytes(StandardCharsets.UTF_8),
                " %PDF-1.4 com espaço antes".getBytes(StandardCharsets.UTF_8), "%PDF".getBytes(StandardCharsets.UTF_8)}) {
            JsonNode erro = api.ler(enviar(admin, aluno, ruim, dados(pedido, tituloBom), 422));
            assertThat(campos(erro)).containsExactly("arquivo");
            assertThat(erro.toString()).doesNotContain(NOME_DO_ARQUIVO).doesNotContain("conteudo-sigiloso");
        }

        // Acima de 900 KB (921.600 bytes): 422 com a frase do tamanho; exatamente 900 KB passa.
        byte[] grande = new byte[921_601];
        byte[] marca = "%PDF-".getBytes(StandardCharsets.US_ASCII);
        System.arraycopy(marca, 0, grande, 0, marca.length);
        JsonNode demais = api.ler(enviar(admin, aluno, grande, dados(pedido, tituloBom), 422));
        assertThat(campos(demais)).containsExactly("arquivo");
        assertThat(demais.get("fieldErrors").get(0).get("message").asString()).isEqualTo("O PDF passa de 900 KB.");
        byte[] noLimite = new byte[921_600];
        System.arraycopy(marca, 0, noLimite, 0, marca.length);
        assertThat(api.ler(enviar(admin, aluno, noLimite, dados(UUID.randomUUID(), tituloBom), 201)).get("sha256").asString())
                .isEqualTo(TextoDoContrato.sha256(noLimite));

        // Título vazio ou com mais de 120 caracteres, e os dois erros juntos.
        assertThat(campos(api.ler(enviar(admin, aluno, pdf("a"), dados(pedido, "   "), 422)))).containsExactly("titulo");
        assertThat(campos(api.ler(enviar(admin, aluno, pdf("a"), dados(pedido, "T".repeat(121)), 422)))).containsExactly("titulo");
        assertThat(campos(api.ler(enviar(admin, aluno, new byte[0], dados(pedido, ""), 422)))).containsExactly("arquivo", "titulo");

        // Pedido ausente, dados ausentes ou ilegíveis e signatário que ainda não existe.
        assertThat(campos(api.ler(enviar(admin, aluno, pdf("a"), dados(null, tituloBom), 422)))).containsExactly("pedidoId");
        assertThat(campos(api.ler(enviar(admin, aluno, pdf("a"), null, 422)))).containsExactly("dados");
        assertThat(campos(api.ler(enviar(admin, aluno, pdf("a"), "{isto nao e json", 422)))).containsExactly("dados");
        Map<String, Object> responsavel = dados(UUID.randomUUID(), tituloBom);
        responsavel.put("signatario", "RESPONSAVEL");
        JsonNode semResponsavel = api.ler(enviar(admin, aluno, pdf("a"), responsavel, 422));
        assertThat(semResponsavel.get("codigo").asString()).isEqualTo("CONTRATO_INCOMPLETO");
        assertThat(campos(semResponsavel)).containsExactlyInAnyOrder("responsavel_nome", "responsavel_cpf");

        // Só o PDF de 900 KB exato foi gravado.
        assertThat(contar("select count(*) from contrato_aluno where aluno_id = ?::uuid", aluno.toString())).isEqualTo(1);
    }

    @Test
    void alunoInativoEAnonimizadoNaoRecebemPdf() throws Exception {
        UUID inativo = UUID.fromString(api.post("/alunos", admin, Map.of("nome", "Inativo " + UUID.randomUUID(), "cpf", Documentos.cpf()), 200)
                .get("id").asString());
        api.patch("/alunos/" + inativo + "/situacao", admin, Map.of("ativo", false), 200);
        assertThat(api.ler(enviar(admin, inativo, pdf("a"), dados(UUID.randomUUID(), "x"), 409)).get("codigo").asString())
                .isEqualTo("ALUNO_INATIVO");
        String nome = jdbc.queryForObject("select nome from aluno where id = ?::uuid", String.class, inativo.toString());
        api.post("/alunos/" + inativo + "/anonimizar", admin, Map.of("nomeConfirmado", nome), 200);
        assertThat(api.ler(enviar(admin, inativo, pdf("a"), dados(UUID.randomUUID(), "x"), 409)).get("codigo").asString())
                .isEqualTo("ALUNO_ANONIMIZADO");
    }

    // ---- isolamento, cancelado, modelo e permissões ----

    @Test
    void outraConsultoriaAlunoAlheioCanceladoEModeloDao404NoDownload() throws Exception {
        JsonNode pendente = gerarPdf(pdf("pendente " + UUID.randomUUID()), 201);
        JsonNode cancelado = gerarPdf(pdf("cancelado " + UUID.randomUUID()), 201);
        api.post("/contratos/" + cancelado.get("id").asString() + "/cancelar", admin,
                Map.of("motivo", "Gerado por engano", "versao", cancelado.get("versao").asLong()), 200);
        JsonNode modelo = api.post("/contratos/modelos", admin, Map.of("nome", "Modelo " + UUID.randomUUID(), "texto", "Oi {aluno_nome}."), 201);
        JsonNode deModelo = api.post("/alunos/" + aluno + "/contratos", admin,
                Map.of("pedidoId", UUID.randomUUID().toString(), "modeloId", modelo.get("id").asString()), 201);
        String id = pendente.get("id").asString();

        // O cancelado some para o aluno; a equipe ainda o lê no histórico.
        baixar(loginDoAluno, "/aluno/contratos/" + cancelado.get("id").asString() + "/arquivo", 404);
        baixar(admin, "/contratos/" + cancelado.get("id").asString() + "/arquivo", 200);
        // Contrato de modelo não tem arquivo.
        baixar(admin, "/contratos/" + deModelo.get("id").asString() + "/arquivo", 404);
        baixar(loginDoAluno, "/aluno/contratos/" + deModelo.get("id").asString() + "/arquivo", 404);
        // Id que não existe.
        baixar(admin, "/contratos/" + UUID.randomUUID() + "/arquivo", 404);

        // Outro aluno da mesma consultoria não baixa o contrato deste.
        UUID colega = api.criarAluno(admin, "Colega " + UUID.randomUUID());
        baixar(api.convidarEEntrar(admin, colega), "/aluno/contratos/" + id + "/arquivo", 404);

        // Outra consultoria: equipe e aluno de lá recebem 404, e não gravam PDF no aluno daqui.
        JsonNode outraEquipe = api.novoTreinador();
        UUID alunoDeLa = api.criarAluno(outraEquipe, "Aluno de Outra " + UUID.randomUUID());
        baixar(outraEquipe, "/contratos/" + id + "/arquivo", 404);
        baixar(api.convidarEEntrar(outraEquipe, alunoDeLa), "/aluno/contratos/" + id + "/arquivo", 404);
        enviar(outraEquipe, aluno, pdf("a"), dados(UUID.randomUUID(), "x"), 404);
        assertThat(contar("select count(*) from contrato_aluno where aluno_id = ?::uuid", aluno.toString())).isEqualTo(3);

        // Permissões: só ler não gera; sem ler não baixa; aluno e equipe não trocam de rota.
        JsonNode soLeitura = membro("So Leitura", Set.of("ALUNO_LER", "ALUNO_SENSIVEL_LER", "CONTRATO_LER"));
        JsonNode semNada = membro("Sem Contrato", Set.of("ALUNO_LER"));
        baixar(soLeitura, "/contratos/" + id + "/arquivo", 200);
        enviar(soLeitura, aluno, pdf("a"), dados(UUID.randomUUID(), "x"), 403);
        baixar(semNada, "/contratos/" + id + "/arquivo", 403);
        baixar(loginDoAluno, "/contratos/" + id + "/arquivo", 403);
        baixar(admin, "/aluno/contratos/" + id + "/arquivo", 403);
        mvc.perform(get("/aluno/contratos/" + id + "/arquivo")).andExpect(status().isUnauthorized());
    }

    @Test
    void contratacaoDoPdfExigeFinanceiroLerETemDeSerDoAluno() throws Exception {
        String contratacao = contratar(aluno);
        UUID outro = api.criarAluno(admin, "Outro " + UUID.randomUUID());
        Map<String, Object> corpo = dados(UUID.randomUUID(), "Com plano");
        corpo.put("contratacaoId", contratacao);

        JsonNode semFinanceiro = membro("Sem Financeiro", Set.of("ALUNO_LER", "ALUNO_SENSIVEL_LER", "CONTRATO_LER", "CONTRATO_ALTERAR"));
        enviar(semFinanceiro, aluno, pdf("a"), corpo, 403);
        assertThat(contar("select count(*) from contrato_aluno where aluno_id = ?::uuid", aluno.toString())).isZero();

        assertThat(api.ler(enviar(admin, aluno, pdf("b"), corpo, 201)).get("contratacaoId").asString()).isEqualTo(contratacao);
        // Contratação de outro aluno: 404, nada gravado.
        Map<String, Object> cruzado = dados(UUID.randomUUID(), "Cruzado");
        cruzado.put("contratacaoId", contratar(outro));
        enviar(admin, aluno, pdf("c"), cruzado, 404);
        assertThat(contar("select count(*) from contrato_aluno where aluno_id = ?::uuid", aluno.toString())).isEqualTo(1);
    }

    private String contratar(UUID doAluno) throws Exception {
        Map<String, Object> plano = new LinkedHashMap<>();
        plano.put("nome", "Plano do contrato " + UUID.randomUUID());
        plano.put("valorCentavos", 10_000);
        plano.put("periodicidade", "MENSAL");
        String planoId = api.post("/financeiro/planos", admin, plano, 200).get("id").asString();
        return api.post("/alunos/" + doAluno + "/contratacoes", admin,
                Map.of("planoComercialId", planoId, "inicio", HOJE.toString(), "diaVencimento", 10), 200).get("id").asString();
    }

    // ---- LGPD ----

    @Test
    void exportacaoTrazOMetadadoSemOsBytesEAnonimizacaoApagaOPendenteEMantemOAssinado() throws Exception {
        String segredo = "SEGREDO-DO-PDF-" + UUID.randomUUID();
        byte[] assinadoPdf = pdf(segredo);
        JsonNode assinado = gerarPdf(assinadoPdf, 201);
        api.post("/aluno/contratos/" + assinado.get("id").asString() + "/assinar", loginDoAluno,
                assinatura(assinado.get("sha256").asString(), nomeDoAluno), 200);
        JsonNode pendente = gerarPdf(pdf("pendente " + UUID.randomUUID()), 201);

        JsonNode exportacao = api.get("/alunos/" + aluno + "/exportacao", admin, 200);
        JsonNode itens = exportacao.get("contratos").get("itens");
        assertThat(itens).hasSize(2);
        for (JsonNode item : itens) {
            assertThat(item.get("origem").asString()).isEqualTo("PDF");
            assertThat(item.path("texto").isNull() || item.path("texto").isMissingNode()).isTrue();
            assertThat(item.get("sha256").asString()).hasSize(64);
        }
        String texto = exportacao.toString();
        assertThat(texto).doesNotContain(segredo).doesNotContain(Base64.getEncoder().encodeToString(assinadoPdf))
                .doesNotContain("\"bytes\"").doesNotContain(NOME_DO_ARQUIVO);

        api.patch("/alunos/" + aluno + "/situacao", admin, Map.of("ativo", false), 200);
        api.post("/alunos/" + aluno + "/anonimizar", admin, Map.of("nomeConfirmado", nomeDoAluno), 200);

        // O pendente sai com o PDF (cascade); o assinado fica com o PDF e as evidências.
        assertThat(contar("select count(*) from contrato_arquivo where contrato_id = ?::uuid", pendente.get("id").asString())).isZero();
        assertThat(contar("select count(*) from contrato_arquivo where contrato_id = ?::uuid", assinado.get("id").asString())).isEqualTo(1);
    }
}
