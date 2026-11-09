package br.com.treinos.api.importacao.assistida;

import br.com.treinos.api.consultoria.Consultoria;
import br.com.treinos.api.consultoria.ConsultoriaRepository;
import br.com.treinos.api.tenant.TenantContext;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;

/**
 * Retenção (LGPD): a sessão da importação assistida guarda dado do aluno (os grupos) e o arquivo; passou de
 * {@code expira_em} (7 dias), sai com os arquivos (FK em cascata). Roda uma vez por dia, uma consultoria por vez, cada
 * uma na própria transação dentro do {@link TenantContext}; o {@code delete} também leva a consultoria explícita.
 * Nada em log além do total.
 */
@Component
public class ImportacaoAssistidaRetencao {

    private final ConsultoriaRepository consultorias;
    private final ImportacaoSessaoRepository sessoes;
    private final TransactionTemplate transacao;
    private final boolean agendada;

    public ImportacaoAssistidaRetencao(ConsultoriaRepository consultorias, ImportacaoSessaoRepository sessoes,
                                       PlatformTransactionManager transacoes,
                                       @Value("${treinos.importacao.assistida.retencao-agendada:true}") boolean agendada) {
        this.consultorias = consultorias;
        this.sessoes = sessoes;
        this.transacao = new TransactionTemplate(transacoes);
        this.agendada = agendada;
    }

    /** A rotina diária; os testes a desligam ({@code treinos.importacao.assistida.retencao-agendada=false}) e chamam {@link #limpar}. */
    @Scheduled(cron = "0 20 3 * * *", zone = "America/Sao_Paulo")
    public void limparDiariamente() {
        if (agendada) {
            limpar(Instant.now());
        }
    }

    /** Apaga as sessões com {@code expira_em} antes de {@code agora}; devolve quantas saíram. */
    public int limpar(Instant agora) {
        int total = 0;
        for (Consultoria c : consultorias.findAll()) {
            Integer apagadas = TenantContext.executarComo(c.getId(), () -> transacao.execute(status ->
                    sessoes.apagarVencidas(c.getId(), agora)));
            total += apagadas == null ? 0 : apagadas;
        }
        return total;
    }
}
