package br.com.treinos.api.pagamentos;

import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.conta.ContaLocalRepositorio;
import br.com.treinos.api.conta.DireitosLocais;
import br.com.treinos.api.pagamentos.AvisoDePagamentoRepositorio.DadosDoPagamento;
import br.com.treinos.api.pagamentos.AvisoDePagamentoRepositorio.Reservado;
import br.com.treinos.api.pagamentos.AvisoDePagamentoRepositorio.Travado;
import br.com.treinos.api.pagamentos.BaixaDeCobranca.Baixa;
import br.com.treinos.api.pagamentos.provedor.AsaasCliente.CobrancaConsultadaAsaas;
import br.com.treinos.api.pagamentos.provedor.ProvedorAsaas;
import br.com.treinos.api.web.Fuso;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

/**
 * Pontas transacionais do {@link ConciliadorAsaas}: {@link #preparar} lê e decifra a API Key da subconta;
 * {@link #concluir} decide sob trava (aviso -> aluno -> contratação -> cobrança) se dá baixa, manda para conferência ou
 * reagenda. A chamada HTTP ao Asaas e a notificação de abatimento à Central ficam sempre fora de transação.
 */
@Component
class ConclusaoDoAvisoAsaas {

    static final String PROVEDOR = ProvedorAsaas.CODIGO;
    static final int MAXIMO_DE_FALHAS = 12;
    private static final long[] ESPERA_SE_NAO_PAGO = {60, 300, 900};
    private static final long ESPERA_MAXIMA_DA_FALHA = 3600;

    private static final String RESUMO_CONFIRMADO =
            "Baixa automática de um pagamento online confirmado pelo Overtraining Pay.";
    static final String RESUMO_ESTORNO_INFORMADO =
            "Estorno ou contestação de um pagamento informado pelo Overtraining Pay; nenhuma baixa foi alterada e ficou para conferir.";
    private static final String RESUMO_PARA_CONFERIR =
            "Pagamento do Overtraining Pay confirmado que não pôde ser aplicado sozinho; ficou para conferir.";

    record Preparo(String apiKey, String walletId) {
        @Override
        public String toString() {
            return "Preparo[...]";
        }
    }

    record Resultado(CobrancaConsultadaAsaas consulta, boolean faltaCredencial, String walletIdSubconta) {

        static Resultado consultado(CobrancaConsultadaAsaas consulta, String walletIdSubconta) {
            return new Resultado(Objects.requireNonNull(consulta), false, walletIdSubconta);
        }

        static Resultado falhou() {
            return new Resultado(null, false, null);
        }

        static Resultado semCredencial() {
            return new Resultado(null, true, null);
        }
    }

    /** Retorno da conclusão para permitir notificar a Central fora da transação quando houver abatimento de split. */
    record AbatimentoPendente(UUID cobrancaId, long valorAbatidoCentavos) {
    }

    private final AvisoDePagamentoRepositorio avisos;
    private final SubcontaAsaasRepository subcontas;
    private final CifraDePagamento cifra;
    private final CobrancaAlunoRepository cobrancas;
    private final Travas travas;
    private final BaixaDeCobranca baixa;
    private final Auditoria auditoria;
    private final ContaLocalRepositorio contasLocais;
    private final CalculadorDeSplitAsaas calculadorDeSplit;

    ConclusaoDoAvisoAsaas(AvisoDePagamentoRepositorio avisos, SubcontaAsaasRepository subcontas,
                          CifraDePagamento cifra, CobrancaAlunoRepository cobrancas, Travas travas,
                          BaixaDeCobranca baixa, Auditoria auditoria, ContaLocalRepositorio contasLocais,
                          CalculadorDeSplitAsaas calculadorDeSplit) {
        this.avisos = avisos;
        this.subcontas = subcontas;
        this.cifra = cifra;
        this.cobrancas = cobrancas;
        this.travas = travas;
        this.baixa = baixa;
        this.auditoria = auditoria;
        this.contasLocais = contasLocais;
        this.calculadorDeSplit = calculadorDeSplit;
    }

    @Transactional(readOnly = true)
    Preparo preparar(Reservado aviso) {
        SubcontaAsaas subconta = subcontas.daConsultoria().orElse(null);
        if (subconta == null || subconta.getApiKeyCifrada() == null) {
            return new Preparo(null, null);
        }
        try {
            String apiKey = cifra.decifrar(aviso.consultoriaId(), subconta.getApiKeyCifrada());
            return new Preparo(apiKey, subconta.getWalletId());
        } catch (CifraIndisponivelException e) {
            return new Preparo(null, null);
        }
    }

    @Transactional
    Optional<AbatimentoPendente> concluir(Reservado aviso, UUID dono, Resultado resultado) {
        UUID consultoria = aviso.consultoriaId();
        Travado atual = avisos.travar(consultoria, aviso.id()).orElse(null);
        if (atual == null || !dono.equals(atual.reservadoPor())) {
            return Optional.empty();
        }
        if (atual.revisao() != aviso.revisao() || !"PENDENTE".equals(atual.situacao())) {
            avisos.liberar(consultoria, aviso.id());
            return Optional.empty();
        }
        if (atual.estornoAvisado()) {
            estornoJaAvisado(aviso, resultado);
            return Optional.empty();
        }
        if (resultado.consulta() == null) {
            falhou(aviso, atual, resultado.faltaCredencial());
            return Optional.empty();
        }
        CobrancaConsultadaAsaas consulta = resultado.consulta();
        if (ehEstornoOuContestacao(consulta.status())) {
            estornoJaAvisado(aviso, resultado);
            return Optional.empty();
        }
        if (CheckoutTransparenteAsaasService.estaPagaNoAsaas(consulta.status())) {
            return paga(aviso, consulta, resultado.walletIdSubconta());
        }
        naoPaga(aviso, atual);
        return Optional.empty();
    }

    private void estornoJaAvisado(Reservado aviso, Resultado resultado) {
        CobrancaConsultadaAsaas consulta = resultado.consulta();
        boolean temDados = consulta != null && positivoOuNulo(consulta.valorCentavos()) != null;
        avisos.encerrar(aviso.consultoriaId(), aviso.id(), "CONFERIR", AvisoDePagamentoRepositorio.ESTORNO_INFORMADO,
                temDados ? positivoOuNulo(consulta.valorCentavos()) : null,
                cobrancaId(aviso).filter(this::existe).orElse(null),
                temDados ? dadosDe(consulta) : DadosDoPagamento.NENHUM);
        auditoria.registrarDoSistema(aviso.consultoriaId(), "PAGAMENTO_PARA_CONFERIR", "AVISO_DE_PAGAMENTO",
                aviso.id(), RESUMO_ESTORNO_INFORMADO);
    }

    private void falhou(Reservado aviso, Travado atual, boolean semCredencial) {
        if (semCredencial || atual.tentativas() + 1 >= MAXIMO_DE_FALHAS) {
            paraConferir(aviso, "CONSULTA_FALHOU", cobrancaId(aviso).filter(this::existe).orElse(null), null,
                    DadosDoPagamento.NENHUM);
            return;
        }
        long espera = Math.min(60L << Math.min(atual.tentativas(), 6), ESPERA_MAXIMA_DA_FALHA);
        avisos.reagendar(aviso.consultoriaId(), aviso.id(), espera);
    }

    private Optional<AbatimentoPendente> paga(Reservado aviso, CobrancaConsultadaAsaas consulta,
                                              String walletIdSubconta) {
        Long amount = positivoOuNulo(consulta.valorCentavos());
        DadosDoPagamento dados = dadosDe(consulta);
        UUID cobrancaId = cobrancaId(aviso).filter(this::existe).orElse(null);
        if (cobrancaId == null) {
            paraConferir(aviso, "COBRANCA_NAO_ENCONTRADA", null, amount, dados);
            return Optional.empty();
        }
        if (consulta.externalReference() != null && !consulta.externalReference().equalsIgnoreCase(cobrancaId.toString())) {
            paraConferir(aviso, "LINK_DIFERENTE", cobrancaId, amount, dados);
            return Optional.empty();
        }
        CobrancaAluno cobranca = travas.daCobrancaDoProvedor(cobrancaId).cobranca();
        return switch (cobranca.getSituacao()) {
            case PAGA -> {
                if (foiPelaMesmaTransacao(cobranca, aviso)) {
                    avisos.encerrar(aviso.consultoriaId(), aviso.id(), "APLICADO", null, amount, cobrancaId, dados);
                } else {
                    paraConferir(aviso, "COBRANCA_JA_PAGA", cobrancaId, amount, dados);
                }
                yield Optional.empty();
            }
            case CANCELADA, RENEGOCIADA -> {
                paraConferir(aviso, "COBRANCA_CANCELADA", cobrancaId, amount, dados);
                yield Optional.empty();
            }
            case ESTORNADA, CONTESTADA -> {
                paraConferir(aviso, "COBRANCA_JA_PAGA", cobrancaId, amount, dados);
                yield Optional.empty();
            }
            case ABERTA -> aplicar(aviso, consulta, cobranca, amount, dados, walletIdSubconta);
        };
    }

    private Optional<AbatimentoPendente> aplicar(Reservado aviso, CobrancaConsultadaAsaas consulta,
                                                 CobrancaAluno cobranca, Long amount, DadosDoPagamento dados,
                                                 String walletIdSubconta) {
        UUID cobrancaId = cobranca.getId();
        if (amount == null || amount.longValue() != cobranca.getValorCentavos()) {
            paraConferir(aviso, "VALOR_DIFERENTE", cobrancaId, amount, dados);
            return Optional.empty();
        }
        FormaDePagamento forma = mapearForma(consulta.billingType());
        if (forma == null) {
            paraConferir(aviso, "FORMA_DESCONHECIDA", cobrancaId, amount, dados);
            return Optional.empty();
        }
        LocalDate pagoEm = consulta.pagoEm() != null ? consulta.pagoEm() : LocalDate.now(Fuso.BRASILIA);
        BaixaDeCobranca.Resultado res = baixa.baixarDoProvedor(cobrancaId,
                new Baixa(PROVEDOR, forma, pagoEm, null, null, null, aviso.transacao()));
        res.cobranca().registrarAsaasCobranca(aviso.transacao());
        if (consulta.valorLiquidoCentavos() != null) {
            res.cobranca().registrarValorLiquido(consulta.valorLiquidoCentavos());
        }
        cobrancas.flush();

        avisos.encerrar(aviso.consultoriaId(), aviso.id(), "APLICADO", null, amount, cobrancaId, dados);
        if (res.mudou()) {
            auditoria.registrarDoSistema(aviso.consultoriaId(), "PAGAMENTO_ONLINE_CONFIRMADO", "COBRANCA",
                    cobrancaId, RESUMO_CONFIRMADO);
            DireitosLocais direitos = contasLocais.direitos(aviso.consultoriaId()).orElse(null);
            long valorAbatido = calculadorDeSplit
                    .calcular(cobranca.getValorCentavos(), walletIdSubconta, direitos)
                    .valorAbatidoCentavos();
            if (valorAbatido > 0) {
                return Optional.of(new AbatimentoPendente(cobrancaId, valorAbatido));
            }
        }
        return Optional.empty();
    }

    private void naoPaga(Reservado aviso, Travado atual) {
        Optional<UUID> cobrancaId = cobrancaId(aviso).filter(this::existe);
        if (cobrancaId.isPresent()) {
            CobrancaAluno cobranca = travas.daCobrancaDoProvedor(cobrancaId.get()).cobranca();
            if (foiPelaMesmaTransacao(cobranca, aviso) && cobranca.getSituacao() == CobrancaAluno.Situacao.PAGA) {
                avisos.conferirEstorno(aviso.consultoriaId(), aviso.id(), cobranca.getId(), cobranca.getValorCentavos());
                auditoria.registrarDoSistema(aviso.consultoriaId(), "PAGAMENTO_PARA_CONFERIR", "AVISO_DE_PAGAMENTO",
                        aviso.id(), RESUMO_ESTORNO_INFORMADO);
                return;
            }
        }
        if (atual.tentativas() >= ESPERA_SE_NAO_PAGO.length) {
            avisos.encerrar(aviso.consultoriaId(), aviso.id(), "IGNORADO", null, null, null, DadosDoPagamento.NENHUM);
        } else {
            avisos.reagendar(aviso.consultoriaId(), aviso.id(), ESPERA_SE_NAO_PAGO[atual.tentativas()]);
        }
    }

    private void paraConferir(Reservado aviso, String motivo, UUID cobrancaId, Long valorPago, DadosDoPagamento dados) {
        avisos.encerrar(aviso.consultoriaId(), aviso.id(), "CONFERIR", motivo, valorPago, cobrancaId, dados);
        auditoria.registrarDoSistema(aviso.consultoriaId(), "PAGAMENTO_PARA_CONFERIR", "AVISO_DE_PAGAMENTO",
                aviso.id(), RESUMO_PARA_CONFERIR);
    }

    private static boolean ehEstornoOuContestacao(String status) {
        if (status == null) {
            return false;
        }
        String s = status.toUpperCase(Locale.ROOT);
        return "REFUNDED".equals(s) || "REFUND_REQUESTED".equals(s) || "REFUND_IN_PROGRESS".equals(s)
                || "CHARGEBACK_REQUESTED".equals(s) || "CHARGEBACK_DISPUTE".equals(s)
                || "AWAITING_CHARGEBACK_REVERSAL".equals(s);
    }

    private static FormaDePagamento mapearForma(String billingType) {
        if (billingType == null) {
            return null;
        }
        return switch (billingType.toUpperCase(Locale.ROOT)) {
            case "PIX" -> FormaDePagamento.PIX;
            case "CREDIT_CARD" -> FormaDePagamento.CARTAO;
            default -> null;
        };
    }

    private static DadosDoPagamento dadosDe(CobrancaConsultadaAsaas c) {
        String forma = c.billingType() == null ? null
                : c.billingType().toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9_-]", "");
        if (forma != null && forma.length() > 20) {
            forma = forma.substring(0, 20);
        }
        if (forma != null && forma.isEmpty()) {
            forma = null;
        }
        return new DadosDoPagamento(forma, c.parcelas(), positivoOuNulo(c.valorCentavos()));
    }

    private static boolean foiPelaMesmaTransacao(CobrancaAluno cobranca, Reservado aviso) {
        return PROVEDOR.equals(cobranca.getProvedor()) && aviso.transacao().equals(cobranca.getIdExterno());
    }

    private boolean existe(UUID cobrancaId) {
        return cobrancas.referenciasDe(cobrancaId).isPresent();
    }

    private static Optional<UUID> cobrancaId(Reservado aviso) {
        try {
            return Optional.of(UUID.fromString(aviso.referencia()));
        } catch (IllegalArgumentException e) {
            return Optional.empty();
        }
    }

    private static Long positivoOuNulo(Long valor) {
        return valor != null && valor > 0 ? valor : null;
    }
}
