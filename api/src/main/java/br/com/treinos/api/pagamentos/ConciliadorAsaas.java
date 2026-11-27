package br.com.treinos.api.pagamentos;

import br.com.treinos.api.integracao.AbatimentoSplitCentralService;
import br.com.treinos.api.pagamentos.AvisoDePagamentoRepositorio.Reservado;
import br.com.treinos.api.pagamentos.ConclusaoDoAvisoAsaas.AbatimentoPendente;
import br.com.treinos.api.pagamentos.ConclusaoDoAvisoAsaas.Preparo;
import br.com.treinos.api.pagamentos.ConclusaoDoAvisoAsaas.Resultado;
import br.com.treinos.api.pagamentos.provedor.AsaasCliente;
import br.com.treinos.api.pagamentos.provedor.ProvedorAsaas;
import br.com.treinos.api.tenant.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Supplier;

/**
 * Conciliador de avisos do Asaas (Overtraining Pay), no molde de {@link ConciliadorInfinitePay} e
 * {@link ConciliadorKiwify}. Consulta {@code GET /payments/{id}} fora de transação, aplica a baixa ou manda para
 * conferência sob trava em {@link ConclusaoDoAvisoAsaas} e notifica a Central fora de transação quando houve retenção
 * de {@code ABATER_MENSALIDADE}.
 */
@Component
public class ConciliadorAsaas {

    private static final Logger LOG = LoggerFactory.getLogger(ConciliadorAsaas.class);

    static final int TAMANHO_DO_LOTE = 20;
    static final int RESERVA_EM_SEGUNDOS = 120;
    private static final Duration INTERVALO_DA_LIMPEZA = Duration.ofHours(1);

    private final AvisoDePagamentoRepositorio avisos;
    private final ConclusaoDoAvisoAsaas conclusao;
    private final AsaasCliente asaasCliente;
    private final AsaasProperties asaas;
    private final PagamentosProperties pagamentos;
    private final AbatimentoSplitCentralService abatimentoCentral;
    private final CancelamentoDeCobrancaAsaas cancelamentos;
    private final TransactionTemplate transacao;
    private volatile Instant ultimaLimpeza = Instant.EPOCH;

    ConciliadorAsaas(AvisoDePagamentoRepositorio avisos, ConclusaoDoAvisoAsaas conclusao, AsaasCliente asaasCliente,
                     AsaasProperties asaas, PagamentosProperties pagamentos,
                     AbatimentoSplitCentralService abatimentoCentral, CancelamentoDeCobrancaAsaas cancelamentos,
                     PlatformTransactionManager transacoes) {
        this.avisos = avisos;
        this.conclusao = conclusao;
        this.asaasCliente = asaasCliente;
        this.asaas = asaas;
        this.pagamentos = pagamentos;
        this.abatimentoCentral = abatimentoCentral;
        this.cancelamentos = cancelamentos;
        this.transacao = new TransactionTemplate(transacoes);
    }

    @Scheduled(fixedDelay = 10_000, initialDelay = 30_000)
    void conciliarAgora() {
        if (!pagamentos.habilitado() || !asaas.habilitado() || !Boolean.TRUE.equals(asaas.conciliacaoAtiva())) {
            return;
        }
        try {
            int processados = processarPendentes();
            if (processados > 0) {
                LOG.info("Conciliação Asaas: {} avisos processados.", processados);
            }
            cancelamentos.processarPendentes();
            limparSeVenceu();
        } catch (RuntimeException e) {
            LOG.warn("Conciliação Asaas falhou ({}).", e.getClass().getSimpleName());
        }
    }

    /** Uma rodada: reserva até {@link #TAMANHO_DO_LOTE} avisos vencidos e conclui cada um. Devolve quantos reservou. */
    public int processarPendentes() {
        UUID dono = UUID.randomUUID();
        List<Reservado> lote = transacao.execute(status ->
                avisos.reservar(dono, TAMANHO_DO_LOTE, RESERVA_EM_SEGUNDOS, ProvedorAsaas.CODIGO));
        if (lote == null || lote.isEmpty()) {
            return 0;
        }
        for (Reservado aviso : lote) {
            try {
                processar(aviso, dono);
            } catch (RuntimeException e) {
                LOG.warn("Aviso do Asaas não concluído ({}).", e.getClass().getSimpleName());
                concluirComoFalha(aviso, dono);
            }
        }
        return lote.size();
    }

    private void processar(Reservado aviso, UUID dono) {
        Resultado resultado;
        try {
            resultado = consultar(aviso);
        } catch (RuntimeException e) {
            resultado = Resultado.falhou();
        }
        Resultado finalResultado = resultado;
        Optional<AbatimentoPendente> abatimento = naConsultoria(aviso, () -> conclusao.concluir(aviso, dono, finalResultado));
        // Notifica a Central fora de transação quando houve retenção de ABATER_MENSALIDADE.
        abatimento.ifPresent(ab -> abatimentoCentral.registrarAbatimento(
                aviso.consultoriaId(), aviso.transacao(), ab.cobrancaId(), ab.valorAbatidoCentavos(), Instant.now()));
    }

    private Resultado consultar(Reservado aviso) {
        Preparo preparo = naConsultoria(aviso, () -> conclusao.preparar(aviso));
        if (preparo.apiKey() == null) {
            return Resultado.semCredencial();
        }
        var consulta = asaasCliente.consultarCobranca(preparo.apiKey(), aviso.transacao());
        return Resultado.consultado(consulta, preparo.walletId());
    }

    private void concluirComoFalha(Reservado aviso, UUID dono) {
        try {
            naConsultoria(aviso, () -> conclusao.concluir(aviso, dono, Resultado.falhou()));
        } catch (RuntimeException e) {
            LOG.warn("Aviso do Asaas segue reservado ({}).", e.getClass().getSimpleName());
        }
    }

    private static <T> T naConsultoria(Reservado aviso, Supplier<T> acao) {
        return TenantContext.executarComo(aviso.consultoriaId(), acao);
    }

    void limparSeVenceu() {
        Instant agora = Instant.now();
        if (Duration.between(ultimaLimpeza, agora).compareTo(INTERVALO_DA_LIMPEZA) < 0) {
            return;
        }
        ultimaLimpeza = agora;
        Integer apagados = transacao.execute(status -> avisos.limpar(ConciliadorInfinitePay.RETENCAO_EM_DIAS));
        if (apagados != null && apagados > 0) {
            LOG.info("Conciliação Asaas: {} avisos antigos apagados.", apagados);
        }
    }
}
