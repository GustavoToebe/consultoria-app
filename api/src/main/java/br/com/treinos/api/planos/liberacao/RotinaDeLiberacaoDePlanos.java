package br.com.treinos.api.planos.liberacao;

import br.com.treinos.api.consultoria.Consultoria;
import br.com.treinos.api.consultoria.ConsultoriaRepository;
import br.com.treinos.api.dieta.PlanoDietaRepository;
import br.com.treinos.api.mobilidade.PlanoMobilidadeRepository;
import br.com.treinos.api.planos.PlanoBase;
import br.com.treinos.api.planos.PlanoRepositorio;
import br.com.treinos.api.tenant.TenantContext;
import br.com.treinos.api.treino.PlanoTreinoRepository;
import br.com.treinos.api.web.Fuso;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * A rotina diária (00:05 de Brasília) que libera para o aluno os planos agendados cuja data chegou (V106): o plano vira o vigente,
 * o aluno passa a ver a versão publicada e, se o treinador marcou "Avisar o aluno", sai o aviso (aviso no app e push). Entra em cada
 * consultoria com o {@link TenantContext} e roda um plano por transação, relendo-o sob trava de linha
 * ({@link PlanoRepositorio#travarParaLiberar}): idempotente (quem já foi liberado tem {@code liberar_em} nulo, então repetir no dia, ou
 * duas instâncias ao mesmo tempo, nunca libera nem avisa duas vezes); falha num plano não derruba os outros. Também apaga os avisos
 * de plano com mais de 30 dias. Nada de nome, id ou conteúdo em log: só contagens e a classe do erro.
 * <p>
 * shortcut: a "lease" é a trava de linha por plano (duas instâncias na mesma hora repetem o trabalho em vez de dividi-lo, sem
 * efeito além do tempo), como a geração de cobranças; trocar por fila com {@code skip locked} se a conta de planos agendados pesar.
 */
@Component
public class RotinaDeLiberacaoDePlanos {

    private static final Logger LOG = LoggerFactory.getLogger(RotinaDeLiberacaoDePlanos.class);

    /** O que uma rodada fez (só contagens). */
    public record Resultado(int liberados, int falhas) {

        Resultado mais(Resultado outro) {
            return new Resultado(liberados + outro.liberados, falhas + outro.falhas);
        }
    }

    private final ConsultoriaRepository consultorias;
    private final PlanoTreinoRepository treinos;
    private final PlanoDietaRepository dietas;
    private final PlanoMobilidadeRepository mobilidades;
    private final LiberacaoDePlano liberacao;
    private final AvisosDePlanoLiberado avisos;
    private final TransactionTemplate transacao;
    private final boolean agendada;

    RotinaDeLiberacaoDePlanos(ConsultoriaRepository consultorias, PlanoTreinoRepository treinos, PlanoDietaRepository dietas,
                              PlanoMobilidadeRepository mobilidades, LiberacaoDePlano liberacao, AvisosDePlanoLiberado avisos,
                              PlatformTransactionManager transacoes,
                              @Value("${treinos.planos.liberacao.agendada:true}") boolean agendada) {
        this.consultorias = consultorias;
        this.treinos = treinos;
        this.dietas = dietas;
        this.mobilidades = mobilidades;
        this.liberacao = liberacao;
        this.avisos = avisos;
        this.transacao = new TransactionTemplate(transacoes);
        this.agendada = agendada;
    }

    /** A rotina diária; os testes a desligam ({@code treinos.planos.liberacao.agendada=false}) e chamam {@link #rodarEm} à mão. */
    @Scheduled(cron = "0 5 0 * * *", zone = Fuso.ID)
    void rodarAgendado() {
        if (!agendada) {
            return;
        }
        try {
            Resultado r = rodarEm(Instant.now());
            if (r.liberados() + r.falhas() > 0) {
                LOG.info("Liberação de planos: {} liberados, {} falhas.", r.liberados(), r.falhas());
            }
        } catch (RuntimeException e) {
            LOG.warn("Liberação de planos falhou ({}).", e.getClass().getSimpleName());
        }
    }

    /** O dia de Brasília do instante dado: 23:59 de Brasília ainda é o dia anterior, 00:00 já é o seguinte. */
    public static LocalDate diaDeBrasilia(Instant instante) {
        return LocalDate.ofInstant(instante, Fuso.BRASILIA);
    }

    /** Uma rodada em todas as consultorias, no dia de Brasília de {@code agora}. */
    public Resultado rodarEm(Instant agora) {
        return rodar(diaDeBrasilia(agora), agora);
    }

    /** Uma rodada numa consultoria só, no dia de Brasília de {@code agora} (os testes simulam antes e depois da meia-noite). */
    public Resultado rodarNa(UUID consultoriaId, Instant agora) {
        return rodarNa(consultoriaId, diaDeBrasilia(agora));
    }

    /** Uma rodada em todas as consultorias, com {@code hoje} (Brasília). */
    public Resultado rodar(LocalDate hoje) {
        return rodar(hoje, Instant.now());
    }

    private Resultado rodar(LocalDate hoje, Instant agora) {
        Resultado total = new Resultado(0, 0);
        for (Consultoria c : consultorias.findAll()) {
            total = total.mais(rodarNa(c.getId(), hoje));
            TenantContext.executarComo(c.getId(), () -> transacao.execute(s -> avisos.limpar(c.getId(), agora)));
        }
        return total;
    }

    /** Uma rodada só numa consultoria (a rodada inteira chama uma por uma; os testes chamam a do próprio dado). */
    public Resultado rodarNa(UUID consultoriaId, LocalDate hoje) {
        return liberarOsDe(consultoriaId, hoje, treinos).mais(liberarOsDe(consultoriaId, hoje, dietas))
                .mais(liberarOsDe(consultoriaId, hoje, mobilidades));
    }

    private <P extends PlanoBase> Resultado liberarOsDe(UUID consultoriaId, LocalDate hoje, PlanoRepositorio<P> repo) {
        List<UUID> ids = TenantContext.executarComo(consultoriaId, () -> transacao.execute(s -> repo.idsParaLiberar(hoje)));
        int liberados = 0;
        int falhas = 0;
        for (UUID id : ids == null ? List.<UUID>of() : ids) {
            try {
                Boolean liberou = TenantContext.executarComo(consultoriaId,
                        () -> transacao.execute(s -> liberarUm(repo, id, hoje)));
                if (Boolean.TRUE.equals(liberou)) {
                    liberados++;
                }
            } catch (RuntimeException e) {
                falhas++;
                LOG.warn("Liberação de plano não concluída ({}).", e.getClass().getSimpleName());
            }
        }
        return new Resultado(liberados, falhas);
    }

    /** Relido sob a trava: liberar à mão, arquivar ou reagendar depois da lista não libera (idempotente). */
    private <P extends PlanoBase> boolean liberarUm(PlanoRepositorio<P> repo, UUID id, LocalDate hoje) {
        P plano = repo.travarParaLiberar(id).orElse(null);
        if (plano == null || plano.isArquivado() || plano.getLiberarEm() == null || plano.getLiberarEm().isAfter(hoje)) {
            return false;
        }
        liberacao.liberar(repo, plano, plano.isAvisarNaLiberacao());
        return true;
    }
}
