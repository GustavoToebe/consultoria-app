package br.com.treinos.api.pagamentos;

import br.com.treinos.api.pagamentos.provedor.KiwifyCliente;
import br.com.treinos.api.pagamentos.provedor.KiwifyFalsa.ModoDaVenda;
import br.com.treinos.api.pagamentos.provedor.KiwifyFalsa.ModoDoToken;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.JsonNode;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * A conciliação da Kiwify de ponta a ponta: o aviso assinado entra pelo webhook, o conciliador consulta a venda na Kiwify de
 * mentira ({@code KiwifyFalsa}, que confere OAuth e cabeçalhos) e só então baixa, quando TUDO confere. Cada divergência vira
 * "Para conferir" com o motivo certo e nunca baixa. Dados fictícios.
 */
@AutoConfigureMockMvc
class KiwifyConciliacaoIntegrationTest extends KiwifyDeTeste {

    @Autowired private KiwifyCliente cliente;
    @Autowired private PlatformTransactionManager transacoes;

    /** Aviso assinado para o pedido, com a venda registrada na Kiwify de mentira; devolve o id do pedido. */
    private String avisoComVenda(Assinante a, String evento, String status, String produto, String email, Long valor) throws Exception {
        String pedido = pedido();
        FALSA.venda(pedido, status, produto, email, valor);
        avisar(a.conta(), corpo(pedido, evento));
        return pedido;
    }

    private String pagoAprovado(Assinante a) throws Exception {
        return avisoComVenda(a, "order_approved", "paid", a.produto(), a.email(), VALOR);
    }

    private Map<String, Object> situacaoDaCobranca(Assinante a) {
        return cobrancaNoBanco(a.cobranca());
    }

    private void cancelarCobranca(Assinante a) throws Exception {
        long versao = ((Number) situacaoDaCobranca(a).get("versao")).longValue();
        api.post("/cobrancas/" + a.cobranca() + "/cancelar", a.conta().login(), Map.of("motivo", "teste", "versao", versao), 200);
    }

    private void conferir(Assinante a, String pedido, String evento, String motivo) {
        Map<String, Object> aviso = avisoNoBanco(a.conta(), pedido, evento);
        assertThat(aviso.get("situacao")).isEqualTo("CONFERIR");
        assertThat(aviso.get("motivo")).isEqualTo(motivo);
        assertThat(situacaoDaCobranca(a).get("situacao")).as("nenhuma baixa").isEqualTo("ABERTA");
    }

    // ---- a baixa ----

    @Test
    void daBaixaSoQuandoTudoConfere() throws Exception {
        Assinante a = novoAssinante(novaConta());
        String pedido = pagoAprovado(a);

        assertThat(situacaoDaCobranca(a).get("situacao")).as("o aviso sozinho nunca baixa").isEqualTo("ABERTA");
        assertThat(rodar()).isPositive();

        Map<String, Object> cobranca = situacaoDaCobranca(a);
        assertThat(cobranca.get("situacao")).isEqualTo("PAGA");
        assertThat(cobranca.get("forma")).isEqualTo("KIWIFY");
        assertThat(cobranca.get("provedor")).isEqualTo("KIWIFY");
        assertThat(cobranca.get("id_externo")).isEqualTo(pedido);
        assertThat(cobranca.get("pago_em")).isNotNull();
        assertThat(cobranca.get("baixa_por")).as("baixa do sistema").isNull();
        Map<String, Object> aviso = avisoNoBanco(a.conta(), pedido, "order_approved");
        assertThat(aviso.get("situacao")).isEqualTo("APLICADO");
        assertThat(aviso.get("cobranca_id")).isEqualTo(a.cobranca());
        assertThat(((Number) aviso.get("valor_pago_centavos")).longValue()).isEqualTo(VALOR);
        assertThat(auditorias(a.conta(), "PAGAMENTO_ONLINE_CONFIRMADO")).isEqualTo(1);
        // Uma volta ao OAuth e uma consulta, com o cabeçalho da conta.
        assertThat(FALSA.requisicoes("/v1/oauth/token")).hasSize(1);
        assertThat(FALSA.requisicoes("/v1/sales/")).hasSize(1);
        assertThat(FALSA.requisicoes("/v1/sales/").get(0).caminho()).isEqualTo("/v1/sales/" + pedido);
        assertThat(FALSA.requisicoes("/v1/sales/").get(0).conta()).isNotBlank();
    }

    @Test
    void oEmailDaCompraSemDiferencaDeCaixaCasaComOAluno() throws Exception {
        Assinante a = novoAssinante(novaConta());
        avisoComVenda(a, "order_approved", "paid", a.produto(), a.email().toUpperCase(java.util.Locale.ROOT), VALOR);

        rodar();

        assertThat(situacaoDaCobranca(a).get("situacao")).isEqualTo("PAGA");
    }

    @Test
    void aBaixaDeUmAvisoRenovadoVaiParaAMensalidadeAbertaMaisAntiga() throws Exception {
        Assinante a = novoAssinante(novaConta());
        String pedido = avisoComVenda(a, "subscription_renewed", "paid", a.produto(), a.email(), VALOR);

        rodar();

        assertThat(avisoNoBanco(a.conta(), pedido, "subscription_renewed").get("situacao")).isEqualTo("APLICADO");
        assertThat(situacaoDaCobranca(a).get("situacao")).isEqualTo("PAGA");
    }

    @Test
    void aprovadaERenovadaDoMesmoPedidoNaoBaixamDuasVezes() throws Exception {
        Assinante a = novoAssinante(novaConta());
        String pedido = pagoAprovado(a);
        avisar(a.conta(), corpo(pedido, "subscription_renewed"));

        rodar();
        rodar();

        assertThat(cobrancasDe(a.conta(), a.aluno(), "PAGA")).hasSize(1);
        assertThat(avisoNoBanco(a.conta(), pedido, "order_approved").get("situacao")).isEqualTo("APLICADO");
        assertThat(avisoNoBanco(a.conta(), pedido, "subscription_renewed").get("situacao")).isEqualTo("APLICADO");
        assertThat(auditorias(a.conta(), "PAGAMENTO_ONLINE_CONFIRMADO")).isEqualTo(1);
    }

    @Test
    void repetirOAvisoJaAplicadoReconsultaEMantemAMesmaBaixa() throws Exception {
        Assinante a = novoAssinante(novaConta());
        String pedido = pagoAprovado(a);
        rodar();
        avisar(a.conta(), corpo(pedido, "order_approved"));

        rodar();

        assertThat(inteiro(avisoNoBanco(a.conta(), pedido, "order_approved"), "revisao")).isEqualTo(2);
        assertThat(avisoNoBanco(a.conta(), pedido, "order_approved").get("situacao")).isEqualTo("APLICADO");
        assertThat(cobrancasDe(a.conta(), a.aluno(), "PAGA")).hasSize(1);
        assertThat(auditorias(a.conta(), "PAGAMENTO_ONLINE_CONFIRMADO")).isEqualTo(1);
    }

    @Test
    void segundoPedidoPagoSemMensalidadeAbertaSobrandoVaiParaConferirSemNovaBaixa() throws Exception {
        Assinante a = novoAssinante(novaConta());
        pagoAprovado(a);
        rodar();
        for (JsonNode aberta : cobrancasDe(a.conta(), a.aluno(), "ABERTA")) {
            api.post("/cobrancas/" + aberta.get("id").asString() + "/cancelar", a.conta().login(),
                    Map.of("motivo", "teste", "versao", aberta.get("versao").asLong()), 200);
        }
        String segundo = pagoAprovado(a);

        rodar();

        Map<String, Object> aviso = avisoNoBanco(a.conta(), segundo, "order_approved");
        assertThat(aviso.get("situacao")).isEqualTo("CONFERIR");
        assertThat(aviso.get("motivo")).isEqualTo(ConclusaoDoAvisoKiwify.SEM_MENSALIDADE_ABERTA);
        assertThat(cobrancasDe(a.conta(), a.aluno(), "PAGA")).hasSize(1);
    }

    // ---- "Para conferir" ----

    @Test
    void emailSemAlunoVaiParaConferir() throws Exception {
        Assinante a = novoAssinante(novaConta());
        String pedido = avisoComVenda(a, "order_approved", "paid", a.produto(), emailUnico(), VALOR);

        rodar();

        conferir(a, pedido, "order_approved", ConclusaoDoAvisoKiwify.EMAIL_SEM_ALUNO);
    }

    @Test
    void vendaSemEmailVaiParaConferir() throws Exception {
        Assinante a = novoAssinante(novaConta());
        String pedido = avisoComVenda(a, "order_approved", "paid", a.produto(), null, VALOR);

        rodar();

        conferir(a, pedido, "order_approved", ConclusaoDoAvisoKiwify.EMAIL_SEM_ALUNO);
    }

    @Test
    void emailDeDoisAlunosVaiParaConferirSemEscolherUm() throws Exception {
        Conta conta = novaConta();
        Assinante a = novoAssinante(conta);
        alunoComEmail(conta, a.email());
        String pedido = pagoAprovado(a);

        rodar();

        conferir(a, pedido, "order_approved", ConclusaoDoAvisoKiwify.EMAIL_DE_VARIOS_ALUNOS);
    }

    @Test
    void alunoSemContratacaoNoPlanoDoProdutoVaiParaConferir() throws Exception {
        Conta conta = novaConta();
        Assinante a = novoAssinante(conta);
        String outroProduto = "prod-" + UUID.randomUUID();
        planoKiwify(conta, outroProduto, VALOR);
        // O produto é do outro plano, em que o aluno não está contratado.
        String pedido = avisoComVenda(a, "order_approved", "paid", outroProduto, a.email(), VALOR);

        rodar();

        conferir(a, pedido, "order_approved", ConclusaoDoAvisoKiwify.SEM_CONTRATACAO_NO_PLANO);
    }

    @Test
    void semMensalidadeAbertaVaiParaConferir() throws Exception {
        Assinante a = novoAssinante(novaConta());
        cancelarCobranca(a);
        String pedido = pagoAprovado(a);

        rodar();

        Map<String, Object> aviso = avisoNoBanco(a.conta(), pedido, "order_approved");
        assertThat(aviso.get("situacao")).isEqualTo("CONFERIR");
        assertThat(aviso.get("motivo")).isEqualTo(ConclusaoDoAvisoKiwify.SEM_MENSALIDADE_ABERTA);
        assertThat(situacaoDaCobranca(a).get("situacao")).isEqualTo("CANCELADA");
    }

    @Test
    void valorOuMoedaDiferenteVaiParaConferir() throws Exception {
        Assinante a = novoAssinante(novaConta());
        String maior = avisoComVenda(a, "order_approved", "paid", a.produto(), a.email(), VALOR + 1);
        String semValor = avisoComVenda(a, "order_approved", "paid", a.produto(), a.email(), null);
        String dolar = pedido();
        FALSA.vendaEmMoeda(dolar, "paid", a.produto(), a.email(), VALOR, "USD");
        avisar(a.conta(), corpo(dolar, "order_approved"));

        rodar();

        for (String pedido : List.of(maior, semValor, dolar)) {
            Map<String, Object> aviso = avisoNoBanco(a.conta(), pedido, "order_approved");
            assertThat(aviso.get("situacao")).as(pedido).isEqualTo("CONFERIR");
            assertThat(aviso.get("motivo")).as(pedido).isEqualTo(ConclusaoDoAvisoKiwify.VALOR_DIFERENTE);
        }
        assertThat(situacaoDaCobranca(a).get("situacao")).isEqualTo("ABERTA");
    }

    @Test
    void assinaturaCanceladaReembolsoEChargebackSoInformamENuncaMexemNaBaixa() throws Exception {
        Assinante a = novoAssinante(novaConta());
        pagoAprovado(a);
        rodar();
        assertThat(situacaoDaCobranca(a).get("situacao")).isEqualTo("PAGA");
        String pedido = pedido();
        FALSA.venda(pedido, "refunded", a.produto(), a.email(), VALOR);

        for (String evento : List.of("subscription_canceled", "order_refunded", "chargeback")) {
            avisar(a.conta(), corpo(pedido, evento));
        }
        rodar();

        assertThat(avisoNoBanco(a.conta(), pedido, "subscription_canceled").get("motivo"))
                .isEqualTo(ConclusaoDoAvisoKiwify.ASSINATURA_CANCELADA);
        assertThat(avisoNoBanco(a.conta(), pedido, "order_refunded").get("motivo")).isEqualTo(ConclusaoDoAvisoKiwify.REEMBOLSO);
        assertThat(avisoNoBanco(a.conta(), pedido, "chargeback").get("motivo")).isEqualTo(ConclusaoDoAvisoKiwify.CHARGEBACK);
        for (String evento : List.of("subscription_canceled", "order_refunded", "chargeback")) {
            assertThat(avisoNoBanco(a.conta(), pedido, evento).get("situacao")).isEqualTo("CONFERIR");
        }
        // A baixa continua e nada foi estornado nem encerrado.
        assertThat(situacaoDaCobranca(a).get("situacao")).isEqualTo("PAGA");
        assertThat(cobrancasDe(a.conta(), a.aluno(), "PAGA")).hasSize(1);
        assertThat(auditorias(a.conta(), "PAGAMENTO_PARA_CONFERIR")).isEqualTo(3);
    }

    @Test
    void aprovadaMasConsultadaComoReembolsadaOuChargebackVaiParaConferirSemBaixa() throws Exception {
        Assinante a = novoAssinante(novaConta());
        String reembolsado = avisoComVenda(a, "order_approved", "refunded", a.produto(), a.email(), VALOR);
        String contestado = avisoComVenda(a, "order_approved", "chargedback", a.produto(), a.email(), VALOR);

        rodar();

        assertThat(avisoNoBanco(a.conta(), reembolsado, "order_approved").get("motivo")).isEqualTo(ConclusaoDoAvisoKiwify.REEMBOLSO);
        assertThat(avisoNoBanco(a.conta(), contestado, "order_approved").get("motivo")).isEqualTo(ConclusaoDoAvisoKiwify.CHARGEBACK);
        assertThat(situacaoDaCobranca(a).get("situacao")).isEqualTo("ABERTA");
    }

    @Test
    void produtoQueNaoEDeNenhumPlanoComPagamentoConfirmadoVaiParaConferirSemBaixaNuncaIgnorado() throws Exception {
        Assinante a = novoAssinante(novaConta());
        String aprovada = avisoComVenda(a, "order_approved", "paid", "produto-de-outra-coisa", a.email(), VALOR);
        String renovada = avisoComVenda(a, "subscription_renewed", "paid", "produto-de-outra-coisa", emailUnico(), VALOR);

        rodar();

        for (String pedido : List.of(aprovada, renovada)) {
            String evento = pedido.equals(aprovada) ? "order_approved" : "subscription_renewed";
            Map<String, Object> aviso = avisoNoBanco(a.conta(), pedido, evento);
            assertThat(aviso.get("situacao")).as(evento).isEqualTo("CONFERIR");
            assertThat(aviso.get("motivo")).as(evento).isEqualTo(ConclusaoDoAvisoKiwify.COBRANCA_NAO_ENCONTRADA);
            assertThat(aviso.get("cobranca_id")).as(evento).isNull();
            assertThat(((Number) aviso.get("valor_pago_centavos")).longValue()).as(evento).isEqualTo(VALOR);
        }
        assertThat(situacaoDaCobranca(a).get("situacao")).as("nunca baixa").isEqualTo("ABERTA");
        assertThat(auditorias(a.conta(), "PAGAMENTO_PARA_CONFERIR")).isEqualTo(2);
    }

    @Test
    void produtoQueNaoEDeNenhumPlanoSemPagamentoConfirmadoOuSoInformativoContinuaIgnorado() throws Exception {
        Assinante a = novoAssinante(novaConta());
        String aguardando = avisoComVenda(a, "order_approved", "waiting_payment", "produto-de-outra-coisa", a.email(), VALOR);
        String recusada = avisoComVenda(a, "order_approved", "refused", "produto-de-outra-coisa", a.email(), VALOR);
        String reembolso = pedido();
        FALSA.venda(reembolso, "paid", "produto-de-outra-coisa", a.email(), VALOR);
        avisar(a.conta(), corpo(reembolso, "order_refunded"));

        rodar();

        assertThat(avisoNoBanco(a.conta(), aguardando, "order_approved").get("situacao")).isEqualTo("IGNORADO");
        assertThat(avisoNoBanco(a.conta(), recusada, "order_approved").get("situacao")).isEqualTo("IGNORADO");
        assertThat(avisoNoBanco(a.conta(), reembolso, "order_refunded").get("situacao")).isEqualTo("IGNORADO");
        assertThat(situacaoDaCobranca(a).get("situacao")).isEqualTo("ABERTA");
    }

    private void arquivarPlano(Assinante a) throws Exception {
        long versao = jdbc.queryForObject("select versao from plano_comercial where id = ?", Long.class, UUID.fromString(a.plano()));
        api.post("/financeiro/planos/" + a.plano() + "/arquivar", a.conta().login(), Map.of("versao", versao), 200);
    }

    @Test
    void planoArquivadoComContratacaoAtivaBaixaNormalmenteEnaoIgnora() throws Exception {
        Assinante a = novoAssinante(novaConta());
        arquivarPlano(a);
        String pedido = pagoAprovado(a);

        rodar();

        assertThat(avisoNoBanco(a.conta(), pedido, "order_approved").get("situacao")).isEqualTo("APLICADO");
        assertThat(situacaoDaCobranca(a).get("situacao")).isEqualTo("PAGA");
    }

    @Test
    void planoArquivadoSemComoBaixarVaiParaConferirNuncaIgnorado() throws Exception {
        Assinante a = novoAssinante(novaConta());
        cancelarCobranca(a);
        arquivarPlano(a);
        String renovada = avisoComVenda(a, "subscription_renewed", "paid", a.produto(), a.email(), VALOR);
        String semAluno = avisoComVenda(a, "order_approved", "paid", a.produto(), emailUnico(), VALOR);

        rodar();

        Map<String, Object> aviso = avisoNoBanco(a.conta(), renovada, "subscription_renewed");
        assertThat(aviso.get("situacao")).isEqualTo("CONFERIR");
        assertThat(aviso.get("motivo")).isEqualTo(ConclusaoDoAvisoKiwify.SEM_MENSALIDADE_ABERTA);
        Map<String, Object> outro = avisoNoBanco(a.conta(), semAluno, "order_approved");
        assertThat(outro.get("situacao")).isEqualTo("CONFERIR");
        assertThat(outro.get("motivo")).isEqualTo(ConclusaoDoAvisoKiwify.EMAIL_SEM_ALUNO);
    }

    @Test
    void reembolsoDepoisDaBaixaComPlanoArquivadoVaiParaConferirComACobranca() throws Exception {
        Assinante a = novoAssinante(novaConta());
        String pedido = pagoAprovado(a);
        rodar();
        arquivarPlano(a);
        FALSA.venda(pedido, "refunded", a.produto(), a.email(), VALOR);
        for (String evento : List.of("order_refunded", "chargeback", "subscription_canceled")) {
            avisar(a.conta(), corpo(pedido, evento));
        }

        rodar();

        for (String evento : List.of("order_refunded", "chargeback", "subscription_canceled")) {
            Map<String, Object> aviso = avisoNoBanco(a.conta(), pedido, evento);
            assertThat(aviso.get("situacao")).as(evento).isEqualTo("CONFERIR");
            assertThat(aviso.get("cobranca_id")).as(evento).isEqualTo(a.cobranca());
        }
        assertThat(situacaoDaCobranca(a).get("situacao")).isEqualTo("PAGA");
    }

    @Test
    void produtoTrocadoDepoisDaBaixaNaoIgnoraReembolsoNemRenovacaoDoMesmoPedido() throws Exception {
        Assinante a = novoAssinante(novaConta());
        String pedido = pagoAprovado(a);
        rodar();
        // O plano passa a apontar para outro produto: o do pedido já baixado não é mais de nenhum plano.
        jdbc.update("update plano_comercial set kiwify_produto_id = ? where id = ?", "prod-novo-" + UUID.randomUUID(),
                UUID.fromString(a.plano()));
        FALSA.venda(pedido, "refunded", a.produto(), a.email(), VALOR);
        avisar(a.conta(), corpo(pedido, "order_refunded"));
        FALSA.venda(pedido, "paid", a.produto(), a.email(), VALOR);
        avisar(a.conta(), corpo(pedido, "subscription_renewed"));

        rodar();

        Map<String, Object> reembolso = avisoNoBanco(a.conta(), pedido, "order_refunded");
        assertThat(reembolso.get("situacao")).isEqualTo("CONFERIR");
        assertThat(reembolso.get("motivo")).isEqualTo(ConclusaoDoAvisoKiwify.REEMBOLSO);
        Map<String, Object> renovada = avisoNoBanco(a.conta(), pedido, "subscription_renewed");
        assertThat(renovada.get("situacao")).isEqualTo("APLICADO");
        assertThat(renovada.get("cobranca_id")).isEqualTo(a.cobranca());
        assertThat(cobrancasDe(a.conta(), a.aluno(), "PAGA")).hasSize(1);
    }

    @Test
    void produtoDeOutraConsultoriaNaoBaixaNestaNemNaOutra() throws Exception {
        Assinante a = novoAssinante(novaConta());
        Assinante b = novoAssinante(novaConta(), a.email(), "prod-" + UUID.randomUUID(), VALOR);
        // O pedido chega pela consultoria de B, mas com o produto e o e-mail de A: o produto não é de nenhum plano de B.
        String pedido = avisoComVenda(b, "order_approved", "paid", a.produto(), a.email(), VALOR);

        rodar();

        Map<String, Object> aviso = avisoNoBanco(b.conta(), pedido, "order_approved");
        assertThat(aviso.get("situacao")).isEqualTo("CONFERIR");
        assertThat(aviso.get("motivo")).isEqualTo(ConclusaoDoAvisoKiwify.COBRANCA_NAO_ENCONTRADA);
        assertThat(situacaoDaCobranca(a).get("situacao")).isEqualTo("ABERTA");
        assertThat(situacaoDaCobranca(b).get("situacao")).isEqualTo("ABERTA");
    }

    // ---- consulta que falha ----

    @Test
    void consultaQueFalhaTentaDeNovoEDepoisDe12TentativasVaiParaConferir() throws Exception {
        Assinante a = novoAssinante(novaConta());
        String pedido = pagoAprovado(a);
        FALSA.modoDaVenda(ModoDaVenda.HTTP_429);

        rodar();

        Map<String, Object> primeira = avisoNoBanco(a.conta(), pedido, "order_approved");
        assertThat(primeira.get("situacao")).isEqualTo("PENDENTE");
        assertThat(inteiro(primeira, "tentativas")).isEqualTo(1);
        assertThat(rodar()).as("ainda não venceu a espera").isZero();

        for (int i = 1; i < ConclusaoDoAvisoKiwify.MAXIMO_DE_FALHAS; i++) {
            assertThat(avisoNoBanco(a.conta(), pedido, "order_approved").get("situacao")).isEqualTo("PENDENTE");
            vencer(a.conta(), pedido, "order_approved");
            rodar();
        }

        conferir(a, pedido, "order_approved", ConclusaoDoAvisoKiwify.CONSULTA_FALHOU);
        assertThat(FALSA.requisicoes("/v1/sales/")).hasSize(ConclusaoDoAvisoKiwify.MAXIMO_DE_FALHAS);
    }

    @Test
    void falhasDaKiwifyNuncaBaixamEVoltamParaAFila() throws Exception {
        Assinante a = novoAssinante(novaConta());
        for (ModoDaVenda modo : List.of(ModoDaVenda.HTTP_500, ModoDaVenda.JSON_INVALIDO, ModoDaVenda.OUTRO_PEDIDO,
                ModoDaVenda.NAO_ENCONTRADA)) {
            FALSA.modoDaVenda(modo);
            String pedido = pagoAprovado(a);

            rodar();

            Map<String, Object> aviso = avisoNoBanco(a.conta(), pedido, "order_approved");
            assertThat(aviso.get("situacao")).as(modo.name()).isEqualTo("PENDENTE");
            assertThat(inteiro(aviso, "tentativas")).as(modo.name()).isEqualTo(1);
            assertThat(situacaoDaCobranca(a).get("situacao")).as(modo.name()).isEqualTo("ABERTA");
        }
    }

    @Test
    void oAuthRejeitadoOuForaDoArVoltaParaAFila() throws Exception {
        Assinante a = novoAssinante(novaConta());
        for (ModoDoToken modo : List.of(ModoDoToken.REJEITADO, ModoDoToken.HTTP_500)) {
            FALSA.modoDoToken(modo);
            String pedido = pagoAprovado(a);

            rodar();

            Map<String, Object> aviso = avisoNoBanco(a.conta(), pedido, "order_approved");
            assertThat(aviso.get("situacao")).as(modo.name()).isEqualTo("PENDENTE");
            assertThat(inteiro(aviso, "tentativas")).as(modo.name()).isEqualTo(1);
        }
        assertThat(FALSA.requisicoes("/v1/sales/")).as("sem token, sem consulta").isEmpty();
    }

    @Test
    void vendaAindaNaoPagaEsperaEDepoisIgnora() throws Exception {
        Assinante a = novoAssinante(novaConta());
        String pedido = avisoComVenda(a, "order_approved", "waiting_payment", a.produto(), a.email(), VALOR);

        for (int i = 0; i < 3; i++) {
            rodar();
            Map<String, Object> aviso = avisoNoBanco(a.conta(), pedido, "order_approved");
            assertThat(aviso.get("situacao")).isEqualTo("PENDENTE");
            assertThat(inteiro(aviso, "tentativas")).isEqualTo(i + 1);
            vencer(a.conta(), pedido, "order_approved");
        }
        rodar();

        assertThat(avisoNoBanco(a.conta(), pedido, "order_approved").get("situacao")).isEqualTo("IGNORADO");
        assertThat(situacaoDaCobranca(a).get("situacao")).isEqualTo("ABERTA");
    }

    @Test
    void credencialRemovidaDepoisDoAvisoVaiParaConferirSemChamarAKiwify() throws Exception {
        Assinante a = novoAssinante(novaConta());
        String pedido = pagoAprovado(a);
        api.delete("/financeiro/kiwify", a.conta().login(), 204);

        rodar();

        conferir(a, pedido, "order_approved", ConclusaoDoAvisoKiwify.CONSULTA_FALHOU);
        assertThat(FALSA.requisicoes()).isEmpty();
    }

    // ---- OAuth ----

    @Test
    void oTokenDoOAuthFicaEmCacheEERenovadoQuandoARevogacaoApareceNaConsulta() throws Exception {
        Assinante a = novoAssinante(novaConta());
        String um = avisoComVenda(a, "order_approved", "paid", "produto-de-outra-coisa", a.email(), VALOR);
        String dois = avisoComVenda(a, "order_approved", "paid", "produto-de-outra-coisa", a.email(), VALOR);

        rodar();

        assertThat(FALSA.tokensEmitidos()).as("duas consultas, um token").isEqualTo(1);
        assertThat(FALSA.requisicoes("/v1/sales/")).hasSize(2);
        FALSA.revogarTokens();
        String tres = avisoComVenda(a, "order_approved", "paid", "produto-de-outra-coisa", a.email(), VALOR);

        rodar();

        assertThat(FALSA.tokensEmitidos()).as("a Kiwify recusou o token velho: pede outro e repete a consulta").isEqualTo(2);
        for (String pedido : List.of(um, dois, tres)) {
            assertThat(avisoNoBanco(a.conta(), pedido, "order_approved").get("situacao")).isEqualTo("CONFERIR");
        }
    }

    @Test
    void oOAuthEmCacheEPorConsultoria() throws Exception {
        Assinante a = novoAssinante(novaConta());
        Assinante b = novoAssinante(novaConta());
        avisoComVenda(a, "order_approved", "paid", "produto-de-outra-coisa", a.email(), VALOR);
        avisoComVenda(b, "order_approved", "paid", "produto-de-outra-coisa", b.email(), VALOR);

        rodar();

        assertThat(FALSA.tokensEmitidos()).isEqualTo(2);
    }

    // ---- segurança ----

    @Test
    void aChamadaAKiwifyRecusaTransacaoAberta() {
        KiwifyCliente.Credenciais credenciais = new KiwifyCliente.Credenciais("id", "segredo", "conta");

        assertThatThrownBy(() -> new TransactionTemplate(transacoes).executeWithoutResult(
                s -> cliente.consultar(UUID.randomUUID(), credenciais, "pedido")))
                .isInstanceOf(IllegalStateException.class);
        assertThat(FALSA.requisicoes()).isEmpty();
    }

    @Test
    void nadaDoCompradorFicaNoBancoNemNaAuditoria() throws Exception {
        Assinante a = novoAssinante(novaConta());
        String pedido = pagoAprovado(a);
        String semAluno = avisoComVenda(a, "order_approved", "paid", a.produto(), emailUnico(), VALOR);

        rodar();

        for (String evento : List.of(pedido, semAluno)) {
            String linha = jdbc.queryForObject("select a::text from aviso_de_pagamento a where consultoria_id = ? and transacao = ?",
                    String.class, a.conta().consultoria(), evento + ":order_approved");
            assertThat(linha).doesNotContain("@exemplo.invalid").doesNotContain("Comprador");
        }
        List<String> resumos = jdbc.queryForList("select resumo from auditoria where consultoria_id = ? "
                + "and acao in ('PAGAMENTO_ONLINE_CONFIRMADO', 'PAGAMENTO_PARA_CONFERIR')", String.class, a.conta().consultoria());
        assertThat(resumos).hasSize(2).allSatisfy(r -> assertThat(r).doesNotContain("@").doesNotContain("15000")
                .doesNotContain("150,00").doesNotContain(a.email()));
        assertThat(resumos).containsExactlyInAnyOrder(
                "Baixa automática de um pagamento online confirmado pela Kiwify.",
                "Pagamento online da Kiwify que não pôde ser aplicado sozinho; ficou para conferir.");
    }

    @Test
    void aConferenciaListaOQueFicouParaConferirComProvedorEIdExterno() throws Exception {
        Assinante a = novoAssinante(novaConta());
        String pedido = avisoComVenda(a, "order_approved", "paid", a.produto(), emailUnico(), VALOR);
        rodar();

        JsonNode lista = api.get("/financeiro/conferencias", a.conta().login(), 200).get("itens");

        assertThat(lista.size()).isEqualTo(1);
        assertThat(lista.get(0).get("provedor").asString()).isEqualTo("KIWIFY");
        assertThat(lista.get(0).get("idExterno").asString()).isEqualTo(pedido);
        assertThat(lista.get(0).get("motivo").asString()).isEqualTo(ConclusaoDoAvisoKiwify.EMAIL_SEM_ALUNO);
        assertThat(lista.toString()).doesNotContain("@exemplo.invalid");
    }
}
