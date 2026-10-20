package br.com.treinos.api.pagamentos;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Optional;

/**
 * Cria as cobranças de uma contratação. Sem agendador: a primeira nasce ao contratar e a seguinte ao pagar ou cancelar uma
 * cobrança (se a de maior competência não está aberta), ou ao retomar. Sempre dentro da transação de quem já travou aluno
 * e contratação (ver {@link Travas}); a conta das datas é do {@link CalendarioDeCobranca}, e conferir a competência antes
 * de inserir é o que torna repetir inofensivo (a unicidade do banco é só rede de segurança).
 */
@Component
class GeradorDeCobrancas {

    private final CobrancaAlunoRepository cobrancas;

    GeradorDeCobrancas(CobrancaAlunoRepository cobrancas) {
        this.cobrancas = cobrancas;
    }

    /** A cobrança do início: competência = início, vencimento = primeira data a partir dele com o dia combinado. */
    @Transactional(propagation = Propagation.MANDATORY)
    CobrancaAluno primeira(ContratacaoAluno contratacao) {
        LocalDate competencia = contratacao.getInicio();
        LocalDate vencimento = CalendarioDeCobranca.vencimento(competencia, contratacao.getDiaVencimento(), null);
        return cobrancas.save(new CobrancaAluno(contratacao, competencia, vencimento));
    }

    /**
     * Garante a seguinte: gera uma cobrança nova sempre que a de MAIOR competência (canceladas incluídas) não está ABERTA.
     * Pagar ou cancelar uma cobrança que não é a última, ou pagar de novo depois de desfazer, não gera nada: a maior
     * continua aberta. Não depende de qual cobrança mudou, então nenhuma sequência de pagar, desfazer, pausar e retomar
     * deixa uma contratação ativa sem cobrança futura (não há agendador).
     */
    @Transactional(propagation = Propagation.MANDATORY)
    Optional<CobrancaAluno> garantirSeguinte(ContratacaoAluno contratacao) {
        Optional<LocalDate> maior = cobrancas.maiorCompetencia(contratacao.getId());
        if (maior.isPresent() && cobrancas.existsByContratacaoIdAndCompetenciaAndSituacao(contratacao.getId(), maior.get(),
                CobrancaAluno.Situacao.ABERTA)) {
            return Optional.empty();
        }
        return proxima(contratacao);
    }

    /**
     * A próxima competência depois da maior que existe (e nunca antes do fim do período da última que cobre período);
     * nada para contratação parada, encerrada ou parcela única.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    Optional<CobrancaAluno> proxima(ContratacaoAluno contratacao) {
        if (contratacao.getSituacao() != ContratacaoAluno.Situacao.ATIVA || !contratacao.getPeriodicidade().recorrente()) {
            return Optional.empty();
        }
        LocalDate maior = cobrancas.maiorCompetencia(contratacao.getId()).orElse(null);
        LocalDate maiorCoberta = cobrancas
                .maiorCompetenciaCoberta(contratacao.getId(), CobrancaAluno.NAO_COBREM_PERIODO).orElse(null);
        LocalDate competencia = CalendarioDeCobranca.proximaCompetencia(contratacao.getAncora(),
                contratacao.getPeriodicidade(), maior, maiorCoberta);
        if (cobrancas.existsByContratacaoIdAndCompetencia(contratacao.getId(), competencia)) {
            return Optional.empty();
        }
        LocalDate vencimento = CalendarioDeCobranca.vencimento(competencia, contratacao.getDiaVencimento(), null);
        return Optional.of(cobrancas.save(new CobrancaAluno(contratacao, competencia, vencimento)));
    }
}
