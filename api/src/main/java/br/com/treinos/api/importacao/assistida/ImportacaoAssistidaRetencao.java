package br.com.treinos.api.importacao.assistida;

import br.com.treinos.api.consultoria.Consultoria;
import br.com.treinos.api.consultoria.ConsultoriaRepository;
import br.com.treinos.api.tenant.TenantContext;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;
import java.util.List;

/**
 * Retenção (LGPD): a sessão da importação assistida guarda dado do aluno (os grupos) e o arquivo; passou de
 * {@code expira_em} (7 dias), sai com os arquivos (FK em cascata). Roda uma vez por dia, uma consultoria por vez, cada
 * uma na própria transação dentro do {@link TenantContext}; o {@code delete} também leva a consultoria explícita.
 * Nada em log além do total. Na subida da API também solta as sessões que ficaram em {@code PROCESSANDO}.
 */
@Component
public class ImportacaoAssistidaRetencao {

    private final ConsultoriaRepository consultorias;
    private final ImportacaoSessaoRepository sessoes;
    private final JsonMapper json;
    private final TransactionTemplate transacao;
    private final boolean agendada;

    public ImportacaoAssistidaRetencao(ConsultoriaRepository consultorias, ImportacaoSessaoRepository sessoes,
                                       JsonMapper json, PlatformTransactionManager transacoes,
                                       @Value("${treinos.importacao.assistida.retencao-agendada:true}") boolean agendada) {
        this.consultorias = consultorias;
        this.sessoes = sessoes;
        this.json = json;
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

    /** Na subida; os testes desligam com a mesma chave da rotina diária e chamam {@link #soltarSessoesEmLeitura}. */
    @EventListener(ApplicationReadyEvent.class)
    public void soltarNaSubida() {
        if (agendada) {
            soltarSessoesEmLeitura();
        }
    }

    /**
     * A leitura roda só na memória da API: depois de reiniciar, ninguém mais termina a sessão {@code PROCESSANDO}. Ela
     * volta a {@code RECEBENDO} com o erro de leitura (a tela oferece ler de novo; os arquivos seguem {@code RECEBIDO}).
     * Devolve quantas soltou.
     */
    // shortcut: supõe uma instância só da API (a da VPS); com mais de uma, soltaria a leitura viva da outra. Trocar por um lease no banco.
    public int soltarSessoesEmLeitura() {
        int total = 0;
        for (Consultoria c : consultorias.findAll()) {
            Integer soltas = TenantContext.executarComo(c.getId(), () -> transacao.execute(status -> {
                List<ImportacaoSessao> presas = sessoes.findByConsultoriaIdAndEstado(c.getId(), "PROCESSANDO");
                for (ImportacaoSessao s : presas) {
                    SessaoJson.marcarFlagProgresso(json, s, "erroProcessamento", true);
                    s.atualizarEstado("RECEBENDO");
                }
                return presas.size();
            }));
            total += soltas == null ? 0 : soltas;
        }
        return total;
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
