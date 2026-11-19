package br.com.treinos.api.pagamentos;

import br.com.treinos.api.pagamentos.AvisoDePagamentoRepositorio.Reservado;
import br.com.treinos.api.pagamentos.ConclusaoDoAvisoKiwify.Preparo;
import br.com.treinos.api.pagamentos.ConclusaoDoAvisoKiwify.Resultado;
import br.com.treinos.api.pagamentos.provedor.KiwifyCliente;
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
 * Transforma os avisos da Kiwify (caixa de entrada {@code aviso_de_pagamento}, provedor {@code KIWIFY}) em baixa ou conferência,
 * no molde do {@link ConciliadorInfinitePay}. O aviso já foi verificado (HMAC-SHA1 do corpo cru) na entrada, mas só diz "olhe
 * esta venda": a baixa nasce da consulta da venda na API da Kiwify, conferida contra o plano, o aluno e a mensalidade
 * ({@link ConclusaoDoAvisoKiwify}). Cada rodada reserva um lote com lease ({@code skip locked}, 120 s), consulta a Kiwify com a
 * conexão do banco solta (o HTTP nunca fica dentro de transação) e conclui, aviso por aviso, numa transação da consultoria dele.
 * Falha num aviso não derruba os outros: sem conclusão, a reserva vence e ele volta à fila. Roda em toda instância; o lease evita
 * duas com o mesmo aviso. Só trabalha com os pagamentos, a Kiwify e a conciliação ligados (nos testes ela fica desligada e
 * {@link #processarPendentes} é chamado à mão). Nada do aviso nem da venda vai a log: só contagens.
 */
@Component
public class ConciliadorKiwify {

    private static final Logger LOG = LoggerFactory.getLogger(ConciliadorKiwify.class);

    static final int TAMANHO_DO_LOTE = 20;
    static final int RESERVA_EM_SEGUNDOS = 120;
    private static final Duration INTERVALO_DA_LIMPEZA = Duration.ofHours(1);

    private final AvisoDePagamentoRepositorio avisos;
    private final ConclusaoDoAvisoKiwify conclusao;
    private final KiwifyCliente cliente;
    private final KiwifyProperties kiwify;
    private final PagamentosProperties pagamentos;
    private final TransactionTemplate transacao;
    private volatile Instant ultimaLimpeza = Instant.EPOCH;

    ConciliadorKiwify(AvisoDePagamentoRepositorio avisos, ConclusaoDoAvisoKiwify conclusao, KiwifyCliente cliente,
                      KiwifyProperties kiwify, PagamentosProperties pagamentos, PlatformTransactionManager transacoes) {
        this.avisos = avisos;
        this.conclusao = conclusao;
        this.cliente = cliente;
        this.kiwify = kiwify;
        this.pagamentos = pagamentos;
        this.transacao = new TransactionTemplate(transacoes);
    }

    @Scheduled(fixedDelay = 10_000, initialDelay = 25_000)
    void conciliarAgora() {
        if (!pagamentos.habilitado() || !kiwify.habilitado() || !Boolean.TRUE.equals(kiwify.conciliacaoAtiva())) {
            return;
        }
        try {
            int processados = processarPendentes();
            if (processados > 0) {
                LOG.info("Conciliação Kiwify: {} avisos processados.", processados);
            }
            limparSeVenceu();
        } catch (RuntimeException e) {
            LOG.warn("Conciliação Kiwify falhou ({}).", e.getClass().getSimpleName());
        }
    }

    /** Uma rodada: reserva até {@link #TAMANHO_DO_LOTE} avisos vencidos e conclui cada um. Devolve quantos reservou. */
    public int processarPendentes() {
        UUID dono = UUID.randomUUID();
        List<Reservado> lote = transacao.execute(status ->
                avisos.reservar(dono, TAMANHO_DO_LOTE, RESERVA_EM_SEGUNDOS, KiwifyConfiguracaoService.PROVEDOR));
        if (lote == null || lote.isEmpty()) {
            return 0;
        }
        for (Reservado aviso : lote) {
            try {
                processar(aviso, dono);
            } catch (RuntimeException e) {
                LOG.warn("Aviso da Kiwify não concluído ({}).", e.getClass().getSimpleName());
                concluirComoFalha(aviso, dono);
            }
        }
        return lote.size();
    }

    /** Consulta fora de transação e conclui dentro dela. Falha de rede ou da Kiwify vira tentativa, não exceção. */
    private void processar(Reservado aviso, UUID dono) {
        Resultado resultado;
        try {
            resultado = consultar(aviso);
        } catch (RuntimeException e) {
            // Nem o aviso nem a mensagem vão a log: pode haver dado do comprador no texto de uma exceção do cliente.
            resultado = Resultado.falhou();
        }
        concluir(aviso, dono, resultado);
    }

    private Resultado consultar(Reservado aviso) {
        Preparo preparo = naConsultoria(aviso, () -> conclusao.preparar(aviso));
        if (preparo.credencial() == null) {
            return Resultado.semCredencial();
        }
        return Resultado.consultado(cliente.consultar(aviso.consultoriaId(), preparo.credencial(), aviso.referencia()));
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
            LOG.warn("Aviso da Kiwify segue reservado ({}).", e.getClass().getSimpleName());
        }
    }

    /** O Hibernate lê o tenant ao abrir a sessão: a consultoria entra por fora, antes da transação do método chamado. */
    private static <T> T naConsultoria(Reservado aviso, Supplier<T> acao) {
        return TenantContext.executarComo(aviso.consultoriaId(), acao);
    }

    /** No máximo uma vez por hora; a retenção é a mesma da InfinitePay (a limpeza é da tabela toda, não de um provedor). */
    void limparSeVenceu() {
        Instant agora = Instant.now();
        if (Duration.between(ultimaLimpeza, agora).compareTo(INTERVALO_DA_LIMPEZA) < 0) {
            return;
        }
        ultimaLimpeza = agora;
        Integer apagados = transacao.execute(status -> avisos.limpar(ConciliadorInfinitePay.RETENCAO_EM_DIAS));
        if (apagados != null && apagados > 0) {
            LOG.info("Conciliação Kiwify: {} avisos antigos apagados.", apagados);
        }
    }
}
