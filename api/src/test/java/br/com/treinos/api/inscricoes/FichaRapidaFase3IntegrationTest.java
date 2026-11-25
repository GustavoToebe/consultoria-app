package br.com.treinos.api.inscricoes;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.conta.ContaLocalRepositorio;
import br.com.treinos.api.conta.DireitosLocais;
import br.com.treinos.api.web.Fuso;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Fase 3 (docs/planos/ficha-rapida-pos-whatsapp.md): múltiplos links públicos de inscrição (incluindo ficha rápida
 * pós-WhatsApp acessível para Assistente sem {@code QUESTIONARIO_LER}), aceite exigindo pagamento confirmado ou cortesia
 * explícita ({@code semCobranca = true}), indicadores separados ({@code aguardandoPagamento}, {@code pagaram},
 * {@code cortesias}), limite de alunos mantido na cortesia e isolamento multi-tenant. Só dados fictícios.
 */
@AutoConfigureMockMvc
@TestPropertySource(properties = "treinos.plano.aplicar=true")
class FichaRapidaFase3IntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate banco;
    @Autowired private ContaLocalRepositorio contas;

    private ApiDeTeste api;
    private JsonNode admin;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
    }

    private static String usuarioId(JsonNode login) {
        return login.path("usuario").path("id").asString();
    }

    private UUID consultoriaDe(JsonNode login) {
        return banco.queryForObject("select consultoria_id from usuario where id = ?::uuid", UUID.class, usuarioId(login));
    }

    private void perfil(JsonNode login, String nome) {
        banco.update("update usuario u set perfil_id = p.id from perfil p where u.id = ?::uuid "
                + "and p.consultoria_id = u.consultoria_id and p.nome = ?", usuarioId(login), nome);
    }

    private String abrirLinkPadrao(JsonNode login) throws Exception {
        JsonNode atual = api.get("/inscricoes/configuracao", login, 200);
        Map<String, Object> corpo = new HashMap<>();
        corpo.put("aberta", true);
        corpo.put("versao", atual.path("versao").isNull() ? null : atual.path("versao").asLong());
        return api.put("/inscricoes/configuracao", login, corpo, 200).path("codigo").asString();
    }

    private String inscreverNoLink(String codigo, String nome, String whatsapp, String email,
                                   String versaoId, Map<String, Object> respostas) throws Exception {
        Map<String, Object> corpo = new HashMap<>();
        corpo.put("nome", nome);
        corpo.put("whatsapp", whatsapp);
        if (email != null) corpo.put("email", email);
        if (versaoId != null) corpo.put("questionarioVersaoId", versaoId);
        if (respostas != null) corpo.put("respostas", respostas);
        api.post("/publico/inscricoes/" + codigo, null, corpo, 202);
        return api.get("/inscricoes?situacao=TODAS&busca=" + whatsapp, admin, 200)
                .path("itens").get(0).path("id").asString();
    }

    private long versao(String id) throws Exception {
        return api.get("/inscricoes/" + id, admin, 200).path("versao").asLong();
    }

    private long alunos(UUID consultoria) {
        Long total = banco.queryForObject("select count(*) from aluno where consultoria_id = ?", Long.class, consultoria);
        return total == null ? 0 : total;
    }

    @Test
    void listarLinksECriarFichaRapidaComSubmissaoPublicaEContagensPorQuestionario() throws Exception {
        UUID consultoria = consultoriaDe(admin);
        String codigoPadrao = abrirLinkPadrao(admin);

        // Cria ficha rápida sem corpo (nome padrão "Ficha rápida") e uma segunda para testar desambiguação de nome.
        JsonNode ficha1 = api.post("/inscricoes/links/ficha-rapida", admin, null, 201);
        assertThat(ficha1.path("nome").asString()).isEqualTo("Ficha rápida");
        assertThat(ficha1.path("padrao").asBoolean()).isFalse();
        assertThat(ficha1.path("aberta").asBoolean()).isTrue();
        assertThat(ficha1.path("codigo").asString()).hasSize(24);
        assertThat(ficha1.path("link").asString()).endsWith("/inscricao/" + ficha1.path("codigo").asString());
        assertThat(ficha1.path("camposOcultos").valueStream().map(JsonNode::asString))
                .containsExactlyInAnyOrder("SEXO", "OBJETIVO", "INTERESSE", "MODALIDADE", "PREVISAO_INICIO", "ORIGEM");

        JsonNode ficha2 = api.post("/inscricoes/links/ficha-rapida", admin, Map.of(), 201);
        assertThat(ficha2.path("nome").asString()).isEqualTo("Ficha rápida 2");

        // Auditoria de criação com resumo fixo.
        List<String> resumos = banco.queryForList(
                "select resumo from auditoria where consultoria_id = ? and acao = 'INSCRICAO_FICHA_RAPIDA_CRIADA' and entidade = 'QUESTIONARIO'",
                String.class, consultoria);
        assertThat(resumos).hasSize(2).containsOnly("Criou um formulário de ficha rápida de inscrição.");

        // GET /inscricoes/links: padrão primeiro, depois por nome asc.
        JsonNode links = api.get("/inscricoes/links", admin, 200);
        assertThat(links).hasSize(3);
        assertThat(links.get(0).path("padrao").asBoolean()).isTrue();
        assertThat(links.get(1).path("nome").asString()).isEqualTo("Ficha rápida");
        assertThat(links.get(2).path("nome").asString()).isEqualTo("Ficha rápida 2");

        // Assistente acessa GET /inscricoes/links; perfil só com INSCRICAO_LER (sem QUESTIONARIO_LER) leva 403 em /questionarios mas 200 em /inscricoes/links.
        perfil(admin, "Assistente");
        assertThat(api.get("/inscricoes/links", admin, 200)).hasSize(3);
        perfil(admin, "Administrador");
        String perfilSoInscricao = api.post("/perfis", admin, Map.of("nome", "Só Inscrição " + UUID.randomUUID(),
                "permissoes", List.of("INSCRICAO_LER")), 200).path("id").asString();
        banco.update("update usuario set perfil_id = ?::uuid where id = ?::uuid", perfilSoInscricao, usuarioId(admin));
        api.get("/questionarios?finalidade=INSCRICAO", admin, 403);
        assertThat(api.get("/inscricoes/links", admin, 200)).hasSize(3);

        // Nutricionista não tem PERM_INSCRICAO_LER: 403.
        perfil(admin, "Nutricionista");
        api.get("/inscricoes/links", admin, 403);
        api.post("/inscricoes/links/ficha-rapida", admin, null, 403);
        perfil(admin, "Administrador");

        // Página pública da ficha rápida mostra apenas EMAIL nos campos fixos e a pergunta única de plano combinado.
        String codigoFicha = ficha1.path("codigo").asString();
        JsonNode pagina = api.get("/publico/inscricoes/" + codigoFicha, null, 200);
        assertThat(pagina.path("aberta").asBoolean()).isTrue();
        assertThat(pagina.path("campos").valueStream().map(JsonNode::asString)).containsExactly("EMAIL");
        JsonNode secao = pagina.path("perguntas").path("conteudo").path("secoes").get(0);
        assertThat(secao.path("titulo").asString()).isEqualTo("Plano combinado");
        JsonNode pergunta = secao.path("perguntas").get(0);
        assertThat(pergunta.path("id").asString()).isEqualTo("plano_combinado");
        assertThat(pergunta.path("tipo").asString()).isEqualTo("TEXTO");
        assertThat(pergunta.path("rotulo").asString()).isEqualTo("Qual plano combinou?");
        assertThat(pergunta.path("obrigatoria").asBoolean()).isFalse();

        // Submissão pública no segundo link e no link padrão, e filtro por questionarioId em /contagens.
        String versaoFicha = pagina.path("perguntas").path("versaoId").asString();
        String idFicha = inscreverNoLink(codigoFicha, "Lead Ficha Rápida", "11987650101",
                ApiDeTeste.emailUnico("ficha"), versaoFicha, Map.of("plano_combinado", "Trimestral online"));
        inscreverNoLink(codigoPadrao, "Lead Padrão", "11987650102", ApiDeTeste.emailUnico("padrao"), null, null);

        JsonNode detalheFicha = api.get("/inscricoes/" + idFicha, admin, 200);
        assertThat(detalheFicha.path("questionarioId").asString()).isEqualTo(ficha1.path("id").asString());
        assertThat(detalheFicha.path("respostas").path("respostas").path("plano_combinado").asString())
                .isEqualTo("Trimestral online");

        JsonNode contagensFicha = api.get("/inscricoes/contagens?questionarioId=" + ficha1.path("id").asString(), admin, 200);
        assertThat(contagensFicha.path("todas").asLong()).isEqualTo(1);
        assertThat(contagensFicha.path("abertas").asLong()).isEqualTo(1);
        assertThat(api.get("/inscricoes/contagens", admin, 200).path("todas").asLong()).isEqualTo(2);
    }

    @Test
    void aceiteExigePagamentoConfirmadoOuCortesiaComAuditoriaELimiteDoPlano() throws Exception {
        UUID consultoria = consultoriaDe(admin);
        String codigo = abrirLinkPadrao(admin);
        String idPago = inscreverNoLink(codigo, "Lead Pagante Fictício", "11987650201",
                ApiDeTeste.emailUnico("pagante"), null, null);
        long alunosAntes = alunos(consultoria);

        // 1. Sem pagamento confirmado e sem cortesia: 409 PAGAMENTO_NAO_CONFIRMADO.
        JsonNode bloqueio = api.post("/inscricoes/" + idPago + "/aceitar", admin,
                Map.of("convidar", false, "versao", versao(idPago)), 409);
        assertThat(bloqueio.path("codigo").asString()).isEqualTo("PAGAMENTO_NAO_CONFIRMADO");
        assertThat(alunos(consultoria)).isEqualTo(alunosAntes);
        assertThat(api.get("/inscricoes/" + idPago, admin, 200).path("situacao").asString()).isEqualTo("NOVA");

        // 2. Confirmar pagamento manual -> tentar aceitar como cortesia é 409 PAGAMENTO_JA_CONFIRMADO.
        JsonNode confirmada = api.put("/inscricoes/" + idPago, admin,
                Map.of("situacao", "NOVA", "pagamento", "CONFIRMADO_MANUAL", "versao", versao(idPago)), 200);
        JsonNode jaPago = api.post("/inscricoes/" + idPago + "/aceitar", admin,
                Map.of("convidar", false, "versao", confirmada.path("versao").asLong(), "semCobranca", true), 409);
        assertThat(jaPago.path("codigo").asString()).isEqualTo("PAGAMENTO_JA_CONFIRMADO");
        assertThat(alunos(consultoria)).isEqualTo(alunosAntes);

        // 3. Aceite normal (pago) passa e audita INSCRICAO_ACEITA.
        JsonNode aceitePago = api.post("/inscricoes/" + idPago + "/aceitar", admin,
                Map.of("convidar", false, "versao", confirmada.path("versao").asLong()), 200);
        assertThat(aceitePago.path("aceitaSemCobranca").asBoolean()).isFalse();
        JsonNode detalhePago = api.get("/inscricoes/" + idPago, admin, 200);
        assertThat(detalhePago.path("aceitaSemCobranca").asBoolean()).isFalse();
        assertThat(detalhePago.path("eventos").get(0).path("tipo").asString()).isEqualTo("ACEITA");
        assertThat(detalhePago.path("eventos").get(0).path("detalhe").isNull()).isTrue();
        assertThat(banco.queryForObject(
                "select count(*) from auditoria where consultoria_id = ? and acao = 'INSCRICAO_ACEITA'",
                Long.class, consultoria)).isEqualTo(1);

        // 4. Aceite com semCobranca = true (cortesia) passa com pagamento AGUARDANDO e audita INSCRICAO_ACEITA_SEM_COBRANCA.
        String idCortesia = inscreverNoLink(codigo, "Lead Cortesia Fictício", "11987650202",
                ApiDeTeste.emailUnico("cortesia"), null, null);
        JsonNode aguardando = api.put("/inscricoes/" + idCortesia, admin,
                Map.of("situacao", "EM_NEGOCIACAO", "pagamento", "AGUARDANDO", "versao", versao(idCortesia)), 200);
        JsonNode aceiteCortesia = api.post("/inscricoes/" + idCortesia + "/aceitar", admin,
                Map.of("convidar", false, "versao", aguardando.path("versao").asLong(), "semCobranca", true), 200);
        assertThat(aceiteCortesia.path("aceitaSemCobranca").asBoolean()).isTrue();
        JsonNode detalheCortesia = api.get("/inscricoes/" + idCortesia, admin, 200);
        assertThat(detalheCortesia.path("aceitaSemCobranca").asBoolean()).isTrue();
        assertThat(detalheCortesia.path("eventos").get(0).path("tipo").asString()).isEqualTo("ACEITA");
        assertThat(detalheCortesia.path("eventos").get(0).path("detalhe").asString())
                .isEqualTo("Aceita sem cobrança (cortesia)");
        List<String> auditoriasCortesia = banco.queryForList(
                "select resumo from auditoria where consultoria_id = ? and acao = 'INSCRICAO_ACEITA_SEM_COBRANCA'",
                String.class, consultoria);
        assertThat(auditoriasCortesia).containsExactly("Aceitou uma inscrição sem cobrança (cortesia) e cadastrou o aluno.");

        // 5. Respeito ao LIMITE_DO_PLANO também na cortesia (D4).
        long ativosAgora = alunos(consultoria);
        contas.gravarDireitos(new DireitosLocais(consultoria, UUID.randomUUID(), 1, "ATIVA", true, null, null, "PAGO",
                "Pago", Map.of("alunos_ativos", ativosAgora), List.of("MOBILIDADE", "PDF", "EQUIPE"), Instant.now()));
        String idSemVaga = inscreverNoLink(codigo, "Lead Sem Vaga Fictício", "11987650203",
                ApiDeTeste.emailUnico("sem-vaga"), null, null);
        JsonNode limite = api.post("/inscricoes/" + idSemVaga + "/aceitar", admin,
                Map.of("convidar", false, "versao", versao(idSemVaga), "semCobranca", true), 409);
        assertThat(limite.path("codigo").asString()).isEqualTo("LIMITE_DO_PLANO");
        assertThat(alunos(consultoria)).isEqualTo(ativosAgora);
    }

    @Test
    void indicadoresSeparamAguardandoPagamentoPagaramCortesiasEAceitesComIsolamentoMultiTenant() throws Exception {
        String codigo = abrirLinkPadrao(admin);

        // 1: paga e aceita
        String id1 = inscreverNoLink(codigo, "Lead 1 Pago e Aceito", "11987650301", null, null, null);
        long v1 = api.put("/inscricoes/" + id1, admin,
                Map.of("situacao", "EM_CONTATO", "pagamento", "CONFIRMADO_MANUAL", "versao", versao(id1)), 200)
                .path("versao").asLong();
        api.post("/inscricoes/" + id1 + "/aceitar", admin, Map.of("convidar", false, "versao", v1), 200);

        // 2: paga mas ainda não aceita (conta em pagaram, não em aceites)
        String id2 = inscreverNoLink(codigo, "Lead 2 Pago Pendente", "11987650302", null, null, null);
        api.put("/inscricoes/" + id2, admin,
                Map.of("situacao", "EM_NEGOCIACAO", "pagamento", "CONFIRMADO_MANUAL", "versao", versao(id2)), 200);

        // 3: aberta aguardando pagamento (conta em aguardandoPagamento)
        String id3 = inscreverNoLink(codigo, "Lead 3 Aguardando", "11987650303", null, null, null);
        api.put("/inscricoes/" + id3, admin,
                Map.of("situacao", "EM_CONTATO", "pagamento", "AGUARDANDO", "versao", versao(id3)), 200);

        // 4: encerrada com pagamento AGUARDANDO (NÃO conta em aguardandoPagamento)
        String id4 = inscreverNoLink(codigo, "Lead 4 Desistiu", "11987650304", null, null, null);
        long v4 = api.put("/inscricoes/" + id4, admin,
                Map.of("situacao", "EM_CONTATO", "pagamento", "AGUARDANDO", "versao", versao(id4)), 200)
                .path("versao").asLong();
        api.post("/inscricoes/" + id4 + "/encerrar", admin,
                Map.of("situacao", "DESISTIU", "motivo", "PRECO", "versao", v4), 200);

        // 5: aceita como cortesia (conta em aceites e cortesias, não em pagaram)
        String id5 = inscreverNoLink(codigo, "Lead 5 Cortesia", "11987650305", null, null, null);
        api.post("/inscricoes/" + id5 + "/aceitar", admin,
                Map.of("convidar", false, "versao", versao(id5), "semCobranca", true), 200);

        String de = LocalDate.now(Fuso.BRASILIA).minusDays(1).toString();
        String ate = LocalDate.now(Fuso.BRASILIA).toString();
        JsonNode ind = api.get("/inscricoes/indicadores?de=" + de + "&ate=" + ate, admin, 200);
        assertThat(ind.path("entradas").asLong()).isEqualTo(5);
        assertThat(ind.path("aguardandoPagamento").asLong()).isEqualTo(1);
        assertThat(ind.path("pagaram").asLong()).isEqualTo(2);
        assertThat(ind.path("cortesias").asLong()).isEqualTo(1);
        assertThat(ind.path("aceites").asLong()).isEqualTo(2);

        // Isolamento multi-tenant: outra consultoria não vê links nem indicadores da primeira.
        JsonNode outro = api.novoTreinador();
        api.post("/inscricoes/links/ficha-rapida", admin, Map.of("nome", "Ficha Exclusiva A"), 201);
        List<String> nomesOutro = new ArrayList<>();
        api.get("/inscricoes/links", outro, 200).forEach(n -> nomesOutro.add(n.path("nome").asString()));
        assertThat(nomesOutro).doesNotContain("Ficha Exclusiva A");

        JsonNode indOutro = api.get("/inscricoes/indicadores?de=" + de + "&ate=" + ate, outro, 200);
        assertThat(indOutro.path("entradas").asLong()).isZero();
        assertThat(indOutro.path("aguardandoPagamento").asLong()).isZero();
        assertThat(indOutro.path("pagaram").asLong()).isZero();
        assertThat(indOutro.path("cortesias").asLong()).isZero();
        assertThat(indOutro.path("aceites").asLong()).isZero();
    }
}
