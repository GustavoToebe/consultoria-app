package br.com.treinos.api.inscricoes;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.conta.ContaLocalRepositorio;
import br.com.treinos.api.conta.DireitosLocais;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Inscrição por link e fila de interessados (Fase A): CA01 (links de consultorias diferentes não se cruzam), CA02
 * (inscrição sem conta, resposta neutra), CA05 (aceite repetido não cria outro aluno), CA19/CA20 (aceite sem pagamento),
 * isolamento (404), permissões dos perfis padrão, aceite com e sem convite, aluno com o mesmo e-mail, plano aplicado,
 * retenção de 180 dias e anonimização. O plano aplicado fica ligado na classe toda: sem linha de direitos nada é barrado.
 * Só dados fictícios.
 */
@AutoConfigureMockMvc
@TestPropertySource(properties = "treinos.plano.aplicar=true")
class InscricoesIntegrationTest extends AbstractIntegrationTest {

    private static final String WHATSAPP = "(11) 98765-4321";

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate banco;
    @Autowired private InscricaoRetencao retencao;
    @Autowired private ContaLocalRepositorio contas;

    private ApiDeTeste api;
    private JsonNode admin;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
    }

    // ---- auxiliares ----

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

    /** Liga o link (com responsável padrão e texto opcionais) e devolve a configuração. */
    private JsonNode abrirLink(JsonNode login, String responsavelId, String texto) throws Exception {
        JsonNode atual = api.get("/inscricoes/configuracao", login, 200);
        Map<String, Object> corpo = new HashMap<>();
        corpo.put("aberta", true);
        corpo.put("responsavelId", responsavelId);
        corpo.put("texto", texto);
        corpo.put("versao", atual.path("versao").isNull() ? null : atual.path("versao").asLong());
        return api.put("/inscricoes/configuracao", login, corpo, 200);
    }

    private static Map<String, Object> inscricao(String nome, String email) {
        Map<String, Object> corpo = new HashMap<>();
        corpo.put("nome", nome);
        corpo.put("whatsapp", "11987654321");
        corpo.put("email", email);
        corpo.put("objetivo", "Objetivo fictício");
        corpo.put("observacao", "Observação fictícia");
        return corpo;
    }

    private JsonNode inscrever(String codigo, Map<String, Object> corpo, int status) throws Exception {
        return api.post("/publico/inscricoes/" + codigo, null, corpo, status);
    }

    private JsonNode unica(JsonNode login) throws Exception {
        JsonNode lista = api.get("/inscricoes", login, 200);
        assertThat(lista.path("total").asLong()).isEqualTo(1);
        return lista.path("itens").get(0);
    }

    private long alunos(UUID consultoria) {
        Long total = banco.queryForObject("select count(*) from aluno where consultoria_id = ?", Long.class, consultoria);
        return total == null ? 0 : total;
    }

    // ---- CA01 e CA02 ----

    @Test
    void cadaLinkLevaAInscricaoParaAConsultoriaEOResponsavelCertosSemCruzar() throws Exception {
        JsonNode outro = api.novoTreinador();
        String codigoA = abrirLink(admin, usuarioId(admin), null).path("codigo").asString();
        String codigoB = abrirLink(outro, null, null).path("codigo").asString();
        assertThat(codigoA).hasSize(24).matches("[A-Za-z0-9_-]{24}").isNotEqualTo(codigoB);

        JsonNode recebida = inscrever(codigoA, inscricao("Interessada Fictícia A", "a-" + UUID.randomUUID() + "@teste.local"), 202);
        // CA02: resposta neutra, sem dado nenhum da inscrição nem da fila.
        assertThat(recebida.propertyNames()).containsExactly("mensagem");
        assertThat(recebida.toString()).doesNotContain("Fictícia");
        inscrever(codigoB, inscricao("Interessado Fictício B", null), 202);

        JsonNode daA = unica(admin);
        assertThat(daA.path("nome").asString()).isEqualTo("Interessada Fictícia A");
        assertThat(daA.path("whatsapp").asString()).isEqualTo(WHATSAPP);
        assertThat(daA.path("situacao").asString()).isEqualTo("NOVA");
        assertThat(daA.path("pagamento").asString()).isEqualTo("NAO_CONTROLADO");
        assertThat(daA.path("responsavelId").asString()).isEqualTo(usuarioId(admin));
        JsonNode daB = unica(outro);
        assertThat(daB.path("nome").asString()).isEqualTo("Interessado Fictício B");
        assertThat(daB.path("responsavelId").isNull()).isTrue();

        // Isolamento: a inscrição de uma consultoria não existe para a outra.
        api.get("/inscricoes/" + daA.path("id").asString(), outro, 404);
        api.put("/inscricoes/" + daA.path("id").asString(), outro,
                Map.of("situacao", "EM_CONTATO", "pagamento", "NAO_CONTROLADO", "versao", 0), 404);
        api.post("/inscricoes/" + daA.path("id").asString() + "/aceitar", outro, Map.of("convidar", false, "versao", 0), 404);
        api.post("/inscricoes/" + daA.path("id").asString() + "/notas", outro, Map.of("texto", "Nota fictícia"), 404);
    }

    @Test
    void paginaPublicaMostraAMarcaEOTextoEFechadoOuDesconhecidoDa404() throws Exception {
        String texto = "Texto fictício de privacidade da consultoria.";
        JsonNode config = abrirLink(admin, null, texto);
        String codigo = config.path("codigo").asString();
        assertThat(config.path("link").asString()).endsWith("/inscricao/" + codigo);

        JsonNode pagina = api.get("/publico/inscricoes/" + codigo, null, 200);
        assertThat(pagina.path("aberta").asBoolean()).isTrue();
        assertThat(pagina.path("texto").asString()).isEqualTo(texto);
        assertThat(pagina.path("consultoria").path("nome").asString()).startsWith("Consultoria ");
        // Só a marca e o texto: nada da fila nem da equipe.
        assertThat(pagina.propertyNames()).containsExactlyInAnyOrder("consultoria", "texto", "aberta");
        assertThat(pagina.path("consultoria").propertyNames()).containsExactlyInAnyOrder("id", "nome", "corPrimaria",
                "fonteTitulo", "temaPadrao", "logoUrl");

        // Com texto, a ciência é obrigatória; telefone sem DDD é recusado.
        assertThat(inscrever(codigo, inscricao("Pessoa Fictícia", null), 400).path("codigo").asString())
                .isEqualTo("CIENCIA_OBRIGATORIA");
        Map<String, Object> semDdd = inscricao("Pessoa Fictícia", null);
        semDdd.put("cienciaPrivacidade", true);
        semDdd.put("whatsapp", "98765-4321");
        inscrever(codigo, semDdd, 400);
        Map<String, Object> ok = inscricao("Pessoa Fictícia", null);
        ok.put("cienciaPrivacidade", true);
        inscrever(codigo, ok, 202);
        JsonNode detalhe = api.get("/inscricoes/" + unica(admin).path("id").asString(), admin, 200);
        assertThat(detalhe.path("cienciaTexto").asString()).isEqualTo(texto);
        assertThat(detalhe.path("cienciaEm").isNull()).isFalse();

        // Código desconhecido, fora do formato ou link desligado: o mesmo 404.
        api.get("/publico/inscricoes/" + "A".repeat(24), null, 404);
        api.get("/publico/inscricoes/curto", null, 404);
        inscrever("A".repeat(24), ok, 404);
        api.put("/inscricoes/configuracao", admin,
                Map.of("aberta", false, "versao", api.get("/inscricoes/configuracao", admin, 200).path("versao").asLong()), 200);
        api.get("/publico/inscricoes/" + codigo, null, 404);
        inscrever(codigo, ok, 404);
    }

    @Test
    void gerarNovoLinkRevogaOAnterior() throws Exception {
        JsonNode config = abrirLink(admin, null, null);
        String antigo = config.path("codigo").asString();
        JsonNode novo = api.post("/inscricoes/configuracao/novo-link", admin,
                Map.of("versao", config.path("versao").asLong()), 200);
        String codigo = novo.path("codigo").asString();
        assertThat(codigo).isNotEqualTo(antigo);
        assertThat(novo.path("aberta").asBoolean()).isTrue();
        api.get("/publico/inscricoes/" + antigo, null, 404);
        api.get("/publico/inscricoes/" + codigo, null, 200);
        // Versão velha: 409, nada muda.
        assertThat(api.post("/inscricoes/configuracao/novo-link", admin,
                Map.of("versao", config.path("versao").asLong()), 409).path("codigo").asString()).isEqualTo("CONFLITO_EDICAO");
        api.get("/publico/inscricoes/" + codigo, null, 200);
    }

    // ---- permissões ----

    @Test
    void perfisPadraoTreinadorEAssistenteAtendemENutricionistaNao() throws Exception {
        UUID consultoria = consultoriaDe(admin);
        List<String> treinador = permissoes(consultoria, "Treinador");
        List<String> assistente = permissoes(consultoria, "Assistente");
        assertThat(treinador).contains("INSCRICAO_LER", "INSCRICAO_ALTERAR");
        assertThat(assistente).contains("INSCRICAO_LER", "INSCRICAO_ALTERAR");
        assertThat(permissoes(consultoria, "Nutricionista")).doesNotContain("INSCRICAO_LER", "INSCRICAO_ALTERAR");

        String codigo = abrirLink(admin, null, null).path("codigo").asString();
        inscrever(codigo, inscricao("Pessoa Fictícia", null), 202);
        String id = unica(admin).path("id").asString();

        perfil(admin, "Nutricionista");
        api.get("/inscricoes", admin, 403);
        api.get("/inscricoes/" + id, admin, 403);
        api.get("/inscricoes/configuracao", admin, 403);
        api.post("/inscricoes/" + id + "/recusar", admin, Map.of("versao", 0), 403);

        perfil(admin, "Assistente");
        JsonNode detalhe = api.get("/inscricoes/" + id, admin, 200);
        api.get("/responsaveis", admin, 200);
        api.put("/inscricoes/" + id, admin, Map.of("situacao", "EM_CONTATO", "pagamento", "AGUARDANDO",
                "versao", detalhe.path("versao").asLong()), 200);
    }

    private List<String> permissoes(UUID consultoria, String perfil) {
        return banco.queryForList("select pp.codigo from perfil_permissao pp join perfil p on p.id = pp.perfil_id"
                + " where p.consultoria_id = ? and p.nome = ?", String.class, consultoria, perfil);
    }

    // ---- andamento, notas e recusa ----

    @Test
    void andamentoComVersaoPagamentoManualNotasERecusa() throws Exception {
        String codigo = abrirLink(admin, null, null).path("codigo").asString();
        inscrever(codigo, inscricao("Pessoa Fictícia", null), 202);
        String id = unica(admin).path("id").asString();
        JsonNode detalhe = api.get("/inscricoes/" + id, admin, 200);
        long versao = detalhe.path("versao").asLong();

        JsonNode alterada = api.put("/inscricoes/" + id, admin, Map.of("situacao", "EM_NEGOCIACAO",
                "pagamento", "CONFIRMADO_MANUAL", "responsavelId", usuarioId(admin), "versao", versao), 200);
        assertThat(alterada.path("situacao").asString()).isEqualTo("EM_NEGOCIACAO");
        assertThat(alterada.path("pagamentoConfirmadoPorNome").asString()).isEqualTo("Treinador Teste");
        assertThat(alterada.path("pagamentoConfirmadoEm").isNull()).isFalse();
        assertThat(alterada.path("responsavelNome").asString()).isEqualTo("Treinador Teste");
        // Versão velha: 409.
        assertThat(api.put("/inscricoes/" + id, admin, Map.of("situacao", "EM_CONTATO", "pagamento", "AGUARDANDO",
                "versao", versao), 409).path("codigo").asString()).isEqualTo("CONFLITO_EDICAO");
        long atual = alterada.path("versao").asLong();
        // ACEITA e RECUSADA têm rota própria.
        api.put("/inscricoes/" + id, admin, Map.of("situacao", "ACEITA", "pagamento", "AGUARDANDO", "versao", atual), 400);
        api.put("/inscricoes/" + id, admin, Map.of("situacao", "RECUSADA", "pagamento", "AGUARDANDO", "versao", atual), 400);
        // Responsável de fora da consultoria: 404.
        api.put("/inscricoes/" + id, admin, Map.of("situacao", "EM_CONTATO", "pagamento", "AGUARDANDO",
                "responsavelId", UUID.randomUUID().toString(), "versao", atual), 404);

        JsonNode comNota = api.post("/inscricoes/" + id + "/notas", admin, Map.of("texto", "Contato fictício feito."), 200);
        assertThat(comNota.path("notas")).hasSize(1);
        assertThat(comNota.path("notas").get(0).path("autorNome").asString()).isEqualTo("Treinador Teste");

        JsonNode recusada = api.post("/inscricoes/" + id + "/recusar", admin, Map.of("versao", atual), 200);
        assertThat(recusada.path("situacao").asString()).isEqualTo("RECUSADA");
        assertThat(api.get("/inscricoes", admin, 200).path("total").asLong()).isZero();
        assertThat(api.get("/inscricoes?situacao=RECUSADA", admin, 200).path("total").asLong()).isEqualTo(1);
        assertThat(api.get("/inscricoes?situacao=TODAS", admin, 200).path("total").asLong()).isEqualTo(1);
        api.get("/inscricoes?situacao=QUALQUER", admin, 400);

        // Auditoria só com resumos fixos: nada de nome nem contato.
        List<String> resumos = banco.queryForList("select resumo from auditoria where consultoria_id = ? and acao like 'INSCRICAO_%'",
                String.class, consultoriaDe(admin));
        assertThat(resumos).isNotEmpty().allSatisfy(r -> assertThat(r).doesNotContain("Fictícia", "98765", "Contato fictício"));
    }

    @Test
    void meusMostraSoAsInscricoesDoResponsavel() throws Exception {
        String codigo = abrirLink(admin, null, null).path("codigo").asString();
        inscrever(codigo, inscricao("Pessoa Fictícia Sem Responsável", null), 202);
        assertThat(api.get("/inscricoes?meus=true", admin, 200).path("total").asLong()).isZero();
        abrirLink(admin, usuarioId(admin), null);
        inscrever(codigo, inscricao("Pessoa Fictícia Minha", null), 202);
        JsonNode meus = api.get("/inscricoes?meus=true", admin, 200);
        assertThat(meus.path("total").asLong()).isEqualTo(1);
        assertThat(meus.path("itens").get(0).path("nome").asString()).isEqualTo("Pessoa Fictícia Minha");
        // Mesmo WhatsApp nas duas abertas: aviso de duplicidade, sem fundir nada.
        assertThat(meus.path("itens").get(0).path("duplicidade").path("outrasInscricoesAbertas").asInt()).isEqualTo(1);
    }

    // ---- aceite ----

    @Test
    void aceitarSemConviteCriaOAlunoUmaVezSo() throws Exception {
        UUID consultoria = consultoriaDe(admin);
        String email = "aceite-" + UUID.randomUUID() + "@teste.local";
        String codigo = abrirLink(admin, usuarioId(admin), null).path("codigo").asString();
        inscrever(codigo, inscricao("Aluna Fictícia", email), 202);
        JsonNode item = unica(admin);
        long antes = alunos(consultoria);

        // CA20: aceita sem nenhum pagamento registrado.
        JsonNode aceite = api.post("/inscricoes/" + item.path("id").asString() + "/aceitar", admin,
                Map.of("convidar", false, "versao", api.get("/inscricoes/" + item.path("id").asString(), admin, 200)
                        .path("versao").asLong()), 200);
        assertThat(aceite.path("convite").isNull()).isTrue();
        String alunoId = aceite.path("alunoId").asString();
        JsonNode aluno = api.get("/alunos/" + alunoId, admin, 200);
        assertThat(aluno.path("nome").asString()).isEqualTo("Aluna Fictícia");
        assertThat(aluno.path("email").asString()).isEqualTo(email);
        assertThat(aluno.path("responsavelId").asString()).isEqualTo(usuarioId(admin));
        assertThat(aluno.path("temAcesso").asBoolean()).isFalse();
        assertThat(alunos(consultoria)).isEqualTo(antes + 1);

        JsonNode detalhe = api.get("/inscricoes/" + item.path("id").asString(), admin, 200);
        assertThat(detalhe.path("situacao").asString()).isEqualTo("ACEITA");
        assertThat(detalhe.path("alunoId").asString()).isEqualTo(alunoId);
        // CA19: aceito não vira pagamento confirmado.
        assertThat(detalhe.path("pagamento").asString()).isEqualTo("NAO_CONTROLADO");

        // CA05: aceitar de novo (mesma versão ou a nova) é 409 com o aluno criado, e nenhum aluno a mais.
        for (long versao : List.of(item.path("versao").asLong(), detalhe.path("versao").asLong())) {
            JsonNode repetido = api.post("/inscricoes/" + item.path("id").asString() + "/aceitar", admin,
                    Map.of("convidar", false, "versao", versao), 409);
            assertThat(repetido.path("codigo").asString()).isEqualTo("INSCRICAO_JA_ACEITA");
            assertThat(repetido.path("fieldErrors").get(0).path("message").asString()).isEqualTo(alunoId);
        }
        api.post("/inscricoes/" + item.path("id").asString() + "/recusar", admin,
                Map.of("versao", detalhe.path("versao").asLong()), 409);
        assertThat(alunos(consultoria)).isEqualTo(antes + 1);
    }

    @Test
    void aceitarComConviteDevolveOLinkDoConviteDoAluno() throws Exception {
        String codigo = abrirLink(admin, null, null).path("codigo").asString();
        inscrever(codigo, inscricao("Aluno Fictício Convidado", null), 202);
        String id = unica(admin).path("id").asString();
        long versao = api.get("/inscricoes/" + id, admin, 200).path("versao").asLong();

        // Sem a permissão de convidar, nada acontece (conferido antes de qualquer efeito).
        perfil(admin, "Treinador");
        banco.update("delete from perfil_permissao pp using perfil p where pp.perfil_id = p.id and p.consultoria_id = ?"
                + " and p.nome = 'Treinador' and pp.codigo = 'ALUNO_CONVITE'", consultoriaDe(admin));
        api.post("/inscricoes/" + id + "/aceitar", admin, Map.of("convidar", true, "versao", versao), 403);
        assertThat(api.get("/inscricoes/" + id, admin, 200).path("situacao").asString()).isEqualTo("NOVA");

        perfil(admin, "Administrador");
        JsonNode aceite = api.post("/inscricoes/" + id + "/aceitar", admin, Map.of("convidar", true, "versao", versao), 200);
        assertThat(aceite.path("convite").path("link").asString()).contains("/convite#codigo=");
        assertThat(aceite.path("convite").path("codigo").asString()).hasSize(10);
        JsonNode aluno = api.get("/alunos/" + aceite.path("alunoId").asString(), admin, 200);
        assertThat(aluno.path("conviteExpiraEm").isNull()).isFalse();
        // Sem responsável na inscrição, o aluno fica com quem aceitou.
        assertThat(aluno.path("responsavelId").asString()).isEqualTo(usuarioId(admin));
    }

    @Test
    void emailDeAlunoQueJaExisteDa409ComOIdSemCriarNada() throws Exception {
        UUID consultoria = consultoriaDe(admin);
        String email = "ja-existe-" + UUID.randomUUID() + "@teste.local";
        String existente = api.post("/alunos", admin, Map.of("nome", "Aluno Fictício Antigo", "email", email), 200)
                .path("id").asString();
        String codigo = abrirLink(admin, null, null).path("codigo").asString();
        inscrever(codigo, inscricao("Aluno Fictício Novo", email.toUpperCase(java.util.Locale.ROOT)), 202);
        JsonNode item = unica(admin);
        assertThat(item.path("duplicidade").path("alunoExistente").asBoolean()).isTrue();
        assertThat(item.path("duplicidade").path("alunoId").asString()).isEqualTo(existente);
        long antes = alunos(consultoria);

        JsonNode recusa = api.post("/inscricoes/" + item.path("id").asString() + "/aceitar", admin,
                Map.of("convidar", false, "versao", api.get("/inscricoes/" + item.path("id").asString(), admin, 200)
                        .path("versao").asLong()), 409);
        assertThat(recusa.path("codigo").asString()).isEqualTo("ALUNO_JA_EXISTE");
        assertThat(recusa.path("fieldErrors").get(0).path("field").asString()).isEqualTo("alunoId");
        assertThat(recusa.path("fieldErrors").get(0).path("message").asString()).isEqualTo(existente);
        assertThat(recusa.toString()).doesNotContain("Fictício").doesNotContain(email);
        assertThat(alunos(consultoria)).isEqualTo(antes);
        assertThat(api.get("/inscricoes/" + item.path("id").asString(), admin, 200).path("situacao").asString())
                .isEqualTo("NOVA");
    }

    @Test
    void aceiteRespeitaOLimiteDeAlunosDoPlano() throws Exception {
        UUID consultoria = consultoriaDe(admin);
        api.criarAluno(admin, "Aluno Fictício Ocupando a Vaga");
        contas.gravarDireitos(new DireitosLocais(consultoria, UUID.randomUUID(), 1, "ATIVA", true, null, null, "PAGO",
                "Pago", Map.of("alunos_ativos", 1L), List.of("MOBILIDADE", "PDF", "EQUIPE"), Instant.now()));
        String codigo = abrirLink(admin, null, null).path("codigo").asString();
        // A inscrição em si não ocupa vaga.
        inscrever(codigo, inscricao("Pessoa Fictícia", null), 202);
        String id = unica(admin).path("id").asString();
        long antes = alunos(consultoria);

        JsonNode recusa = api.post("/inscricoes/" + id + "/aceitar", admin,
                Map.of("convidar", true, "versao", api.get("/inscricoes/" + id, admin, 200).path("versao").asLong()), 409);
        assertThat(recusa.path("codigo").asString()).isEqualTo("LIMITE_DO_PLANO");
        assertThat(alunos(consultoria)).isEqualTo(antes);
        assertThat(api.get("/inscricoes/" + id, admin, 200).path("situacao").asString()).isEqualTo("NOVA");
    }

    // ---- retenção e privacidade ----

    @Test
    void retencaoApagaSoRecusadasEDesistentesParadasHaMaisDe180Dias() throws Exception {
        UUID consultoria = consultoriaDe(admin);
        String codigo = abrirLink(admin, null, null).path("codigo").asString();
        for (String nome : List.of("Recusada Velha", "Desistiu Velha", "Recusada Nova", "Aberta Velha")) {
            inscrever(codigo, inscricao("Pessoa Fictícia " + nome, null), 202);
        }
        Map<String, String> ids = new HashMap<>();
        for (JsonNode i : api.get("/inscricoes?situacao=TODAS", admin, 200).path("itens")) {
            ids.put(i.path("nome").asString().replace("Pessoa Fictícia ", ""), i.path("id").asString());
        }
        banco.update("update inscricao set situacao = 'RECUSADA' where id in (?::uuid, ?::uuid)",
                ids.get("Recusada Velha"), ids.get("Recusada Nova"));
        banco.update("update inscricao set situacao = 'DESISTIU' where id = ?::uuid", ids.get("Desistiu Velha"));
        api.post("/inscricoes/" + ids.get("Recusada Velha") + "/notas", admin, Map.of("texto", "Nota fictícia"), 200);
        Instant velho = Instant.now().minus(Duration.ofDays(181));
        banco.update("update inscricao set atualizada_em = ? where id in (?::uuid, ?::uuid, ?::uuid)",
                java.sql.Timestamp.from(velho), ids.get("Recusada Velha"), ids.get("Desistiu Velha"), ids.get("Aberta Velha"));

        assertThat(retencao.limpar(Instant.now().minus(InscricaoRetencao.PRAZO))).isGreaterThanOrEqualTo(2);
        List<String> restantes = banco.queryForList("select id::text from inscricao where consultoria_id = ?", String.class,
                consultoria);
        assertThat(restantes).containsExactlyInAnyOrder(ids.get("Recusada Nova"), ids.get("Aberta Velha"));
        assertThat(banco.queryForObject("select count(*) from inscricao_nota where consultoria_id = ?", Long.class,
                consultoria)).isZero();
    }

    @Test
    void anonimizarOAlunoApagaAInscricaoQueOCriou() throws Exception {
        UUID consultoria = consultoriaDe(admin);
        String codigo = abrirLink(admin, null, null).path("codigo").asString();
        inscrever(codigo, inscricao("Aluna Fictícia Anonimizada", null), 202);
        String id = unica(admin).path("id").asString();
        api.post("/inscricoes/" + id + "/notas", admin, Map.of("texto", "Nota fictícia"), 200);
        String alunoId = api.post("/inscricoes/" + id + "/aceitar", admin,
                Map.of("convidar", false, "versao", api.get("/inscricoes/" + id, admin, 200).path("versao").asLong()), 200)
                .path("alunoId").asString();

        api.patch("/alunos/" + alunoId + "/situacao", admin, Map.of("ativo", false), 200);
        api.post("/alunos/" + alunoId + "/anonimizar", admin, Map.of("nomeConfirmado", "Aluna Fictícia Anonimizada"), 200);
        api.get("/inscricoes/" + id, admin, 404);
        assertThat(banco.queryForObject("select count(*) from inscricao where consultoria_id = ?", Long.class, consultoria))
                .isZero();
        assertThat(banco.queryForObject("select count(*) from inscricao_nota where consultoria_id = ?", Long.class,
                consultoria)).isZero();
    }

    // ---- revisão de segurança (19/10) ----

    private static boolean semValor(JsonNode campo) {
        return campo.isNull() || campo.isMissingNode();
    }

    @Test
    void inscricaoAceitaEscondeObjetivoEObservacaoDeQuemNaoLeDadoSensivel() throws Exception {
        String codigo = abrirLink(admin, null, null).path("codigo").asString();
        inscrever(codigo, inscricao("Aluna Fictícia Sensível", null), 202);
        String id = unica(admin).path("id").asString();

        // Antes do aceite, quem atende a fila (Assistente, sem ALUNO_SENSIVEL_LER) lê o que a pessoa escreveu.
        perfil(admin, "Assistente");
        assertThat(api.get("/inscricoes/" + id, admin, 200).path("objetivo").asString()).isEqualTo("Objetivo fictício");

        perfil(admin, "Administrador");
        String alunoId = api.post("/inscricoes/" + id + "/aceitar", admin,
                Map.of("convidar", false, "versao", api.get("/inscricoes/" + id, admin, 200).path("versao").asLong()), 200)
                .path("alunoId").asString();
        assertThat(api.get("/inscricoes/" + id, admin, 200).path("observacao").asString()).isEqualTo("Observação fictícia");

        // Depois do aceite valem as regras do aluno: a ficha esconde o objetivo, e a inscrição também.
        perfil(admin, "Assistente");
        assertThat(semValor(api.get("/alunos/" + alunoId, admin, 200).path("objetivo"))).isTrue();
        JsonNode detalhe = api.get("/inscricoes/" + id, admin, 200);
        assertThat(semValor(detalhe.path("objetivo"))).isTrue();
        assertThat(semValor(detalhe.path("observacao"))).isTrue();
        JsonNode item = api.get("/inscricoes?situacao=TODAS", admin, 200).path("itens").get(0);
        assertThat(semValor(item.path("objetivo"))).isTrue();
        assertThat(detalhe.toString() + item).doesNotContain("Objetivo fictício").doesNotContain("Observação fictícia");
    }

    @Test
    void exportacaoDoAlunoLevaAInscricaoQueOCriou() throws Exception {
        String codigo = abrirLink(admin, null, "Texto fictício da consultoria.").path("codigo").asString();
        Map<String, Object> corpo = inscricao("Aluna Fictícia Exportada", null);
        corpo.put("cienciaPrivacidade", true);
        inscrever(codigo, corpo, 202);
        String id = unica(admin).path("id").asString();
        api.post("/inscricoes/" + id + "/notas", admin, Map.of("texto", "Nota fictícia da equipe"), 200);
        String alunoId = api.post("/inscricoes/" + id + "/aceitar", admin,
                Map.of("convidar", false, "versao", api.get("/inscricoes/" + id, admin, 200).path("versao").asLong()), 200)
                .path("alunoId").asString();

        JsonNode exportacao = api.get("/alunos/" + alunoId + "/exportacao", admin, 200);
        JsonNode itens = exportacao.path("inscricao").path("itens");
        assertThat(itens).hasSize(1);
        assertThat(itens.get(0).path("whatsapp").asString()).isEqualTo(WHATSAPP);
        assertThat(itens.get(0).path("observacao").asString()).isEqualTo("Observação fictícia");
        assertThat(itens.get(0).path("cienciaTexto").asString()).isEqualTo("Texto fictício da consultoria.");
        assertThat(itens.get(0).path("notas").get(0).path("texto").asString()).isEqualTo("Nota fictícia da equipe");
        assertThat(itens.get(0).path("notas").get(0).has("autorId")).isFalse();

        // Aluno que não veio do link: seção vazia, não omitida.
        UUID outro = api.criarAluno(admin, "Aluno Fictício Direto");
        assertThat(api.get("/alunos/" + outro + "/exportacao", admin, 200).path("inscricao").path("itens")).isEmpty();
    }

    @Test
    void linkPublicoTemTetoDeInscricoesPorConsultoriaEm24Horas() throws Exception {
        UUID consultoria = consultoriaDe(admin);
        String codigo = abrirLink(admin, null, null).path("codigo").asString();
        JsonNode outra = api.novoTreinador();
        String codigoOutra = abrirLink(outra, null, null).path("codigo").asString();
        // O teto padrão (200) já gasto nas últimas 24 h, sem passar 200 vezes pelo controller.
        banco.update("insert into inscricao (id, consultoria_id, nome, whatsapp) select gen_random_uuid(), ?, "
                + "'Pessoa Fictícia ' || g, ? from generate_series(1, 200) g", consultoria, WHATSAPP);

        JsonNode recusada = inscrever(codigo, inscricao("Pessoa Fictícia a Mais", null), 429);
        assertThat(recusada.toString()).doesNotContain("Fictícia");
        assertThat(banco.queryForObject("select count(*) from inscricao where consultoria_id = ?", Long.class, consultoria))
                .isEqualTo(200);
        // O teto é de cada consultoria: a outra continua recebendo.
        inscrever(codigoOutra, inscricao("Pessoa Fictícia da Outra", null), 202);
        // Passadas 24 h, o link volta a receber.
        banco.update("update inscricao set criada_em = now() - interval '25 hours' where consultoria_id = ?", consultoria);
        inscrever(codigo, inscricao("Pessoa Fictícia do Dia Seguinte", null), 202);
    }

    @Test
    void sexoOpcionalCopiaParaOAlunoENaoLigaOCiclo() throws Exception {
        String codigo = abrirLink(admin, usuarioId(admin), null).path("codigo").asString();
        Map<String, Object> invalido = inscricao("Pessoa Fictícia", null);
        invalido.put("sexo", "TALVEZ");
        JsonNode erro = inscrever(codigo, invalido, 422);
        assertThat(erro.path("codigo").asString()).isEqualTo("INSCRICAO_INVALIDA");
        assertThat(erro.toString()).doesNotContain("TALVEZ");

        Map<String, Object> corpo = inscricao("Aluna Fictícia Sexo", "sexo-" + UUID.randomUUID() + "@teste.local");
        corpo.put("sexo", "FEMININO");
        inscrever(codigo, corpo, 202);
        JsonNode item = unica(admin);
        JsonNode detalhe = api.get("/inscricoes/" + item.path("id").asString(), admin, 200);
        assertThat(detalhe.path("sexo").asString()).isEqualTo("FEMININO");
        JsonNode aceite = api.post("/inscricoes/" + item.path("id").asString() + "/aceitar", admin,
                Map.of("convidar", false, "versao", detalhe.path("versao").asLong()), 200);
        String alunoId = aceite.path("alunoId").asString();
        assertThat(api.get("/alunos/" + alunoId, admin, 200).path("sexo").asString()).isEqualTo("FEMININO");
        assertThat(banco.queryForObject("select ciclo_ativado_em from aluno where id = ?::uuid", String.class, alunoId)).isNull();
    }
}
