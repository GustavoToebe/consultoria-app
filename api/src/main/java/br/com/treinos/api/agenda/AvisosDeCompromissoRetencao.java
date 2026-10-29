package br.com.treinos.api.agenda;

import br.com.treinos.api.consultoria.Consultoria;
import br.com.treinos.api.consultoria.ConsultoriaRepository;
import br.com.treinos.api.tenant.TenantContext;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Duration;
import java.time.Instant;

/**
 * Limpeza dos avisos de compromisso (D12 item 6): os vistos somem em 30 dias; os não vistos, 7 dias depois do fim do
 * compromisso. Roda uma vez por dia, uma consultoria por vez, cada uma na própria transação dentro do
 * {@link TenantContext} (os {@code delete} também levam a consultoria explícita), como {@code InscricaoRetencao}. Sem
 * auditoria dos avisos; só o total é devolvido, nada em log.
 */
@Component
public class AvisosDeCompromissoRetencao {

    static final Duration PRAZO_DOS_VISTOS = Duration.ofDays(30);
    static final Duration PRAZO_DOS_NAO_VISTOS = Duration.ofDays(7);

    private final ConsultoriaRepository consultorias;
    private final AvisoCompromissoRepository avisos;
    private final TransactionTemplate transacao;
    private final boolean agendada;

    public AvisosDeCompromissoRetencao(ConsultoriaRepository consultorias, AvisoCompromissoRepository avisos,
                                       PlatformTransactionManager transacoes,
                                       @Value("${treinos.agenda.avisos.limpeza-agendada:true}") boolean agendada) {
        this.consultorias = consultorias;
        this.avisos = avisos;
        this.transacao = new TransactionTemplate(transacoes);
        this.agendada = agendada;
    }

    /** A rotina diária; os testes a desligam ({@code treinos.agenda.avisos.limpeza-agendada=false}) e chamam {@link #limpar} à mão. */
    @Scheduled(cron = "0 50 3 * * *", zone = "America/Sao_Paulo")
    public void limparDiariamente() {
        if (agendada) {
            limpar(Instant.now());
        }
    }

    /**
     * Apaga os avisos vistos antes de {@code agora - 30 dias} e os não vistos de compromisso que terminou antes de
     * {@code agora - 7 dias}; devolve quantos saíram.
     */
    public int limpar(Instant agora) {
        int total = 0;
        for (Consultoria c : consultorias.findAll()) {
            Integer apagados = TenantContext.executarComo(c.getId(), () -> transacao.execute(status ->
                    avisos.apagarVistosAntes(c.getId(), agora.minus(PRAZO_DOS_VISTOS))
                            + avisos.apagarNaoVistosDeCompromissosEncerradosAntes(c.getId(), agora.minus(PRAZO_DOS_NAO_VISTOS))));
            total += apagados == null ? 0 : apagados;
        }
        return total;
    }
}
