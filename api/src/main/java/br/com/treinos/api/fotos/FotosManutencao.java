package br.com.treinos.api.fotos;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * Rotinas das fotos: (1) esvazia a fila de remoção no bucket, com espera crescente a cada falha; (2) apaga as fotos
 * pendentes que ninguém ligou a uma atualização em 24 h; (3) limpa as linhas removidas que já não contam para o limite do
 * dia. Só rodam com as fotos ligadas e a manutenção ativa. O log diz apenas quantas e a classe do erro, nunca ids.
 */
@Component
public class FotosManutencao {

    private static final Logger LOG = LoggerFactory.getLogger(FotosManutencao.class);
    static final Duration PRAZO_DA_PENDENTE = Duration.ofHours(24);
    static final Duration RETENCAO_DA_LINHA_REMOVIDA = Duration.ofDays(2);
    private static final int LOTE = 50;

    private final FotoRemocaoRepositorio remocoes;
    private final ObjectProvider<ArmazenamentoDeFotos> armazenamento;
    private final FotosProperties propriedades;
    private final TransactionTemplate transacao;

    public FotosManutencao(FotoRemocaoRepositorio remocoes, ObjectProvider<ArmazenamentoDeFotos> armazenamento,
                           FotosProperties propriedades, PlatformTransactionManager gerenteDeTransacao) {
        this.remocoes = remocoes;
        this.armazenamento = armazenamento;
        this.propriedades = propriedades;
        this.transacao = new TransactionTemplate(gerenteDeTransacao);
    }

    @Scheduled(fixedDelay = 30_000, initialDelay = 60_000)
    void agendadaFila() {
        if (ativa()) {
            esvaziarFila();
        }
    }

    @Scheduled(cron = "0 17 * * * *")
    void agendadaLimpeza() {
        if (ativa()) {
            limparPendentesEAntigas();
        }
    }

    private boolean ativa() {
        return propriedades.habilitado() && propriedades.manutencaoAtiva();
    }

    /** Apaga no bucket o que a fila arrendou. Devolve quantos objetos saíram. */
    public int esvaziarFila() {
        ArmazenamentoDeFotos bucket = armazenamento.getIfAvailable();
        if (bucket == null) {
            return 0;
        }
        int apagados = 0;
        int adiados = 0;
        List<ObjetoDeFoto> lote = transacao.execute(s -> remocoes.arrendarVencidas(Instant.now(), LOTE));
        for (ObjetoDeFoto objeto : lote == null ? List.<ObjetoDeFoto>of() : lote) {
            try {
                bucket.apagar(objeto.chave());
                transacao.executeWithoutResult(s -> remocoes.concluir(objeto));
                apagados++;
            } catch (RuntimeException e) {
                // O objeto volta à fila sozinho, mais tarde (o arrendamento já empurrou a próxima tentativa).
                adiados++;
                LOG.warn("Remoção de foto no bucket falhou ({}); nova tentativa mais tarde.", e.getClass().getSimpleName());
            }
        }
        if (apagados > 0 || adiados > 0) {
            LOG.info("Fila de fotos: {} removidas do bucket, {} adiadas.", apagados, adiados);
        }
        return apagados;
    }

    /** Pendentes velhas viram removidas e entram na fila; linhas removidas há dias saem da tabela. */
    public void limparPendentesEAntigas() {
        Instant agora = Instant.now();
        Integer pendentes = transacao.execute(s -> remocoes.removerPendentesAntigas(agora.minus(PRAZO_DA_PENDENTE), agora));
        Integer antigas = transacao.execute(s -> remocoes.apagarRemovidasAntigas(agora.minus(RETENCAO_DA_LINHA_REMOVIDA)));
        if ((pendentes != null && pendentes > 0) || (antigas != null && antigas > 0)) {
            LOG.info("Fotos: {} pendentes vencidas enviadas para remoção, {} linhas antigas apagadas.", pendentes, antigas);
        }
    }
}
