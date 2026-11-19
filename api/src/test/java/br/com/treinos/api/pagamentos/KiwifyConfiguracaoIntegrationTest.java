package br.com.treinos.api.pagamentos;

import org.junit.jupiter.api.Test;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import tools.jackson.databind.JsonNode;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * A credencial da Kiwify do treinador ({@code GET/PUT/DELETE /financeiro/kiwify}): o contrato do app, o segredo que nunca volta
 * (resposta, auditoria, banco em claro), a versão, os 422 por campo sem repetir valor, a janela de 24 h do token anterior do
 * webhook, as permissões e o isolamento entre consultorias. Dados fictícios.
 */
@AutoConfigureMockMvc
class KiwifyConfiguracaoIntegrationTest extends KiwifyDeTeste {

    private static final String ROTA = "/financeiro/kiwify";

    private Map<String, Object> corpo(String token, String clientId, String secret, String account, Long versao) {
        Map<String, Object> c = new LinkedHashMap<>();
        if (token != null) c.put("tokenDoWebhook", token);
        if (clientId != null) c.put("clientId", clientId);
        if (secret != null) c.put("clientSecret", secret);
        if (account != null) c.put("accountId", account);
        c.put("versao", versao);
        return c;
    }

    private Map<String, Object> linhaDaCredencial(UUID consultoria) {
        return jdbc.queryForMap("select * from credencial_kiwify where consultoria_id = ?", consultoria);
    }

    private int credenciais(UUID consultoria) {
        return jdbc.queryForObject("select count(*) from credencial_kiwify where consultoria_id = ?", Integer.class, consultoria);
    }

    @Test
    void getSemCredencialNaoCriaNada() throws Exception {
        JsonNode login = api.novoTreinador();

        JsonNode lido = api.get(ROTA, login, 200);

        assertThat(lido.get("configurada").asBoolean()).isFalse();
        assertThat(lido.get("webhookUrl").isNull()).isTrue();
        assertThat(lido.get("clientIdFinal").isNull()).isTrue();
        assertThat(lido.get("versao").isNull()).isTrue();
        assertThat(credenciais(consultoriaDe(login))).isZero();
    }

    @Test
    void criaComOsQuatroCamposERespondeSemNenhumSegredo() throws Exception {
        JsonNode login = api.novoTreinador();
        String token = "token-ficticio-do-webhook-" + UUID.randomUUID();
        String clientId = "cliente-ficticio-a1b2";
        String secret = "segredo-ficticio-" + UUID.randomUUID();
        String account = "conta-ficticia-" + UUID.randomUUID();

        JsonNode criada = api.put(ROTA, login, corpo(token, clientId, secret, account, null), 200);

        assertThat(criada.get("configurada").asBoolean()).isTrue();
        assertThat(criada.get("versao").asLong()).isZero();
        assertThat(criada.get("clientIdFinal").asString()).isEqualTo("a1b2");
        assertThat(criada.get("webhookUrl").asString()).startsWith("https://api.teste.local/publico/pagamentos/kiwify/")
                .matches(".*/[A-Za-z0-9_-]{43}$");
        for (String segredo : List.of(token, clientId, secret, account)) {
            assertThat(criada.toString()).doesNotContain(segredo);
            assertThat(api.get(ROTA, login, 200).toString()).doesNotContain(segredo);
        }
        // No banco só existe cifrado (v1:<chave>:<nonce>:<texto>), nunca em claro.
        Map<String, Object> linha = linhaDaCredencial(consultoriaDe(login));
        for (String coluna : List.of("token_webhook_cifrado", "client_id_cifrado", "client_secret_cifrado", "account_id_cifrado")) {
            assertThat(linha.get(coluna).toString()).startsWith("v1:teste:").doesNotContain(token).doesNotContain(secret)
                    .doesNotContain(account).doesNotContain(clientId);
        }
        assertThat(linha.get("token_webhook_anterior_cifrado")).isNull();
        // Auditoria com resumo fixo, sem valor nenhum.
        assertThat(jdbc.queryForObject("select resumo from auditoria where consultoria_id = ? and acao = 'KIWIFY_CONFIGURADA'",
                String.class, consultoriaDe(login))).isEqualTo("Configurou a Kiwify.");
        String auditoria = jdbc.queryForList("select resumo || coalesce(entidade, '') from auditoria where consultoria_id = ?",
                String.class, consultoriaDe(login)).toString();
        for (String segredo : List.of(token, clientId, secret, account)) {
            assertThat(auditoria).doesNotContain(segredo);
        }
    }

    @Test
    void versaoNaCriacaoEVersaoVelhaOuAusenteNaAlteracaoDao409() throws Exception {
        Conta conta = novaConta();

        // Criar com versão (não há nada gravado) e alterar sem versão ou com versão velha: CONFLITO_EDICAO.
        JsonNode outro = api.novoTreinador();
        assertThat(api.put(ROTA, outro, corpo("token-ficticio-qualquer-1", "cli-1", "sec-1", "acc-1", 0L), 409)
                .get("codigo").asString()).isEqualTo("CONFLITO_EDICAO");
        assertThat(api.put(ROTA, conta.login(), corpo(null, "novo-cliente-9", null, null, null), 409)
                .get("codigo").asString()).isEqualTo("CONFLITO_EDICAO");
        assertThat(api.put(ROTA, conta.login(), corpo(null, "novo-cliente-9", null, null, 7L), 409)
                .get("codigo").asString()).isEqualTo("CONFLITO_EDICAO");
        assertThat(credenciais(consultoriaDe(outro))).isZero();
        assertThat(api.get(ROTA, conta.login(), 200).get("versao").asLong()).isZero();
    }

    @Test
    void alteraSoOQueVeioEMantemOTokenDoCaminho() throws Exception {
        Conta conta = novaConta();
        String urlAntes = api.get(ROTA, conta.login(), 200).get("webhookUrl").asString();

        JsonNode alterada = api.put(ROTA, conta.login(), corpo(null, "cliente-novo-zz99", null, null, 0L), 200);

        assertThat(alterada.get("versao").asLong()).isEqualTo(1L);
        assertThat(alterada.get("clientIdFinal").asString()).isEqualTo("zz99");
        assertThat(alterada.get("webhookUrl").asString()).isEqualTo(urlAntes);
        Map<String, Object> linha = linhaDaCredencial(conta.consultoria());
        assertThat(linha.get("token_caminho")).isEqualTo(conta.caminho());
        // Não mexeu no token do webhook: nada de "anterior".
        assertThat(linha.get("token_webhook_anterior_cifrado")).isNull();
        assertThat(linha.get("anterior_valido_ate")).isNull();
    }

    @Test
    void trocarOTokenDoWebhookGuardaOAnteriorPor24HorasERegravarOMesmoNaoTroca() throws Exception {
        Conta conta = novaConta();

        // O mesmo token de novo: não é troca.
        JsonNode igual = api.put(ROTA, conta.login(), corpo(conta.token(), null, null, null, 0L), 200);
        assertThat(linhaDaCredencial(conta.consultoria()).get("token_webhook_anterior_cifrado")).isNull();

        JsonNode trocada = api.put(ROTA, conta.login(), corpo("token-novo-ficticio-" + UUID.randomUUID(), null, null, null,
                igual.get("versao").asLong()), 200);

        Map<String, Object> linha = linhaDaCredencial(conta.consultoria());
        assertThat(linha.get("token_webhook_anterior_cifrado")).isNotNull();
        Double segundos = jdbc.queryForObject("select extract(epoch from (anterior_valido_ate - now())) from credencial_kiwify "
                + "where consultoria_id = ?", Double.class, conta.consultoria());
        assertThat(segundos).isBetween(24 * 3600 - 120.0, 24 * 3600.0);
        assertThat(trocada.get("webhookUrl").asString()).endsWith(conta.caminho());
        assertThat(trocada.get("versao").asLong()).isEqualTo(igual.get("versao").asLong() + 1);
    }

    @Test
    void campoInvalidoDa422PorCampoSemRepetirOValor() throws Exception {
        JsonNode login = api.novoTreinador();
        String curto = "curto-demais-15c";
        String comEspaco = "tem espaco no meio";

        // Criando, os quatro são obrigatórios.
        JsonNode vazio = api.put(ROTA, login, corpo(null, null, null, null, null), 422);
        assertThat(vazio.get("codigo").asString()).isEqualTo("KIWIFY_INVALIDA");
        assertThat(campos(vazio)).containsExactlyInAnyOrder("tokenDoWebhook", "clientId", "clientSecret", "accountId");

        JsonNode torto = api.put(ROTA, login, corpo(curto.substring(0, 15), comEspaco, "ok-1", "x".repeat(201), null), 422);
        assertThat(campos(torto)).containsExactlyInAnyOrder("tokenDoWebhook", "clientId", "accountId");
        for (String valor : List.of(curto.substring(0, 15), comEspaco, "x".repeat(201))) {
            assertThat(torto.toString()).doesNotContain(valor);
        }
        assertThat(credenciais(consultoriaDe(login))).isZero();

        // O token de 16 caracteres é o mínimo; o limite de 200 vale para os quatro.
        Conta conta = novaConta();
        assertThat(campos(api.put(ROTA, conta.login(), corpo("a".repeat(201), null, null, null, 0L), 422)))
                .containsExactly("tokenDoWebhook");
        api.put(ROTA, conta.login(), corpo("t".repeat(16), "c".repeat(200), "s".repeat(200), "a".repeat(200), 0L), 200);

        // Campo presente e em branco é erro no campo (não apaga e não mantém); ausente mantém.
        Map<String, Object> embranco = new LinkedHashMap<>();
        embranco.put("clientSecret", "   ");
        embranco.put("versao", 1L);
        JsonNode recusado = api.put(ROTA, conta.login(), embranco, 422);
        assertThat(campos(recusado)).containsExactly("clientSecret");
        assertThat(api.get(ROTA, conta.login(), 200).get("versao").asLong()).isEqualTo(1L);
    }

    private static List<String> campos(JsonNode erro) {
        return erro.get("fieldErrors").valueStream().map(f -> f.get("field").asString()).toList();
    }

    @Test
    void removerApagaACredencialEOTokenDoCaminhoEEIdempotente() throws Exception {
        Conta conta = novaConta();

        api.delete(ROTA + "?versao=5", conta.login(), 409);
        assertThat(credenciais(conta.consultoria())).isEqualTo(1);
        api.delete(ROTA + "?versao=0", conta.login(), 204);

        assertThat(credenciais(conta.consultoria())).isZero();
        JsonNode lido = api.get(ROTA, conta.login(), 200);
        assertThat(lido.get("configurada").asBoolean()).isFalse();
        assertThat(lido.get("webhookUrl").isNull()).isTrue();
        // A URL antiga passa a dar 404, e nada é gravado.
        String corpo = corpo(pedido(), "order_approved");
        assertThat(avisarCom(conta.caminho(), assinar(conta.token(), corpo), corpo).getStatus()).isEqualTo(404);
        assertThat(totalDeAvisos(conta)).isZero();
        // Sem credencial não há o que remover: 204 do mesmo jeito, sem nova auditoria.
        api.delete(ROTA, conta.login(), 204);
        assertThat(auditorias(conta, "KIWIFY_REMOVIDA")).isEqualTo(1);
        assertThat(jdbc.queryForObject("select resumo from auditoria where consultoria_id = ? and acao = 'KIWIFY_REMOVIDA'",
                String.class, conta.consultoria())).isEqualTo("Removeu a Kiwify.");
        // Configurar de novo gera um token de caminho novo.
        JsonNode nova = api.put(ROTA, conta.login(), credencial("token-ficticio-novo-" + UUID.randomUUID(), "cli-novo-1"), 200);
        assertThat(nova.get("webhookUrl").asString()).doesNotEndWith(conta.caminho());
    }

    @Test
    void permissoesEIsolamentoEntreConsultorias() throws Exception {
        Conta conta = novaConta();
        JsonNode semFinanceiro = membro(conta, "Sem financeiro", Set.of("ALUNO_LER"));
        JsonNode leitor = membro(conta, "Leitor financeiro", Set.of("FINANCEIRO_LER", "ALUNO_LER"));
        JsonNode gestor = membro(conta, "Gestor financeiro", Set.of("FINANCEIRO_ALTERAR", "FINANCEIRO_LER", "ALUNO_LER"));
        JsonNode aluno = api.convidarEEntrar(conta.login(), api.criarAluno(conta.login(), "Aluno Fictício " + UUID.randomUUID()));

        api.get(ROTA, semFinanceiro, 403);
        api.get(ROTA, aluno, 403);
        api.get(ROTA, null, 401);
        api.put(ROTA, semFinanceiro, corpo(null, "cliente-x-1", null, null, 0L), 403);
        // Quem só lê vê a situação, mas não a URL do webhook (ela carrega o token da consultoria); não grava nem remove.
        JsonNode lido = api.get(ROTA, leitor, 200);
        assertThat(lido.get("configurada").asBoolean()).isTrue();
        assertThat(lido.get("webhookUrl").isNull()).isTrue();
        assertThat(lido.toString()).doesNotContain(conta.caminho());
        api.put(ROTA, leitor, corpo(null, "cliente-x-1", null, null, 0L), 403);
        api.delete(ROTA, leitor, 403);
        JsonNode doGestor = api.put(ROTA, gestor, corpo(null, "cliente-do-gestor-g7", null, null, 0L), 200);
        assertThat(doGestor.get("webhookUrl").asString()).endsWith(conta.caminho());
        assertThat(doGestor.get("clientIdFinal").asString()).isEqualTo("r-g7");

        // Outra consultoria não vê nem mexe: cada uma tem a sua credencial e o seu token de caminho.
        Conta outra = novaConta();
        assertThat(api.get(ROTA, outra.login(), 200).get("webhookUrl").asString()).endsWith(outra.caminho())
                .doesNotEndWith(conta.caminho());
        assertThat(jdbc.queryForObject("select count(distinct token_caminho) from credencial_kiwify where consultoria_id in (?, ?)",
                Integer.class, conta.consultoria(), outra.consultoria())).isEqualTo(2);
        api.delete(ROTA, outra.login(), 204);
        assertThat(credenciais(conta.consultoria())).isEqualTo(1);
    }

    @Test
    void oPedidoEARespostaNaoImprimemSegredo() {
        var pedido = new KiwifyDtos.KiwifyRequest("token-segredo-123456", "cli-segredo", "sec-segredo", "acc-segredo", 1L);
        var resposta = new KiwifyDtos.KiwifyResponse(true, "https://x/publico/pagamentos/kiwify/tok", "a1b2", 1L);

        assertThat(pedido.toString()).doesNotContain("segredo").doesNotContain("123456");
        assertThat(resposta.toString()).doesNotContain("tok").doesNotContain("a1b2");
    }
}
