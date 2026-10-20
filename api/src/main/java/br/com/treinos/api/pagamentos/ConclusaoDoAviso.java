package br.com.treinos.api.pagamentos;

import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.pagamentos.AvisoDePagamentoRepositorio.DadosDoPagamento;
import br.com.treinos.api.pagamentos.AvisoDePagamentoRepositorio.Reservado;
import br.com.treinos.api.pagamentos.AvisoDePagamentoRepositorio.Travado;
import br.com.treinos.api.pagamentos.BaixaDeCobranca.Baixa;
import br.com.treinos.api.pagamentos.provedor.ConsultaDeCobranca;
import br.com.treinos.api.pagamentos.provedor.CredencialDoProvedor;
import br.com.treinos.api.pagamentos.provedor.SituacaoNormalizada;
import br.com.treinos.api.web.Fuso;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

/**
 * As duas pontas do conciliador que tocam o banco, ao redor da chamada à InfinitePay (que fica fora de qualquer
 * transação): {@link #preparar} lê a credencial e o link da cobrança; {@link #concluir} decide e grava. A baixa nunca é
 * desfeita nem alterada aqui: transação já aplicada que o provedor diz estornada só vai para a conferência. Quem chama põe a
 * consultoria em {@code TenantContext.executarComo} antes de entrar aqui (o Hibernate lê o tenant ao abrir a sessão).
 *
 * <p>A cobrança pode ter mudado durante o HTTP: toda decisão é tomada aqui dentro, sob trava (aviso, depois aluno,
 * contratação e cobrança, nessa ordem), relendo a cobrança, nunca com o que foi lido antes. As operações de
 * {@link BaixaDeCobranca} só são chamadas quando a cobrança travada está no estado que elas aceitam: uma exceção que
 * atravessasse o proxy delas marcaria esta transação como só-rollback e o aviso ficaria preso na reserva.
 */
@Component
class ConclusaoDoAviso {

    static final String PROVEDOR = RecebimentoOnlineService.PROVEDOR;
    /** Tentativas de consulta falhas (rede, HTTP, JSON) antes de o aviso ir para a conferência. */
    static final int MAXIMO_DE_FALHAS = 12;
    /** Esperas, em segundos, depois da consulta que ainda não viu o pagamento (tentativas 0, 1 e 2); a quarta vira IGNORADO. */
    private static final long[] ESPERA_SE_NAO_PAGO = {60, 300, 900};
    private static final long ESPERA_MAXIMA_DA_FALHA = 3600;

    private static final String RESUMO_CONFIRMADO = "Baixa automática de um pagamento online confirmado pela InfinitePay.";
    static final String RESUMO_ESTORNO_INFORMADO =
            "Estorno de um pagamento online informado pela InfinitePay; nenhuma baixa foi alterada e ficou para conferir.";
    private static final String RESUMO_PARA_CONFERIR =
            "Pagamento online confirmado que não pôde ser aplicado sozinho; ficou para conferir.";

    /** O que a chamada ao provedor precisa: a credencial (nula se não há ou não decifra) e o slug do link da cobrança. */
    record Preparo(CredencialDoProvedor credencial, String slugDoLink) {

        @Override
        public String toString() {
            return "Preparo[...]";
        }
    }

    /** A consulta feita, ou a razão de não ter sido: falha do provedor, ou credencial que falta. */
    record Resultado(ConsultaDeCobranca consulta, boolean faltaCredencial) {

        static Resultado consultado(ConsultaDeCobranca consulta) {
            return new Resultado(Objects.requireNonNull(consulta), false);
        }

        static Resultado falhou() {
            return new Resultado(null, false);
        }

        static Resultado semCredencial() {
            return new Resultado(null, true);
        }
    }

    private final AvisoDePagamentoRepositorio avisos;
    private final CredencialPagamentoRepository credenciais;
    private final CifraDePagamento cifra;
    private final CobrancaAlunoRepository cobrancas;
    private final Travas travas;
    private final BaixaDeCobranca baixa;
    private final Auditoria auditoria;

    ConclusaoDoAviso(AvisoDePagamentoRepositorio avisos, CredencialPagamentoRepository credenciais, CifraDePagamento cifra,
                     CobrancaAlunoRepository cobrancas, Travas travas, BaixaDeCobranca baixa, Auditoria auditoria) {
        this.avisos = avisos;
        this.credenciais = credenciais;
        this.cifra = cifra;
        this.cobrancas = cobrancas;
        this.travas = travas;
        this.baixa = baixa;
        this.auditoria = auditoria;
    }

    /** Passo 1 (transação curta, só leitura). A chave é decifrada só em memória, para a chamada. */
    @Transactional(readOnly = true)
    Preparo preparar(Reservado aviso) {
        String slug = cobrancaId(aviso).flatMap(cobrancas::findById).map(CobrancaAluno::getLinkSlug).orElse(null);
        CredencialPagamento credencial = credenciais.findByProvedor(PROVEDOR).orElse(null);
        if (credencial == null) {
            return new Preparo(null, slug);
        }
        try {
            String segredo = credencial.getSegredoCifrado() == null ? null
                    : cifra.decifrar(aviso.consultoriaId(), credencial.getSegredoCifrado());
            return new Preparo(new CredencialDoProvedor(aviso.consultoriaId(), credencial.getConta(), segredo), slug);
        } catch (CifraIndisponivelException e) {
            return new Preparo(null, slug);
        }
    }

    /**
     * Passo 3. Trava o aviso e confere que a reserva ainda é desta execução e que ninguém o rearmou (outra notificação
     * muda a revisão): se mudou, só devolve o aviso à fila, que o consulta de novo na próxima rodada.
     */
    @Transactional
    void concluir(Reservado aviso, UUID dono, Resultado resultado) {
        UUID consultoria = aviso.consultoriaId();
        Travado atual = avisos.travar(consultoria, aviso.id()).orElse(null);
        if (atual == null || !dono.equals(atual.reservadoPor())) {
            return;
        }
        if (atual.revisao() != aviso.revisao() || !"PENDENTE".equals(atual.situacao())) {
            avisos.liberar(consultoria, aviso.id());
            return;
        }
        if (atual.estornoAvisado()) {
            estornoJaAvisado(aviso, resultado);
        } else if (resultado.consulta() == null) {
            falhou(aviso, atual, resultado.faltaCredencial());
        } else if (resultado.consulta().situacao() == SituacaoNormalizada.PAGA) {
            paga(aviso, resultado.consulta());
        } else {
            naoPaga(aviso, atual);
        }
    }

    // ---- estorno já avisado ----

    /**
     * A InfinitePay já mandou o evento {@code refunded} desta transação (a marca permanente do aviso, lida aqui sob a trava
     * do aviso, não do resumo lido antes do HTTP): vai para CONFERIR/{@value AvisoDePagamentoRepositorio#ESTORNO_INFORMADO}
     * antes de qualquer decisão de baixa, qualquer que seja a resposta do {@code payment_check} (paid inclusive: ele pode
     * demorar a refletir o estorno). Nunca chama {@code baixarDoProvedor} e não toca na cobrança: ABERTA continua aberta e PAGA
     * continua paga. A consulta HTTP já foi feita quando se chega aqui e é aproveitada só para preencher o que o treinador
     * vai ver (valor, forma, parcelas) quando ela veio paga; dispensá-la exigiria ler a marca antes do HTTP, fora da trava, e
     * não evitaria nada que importe (ela é uma leitura). Falha da consulta não gera nova tentativa: o estorno já é motivo.
     */
    private void estornoJaAvisado(Reservado aviso, Resultado resultado) {
        ConsultaDeCobranca consulta = resultado.consulta();
        boolean veioPaga = consulta != null && consulta.situacao() == SituacaoNormalizada.PAGA;
        avisos.encerrar(aviso.consultoriaId(), aviso.id(), "CONFERIR", AvisoDePagamentoRepositorio.ESTORNO_INFORMADO,
                veioPaga ? positivoOuNulo(consulta.valorCentavos()) : null,
                cobrancaId(aviso).filter(this::existe).orElse(null),
                veioPaga ? DadosDoPagamento.de(consulta) : DadosDoPagamento.NENHUM);
        auditoria.registrarDoSistema(aviso.consultoriaId(), "PAGAMENTO_PARA_CONFERIR", "AVISO_DE_PAGAMENTO", aviso.id(),
                RESUMO_ESTORNO_INFORMADO);
    }

    // ---- consulta com falha ----

    /** Espera 60 s × 2^tentativas (no máximo 1 h); na 12ª falha, ou sem credencial, vai para a conferência. */
    private void falhou(Reservado aviso, Travado atual, boolean semCredencial) {
        if (semCredencial || atual.tentativas() + 1 >= MAXIMO_DE_FALHAS) {
            paraConferir(aviso, "CONSULTA_FALHOU", cobrancaId(aviso).filter(this::existe).orElse(null), null,
                    DadosDoPagamento.NENHUM);
            return;
        }
        long espera = Math.min(60L << Math.min(atual.tentativas(), 6), ESPERA_MAXIMA_DA_FALHA);
        avisos.reagendar(aviso.consultoriaId(), aviso.id(), espera);
    }

    // ---- consulta paga ----

    private void paga(Reservado aviso, ConsultaDeCobranca consulta) {
        Long amount = positivoOuNulo(consulta.valorCentavos());
        DadosDoPagamento dados = DadosDoPagamento.de(consulta);
        UUID cobrancaId = cobrancaId(aviso).filter(this::existe).orElse(null);
        if (cobrancaId == null) {
            paraConferir(aviso, "COBRANCA_NAO_ENCONTRADA", null, amount, dados);
            return;
        }
        CobrancaAluno cobranca = travas.daCobrancaDoProvedor(cobrancaId).cobranca();
        switch (cobranca.getSituacao()) {
            case PAGA -> {
                if (foiPelaMesmaTransacao(cobranca, aviso)) {
                    avisos.encerrar(aviso.consultoriaId(), aviso.id(), "APLICADO", null, amount, cobrancaId, dados);
                } else {
                    // Outra transação para uma cobrança já paga (pagamento em dobro): nunca quita outra, o treinador decide.
                    paraConferir(aviso, "COBRANCA_JA_PAGA", cobrancaId, amount, dados);
                }
            }
            case CANCELADA -> paraConferir(aviso, "COBRANCA_CANCELADA", cobrancaId, amount, dados);
            case ESTORNADA, CONTESTADA -> paraConferir(aviso, "COBRANCA_JA_PAGA", cobrancaId, amount, dados);
            case ABERTA -> aplicar(aviso, consulta, cobranca, amount, dados);
        }
    }

    /** Cobrança aberta: confere valor, link e forma antes de dar a baixa. Qualquer dúvida vai para a conferência. */
    private void aplicar(Reservado aviso, ConsultaDeCobranca consulta, CobrancaAluno cobranca, Long amount,
                         DadosDoPagamento dados) {
        UUID cobrancaId = cobranca.getId();
        // O valor conferido é o amount (o do link), nunca o paid_amount, que pode trazer juros do parcelamento.
        if (amount == null || amount.longValue() != cobranca.getValorCentavos()
                || (cobranca.getLinkValorCentavos() != null && amount.longValue() != cobranca.getLinkValorCentavos())) {
            paraConferir(aviso, "VALOR_DIFERENTE", cobrancaId, amount, dados);
            return;
        }
        // Este cuidado vira ruído se o slug do webhook nunca igualar o do /links (o teste de R$ 1 decide). Um link
        // duplicado criado numa corrida também cai aqui, sem perder o pagamento: o treinador confere.
        if (cobranca.getLinkSlug() != null && aviso.slug() != null && !aviso.slug().equals(cobranca.getLinkSlug())) {
            paraConferir(aviso, "LINK_DIFERENTE", cobrancaId, amount, dados);
            return;
        }
        if (consulta.forma() == null) {
            paraConferir(aviso, "FORMA_DESCONHECIDA", cobrancaId, amount, dados);
            return;
        }
        // A API não devolve a data do pagamento: vale o dia em que a consulta o viu (Brasília).
        baixa.baixarDoProvedor(cobrancaId, new Baixa(PROVEDOR, consulta.forma(), LocalDate.now(Fuso.BRASILIA), null, null,
                null, aviso.transacao()));
        avisos.encerrar(aviso.consultoriaId(), aviso.id(), "APLICADO", null, amount, cobrancaId, dados);
        auditoria.registrarDoSistema(aviso.consultoriaId(), "PAGAMENTO_ONLINE_CONFIRMADO", "COBRANCA", cobrancaId,
                RESUMO_CONFIRMADO);
    }

    // ---- consulta não paga ----

    /**
     * Transação que já aplicamos e que deixa de vir paga = estorno informado: a baixa NUNCA é desfeita nem alterada aqui. A
     * cobrança segue PAGA e o aviso vai para a conferência (ESTORNO_INFORMADO), para o treinador decidir; o payload e a
     * resposta de estorno da InfinitePay não são documentados, e o roteiro de R$ 1 anota o que o payment_check devolve depois
     * do estorno. Senão ainda não pagou: volta em 1, 5 e 15 minutos e depois o aviso é ignorado (se pagarem, a InfinitePay
     * avisa de novo e o aviso é rearmado).
     */
    private void naoPaga(Reservado aviso, Travado atual) {
        Optional<UUID> cobrancaId = cobrancaId(aviso).filter(this::existe);
        if (cobrancaId.isPresent()) {
            CobrancaAluno cobranca = travas.daCobrancaDoProvedor(cobrancaId.get()).cobranca();
            if (foiPelaMesmaTransacao(cobranca, aviso) && cobranca.getSituacao() == CobrancaAluno.Situacao.PAGA) {
                avisos.conferirEstorno(aviso.consultoriaId(), aviso.id(), cobranca.getId(), cobranca.getValorCentavos());
                auditoria.registrarDoSistema(aviso.consultoriaId(), "PAGAMENTO_PARA_CONFERIR", "AVISO_DE_PAGAMENTO", aviso.id(),
                        RESUMO_ESTORNO_INFORMADO);
                return;
            }
        }
        if (atual.tentativas() >= ESPERA_SE_NAO_PAGO.length) {
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

    /** A cobrança foi baixada por esta mesma transação da InfinitePay. */
    private static boolean foiPelaMesmaTransacao(CobrancaAluno cobranca, Reservado aviso) {
        return PROVEDOR.equals(cobranca.getProvedor()) && aviso.transacao().equals(cobranca.getIdExterno());
    }

    /** A cobrança existe nesta consultoria (a leitura filtra pelo tenant). Lê só ids: a entidade entra travada, depois. */
    private boolean existe(UUID cobrancaId) {
        return cobrancas.referenciasDe(cobrancaId).isPresent();
    }

    /** O {@code order_nsu} do aviso é o id da cobrança; o que não é UUID não é cobrança nossa. */
    private static Optional<UUID> cobrancaId(Reservado aviso) {
        try {
            return Optional.of(UUID.fromString(aviso.referencia()));
        } catch (IllegalArgumentException e) {
            return Optional.empty();
        }
    }

    /** A coluna só aceita valor maior que zero. */
    private static Long positivoOuNulo(Long valor) {
        return valor != null && valor > 0 ? valor : null;
    }
}
