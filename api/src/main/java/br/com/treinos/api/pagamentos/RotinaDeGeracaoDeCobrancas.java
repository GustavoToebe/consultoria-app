package br.com.treinos.api.pagamentos;

import br.com.treinos.api.tenant.TenantContext;
import br.com.treinos.api.web.Fuso;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * A rotina diária (4h15 de Brasília, só com o financeiro ligado) que garante a toda contratação ATIVA e recorrente uma
 * cobrança para cada competência até a primeira com vencimento a partir de hoje, paga a anterior ou não
 * ({@link GeradorDeCobrancas#garantirAteHoje}). Pausada, encerrada e parcela única não geram; retomar volta a gerar pela mesma regra.
 * Entra em cada consultoria com o {@link TenantContext} e roda uma contratação por transação, na ordem de trava de
 * {@link Travas} (aluno, depois contratação): idempotente pela conferência da competência e pelo índice único
 * ({@code ux_cobranca_competencia}), então repetir no mesmo dia, ou duas instâncias ao mesmo tempo, nunca duplica; falha numa
 * contratação não derruba as outras. Nada de nome, valor ou id em log: só contagens e a classe do erro.
 * <p>
 * shortcut: a "lease" é a trava de linha por contratação (duas instâncias na mesma hora repetem o trabalho em vez de
 * dividi-lo, sem efeito além do tempo); trocar por fila com {@code skip locked} se a conta de contratações crescer a ponto de pesar.
 */
@Component
@EnableConfigurationProperties(GeracaoProperties.class)
public class RotinaDeGeracaoDeCobrancas {

    private static final Logger LOG = LoggerFactory.getLogger(RotinaDeGeracaoDeCobrancas.class);

    /** O que uma rodada fez (só contagens). {@code executou} falso = financeiro desligado, nada foi feito. */
    public record Resultado(boolean executou, int contratacoes, int cobrancas, int falhas) {

        static final Resultado NADA = new Resultado(false, 0, 0, 0);

        Resultado mais(Resultado outro) {
            return new Resultado(executou, contratacoes + outro.contratacoes, cobrancas + outro.cobrancas,
                    falhas + outro.falhas);
        }
    }

    private final GeracaoRepositorio geracao;
    private final ContratacaoAlunoRepository contratacoes;
    private final Travas travas;
    private final GeradorDeCobrancas gerador;
    private final PagamentosProperties pagamentos;
    private final GeracaoProperties propriedades;
    private final TransactionTemplate transacao;

    RotinaDeGeracaoDeCobrancas(GeracaoRepositorio geracao, ContratacaoAlunoRepository contratacoes, Travas travas,
                               GeradorDeCobrancas gerador, PagamentosProperties pagamentos, GeracaoProperties propriedades,
                               PlatformTransactionManager transacoes) {
        this.geracao = geracao;
        this.contratacoes = contratacoes;
        this.travas = travas;
        this.gerador = gerador;
        this.pagamentos = pagamentos;
        this.propriedades = propriedades;
        this.transacao = new TransactionTemplate(transacoes);
    }

    @Scheduled(cron = "0 15 4 * * *", zone = Fuso.ID)
    void rodarAgendado() {
        if (!Boolean.TRUE.equals(propriedades.agendada())) {
            return;
        }
        try {
            Resultado r = rodarSeLigado(LocalDate.now(Fuso.BRASILIA));
            if (r.cobrancas() + r.falhas() > 0) {
                LOG.info("Geração de cobranças: {} criadas em {} contratações, {} falhas.", r.cobrancas(), r.contratacoes(),
                        r.falhas());
            }
        } catch (RuntimeException e) {
            LOG.warn("Geração de cobranças falhou ({}).", e.getClass().getSimpleName());
        }
    }

    /** Com o financeiro desligado não faz nada. */
    public Resultado rodarSeLigado(LocalDate hoje) {
        return pagamentos.habilitado() ? rodar(hoje) : Resultado.NADA;
    }

    /** Uma rodada em todas as consultorias, com {@code hoje} (Brasília). */
    public Resultado rodar(LocalDate hoje) {
        Resultado total = new Resultado(true, 0, 0, 0);
        for (UUID consultoriaId : geracao.consultoriasDaRotina()) {
            total = total.mais(rodarNa(consultoriaId, hoje));
        }
        return total;
    }

    /** Uma rodada só numa consultoria (a rodada inteira chama uma por uma; os testes chamam a do próprio dado). */
    public Resultado rodarNa(UUID consultoriaId, LocalDate hoje) {
        List<UUID> ids = TenantContext.executarComo(consultoriaId, () -> transacao.execute(
                s -> contratacoes.idsAtivasRecorrentes(ContratacaoAluno.Situacao.ATIVA, PeriodoDoPlano.PARCELA_UNICA)));
        int criadas = 0;
        int falhas = 0;
        for (UUID id : ids == null ? List.<UUID>of() : ids) {
            try {
                Integer n = TenantContext.executarComo(consultoriaId, () -> transacao.execute(s -> gerar(id, hoje)));
                criadas += n == null ? 0 : n;
            } catch (RuntimeException e) {
                falhas++;
                LOG.warn("Geração de cobranças não concluída para uma contratação ({}).", e.getClass().getSimpleName());
            }
        }
        return new Resultado(true, ids == null ? 0 : ids.size(), criadas, falhas);
    }

    private int gerar(UUID contratacaoId, LocalDate hoje) {
        // Já relida sob a trava: pausar ou encerrar depois da lista não gera (o gerador confere a situação).
        return gerador.garantirAteHoje(travas.daContratacao(contratacaoId).contratacao(), hoje);
    }
}
