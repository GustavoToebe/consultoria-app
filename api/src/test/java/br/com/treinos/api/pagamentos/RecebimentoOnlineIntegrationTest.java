package br.com.treinos.api.pagamentos;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.auditoria.Auditoria;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Recebimento online do treinador (InfiniteTag e API Key cifrada): a chave só entra, nunca volta em resposta, auditoria ou
 * erro; o token do aviso nasce com a credencial e fica; permissões, versão, isolamento entre consultorias e o evento do
 * sistema na auditoria. Só dados fictícios.
 */
@AutoConfigureMockMvc
class RecebimentoOnlineIntegrationTest extends AbstractIntegrationTest {

    private static final String ROTA = "/financeiro/recebimento-online";
    private static final String CHAVE = "chave-fake-do-teste-9876543210";

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private CifraDePagamento cifra;
    @Autowired private Auditoria auditoria;
    @Autowired private PlatformTransactionManager transacoes;

    private ApiDeTeste api;
    private JsonNode admin;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
    }

    private UUID consultoriaDe(JsonNode login) {
        return jdbc.queryForObject("select consultoria_id from usuario where id = ?::uuid", UUID.class,
                login.get("usuario").get("id").asString());
    }

    private static boolean nulo(JsonNode n) {
        return n == null || n.isNull() || n.isMissingNode();
    }

    private Map<String, Object> corpo(String tag, String chave, Boolean remover, Long versao) {
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("infiniteTag", tag);
        if (chave != null) {
            corpo.put("apiKey", chave);
        }
        if (remover != null) {
            corpo.put("removerApiKey", remover);
        }
        if (versao != null) {
            corpo.put("versao", versao);
        }
        return corpo;
    }

    private Map<String, Object> corpo(String tag, String chave, Boolean remover, Long versao, String juros) {
        Map<String, Object> corpo = corpo(tag, chave, remover, versao);
        corpo.put("jurosDoParcelamento", juros);
        return corpo;
    }

    private Map<String, Object> linha(UUID consultoria) {
        return jdbc.queryForMap("select * from credencial_pagamento where consultoria_id = ? and provedor = 'INFINITEPAY'", consultoria);
    }

    private int auditorias(UUID consultoria, String acao) {
        Integer n = jdbc.queryForObject("select count(*) from auditoria where consultoria_id = ? and acao = ?", Integer.class,
                consultoria, acao);
        return n == null ? 0 : n;
    }

    private JsonNode membro(String nome, Set<String> permissoes) throws Exception {
        String perfil = api.post("/perfis", admin, Map.of("nome", "Perfil " + nome + UUID.randomUUID(), "permissoes", permissoes), 200)
                .get("id").asString();
        JsonNode convite = api.post("/usuarios/convites", admin,
                Map.of("nome", nome, "email", ApiDeTeste.emailUnico("membro"), "perfilId", perfil), 200);
        return api.post("/publico/convites-equipe/aceitar", null,
                Map.of("codigo", convite.get("codigo").asString(), "senha", ApiDeTeste.SENHA), 200);
    }

    @Test
    void oPedidoNaoImprimeAChave() {
        var pedido = new PagamentosDtos.RecebimentoOnlineRequest("treinador-fake", CHAVE, null, null, null);

        assertThat(pedido.toString()).doesNotContain(CHAVE);
    }

    @Test
    void semCredencialOGetDizQueNaoEstaConfigurado() throws Exception {
        JsonNode r = api.get(ROTA, admin, 200);

        // O contrato com o app (financeiroTipos.ts): estes seis campos, sempre presentes, os nulos como null.
        assertThat(r.propertyNames()).containsExactlyInAnyOrder("habilitado", "configurado", "infiniteTag", "apiKeyConfigurada", "versao",
                "jurosDoParcelamento");
        assertThat(r.get("jurosDoParcelamento").isNull()).as("sem credencial não há escolha de juros").isTrue();
        assertThat(r.get("habilitado").asBoolean()).isTrue();
        assertThat(r.get("configurado").asBoolean()).isFalse();
        assertThat(r.get("apiKeyConfigurada").asBoolean()).isFalse();
        assertThat(r.get("infiniteTag").isNull()).isTrue();
        assertThat(r.get("versao").isNull()).isTrue();
    }

    @Test
    void salvaATagNormalizadaECifraAChaveQueNuncaVolta() throws Exception {
        UUID consultoria = consultoriaDe(admin);

        JsonNode criada = api.put(ROTA, admin, corpo("  $MeuTreinador.Fit ", CHAVE, null, null), 200);

        assertThat(criada.propertyNames()).containsExactlyInAnyOrder("habilitado", "configurado", "infiniteTag", "apiKeyConfigurada", "versao",
                "jurosDoParcelamento");
        assertThat(criada.get("jurosDoParcelamento").asString()).as("criação sem o campo = ALUNO").isEqualTo("ALUNO");
        assertThat(linha(consultoria).get("juros_parcelamento")).isEqualTo("ALUNO");
        assertThat(criada.get("versao").isNumber()).isTrue();
        assertThat(criada.get("configurado").asBoolean()).isTrue();
        assertThat(criada.get("infiniteTag").asString()).isEqualTo("meutreinador.fit");
        assertThat(criada.get("apiKeyConfigurada").asBoolean()).isTrue();
        assertThat(criada.has("apiKey")).isFalse();
        assertThat(criada.toString()).doesNotContain(CHAVE);
        assertThat(api.get(ROTA, admin, 200).toString()).doesNotContain(CHAVE).doesNotContain("v1:");

        Map<String, Object> linha = linha(consultoria);
        assertThat(linha.get("conta")).isEqualTo("meutreinador.fit");
        String cifrado = (String) linha.get("segredo_cifrado");
        assertThat(cifrado).startsWith("v1:teste:").doesNotContain(CHAVE);
        assertThat(cifra.decifrar(consultoria, cifrado)).isEqualTo(CHAVE);
        assertThat((String) linha.get("token_aviso")).matches("[A-Za-z0-9_-]{43}");
        assertThat(auditorias(consultoria, "RECEBIMENTO_ONLINE_CONFIGURADO")).isEqualTo(1);
        assertThat(jdbc.queryForObject("select resumo from auditoria where consultoria_id = ? and acao = 'RECEBIMENTO_ONLINE_CONFIGURADO'",
                String.class, consultoria)).isEqualTo("Configurou o recebimento online.");
        assertThat(jdbc.queryForObject("select string_agg(resumo || coalesce(entidade, ''), ' ') from auditoria where consultoria_id = ?",
                String.class, consultoria)).doesNotContain(CHAVE).doesNotContain("meutreinador");
    }

    @Test
    void alterarSemChaveMantemAChaveEOTokenEExigeAVersao() throws Exception {
        UUID consultoria = consultoriaDe(admin);
        JsonNode criada = api.put(ROTA, admin, corpo("treinador-um", CHAVE, null, null), 200);
        Map<String, Object> antes = linha(consultoria);

        JsonNode alterada = api.put(ROTA, admin, corpo("$treinador-dois", null, null, criada.get("versao").asLong()), 200);

        assertThat(alterada.get("infiniteTag").asString()).isEqualTo("treinador-dois");
        assertThat(alterada.get("apiKeyConfigurada").asBoolean()).isTrue();
        assertThat(alterada.get("versao").asLong()).isGreaterThan(criada.get("versao").asLong());
        Map<String, Object> depois = linha(consultoria);
        assertThat(depois.get("segredo_cifrado")).isEqualTo(antes.get("segredo_cifrado"));
        assertThat(depois.get("token_aviso")).isEqualTo(antes.get("token_aviso"));

        // Versão velha ou ausente: 409.
        assertThat(api.put(ROTA, admin, corpo("treinador-tres", null, null, criada.get("versao").asLong()), 409)
                .get("codigo").asString()).isEqualTo("CONFLITO_EDICAO");
        assertThat(api.put(ROTA, admin, corpo("treinador-tres", null, null, null), 409)
                .get("codigo").asString()).isEqualTo("CONFLITO_EDICAO");
        assertThat(linha(consultoria).get("conta")).isEqualTo("treinador-dois");

        // Trocar a chave cifra de novo (nonce novo); o token continua o mesmo.
        JsonNode trocada = api.put(ROTA, admin, corpo("treinador-dois", CHAVE + "-nova", null, alterada.get("versao").asLong()), 200);
        Map<String, Object> aposTroca = linha(consultoria);
        assertThat(aposTroca.get("segredo_cifrado")).isNotEqualTo(antes.get("segredo_cifrado"));
        assertThat(cifra.decifrar(consultoria, (String) aposTroca.get("segredo_cifrado"))).isEqualTo(CHAVE + "-nova");
        assertThat(aposTroca.get("token_aviso")).isEqualTo(antes.get("token_aviso"));

        // Remover só a chave deixa a Tag.
        JsonNode semChave = api.put(ROTA, admin, corpo("treinador-dois", null, true, trocada.get("versao").asLong()), 200);
        assertThat(semChave.get("apiKeyConfigurada").asBoolean()).isFalse();
        assertThat(semChave.get("configurado").asBoolean()).isTrue();
        assertThat(linha(consultoria).get("segredo_cifrado")).isNull();
        assertThat(auditorias(consultoria, "RECEBIMENTO_ONLINE_CONFIGURADO")).isEqualTo(4);
    }

    @Test
    void validaATagEAChaveSemRepetirOValor() throws Exception {
        for (String tag : new String[] {"ab", "$", "tag com espaço", "tag/barra", "x".repeat(41), "acentuação"}) {
            JsonNode erro = api.put(ROTA, admin, corpo(tag, null, null, null), 422);
            assertThat(erro.get("codigo").asString()).as(tag).isEqualTo("RECEBIMENTO_ONLINE_INVALIDO");
            assertThat(erro.get("fieldErrors").get(0).get("field").asString()).isEqualTo("infiniteTag");
        }
        api.put(ROTA, admin, corpo("   ", null, null, null), 400);
        for (String chave : new String[] {"curta", "tem espaço no meio da chave", "x".repeat(201)}) {
            JsonNode erro = api.put(ROTA, admin, corpo("treinador-valido", chave, null, null), 422);
            assertThat(erro.get("codigo").asString()).isEqualTo("RECEBIMENTO_ONLINE_INVALIDO");
            assertThat(erro.get("fieldErrors").get(0).get("field").asString()).isEqualTo("apiKey");
            assertThat(erro.toString()).doesNotContain(chave);
        }
        String enorme = "chave-enorme-fake-" + "y".repeat(400);
        JsonNode grande = api.put(ROTA, admin, corpo("treinador-valido", enorme, null, null), 422);
        assertThat(grande.get("fieldErrors").get(0).get("field").asString()).isEqualTo("apiKey");
        assertThat(grande.toString()).doesNotContain("chave-enorme-fake");
        assertThat(api.put(ROTA, admin, corpo("treinador-valido", CHAVE, true, null), 422).get("codigo").asString())
                .isEqualTo("RECEBIMENTO_ONLINE_INVALIDO");
        assertThat(api.get(ROTA, admin, 200).get("configurado").asBoolean()).isFalse();
    }

    @Test
    void jurosDoParcelamentoCriaComPadraoAlunoAlteraSoQuandoVemENaoMudaQuandoNulo() throws Exception {
        UUID consultoria = consultoriaDe(admin);
        JsonNode criada = api.put(ROTA, admin, corpo("treinador-juros", CHAVE, null, null, "TREINADOR"), 200);
        assertThat(criada.get("jurosDoParcelamento").asString()).isEqualTo("TREINADOR");
        assertThat(linha(consultoria).get("juros_parcelamento")).isEqualTo("TREINADOR");

        // Alteração sem o campo não mexe.
        JsonNode igual = api.put(ROTA, admin, corpo("treinador-juros", null, null, criada.get("versao").asLong()), 200);
        assertThat(igual.get("jurosDoParcelamento").asString()).isEqualTo("TREINADOR");

        JsonNode aluno = api.put(ROTA, admin, corpo("treinador-juros", null, null, igual.get("versao").asLong(), "ALUNO"), 200);
        assertThat(aluno.get("jurosDoParcelamento").asString()).isEqualTo("ALUNO");
        assertThat(api.get(ROTA, admin, 200).get("jurosDoParcelamento").asString()).isEqualTo("ALUNO");
        assertThat(auditorias(consultoria, "RECEBIMENTO_ONLINE_CONFIGURADO")).isEqualTo(3);
        assertThat(jdbc.queryForObject("select string_agg(resumo, ' ') from auditoria where consultoria_id = ?", String.class,
                consultoria)).doesNotContain("TREINADOR").doesNotContain("juros");

        // Valor fora do conjunto: 422 no campo, sem repetir o valor.
        JsonNode erro = api.put(ROTA, admin, corpo("treinador-juros", null, null, aluno.get("versao").asLong(), "talvez"), 422);
        assertThat(erro.get("codigo").asString()).isEqualTo("RECEBIMENTO_ONLINE_INVALIDO");
        assertThat(erro.get("fieldErrors").get(0).get("field").asString()).isEqualTo("jurosDoParcelamento");
        assertThat(erro.toString()).doesNotContain("talvez");
    }

    @Test
    void jurosDoTreinadorExigemAChaveDeApi() throws Exception {
        UUID consultoria = consultoriaDe(admin);

        // Criação sem chave com TREINADOR: 422 no campo, com a mensagem fixa, e nada é gravado.
        JsonNode semChave = api.put(ROTA, admin, corpo("treinador-sem-chave", null, null, null, "TREINADOR"), 422);
        assertThat(semChave.get("codigo").asString()).isEqualTo("RECEBIMENTO_ONLINE_INVALIDO");
        assertThat(semChave.get("fieldErrors").get(0).get("field").asString()).isEqualTo("jurosDoParcelamento");
        assertThat(semChave.get("fieldErrors").get(0).get("message").asString()).isEqualTo("Precisa da chave de API para valer.");
        assertThat(api.get(ROTA, admin, 200).get("configurado").asBoolean()).isFalse();

        // Com chave vale; tirar a chave com TREINADOR ativo é recusado, e tirar junto com voltar a ALUNO é aceito.
        JsonNode criada = api.put(ROTA, admin, corpo("treinador-com-chave", CHAVE, null, null, "TREINADOR"), 200);
        JsonNode recusada = api.put(ROTA, admin, corpo("treinador-com-chave", null, true, criada.get("versao").asLong()), 422);
        assertThat(recusada.get("fieldErrors").get(0).get("field").asString()).isEqualTo("jurosDoParcelamento");
        assertThat(linha(consultoria).get("segredo_cifrado")).isNotNull();
        JsonNode voltou = api.put(ROTA, admin, corpo("treinador-com-chave", null, true, criada.get("versao").asLong(), "ALUNO"), 200);
        assertThat(voltou.get("apiKeyConfigurada").asBoolean()).isFalse();
        assertThat(voltou.get("jurosDoParcelamento").asString()).isEqualTo("ALUNO");

        // Sem chave, ligar TREINADOR numa credencial que já existe também é recusado.
        assertThat(api.put(ROTA, admin, corpo("treinador-com-chave", null, null, voltou.get("versao").asLong(), "TREINADOR"), 422)
                .get("codigo").asString()).isEqualTo("RECEBIMENTO_ONLINE_INVALIDO");
        assertThat(linha(consultoria).get("juros_parcelamento")).isEqualTo("ALUNO");
    }

    @Test
    void removerApagaACredencialEAuditaUmaVezSo() throws Exception {
        UUID consultoria = consultoriaDe(admin);
        JsonNode criada = api.put(ROTA, admin, corpo("treinador-remover", CHAVE, null, null), 200);

        assertThat(api.delete(ROTA + "?versao=" + (criada.get("versao").asLong() + 5), admin, 409).get("codigo").asString())
                .isEqualTo("CONFLITO_EDICAO");
        api.delete(ROTA + "?versao=" + criada.get("versao").asLong(), admin, 204);

        assertThat(api.get(ROTA, admin, 200).get("configurado").asBoolean()).isFalse();
        assertThat(jdbc.queryForObject("select count(*) from credencial_pagamento where consultoria_id = ?", Integer.class, consultoria))
                .isZero();
        assertThat(auditorias(consultoria, "RECEBIMENTO_ONLINE_REMOVIDO")).isEqualTo(1);
        api.delete(ROTA, admin, 204);
        assertThat(auditorias(consultoria, "RECEBIMENTO_ONLINE_REMOVIDO")).isEqualTo(1);

        // Sem credencial, mandar versão é 409 (alguém a removeu); sem versão cria de novo.
        api.put(ROTA, admin, corpo("treinador-remover", null, null, 5L), 409);
        api.put(ROTA, admin, corpo("treinador-remover", null, null, null), 200);
        assertThat(linha(consultoria).get("token_aviso")).isNotNull();
    }

    @Test
    void permissoesEIsolamentoEntreConsultorias() throws Exception {
        api.put(ROTA, admin, corpo("treinador-isolado", CHAVE, null, null), 200);
        JsonNode semFinanceiro = membro("Sem financeiro", Set.of("ALUNO_LER"));
        JsonNode leitor = membro("Leitor financeiro", Set.of("FINANCEIRO_LER", "ALUNO_LER"));
        JsonNode gestor = membro("Gestor financeiro", Set.of("FINANCEIRO_ALTERAR", "FINANCEIRO_LER", "ALUNO_LER"));

        api.get(ROTA, semFinanceiro, 403);
        api.put(ROTA, semFinanceiro, corpo("treinador-x", null, null, null), 403);
        JsonNode lido = api.get(ROTA, leitor, 200);
        assertThat(lido.get("infiniteTag").asString()).isEqualTo("treinador-isolado");
        assertThat(lido.toString()).doesNotContain(CHAVE);
        api.put(ROTA, leitor, corpo("treinador-x", null, null, lido.get("versao").asLong()), 403);
        api.delete(ROTA, leitor, 403);
        api.put(ROTA, gestor, corpo("treinador-do-gestor", null, null, lido.get("versao").asLong()), 200);
        api.get(ROTA, null, 401);

        JsonNode outro = api.novoTreinador();
        assertThat(api.get(ROTA, outro, 200).get("configurado").asBoolean()).isFalse();
        api.delete(ROTA, outro, 204);
        assertThat(api.get(ROTA, admin, 200).get("infiniteTag").asString()).isEqualTo("treinador-do-gestor");
        JsonNode doOutro = api.put(ROTA, outro, corpo("treinador-do-outro", null, null, null), 200);
        assertThat(doOutro.get("infiniteTag").asString()).isEqualTo("treinador-do-outro");
        assertThat(jdbc.queryForObject("select count(distinct token_aviso) from credencial_pagamento where consultoria_id in (?, ?)",
                Integer.class, consultoriaDe(admin), consultoriaDe(outro))).isEqualTo(2);
    }

    @Test
    void euInformaSeORecebimentoOnlineEstaLigado() throws Exception {
        assertThat(api.get("/eu", admin, 200).get("recebimentoOnlineHabilitado").asBoolean()).isTrue();
        JsonNode loginAluno = api.convidarEEntrar(admin, api.criarAluno(admin, "Aluno Fictício " + UUID.randomUUID()));
        assertThat(api.get("/eu", loginAluno, 200).get("recebimentoOnlineHabilitado").asBoolean()).isTrue();
    }

    @Test
    void eventoDoSistemaApareceNaListagemDaAuditoriaComoSistema() throws Exception {
        UUID consultoria = consultoriaDe(admin);
        UUID entidade = UUID.randomUUID();
        new TransactionTemplate(transacoes).executeWithoutResult(s ->
                auditoria.registrarDoSistema(consultoria, "PAGAMENTO_ONLINE_CONFIRMADO", "COBRANCA", entidade,
                        "Confirmou um pagamento online."));

        assertThat(jdbc.queryForObject("select usuario_id from auditoria where entidade_id = ?", UUID.class, entidade)).isNull();
        JsonNode lista = api.get("/auditoria?acao=PAGAMENTO_ONLINE_CONFIRMADO", admin, 200);
        assertThat(lista.get("itens")).hasSize(1);
        JsonNode evento = lista.get("itens").get(0);
        assertThat(evento.get("nomeUsuario").asString()).isEqualTo("Sistema");
        assertThat(nulo(evento.get("usuarioId"))).isTrue();
        assertThat(evento.get("resumo").asString()).isEqualTo("Confirmou um pagamento online.");
        // A lista inteira (com eventos de gente e do sistema) continua saindo, e o filtro por pessoa não traz o sistema.
        assertThat(api.get("/auditoria", admin, 200).get("itens").toString()).contains("Sistema");
        assertThat(api.get("/auditoria?usuarioId=" + admin.get("usuario").get("id").asString() + "&acao=PAGAMENTO_ONLINE_CONFIRMADO",
                admin, 200).get("itens")).isEmpty();
        // Outra consultoria não vê o evento.
        assertThat(api.get("/auditoria?acao=PAGAMENTO_ONLINE_CONFIRMADO", api.novoTreinador(), 200).get("itens")).isEmpty();
    }
}
