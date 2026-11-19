package br.com.treinos.api.pagamentos;

import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.pagamentos.AvisoDePagamentoRepositorio.DadosDoPagamento;
import br.com.treinos.api.pagamentos.AvisoDePagamentoRepositorio.Reservado;
import br.com.treinos.api.pagamentos.AvisoDePagamentoRepositorio.Travado;
import br.com.treinos.api.pagamentos.BaixaDeCobranca.Baixa;
import br.com.treinos.api.pagamentos.provedor.KiwifyCliente;
import br.com.treinos.api.pagamentos.provedor.KiwifyCliente.Venda;
import br.com.treinos.api.web.Fuso;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

/**
 * As duas pontas do conciliador da Kiwify que tocam o banco, ao redor da consulta da venda (que fica fora de qualquer
 * transação): {@link #preparar} lê e decifra a credencial; {@link #concluir} decide e grava. O aviso (assinado) só diz "olhe
 * esta venda": a baixa nasce da consulta da venda à Kiwify, e só quando TUDO confere (D17 e D19): {@code status=paid},
 * {@code product.id} igual ao produto de um plano, {@code customer.email} igual ao e-mail de um aluno ativo da consultoria (um
 * só), contratação ATIVA no plano daquele produto, mensalidade ABERTA e valor ({@code payment.charge_amount}) igual ao dela.
 * Qualquer dúvida vira "Para conferir", nunca baixa; nada encerra contratação nem estorna sozinho.
 *
 * <p>Toda decisão é tomada aqui dentro, sob trava (aviso, depois aluno, contratação e cobrança, nessa ordem), relendo a
 * cobrança travada. Antes de travar só se leem ids (projeções), para a entidade entrar na sessão já travada. Quem chama põe a
 * consultoria em {@code TenantContext.executarComo} antes de entrar aqui. Nada daqui vai a log: o e-mail do comprador, o
 * produto e o valor da venda ficam só em memória.
 */
@Component
class ConclusaoDoAvisoKiwify {

    static final String PROVEDOR = KiwifyConfiguracaoService.PROVEDOR;
    /** Tentativas de consulta falhas (rede, HTTP, JSON, 429) antes de o aviso ir para a conferência. */
    static final int MAXIMO_DE_FALHAS = 12;
    /** Esperas, em segundos, depois da consulta que ainda não viu o pagamento (tentativas 0, 1 e 2); a quarta vira IGNORADO. */
    private static final long[] ESPERA_SE_NAO_PAGO = {60, 300, 900};
    private static final long ESPERA_MAXIMA_DA_FALHA = 3600;

    static final String STATUS_PAGO = "paid";
    static final String STATUS_REEMBOLSADO = "refunded";
    static final String STATUS_CHARGEBACK = "chargedback";
    private static final String MOEDA = "BRL";

    private static final String RESUMO_CONFIRMADO = "Baixa automática de um pagamento online confirmado pela Kiwify.";
    private static final String RESUMO_PARA_CONFERIR =
            "Pagamento online da Kiwify que não pôde ser aplicado sozinho; ficou para conferir.";
    private static final String RESUMO_INFORMADO =
            "A Kiwify informou cancelamento, reembolso ou chargeback; nenhuma baixa foi alterada e ficou para conferir.";

    /** Motivos de "Para conferir" (D19): o app os conhece por estes nomes. */
    static final String EMAIL_SEM_ALUNO = "KIWIFY_EMAIL_SEM_ALUNO";
    static final String EMAIL_DE_VARIOS_ALUNOS = "KIWIFY_EMAIL_DE_VARIOS_ALUNOS";
    static final String SEM_CONTRATACAO_NO_PLANO = "KIWIFY_SEM_CONTRATACAO_NO_PLANO";
    static final String SEM_MENSALIDADE_ABERTA = "KIWIFY_SEM_MENSALIDADE_ABERTA";
    static final String ASSINATURA_CANCELADA = "KIWIFY_ASSINATURA_CANCELADA";
    static final String REEMBOLSO = "KIWIFY_REEMBOLSO";
    static final String CHARGEBACK = "KIWIFY_CHARGEBACK";
    static final String COBRANCA_NAO_ENCONTRADA = "COBRANCA_NAO_ENCONTRADA";
    static final String VALOR_DIFERENTE = "VALOR_DIFERENTE";
    static final String CONSULTA_FALHOU = "CONSULTA_FALHOU";

    /** O que a chamada à Kiwify precisa: a credencial decifrada (nula se não há ou não decifra). Só em memória. */
    record Preparo(KiwifyCliente.Credenciais credencial) {

        @Override
        public String toString() {
            return "Preparo[...]";
        }
    }

    /** A venda consultada, ou a razão de não ter sido: falha da Kiwify, ou credencial que falta. */
    record Resultado(Venda venda, boolean faltaCredencial) {

        static Resultado consultado(Venda venda) {
            return new Resultado(Objects.requireNonNull(venda), false);
        }

        static Resultado falhou() {
            return new Resultado(null, false);
        }

        static Resultado semCredencial() {
            return new Resultado(null, true);
        }
    }

    private final AvisoDePagamentoRepositorio avisos;
    private final CredencialKiwifyRepository credenciais;
    private final CifraDePagamento cifra;
    private final PlanoComercialRepository planos;
    private final ContratacaoAlunoRepository contratacoes;
    private final CobrancaAlunoRepository cobrancas;
    private final KiwifyBuscas alunos;
    private final Travas travas;
    private final BaixaDeCobranca baixa;
    private final Auditoria auditoria;

    ConclusaoDoAvisoKiwify(AvisoDePagamentoRepositorio avisos, CredencialKiwifyRepository credenciais, CifraDePagamento cifra,
                           PlanoComercialRepository planos, ContratacaoAlunoRepository contratacoes,
                           CobrancaAlunoRepository cobrancas, KiwifyBuscas alunos, Travas travas, BaixaDeCobranca baixa,
                           Auditoria auditoria) {
        this.avisos = avisos;
        this.credenciais = credenciais;
        this.cifra = cifra;
        this.planos = planos;
        this.contratacoes = contratacoes;
        this.cobrancas = cobrancas;
        this.alunos = alunos;
        this.travas = travas;
        this.baixa = baixa;
        this.auditoria = auditoria;
    }

    /** Passo 1 (transação curta, só leitura). A credencial é decifrada só em memória, para a chamada. */
    @Transactional(readOnly = true)
    Preparo preparar(Reservado aviso) {
        CredencialKiwify credencial = credenciais.daConsultoria().orElse(null);
        if (credencial == null) {
            return new Preparo(null);
        }
        try {
            UUID consultoria = aviso.consultoriaId();
            return new Preparo(new KiwifyCliente.Credenciais(cifra.decifrar(consultoria, credencial.getClientIdCifrado()),
                    cifra.decifrar(consultoria, credencial.getClientSecretCifrado()),
                    cifra.decifrar(consultoria, credencial.getAccountIdCifrado())));
        } catch (CifraIndisponivelException e) {
            return new Preparo(null);
        }
    }

    /**
     * Passo 3. Trava o aviso e confere que a reserva ainda é desta execução e que ninguém o rearmou (outra notificação muda a
     * revisão): se mudou, só devolve o aviso à fila, que o consulta de novo na próxima rodada.
     */
    @Transactional
    void concluir(Reservado aviso, UUID dono, Resultado resultado) {
        Travado atual = avisos.travar(aviso.consultoriaId(), aviso.id()).orElse(null);
        if (atual == null || !dono.equals(atual.reservadoPor())) {
            return;
        }
        if (atual.revisao() != aviso.revisao() || !"PENDENTE".equals(atual.situacao())) {
            avisos.liberar(aviso.consultoriaId(), aviso.id());
            return;
        }
        if (resultado.venda() == null) {
            falhou(aviso, atual, resultado.faltaCredencial());
        } else {
            decidir(aviso, atual, resultado.venda());
        }
    }

    // ---- consulta com falha ----

    /** Espera 60 s × 2^tentativas (no máximo 1 h); na 12ª falha, ou sem credencial, vai para a conferência. */
    private void falhou(Reservado aviso, Travado atual, boolean semCredencial) {
        if (semCredencial || atual.tentativas() + 1 >= MAXIMO_DE_FALHAS) {
            paraConferir(aviso, CONSULTA_FALHOU, idDaBaixa(aviso).orElse(null), null, DadosDoPagamento.NENHUM);
            return;
        }
        long espera = Math.min(60L << Math.min(atual.tentativas(), 6), ESPERA_MAXIMA_DA_FALHA);
        avisos.reagendar(aviso.consultoriaId(), aviso.id(), espera);
    }

    // ---- venda consultada ----

    private void decidir(Reservado aviso, Travado atual, Venda venda) {
        Long valor = positivoOuNulo(venda.valorCentavos());
        String evento = aviso.eventoTipo();
        boolean informativo = AvisoKiwifyService.REEMBOLSADA.equals(evento) || AvisoKiwifyService.CHARGEBACK.equals(evento)
                || AvisoKiwifyService.CANCELADA.equals(evento);
        if (!informativo && !AvisoKiwifyService.APROVADA.equals(evento) && !AvisoKiwifyService.RENOVADA.equals(evento)) {
            avisos.encerrar(aviso.consultoriaId(), aviso.id(), "IGNORADO", null, null, null, DadosDoPagamento.NENHUM);
            return;
        }
        // Pedido que já deu baixa nunca é ignorado, seja qual for o plano de hoje (arquivado, produto trocado, assinatura desligada).
        UUID baixada = idDaBaixa(aviso).orElse(null);
        // Sem baixa, produto que não é de nenhum plano da consultoria (arquivados incluídos): pagamento CONFIRMADO vai para a
        // conferência (D4, 18/11: dinheiro que entrou nunca é ignorado); o resto (não pago, cancelamento, reembolso) é ignorado.
        List<UUID> planosDoProduto = venda.produtoId() == null ? List.of() : planos.idsDoProdutoDaKiwify(venda.produtoId());
        if (baixada == null && planosDoProduto.isEmpty()) {
            if (!informativo && STATUS_PAGO.equals(venda.status())) {
                paraConferir(aviso, COBRANCA_NAO_ENCONTRADA, null, valor, new DadosDoPagamento(venda.meio(), venda.parcelas(), null));
            } else {
                avisos.encerrar(aviso.consultoriaId(), aviso.id(), "IGNORADO", null, null, null, DadosDoPagamento.NENHUM);
            }
            return;
        }
        if (AvisoKiwifyService.REEMBOLSADA.equals(evento)) {
            informado(aviso, REEMBOLSO, baixada, valor);
        } else if (AvisoKiwifyService.CHARGEBACK.equals(evento)) {
            informado(aviso, CHARGEBACK, baixada, valor);
        } else if (AvisoKiwifyService.CANCELADA.equals(evento)) {
            informado(aviso, ASSINATURA_CANCELADA, baixada, valor);
        } else {
            aprovada(aviso, atual, venda, planosDoProduto, baixada, valor);
        }
    }

    /** Cancelamento, reembolso e chargeback: só informação para o treinador. Nada é encerrado nem estornado aqui. */
    private void informado(Reservado aviso, String motivo, UUID cobrancaId, Long valor) {
        avisos.encerrar(aviso.consultoriaId(), aviso.id(), "CONFERIR", motivo, valor, cobrancaId, DadosDoPagamento.NENHUM);
        auditoria.registrarDoSistema(aviso.consultoriaId(), "PAGAMENTO_PARA_CONFERIR", "AVISO_DE_PAGAMENTO", aviso.id(),
                RESUMO_INFORMADO);
    }

    /** Compra aprovada ou assinatura renovada: confere a venda inteira antes de qualquer baixa. */
    private void aprovada(Reservado aviso, Travado atual, Venda venda, List<UUID> planosDoProduto, UUID baixada, Long valor) {
        DadosDoPagamento dados = new DadosDoPagamento(venda.meio(), venda.parcelas(), null);
        if (!STATUS_PAGO.equals(venda.status())) {
            naoPaga(aviso, atual, venda, baixada, valor);
            return;
        }
        // O mesmo pedido já deu baixa (compra aprovada e renovação chegam as duas): nunca baixa de novo, nem outra mensalidade.
        if (baixada != null) {
            avisos.encerrar(aviso.consultoriaId(), aviso.id(), "APLICADO", null, valor, baixada, dados);
            return;
        }
        List<UUID> achados = venda.email() == null ? List.of()
                : alunos.alunosAtivosDoEmail(venda.email().toLowerCase(Locale.ROOT), PageRequest.of(0, 2));
        if (achados.isEmpty()) {
            paraConferir(aviso, EMAIL_SEM_ALUNO, null, valor, dados);
            return;
        }
        if (achados.size() > 1) {
            paraConferir(aviso, EMAIL_DE_VARIOS_ALUNOS, null, valor, dados);
            return;
        }
        var ativa = contratacoes.ativaDoAluno(achados.get(0), ContratacaoAluno.Situacao.ATIVA)
                .filter(c -> planosDoProduto.contains(c.getPlanoComercialId())).orElse(null);
        if (ativa == null) {
            paraConferir(aviso, SEM_CONTRATACAO_NO_PLANO, null, valor, dados);
            return;
        }
        List<UUID> abertas = cobrancas.idsDaContratacao(ativa.getId(), CobrancaAluno.Tipo.MENSALIDADE,
                CobrancaAluno.Situacao.ABERTA, PageRequest.of(0, 1));
        if (abertas.isEmpty()) {
            paraConferir(aviso, SEM_MENSALIDADE_ABERTA, null, valor, dados);
            return;
        }
        // A mensalidade aberta mais antiga, relida sob trava (aluno, contratação, cobrança): o que valia antes pode ter mudado.
        UUID cobrancaId = abertas.get(0);
        Travas.DaCobranca t = travas.daCobrancaDoProvedor(cobrancaId);
        // Outro aviso do mesmo pedido pode ter dado a baixa enquanto esperávamos a trava do aluno: nada a fazer, e nunca baixar outra.
        UUID jaBaixada = idDaBaixa(aviso).orElse(null);
        if (jaBaixada != null) {
            avisos.encerrar(aviso.consultoriaId(), aviso.id(), "APLICADO", null, valor, jaBaixada, dados);
            return;
        }
        CobrancaAluno cobranca = t.cobranca();
        boolean aindaServe = cobranca.getSituacao() == CobrancaAluno.Situacao.ABERTA
                && cobranca.getTipo() == CobrancaAluno.Tipo.MENSALIDADE && t.contratacao() != null
                && t.contratacao().getSituacao() == ContratacaoAluno.Situacao.ATIVA
                && planosDoProduto.contains(t.contratacao().getPlanoComercialId());
        if (!aindaServe) {
            paraConferir(aviso, SEM_MENSALIDADE_ABERTA, cobrancaId, valor, dados);
            return;
        }
        boolean moedaCerta = venda.moeda() == null || MOEDA.equals(venda.moeda());
        if (valor == null || !moedaCerta || valor.longValue() != cobranca.getValorCentavos()) {
            paraConferir(aviso, VALOR_DIFERENTE, cobrancaId, valor, dados);
            return;
        }
        // A venda não traz a data do pagamento que sirva de dia civil: vale o dia em que a consulta a viu (Brasília).
        baixa.baixarDoProvedor(cobrancaId, new Baixa(PROVEDOR, FormaDePagamento.KIWIFY, LocalDate.now(Fuso.BRASILIA), null, null,
                null, aviso.referencia()));
        avisos.encerrar(aviso.consultoriaId(), aviso.id(), "APLICADO", null, valor, cobrancaId, dados);
        auditoria.registrarDoSistema(aviso.consultoriaId(), "PAGAMENTO_ONLINE_CONFIRMADO", "COBRANCA", cobrancaId,
                RESUMO_CONFIRMADO);
    }

    /**
     * A consulta diz que a venda deste aviso de "aprovada" não está paga. Reembolsada ou com chargeback vira "Para conferir" com
     * o motivo certo; ainda sem pagamento (ou recusada) tenta de novo em 1, 5 e 15 minutos e depois o aviso é ignorado (se pagarem,
     * a Kiwify avisa de novo e o aviso é rearmado). Nada é estornado aqui.
     */
    private void naoPaga(Reservado aviso, Travado atual, Venda venda, UUID baixada, Long valor) {
        if (STATUS_REEMBOLSADO.equals(venda.status())) {
            informado(aviso, REEMBOLSO, baixada, valor);
        } else if (STATUS_CHARGEBACK.equals(venda.status())) {
            informado(aviso, CHARGEBACK, baixada, valor);
        } else if (atual.tentativas() >= ESPERA_SE_NAO_PAGO.length) {
            avisos.encerrar(aviso.consultoriaId(), aviso.id(), "IGNORADO", null, null, null, DadosDoPagamento.NENHUM);
        } else {
            avisos.reagendar(aviso.consultoriaId(), aviso.id(), ESPERA_SE_NAO_PAGO[atual.tentativas()]);
        }
    }

    // ---- apoio ----

    private void paraConferir(Reservado aviso, String motivo, UUID cobrancaId, Long valorPago, DadosDoPagamento dados) {
        avisos.encerrar(aviso.consultoriaId(), aviso.id(), "CONFERIR", motivo, valorPago, cobrancaId, dados);
        auditoria.registrarDoSistema(aviso.consultoriaId(), "PAGAMENTO_PARA_CONFERIR", "AVISO_DE_PAGAMENTO", aviso.id(),
                RESUMO_PARA_CONFERIR);
    }

    /** A cobrança que este pedido da Kiwify já baixou, se houver ({@code id_externo} = {@code order_id}). */
    private Optional<UUID> idDaBaixa(Reservado aviso) {
        return cobrancas.idDaBaixaDoProvedor(PROVEDOR, aviso.referencia());
    }

    /** A coluna só aceita valor maior que zero. */
    private static Long positivoOuNulo(Long valor) {
        return valor != null && valor > 0 ? valor : null;
    }
}
