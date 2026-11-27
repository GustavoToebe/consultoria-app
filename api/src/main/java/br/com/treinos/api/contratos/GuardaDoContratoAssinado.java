package br.com.treinos.api.contratos;

import br.com.treinos.api.pagamentos.PagamentosDoAluno;
import br.com.treinos.api.tenant.TenantContext;
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
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Guarda do contrato assinado (D16): o assinado sobrevive à anonimização e a "Excluir minha conta" como prova, mas só por 5 anos
 * depois do fim do contrato. Esta rotina diária (3h40 de Brasília) apaga o texto, as evidências e o link do que passou disso e a
 * linha do PDF; ficam id, título, {@code sha256}, situação e grupo, com {@code apagado_em}.
 * <p>
 * Elegível: {@code ASSINADO}, ainda não apagado, de aluno anonimizado, com referência + 5 anos &lt;= hoje (Brasília). Referência = o
 * fim da contratação ligada ({@link PagamentosDoAluno#fimDaContratacaoParaGuarda}: o encerramento, ou o fim da vigência) ou, sem
 * contratação, o dia da assinatura. Contratação que não terminou mantém o contrato. Roda com o módulo de contratos e o financeiro
 * ligados ou não: lê só dado já gravado, e a flag só fecha os controllers.
 * <p>
 * Uma transação por consultoria ({@link TenantContext#executarComo} com a transação aberta dentro): o erro de uma desfaz só ela, vai
 * ao log com o id da consultoria e a classe da exceção (nunca texto, nome, CPF, IP nem a mensagem do erro) e a rotina segue para a
 * próxima. Idempotente: o UPDATE só casa com o não apagado.
 */
@Component
public class GuardaDoContratoAssinado {

    private static final Logger LOG = LoggerFactory.getLogger(GuardaDoContratoAssinado.class);

    /** Anos de guarda depois do fim do contrato (D16: prescrição da cobrança de contrato escrito, Código Civil art. 206, § 5º, I). */
    static final int ANOS_DE_GUARDA = 5;

    /** O que uma rodada fez: contratos apagados e consultorias que falharam (essas ficam como estavam e voltam na rodada seguinte). */
    public record Resultado(int apagados, int consultoriasQueFalharam) { }

    private final ContratoGuardaRepository guarda;
    private final PagamentosDoAluno pagamentos;
    private final boolean agendada;
    private final TransactionTemplate transacao;

    GuardaDoContratoAssinado(ContratoGuardaRepository guarda, PagamentosDoAluno pagamentos,
                             PlatformTransactionManager transacoes,
                             @Value("${treinos.contratos.guarda-agendada:true}") boolean agendada) {
        this.guarda = guarda;
        this.pagamentos = pagamentos;
        this.agendada = agendada;
        this.transacao = new TransactionTemplate(transacoes);
    }

    @Scheduled(cron = "0 40 3 * * *", zone = Fuso.ID)
    void rodarAgendado() {
        if (!agendada) {
            return;
        }
        try {
            Resultado r = rodar(LocalDate.now(Fuso.BRASILIA));
            if (r.apagados() + r.consultoriasQueFalharam() > 0) {
                LOG.info("Guarda do contrato assinado: {} apagados, {} consultorias com falha.", r.apagados(), r.consultoriasQueFalharam());
            }
        } catch (RuntimeException e) {
            LOG.error("Guarda do contrato assinado falhou ({}).", e.getClass().getSimpleName());
        }
    }

    /** Uma rodada em todas as consultorias, com {@code hoje} (Brasília). */
    public Resultado rodar(LocalDate hoje) {
        int apagados = 0;
        int falhas = 0;
        for (UUID consultoriaId : guarda.consultorias()) {
            try {
                apagados += rodarNa(consultoriaId, hoje);
            } catch (RuntimeException e) {
                falhas++;
                LOG.error("Guarda do contrato assinado falhou na consultoria {} ({}).", consultoriaId, e.getClass().getSimpleName());
            }
        }
        return new Resultado(apagados, falhas);
    }

    /** Uma consultoria, numa transação só: tudo ou nada. Os testes a chamam para contar só o dado do próprio teste. */
    int rodarNa(UUID consultoriaId, LocalDate hoje) {
        Integer apagados = TenantContext.executarComo(consultoriaId, () -> transacao.execute(s -> apagarElegiveis(consultoriaId, hoje)));
        return apagados == null ? 0 : apagados;
    }

    private int apagarElegiveis(UUID consultoriaId, LocalDate hoje) {
        List<Object[]> guardados = guarda.guardadosDeAlunoAnonimizado(consultoriaId);
        // Um instante só por consultoria, na precisão do banco.
        Instant agora = Instant.now().truncatedTo(ChronoUnit.MICROS);
        int apagados = 0;
        for (Object[] linha : guardados) {
            UUID id = UUID.fromString((String) linha[0]);
            Optional<LocalDate> referencia = linha[1] == null
                    ? Optional.of(LocalDate.parse((String) linha[2]))
                    : pagamentos.fimDaContratacaoParaGuarda(UUID.fromString((String) linha[1]));
            // Sem referência (contratação que não terminou): mantém. Referência + 5 anos == hoje já apaga.
            boolean passouDaGuarda = referencia.map(r -> !r.plusYears(ANOS_DE_GUARDA).isAfter(hoje)).orElse(false);
            if (passouDaGuarda && guarda.apagar(consultoriaId, id, agora) == 1) {
                guarda.apagarPdf(consultoriaId, id);
                apagados++;
            }
        }
        return apagados;
    }
}
