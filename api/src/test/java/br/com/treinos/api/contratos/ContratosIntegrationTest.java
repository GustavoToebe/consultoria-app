package br.com.treinos.api.contratos;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.Documentos;
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
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Contrato digital, passo 1 (V105, {@code docs/planos/contrato-digital.md}): modelos, prévia, gerar idempotente, assinatura do aluno com
 * evidências, cancelar, prorrogar, isolamento por consultoria, permissões, financeiro, exportação e anonimização, e nada do texto, CPF,
 * nome, IP ou aparelho em log nem na auditoria. Só dados fictícios.
 */
@AutoConfigureMockMvc
class ContratosIntegrationTest extends AbstractIntegrationTest {

    private static final LocalDate HOJE = LocalDate.now(Fuso.BRASILIA);
    private static final String FRASE_SIGILOSA = "Cláusula sigilosa do contrato fictício";
    private static final String TEXTO = FRASE_SIGILOSA + " de {aluno_nome}, CPF {aluno_cpf}, com a {consultoria}.";

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;

    private ApiDeTeste api;
    private JsonNode admin;
    private UUID consultoria;
    private String nomeDoAluno;
    private String cpfDoAluno;
    private UUID aluno;
    private JsonNode loginDoAluno;
    private ListAppender<ILoggingEvent> log;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        consultoria = consultoriaDe(admin);
        nomeDoAluno = "Joana Contratante " + UUID.randomUUID().toString().substring(0, 8);
        cpfDoAluno = Documentos.cpf();
        aluno = UUID.fromString(api.post("/alunos", admin, Map.of("nome", nomeDoAluno, "cpf", cpfDoAluno), 200).get("id").asString());
        loginDoAluno = api.convidarEEntrar(admin, aluno);
        log = new ListAppender<>();
        log.start();
        ((Logger) LoggerFactory.getLogger(Logger.ROOT_LOGGER_NAME)).addAppender(log);
    }

    @AfterEach
    void soltarOLog() {
        ((Logger) LoggerFactory.getLogger(Logger.ROOT_LOGGER_NAME)).detachAppender(log);
    }

    // ---- ajudantes ----

    private UUID consultoriaDe(JsonNode login) {
        return jdbc.queryForObject("select consultoria_id from usuario where id = ?::uuid", UUID.class,
                login.get("usuario").get("id").asString());
    }

    private JsonNode modelo(JsonNode quem, String nome, String texto) throws Exception {
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("nome", nome);
        corpo.put("texto", texto);
        return api.post("/contratos/modelos", quem, corpo, 201);
    }

    private JsonNode modelo() throws Exception {
        return modelo(admin, "Modelo " + UUID.randomUUID(), TEXTO);
    }

    private static Map<String, Object> pedido(JsonNode modelo, UUID pedidoId) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("pedidoId", pedidoId.toString());
        m.put("modeloId", modelo.get("id").asString());
        return m;
    }

    private JsonNode gerar(JsonNode modelo, int esperado) throws Exception {
        return api.post("/alunos/" + aluno + "/contratos", admin, pedido(modelo, UUID.randomUUID()), esperado);
    }

    private static Map<String, Object> assinatura(String sha256, String nome, Boolean aceite) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("sha256", sha256);
        m.put("nome", nome);
        m.put("aceite", aceite);
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

    /** Contratação recorrente do aluno num plano mensal novo; devolve o id da contratação. */
    private String contratar(JsonNode quem, UUID doAluno) throws Exception {
        Map<String, Object> plano = new LinkedHashMap<>();
        plano.put("nome", "Plano do contrato " + UUID.randomUUID());
        plano.put("valorCentavos", 10_000);
        plano.put("periodicidade", "MENSAL");
        String planoId = api.post("/financeiro/planos", quem, plano, 200).get("id").asString();
        return api.post("/alunos/" + doAluno + "/contratacoes", quem,
                Map.of("planoComercialId", planoId, "inicio", HOJE.toString(), "diaVencimento", 10), 200).get("id").asString();
    }

    // ---- modelos ----

    @Test
    void modeloTemNomeUnicoVersaoCampoDesconhecido422ESoOAdministradorMexe() throws Exception {
        JsonNode criado = modelo(admin, "Contrato de Treino", TEXTO);
        assertThat(criado.get("versao").asLong()).isZero();
        assertThat(api.get("/contratos/modelos", admin, 200)).extracting(m -> m.get("id").asString()).contains(criado.get("id").asString());

        // Nome repetido (sem diferença de caixa) entre os ativos: 409; arquivar libera o nome.
        assertThat(api.post("/contratos/modelos", admin, Map.of("nome", "CONTRATO DE TREINO", "texto", TEXTO), 409).get("codigo").asString())
                .isEqualTo("CONTRATO_MODELO_NOME_EM_USO");

        // Campo que não existe: 422 no texto, dizendo só quantos, nunca o nome do campo nem o texto.
        JsonNode invalido = api.post("/contratos/modelos", admin, Map.of("nome", "Com campo ruim", "texto", "Oi {campo_secreto_xyz}"), 422);
        assertThat(invalido.get("codigo").asString()).isEqualTo("CONTRATO_MODELO_INVALIDO");
        assertThat(campos(invalido)).contains("texto");
        assertThat(invalido.toString()).doesNotContain("campo_secreto_xyz");

        // Editar com a versão atual; versão velha é 409.
        Map<String, Object> novo = new LinkedHashMap<>();
        novo.put("nome", "Contrato de Treino v2");
        novo.put("texto", "Texto novo de {aluno_nome}.");
        novo.put("versao", criado.get("versao").asLong());
        JsonNode alterado = api.put("/contratos/modelos/" + criado.get("id").asString(), admin, novo, 200);
        assertThat(alterado.get("versao").asLong()).isGreaterThan(criado.get("versao").asLong());
        assertThat(api.put("/contratos/modelos/" + criado.get("id").asString(), admin, novo, 409).get("codigo").asString())
                .isEqualTo("CONFLITO_EDICAO");

        // Prévia com dados fictícios, nunca de aluno.
        JsonNode previa = api.post("/contratos/modelos/" + criado.get("id").asString() + "/previa", admin, Map.of(), 200);
        assertThat(previa.get("texto").asString()).contains("Maria Aluna de Exemplo").doesNotContain(nomeDoAluno);

        // Arquivar: o modelo some da escolha e o nome volta a ficar livre.
        api.post("/contratos/modelos/" + criado.get("id").asString() + "/arquivar", admin,
                Map.of("versao", alterado.get("versao").asLong()), 200);
        modelo(admin, "Contrato de Treino v2", "Outro texto.");
        assertThat(gerarCom(criado, 409).get("codigo").asString()).isEqualTo("CONTRATO_MODELO_ARQUIVADO");
    }

    private JsonNode gerarCom(JsonNode modelo, int esperado) throws Exception {
        return gerar(modelo, esperado);
    }

    // ---- gerar ----

    @Test
    void gerarPreencheCongelaOTextoEORepetirOPedidoDevolveOMesmoContrato() throws Exception {
        JsonNode modelo = modelo();
        jdbc.update("update consultoria set contrato_prazo_dias = 5 where id = ?", consultoria);
        UUID pedido = UUID.randomUUID();

        JsonNode criado = api.post("/alunos/" + aluno + "/contratos", admin, pedido(modelo, pedido), 201);

        assertThat(criado.get("situacao").asString()).isEqualTo("PENDENTE");
        assertThat(criado.get("texto").asString()).contains(nomeDoAluno).contains(cpfDoAluno).doesNotContain("{");
        String sha = criado.get("sha256").asString();
        assertThat(sha).isEqualTo(TextoDoContrato.sha256(TextoDoContrato.normalizar(criado.get("texto").asString())));
        assertThat(criado.get("prazoAte").isNull()).isFalse();
        // O texto fica congelado: mudar o modelo depois não muda o contrato.
        Map<String, Object> novo = new LinkedHashMap<>();
        novo.put("nome", modelo.get("nome").asString());
        novo.put("texto", "Texto trocado.");
        novo.put("versao", modelo.get("versao").asLong());
        api.put("/contratos/modelos/" + modelo.get("id").asString(), admin, novo, 200);
        assertThat(api.get("/contratos/" + criado.get("id").asString(), admin, 200).get("sha256").asString()).isEqualTo(sha);

        // O mesmo pedido: 200, o mesmo contrato, sem gerar outro nem auditar de novo.
        JsonNode repetido = api.post("/alunos/" + aluno + "/contratos", admin, pedido(modelo, pedido), 200);
        assertThat(repetido.get("id").asString()).isEqualTo(criado.get("id").asString());
        assertThat(contar("select count(*) from contrato_aluno where aluno_id = ?::uuid", aluno.toString())).isEqualTo(1);
        assertThat(contar("select count(*) from auditoria where acao = 'CONTRATO_GERADO' and entidade_id = ?::uuid",
                criado.get("id").asString())).isEqualTo(1);

        // O mesmo pedido em outro aluno da consultoria: 409.
        UUID outro = api.criarAluno(admin, "Outro Aluno " + UUID.randomUUID());
        assertThat(api.post("/alunos/" + outro + "/contratos", admin, pedido(modelo, pedido), 409).get("codigo").asString())
                .isEqualTo("PEDIDO_JA_USADO");

        // Pedido ausente e responsável como signatário (ainda não existe): 422 por campo.
        assertThat(campos(api.post("/alunos/" + aluno + "/contratos", admin, Map.of("modeloId", modelo.get("id").asString()), 422)))
                .containsExactly("pedidoId");
        Map<String, Object> responsavel = pedido(modelo, UUID.randomUUID());
        responsavel.put("signatario", "RESPONSAVEL");
        JsonNode semResponsavel = api.post("/alunos/" + aluno + "/contratos", admin, responsavel, 422);
        assertThat(semResponsavel.get("codigo").asString()).isEqualTo("CONTRATO_INCOMPLETO");
        assertThat(campos(semResponsavel)).containsExactlyInAnyOrder("responsavel_nome", "responsavel_cpf");
    }

    @Test
    void campoSemValorNaPreviaEnoGerarE422ComALista() throws Exception {
        UUID semCpf = UUID.fromString(api.post("/alunos", admin, Map.of("nome", "Sem Cpf " + UUID.randomUUID()), 200).get("id").asString());
        JsonNode modelo = modelo();

        JsonNode previa = api.post("/alunos/" + semCpf + "/contratos/previa", admin, Map.of("modeloId", modelo.get("id").asString()), 200);
        assertThat(previa.get("podeGerar").asBoolean()).isFalse();
        assertThat(previa.get("faltas").get(0).get("campo").asString()).isEqualTo("aluno_cpf");
        assertThat(previa.get("texto").asString()).contains("{aluno_cpf}");

        JsonNode erro = api.post("/alunos/" + semCpf + "/contratos", admin, pedido(modelo, UUID.randomUUID()), 422);
        assertThat(erro.get("codigo").asString()).isEqualTo("CONTRATO_INCOMPLETO");
        assertThat(campos(erro)).containsExactly("aluno_cpf");
        assertThat(contar("select count(*) from contrato_aluno where aluno_id = ?::uuid", semCpf.toString())).isZero();
    }

    @Test
    void alunoInativoEAnonimizadoNaoRecebemContrato() throws Exception {
        JsonNode modelo = modelo();
        UUID inativo = UUID.fromString(api.post("/alunos", admin, Map.of("nome", "Inativo " + UUID.randomUUID(), "cpf", Documentos.cpf()), 200)
                .get("id").asString());
        api.patch("/alunos/" + inativo + "/situacao", admin, Map.of("ativo", false), 200);

        assertThat(api.post("/alunos/" + inativo + "/contratos", admin, pedido(modelo, UUID.randomUUID()), 409).get("codigo").asString())
                .isEqualTo("ALUNO_INATIVO");
        String nome = jdbc.queryForObject("select nome from aluno where id = ?::uuid", String.class, inativo.toString());
        api.post("/alunos/" + inativo + "/anonimizar", admin, Map.of("nomeConfirmado", nome), 200);
        assertThat(api.post("/alunos/" + inativo + "/contratos", admin, pedido(modelo, UUID.randomUUID()), 409).get("codigo").asString())
                .isEqualTo("ALUNO_ANONIMIZADO");
    }

    // ---- assinar ----

    @Test
    void alunoAssinaComEvidenciasERecusaHashErradoNomeErradoEAceiteAusente() throws Exception {
        JsonNode criado = gerar(modelo(), 201);
        String id = criado.get("id").asString();
        String sha = criado.get("sha256").asString();

        // O aluno vê o próprio contrato, com o texto e o hash, e nada de quem gerou.
        JsonNode lista = api.get("/aluno/contratos", loginDoAluno, 200);
        assertThat(lista).hasSize(1);
        JsonNode visto = api.get("/aluno/contratos/" + id, loginDoAluno, 200);
        assertThat(visto.get("sha256").asString()).isEqualTo(sha);
        assertThat(visto.has("geradoPorNome")).isFalse();

        // Hash diferente do que ele viu: 409; nada é gravado.
        assertThat(api.post("/aluno/contratos/" + id + "/assinar", loginDoAluno, assinatura("0".repeat(64), nomeDoAluno, true), 409)
                .get("codigo").asString()).isEqualTo("CONTRATO_ALTERADO");
        // Aceite ausente ou falso e nome que não confere: 422 por campo.
        assertThat(campos(api.post("/aluno/contratos/" + id + "/assinar", loginDoAluno, assinatura(sha, nomeDoAluno, false), 422)))
                .containsExactly("aceite");
        assertThat(campos(api.post("/aluno/contratos/" + id + "/assinar", loginDoAluno, assinatura(sha, "Outra Pessoa", true), 422)))
                .containsExactly("nome");
        assertThat(contar("select count(*) from contrato_aluno where id = ?::uuid and situacao = 'PENDENTE'", id)).isEqualTo(1);

        // Nome com caixa e acento diferentes e espaços sobrando vale; o aparelho é cortado em 300 caracteres.
        String nomeDigitado = "  " + nomeDoAluno.toUpperCase(Locale.ROOT).replace("  ", " ") + "  ";
        var resposta = mvc.perform(MockMvcRequestBuilders.post("/aluno/contratos/" + id + "/assinar")
                        .header("Authorization", ApiDeTeste.bearer(loginDoAluno)).header("User-Agent", "A".repeat(400))
                        .contentType(MediaType.APPLICATION_JSON).content(api.paraJson(assinatura(sha, nomeDigitado, true))))
                .andExpect(status().isOk()).andReturn();
        JsonNode assinado = api.ler(resposta);
        assertThat(assinado.get("situacao").asString()).isEqualTo("ASSINADO");
        assertThat(assinado.get("assinatura").get("nome").asString()).isEqualTo(nomeDoAluno.toUpperCase(Locale.ROOT));

        var evidencias = jdbc.queryForMap("select assinante_nome, assinante_ip, length(assinante_agente) as agente, assinado_por_usuario_id,"
                + " assinante_cpf from contrato_aluno where id = ?::uuid", id);
        assertThat(evidencias.get("assinante_ip").toString()).isNotBlank();
        assertThat(evidencias.get("agente")).isEqualTo(300);
        assertThat(evidencias.get("assinado_por_usuario_id")).isNotNull();
        assertThat(evidencias.get("assinante_cpf")).isNull();

        // Assinar de novo: 200 sem regravar nem auditar de novo.
        String assinadoEm = jdbc.queryForObject("select assinado_em::text from contrato_aluno where id = ?::uuid", String.class, id);
        api.post("/aluno/contratos/" + id + "/assinar", loginDoAluno, assinatura(sha, nomeDoAluno, true), 200);
        assertThat(jdbc.queryForObject("select assinado_em::text from contrato_aluno where id = ?::uuid", String.class, id))
                .isEqualTo(assinadoEm);
        assertThat(contar("select count(*) from auditoria where acao = 'CONTRATO_ASSINADO' and entidade_id = ?::uuid", id)).isEqualTo(1);

        // A equipe vê as evidências; assinado não se cancela.
        JsonNode daEquipe = api.get("/contratos/" + id, admin, 200);
        assertThat(daEquipe.get("assinatura").get("nome").asString()).isEqualTo(nomeDoAluno.toUpperCase(Locale.ROOT));
        assertThat(api.post("/contratos/" + id + "/cancelar", admin, Map.of("motivo", "Teste", "versao", daEquipe.get("versao").asLong()), 409)
                .get("codigo").asString()).isEqualTo("CONTRATO_ASSINADO");
    }

    @Test
    void contratoCanceladoNaoApareceNemSeAssinaEOdeOutroAlunoOuConsultoriaE404() throws Exception {
        JsonNode modelo = modelo();
        JsonNode cancelado = gerar(modelo, 201);
        api.post("/contratos/" + cancelado.get("id").asString() + "/cancelar", admin,
                Map.of("motivo", "Gerado por engano", "versao", cancelado.get("versao").asLong()), 200);
        JsonNode pendente = gerar(modelo, 201);

        // O cancelado some para o aluno (lista e leitura 404) e, se alguém tentar assinar, também é 404.
        assertThat(api.get("/aluno/contratos", loginDoAluno, 200)).extracting(c -> c.get("id").asString())
                .containsExactly(pendente.get("id").asString());
        api.get("/aluno/contratos/" + cancelado.get("id").asString(), loginDoAluno, 404);
        api.post("/aluno/contratos/" + cancelado.get("id").asString() + "/assinar", loginDoAluno,
                assinatura(cancelado.get("sha256").asString(), nomeDoAluno, true), 404);

        // Outro aluno da mesma consultoria não vê nem assina o contrato deste aluno.
        UUID colega = api.criarAluno(admin, "Colega " + UUID.randomUUID());
        JsonNode loginDoColega = api.convidarEEntrar(admin, colega);
        api.get("/aluno/contratos/" + pendente.get("id").asString(), loginDoColega, 404);
        api.post("/aluno/contratos/" + pendente.get("id").asString() + "/assinar", loginDoColega,
                assinatura(pendente.get("sha256").asString(), "Colega", true), 404);
        assertThat(api.get("/aluno/contratos", loginDoColega, 200)).isEmpty();

        // Outra consultoria: a equipe e o aluno de lá recebem 404 em tudo.
        JsonNode outraEquipe = api.novoTreinador();
        UUID alunoDeLa = api.criarAluno(outraEquipe, "Aluno de Outra " + UUID.randomUUID());
        JsonNode loginDeLa = api.convidarEEntrar(outraEquipe, alunoDeLa);
        String id = pendente.get("id").asString();
        api.get("/contratos/" + id, outraEquipe, 404);
        api.get("/alunos/" + aluno + "/contratos", outraEquipe, 404);
        api.post("/contratos/" + id + "/cancelar", outraEquipe, Map.of("motivo", "x", "versao", 0), 404);
        api.post("/contratos/" + id + "/prorrogar", outraEquipe, Map.of("dias", 3, "versao", 0), 404);
        api.post("/alunos/" + aluno + "/contratos/previa", outraEquipe, Map.of("modeloId", modelo.get("id").asString()), 404);
        api.post("/alunos/" + aluno + "/contratos", outraEquipe, pedido(modelo, UUID.randomUUID()), 404);
        api.get("/aluno/contratos/" + id, loginDeLa, 404);
        api.post("/aluno/contratos/" + id + "/assinar", loginDeLa, assinatura(pendente.get("sha256").asString(), "Aluno de Outra", true), 404);
        assertThat(api.get("/contratos/modelos", outraEquipe, 200)).isEmpty();
        assertThat(contar("select count(*) from contrato_aluno where id = ?::uuid and situacao = 'PENDENTE'", id)).isEqualTo(1);
    }

    // ---- permissões ----

    @Test
    void semPermissaoE403AlunoNaoUsaRotaDaEquipeEEquipeNaoUsaRotaDoAluno() throws Exception {
        JsonNode modelo = modelo();
        JsonNode contrato = gerar(modelo, 201);
        String id = contrato.get("id").asString();
        JsonNode semNada = membro("Sem Contrato", Set.of("ALUNO_LER"));
        JsonNode soLeitura = membro("So Leitura", Set.of("ALUNO_LER", "ALUNO_SENSIVEL_LER", "CONTRATO_LER"));

        for (JsonNode quem : new JsonNode[]{semNada}) {
            api.get("/contratos/modelos", quem, 403);
            api.get("/alunos/" + aluno + "/contratos", quem, 403);
            api.get("/contratos/" + id, quem, 403);
        }
        api.get("/contratos/modelos", soLeitura, 200);
        api.get("/alunos/" + aluno + "/contratos", soLeitura, 200);
        api.get("/contratos/" + id, soLeitura, 200);
        api.post("/contratos/modelos", soLeitura, Map.of("nome", "Nao", "texto", "x"), 403);
        api.post("/alunos/" + aluno + "/contratos", soLeitura, pedido(modelo, UUID.randomUUID()), 403);
        api.post("/alunos/" + aluno + "/contratos/previa", soLeitura, Map.of("modeloId", modelo.get("id").asString()), 403);
        api.post("/contratos/" + id + "/cancelar", soLeitura, Map.of("motivo", "x", "versao", 0), 403);
        api.post("/contratos/" + id + "/prorrogar", soLeitura, Map.of("dias", 1, "versao", 0), 403);

        api.get("/contratos/" + id, loginDoAluno, 403);
        api.get("/alunos/" + aluno + "/contratos", loginDoAluno, 403);
        api.get("/aluno/contratos", admin, 403);
        api.get("/aluno/contratos", null, 401);
        api.get("/contratos/modelos", null, 401);
    }

    // ---- financeiro ----

    @Test
    void contratacaoExigeFinanceiroLerETemDeSerDoAluno() throws Exception {
        JsonNode modelo = modelo(admin, "Com plano " + UUID.randomUUID(), "{aluno_nome} no plano {plano}, desde {vigencia_inicio}.");
        String contratacao = contratar(admin, aluno);
        Map<String, Object> pedido = pedido(modelo, UUID.randomUUID());
        pedido.put("contratacaoId", contratacao);

        // Sem FINANCEIRO_LER o plano e as datas não entram, mesmo com CONTRATO_ALTERAR.
        JsonNode semFinanceiro = membro("Sem Financeiro", Set.of("ALUNO_LER", "ALUNO_SENSIVEL_LER", "CONTRATO_LER", "CONTRATO_ALTERAR"));
        api.post("/alunos/" + aluno + "/contratos", semFinanceiro, pedido, 403);
        api.post("/alunos/" + aluno + "/contratos/previa", semFinanceiro, pedido, 403);
        assertThat(contar("select count(*) from contrato_aluno where aluno_id = ?::uuid", aluno.toString())).isZero();

        // Com a permissão: preenche com o plano e o início; a contratação fica ligada.
        JsonNode criado = api.post("/alunos/" + aluno + "/contratos", admin, pedido, 201);
        assertThat(criado.get("texto").asString()).contains("desde " + HOJE.format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy")))
                .contains("no plano Plano do contrato").doesNotContain("{");
        assertThat(criado.get("contratacaoId").asString()).isEqualTo(contratacao);

        // Contratação de outro aluno: 404, nada gravado.
        UUID outro = api.criarAluno(admin, "Outro " + UUID.randomUUID());
        Map<String, Object> cruzado = pedido(modelo, UUID.randomUUID());
        cruzado.put("contratacaoId", contratar(admin, outro));
        api.post("/alunos/" + aluno + "/contratos", admin, cruzado, 404);

        // Contrato recorrente não tem valor total: o campo falta, com frase fixa.
        JsonNode comValor = modelo(admin, "Com valor " + UUID.randomUUID(), "Total {valor_total}");
        Map<String, Object> pedidoComValor = pedido(comValor, UUID.randomUUID());
        pedidoComValor.put("contratacaoId", contratacao);
        assertThat(campos(api.post("/alunos/" + aluno + "/contratos", admin, pedidoComValor, 422))).containsExactly("valor_total");
    }

    // ---- cancelar e prorrogar ----

    @Test
    void cancelarExigeMotivoEVersaoEProrrogarSoComPrazoEPendente() throws Exception {
        JsonNode modelo = modelo();
        // Sem prazo configurado, não há o que prorrogar.
        JsonNode semPrazo = gerar(modelo, 201);
        assertThat(semPrazo.get("prazoAte").isNull()).isTrue();
        assertThat(api.post("/contratos/" + semPrazo.get("id").asString() + "/prorrogar", admin,
                Map.of("dias", 3, "versao", semPrazo.get("versao").asLong()), 409).get("codigo").asString()).isEqualTo("CONTRATO_SEM_PRAZO");

        jdbc.update("update consultoria set contrato_prazo_dias = 2 where id = ?", consultoria);
        JsonNode comPrazo = gerar(modelo, 201);
        String id = comPrazo.get("id").asString();
        long versao = comPrazo.get("versao").asLong();

        assertThat(campos(api.post("/contratos/" + id + "/prorrogar", admin, Map.of("dias", 61, "versao", versao), 422))).containsExactly("dias");
        JsonNode prorrogado = api.post("/contratos/" + id + "/prorrogar", admin, Map.of("dias", 10, "versao", versao), 200);
        assertThat(java.time.Instant.parse(prorrogado.get("prazoAte").asString()))
                .isAfter(java.time.Instant.parse(comPrazo.get("prazoAte").asString()).plus(java.time.Duration.ofDays(9)));
        // Versão velha: 409.
        assertThat(api.post("/contratos/" + id + "/prorrogar", admin, Map.of("dias", 1, "versao", versao), 409).get("codigo").asString())
                .isEqualTo("CONFLITO_EDICAO");

        // Cancelar: motivo obrigatório (422), depois 200; cancelar de novo é 200 sem auditar; prorrogar o cancelado é 409.
        long atual = prorrogado.get("versao").asLong();
        assertThat(campos(api.post("/contratos/" + id + "/cancelar", admin, Map.of("motivo", "  ", "versao", atual), 422))).containsExactly("motivo");
        JsonNode cancelado = api.post("/contratos/" + id + "/cancelar", admin, Map.of("motivo", "Valor errado", "versao", atual), 200);
        assertThat(cancelado.get("situacao").asString()).isEqualTo("CANCELADO");
        api.post("/contratos/" + id + "/cancelar", admin, Map.of("motivo", "Valor errado", "versao", atual), 200);
        assertThat(contar("select count(*) from auditoria where acao = 'CONTRATO_CANCELADO' and entidade_id = ?::uuid", id)).isEqualTo(1);
        assertThat(api.post("/contratos/" + id + "/prorrogar", admin, Map.of("dias", 1, "versao", cancelado.get("versao").asLong()), 409)
                .get("codigo").asString()).isEqualTo("CONTRATO_NAO_PENDENTE");
    }

    // ---- LGPD ----

    @Test
    void exportacaoLevaOsContratosEAnonimizacaoApagaOPendenteEMantemOAssinado() throws Exception {
        JsonNode modelo = modelo();
        JsonNode assinado = gerar(modelo, 201);
        api.post("/aluno/contratos/" + assinado.get("id").asString() + "/assinar", loginDoAluno,
                assinatura(assinado.get("sha256").asString(), nomeDoAluno, true), 200);
        JsonNode pendente = gerar(modelo, 201);
        JsonNode cancelado = gerar(modelo, 201);
        api.post("/contratos/" + cancelado.get("id").asString() + "/cancelar", admin,
                Map.of("motivo", "Teste", "versao", cancelado.get("versao").asLong()), 200);

        JsonNode exportacao = api.get("/alunos/" + aluno + "/exportacao", admin, 200);
        assertThat(exportacao.get("contratos").get("itens")).hasSize(3);
        assertThat(exportacao.get("secoesOmitidas").toString()).doesNotContain("contratos");
        // Sem CONTRATO_LER a seção sai omitida (a exportação segue com o resto).
        JsonNode semContrato = membro("Exporta Sem Contrato", Set.of("ALUNO_LER", "ALUNO_EXPORTAR", "ALUNO_SENSIVEL_LER"));
        JsonNode omitida = api.get("/alunos/" + aluno + "/exportacao", semContrato, 200);
        assertThat(omitida.get("secoesOmitidas").toString()).contains("contratos");
        assertThat(omitida.path("contratos").isMissingNode() || omitida.path("contratos").isNull()).isTrue();

        api.patch("/alunos/" + aluno + "/situacao", admin, Map.of("ativo", false), 200);
        api.post("/alunos/" + aluno + "/anonimizar", admin, Map.of("nomeConfirmado", nomeDoAluno), 200);

        // Pendente e cancelado saem; o assinado fica, com o texto e as evidências (D16).
        assertThat(contar("select count(*) from contrato_aluno where id in (?::uuid, ?::uuid)",
                pendente.get("id").asString(), cancelado.get("id").asString())).isZero();
        assertThat(contar("select count(*) from contrato_aluno where id = ?::uuid and situacao = 'ASSINADO' and texto is not null",
                assinado.get("id").asString())).isEqualTo(1);
    }

    @Test
    void excluirMinhaContaApagaOPendenteEMantemOAssinado() throws Exception {
        JsonNode modelo = modelo();
        JsonNode assinado = gerar(modelo, 201);
        api.post("/aluno/contratos/" + assinado.get("id").asString() + "/assinar", loginDoAluno,
                assinatura(assinado.get("sha256").asString(), nomeDoAluno, true), 200);
        JsonNode pendente = gerar(modelo, 201);

        api.post("/aluno/conta/excluir", loginDoAluno, Map.of("senha", ApiDeTeste.SENHA, "confirmacao", "EXCLUIR"), 204);

        assertThat(contar("select count(*) from contrato_aluno where id = ?::uuid", pendente.get("id").asString())).isZero();
        assertThat(contar("select count(*) from contrato_aluno where id = ?::uuid and situacao = 'ASSINADO'", assinado.get("id").asString()))
                .isEqualTo(1);
    }

    // ---- nada vaza ----

    @Test
    void nenhumDadoDoContratoVaiAoLogNemAAuditoria() throws Exception {
        JsonNode criado = gerar(modelo(), 201);
        String id = criado.get("id").asString();
        api.post("/aluno/contratos/" + id + "/assinar", loginDoAluno, assinatura(criado.get("sha256").asString(), "Nome Errado", true), 422);
        api.post("/aluno/contratos/" + id + "/assinar", loginDoAluno, assinatura(criado.get("sha256").asString(), nomeDoAluno, true), 200);
        JsonNode outro = gerar(modelo(), 201);
        api.post("/contratos/" + outro.get("id").asString() + "/cancelar", admin,
                Map.of("motivo", "Motivo sigiloso do cancelamento", "versao", outro.get("versao").asLong()), 200);

        String auditoria = jdbc.queryForObject("select coalesce(string_agg(coalesce(acao,'') || ' ' || coalesce(resumo,'') || ' ' || "
                + "coalesce(entidade,''), ' '), '') from auditoria where consultoria_id = ?", String.class, consultoria);
        String logado = String.join("\n", log.list.stream().map(ILoggingEvent::getFormattedMessage).toList());
        String ip = jdbc.queryForObject("select assinante_ip from contrato_aluno where id = ?::uuid", String.class, id);
        for (String segredo : new String[]{FRASE_SIGILOSA, nomeDoAluno, cpfDoAluno, "Motivo sigiloso", criado.get("sha256").asString()}) {
            assertThat(auditoria).as("auditoria").doesNotContain(segredo);
            assertThat(logado).as("log").doesNotContain(segredo);
        }
        assertThat(auditoria).doesNotContain(ip.length() > 6 ? ip : "sem-ip-longo");
    }
}
