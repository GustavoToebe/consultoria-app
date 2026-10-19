package br.com.treinos.api.inscricoes;

import br.com.treinos.api.consultoria.Consultoria;
import br.com.treinos.api.consultoria.ConsultoriaRepository;
import br.com.treinos.api.tenant.TenantContext;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Duration;
import java.time.Instant;

/**
 * Retenção (LGPD, decisão de 19/10): inscrição recusada ou desistente, parada há mais de 180 dias, é apagada com as
 * notas. A aceita virou aluno e segue as regras do aluno. Roda uma vez por dia, uma consultoria por vez, cada uma na
 * própria transação dentro do {@link TenantContext} (o {@code delete} também leva a consultoria explícita). Não conta
 * nada em log além do total.
 */
@Component
public class InscricaoRetencao {

    static final Duration PRAZO = Duration.ofDays(180);

    private final ConsultoriaRepository consultorias;
    private final InscricaoRepository inscricoes;
    private final TransactionTemplate transacao;

    public InscricaoRetencao(ConsultoriaRepository consultorias, InscricaoRepository inscricoes,
                             PlatformTransactionManager transacoes) {
        this.consultorias = consultorias;
        this.inscricoes = inscricoes;
        this.transacao = new TransactionTemplate(transacoes);
    }

    @Scheduled(cron = "0 35 3 * * *", zone = "America/Sao_Paulo")
    public void limparDiariamente() {
        limpar(Instant.now().minus(PRAZO));
    }

    /** Apaga as recusadas e desistentes com {@code atualizada_em} antes de {@code limite}; devolve quantas saíram. */
    public int limpar(Instant limite) {
        int total = 0;
        for (Consultoria c : consultorias.findAll()) {
            Integer apagadas = TenantContext.executarComo(c.getId(), () -> transacao.execute(status ->
                    inscricoes.apagarEncerradas(c.getId(), SituacaoInscricao.ENCERRADAS_SEM_ALUNO, limite)));
            total += apagadas == null ? 0 : apagadas;
        }
        return total;
    }
}
