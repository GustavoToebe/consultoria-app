package br.com.treinos.api.pagamentos;

import br.com.treinos.api.pagamentos.AvisoDePagamentoRepositorio.Reservado;
import br.com.treinos.api.pagamentos.ConclusaoDoAviso.Preparo;
import br.com.treinos.api.pagamentos.ConclusaoDoAviso.Resultado;
import br.com.treinos.api.pagamentos.provedor.PedidoDeConsulta;
import br.com.treinos.api.pagamentos.provedor.ProvedorDePagamento;
import br.com.treinos.api.pagamentos.provedor.ProvedoresDePagamento;
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
import java.util.UUID;
import java.util.function.Supplier;

/**
 * Transforma os avisos da InfinitePay (caixa de entrada {@code aviso_de_pagamento}) em baixa, estorno ou conferência. O
 * webhook não é assinado: ele só diz "consulte de novo", e aqui a baixa nasce da resposta do {@code payment_check}, conferida
 * contra a cobrança. Cada rodada reserva um lote com lease ({@code skip locked}, 120 s), consulta o provedor com a conexão do
 * banco solta (o HTTP nunca fica dentro de transação) e conclui, aviso por aviso, numa transação da consultoria dele
 * ({@link ConclusaoDoAviso}). Falha num aviso não derruba os outros: sem conclusão, a reserva vence e ele volta à fila.
 * Roda em toda instância; o lease evita duas com o mesmo aviso. Só trabalha com os pagamentos, a InfinitePay e a conciliação
 * ligados (nos testes ela fica desligada e {@link #processarPendentes} é chamado à mão). Nada do aviso vai a log: só contagens.
 */
@Component
public class ConciliadorInfinitePay {

    private static final Logger LOG = LoggerFactory.getLogger(ConciliadorInfinitePay.class);

    static final int TAMANHO_DO_LOTE = 20;
    static final int RESERVA_EM_SEGUNDOS = 120;
    /** Avisos já resolvidos há mais que isto saem da caixa de entrada. */
    static final int RETENCAO_EM_DIAS = 180;
    private static final Duration INTERVALO_DA_LIMPEZA = Duration.ofHours(1);

    private final AvisoDePagamentoRepositorio avisos;
    private final ConclusaoDoAviso conclusao;
    private final ProvedoresDePagamento provedores;
    private final InfinitePayProperties infinitePay;
    private final PagamentosProperties pagamentos;
    private final TransactionTemplate transacao;
    private volatile Instant ultimaLimpeza = Instant.EPOCH;

    ConciliadorInfinitePay(AvisoDePagamentoRepositorio avisos, ConclusaoDoAviso conclusao, ProvedoresDePagamento provedores,
                           InfinitePayProperties infinitePay, PagamentosProperties pagamentos,
                           PlatformTransactionManager transacoes) {
        this.avisos = avisos;
        this.conclusao = conclusao;
        this.provedores = provedores;
        this.infinitePay = infinitePay;
        this.pagamentos = pagamentos;
        this.transacao = new TransactionTemplate(transacoes);
    }

    @Scheduled(fixedDelay = 10_000, initialDelay = 20_000)
    void conciliarAgora() {
        if (!pagamentos.habilitado() || !infinitePay.habilitado() || !Boolean.TRUE.equals(infinitePay.conciliacaoAtiva())) {
            return;
        }
        try {
            int processados = processarPendentes();
            if (processados > 0) {
                LOG.info("Conciliação InfinitePay: {} avisos processados.", processados);
            }
            limparSeVenceu();
        } catch (RuntimeException e) {
            LOG.warn("Conciliação InfinitePay falhou ({}).", e.getClass().getSimpleName());
        }
    }

    /** Uma rodada: reserva até {@link #TAMANHO_DO_LOTE} avisos vencidos e conclui cada um. Devolve quantos reservou. */
    public int processarPendentes() {
        UUID dono = UUID.randomUUID();
        List<Reservado> lote = transacao.execute(status -> avisos.reservar(dono, TAMANHO_DO_LOTE, RESERVA_EM_SEGUNDOS));
        if (lote == null || lote.isEmpty()) {
            return 0;
        }
        for (Reservado aviso : lote) {
            try {
                processar(aviso, dono);
            } catch (RuntimeException e) {
                LOG.warn("Aviso de pagamento não concluído ({}).", e.getClass().getSimpleName());
                concluirComoFalha(aviso, dono);
            }
        }
        return lote.size();
    }

    /** Consulta fora de transação e conclui dentro dela. Falha de rede ou do provedor vira tentativa, não exceção. */
    private void processar(Reservado aviso, UUID dono) {
        Resultado resultado;
        try {
            resultado = consultar(aviso);
        } catch (RuntimeException e) {
            // Nem o aviso nem a mensagem vão a log: pode haver dado do pagador no texto de uma exceção do provedor.
            resultado = Resultado.falhou();
        }
        concluir(aviso, dono, resultado);
    }

    private Resultado consultar(Reservado aviso) {
        Preparo preparo = naConsultoria(aviso, () -> conclusao.preparar(aviso));
        if (preparo.credencial() == null) {
            return Resultado.semCredencial();
        }
        ProvedorDePagamento provedor = provedores.buscar(RecebimentoOnlineService.PROVEDOR)
                .orElseThrow(() -> new IllegalStateException("Provedor de pagamento não registrado."));
        String slug = aviso.slug() != null ? aviso.slug() : preparo.slugDoLink();
        var consulta = provedor.consultar(preparo.credencial(),
                new PedidoDeConsulta(UUID.fromString(aviso.referencia()), aviso.transacao(), slug));
        return Resultado.consultado(consulta);
    }

    private void concluir(Reservado aviso, UUID dono, Resultado resultado) {
        naConsultoria(aviso, () -> {
            conclusao.concluir(aviso, dono, resultado);
            return Boolean.TRUE;
        });
    }

    /** Última tentativa de não deixar o aviso preso: conta uma falha. Se nem isso grava, a reserva vence sozinha. */
    private void concluirComoFalha(Reservado aviso, UUID dono) {
        try {
            concluir(aviso, dono, Resultado.falhou());
        } catch (RuntimeException e) {
            LOG.warn("Aviso de pagamento segue reservado ({}).", e.getClass().getSimpleName());
        }
    }

    /** O Hibernate lê o tenant ao abrir a sessão: a consultoria entra por fora, antes da transação do método chamado. */
    private static <T> T naConsultoria(Reservado aviso, Supplier<T> acao) {
        return TenantContext.executarComo(aviso.consultoriaId(), acao);
    }

    /** No máximo uma vez por hora (a rodada roda a cada 10 s). */
    void limparSeVenceu() {
        Instant agora = Instant.now();
        if (Duration.between(ultimaLimpeza, agora).compareTo(INTERVALO_DA_LIMPEZA) < 0) {
            return;
        }
        ultimaLimpeza = agora;
        int apagados = limparAvisosAntigos();
        if (apagados > 0) {
            LOG.info("Conciliação InfinitePay: {} avisos antigos apagados.", apagados);
        }
    }

    /** Apaga os avisos aplicados, ignorados e conferidos com mais de {@link #RETENCAO_EM_DIAS} dias. Devolve quantos. */
    public int limparAvisosAntigos() {
        Integer apagados = transacao.execute(status -> avisos.limpar(RETENCAO_EM_DIAS));
        return apagados == null ? 0 : apagados;
    }
}
