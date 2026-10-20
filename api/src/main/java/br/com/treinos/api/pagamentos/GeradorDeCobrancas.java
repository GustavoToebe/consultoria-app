package br.com.treinos.api.pagamentos;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Optional;

/**
 * Cria as cobranças de uma contratação. Sem agendador: a primeira nasce ao contratar e a seguinte ao pagar ou cancelar a
 * última, ou ao retomar. Sempre dentro da transação de quem já travou aluno e contratação (ver {@link Travas}); a conta
 * das datas é do {@link CalendarioDeCobranca}, e conferir a competência antes de inserir é o que torna repetir inofensivo
 * (a unicidade do banco é só rede de segurança).
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
     * A seguinte, só se a cobrança de partida é a de maior competência (as canceladas contam). Pagar uma cobrança antiga,
     * ou pagar de novo depois de desfazer, não gera nada: a seguinte já existe.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    Optional<CobrancaAluno> aposUltima(ContratacaoAluno contratacao, CobrancaAluno partida) {
        Optional<LocalDate> maior = cobrancas.maiorCompetencia(contratacao.getId());
        if (maior.isEmpty() || !maior.get().equals(partida.getCompetencia())) {
            return Optional.empty();
        }
        return proxima(contratacao);
    }

    /** A próxima competência depois da maior que existe; nada para contratação parada, encerrada ou parcela única. */
    @Transactional(propagation = Propagation.MANDATORY)
    Optional<CobrancaAluno> proxima(ContratacaoAluno contratacao) {
        if (contratacao.getSituacao() != ContratacaoAluno.Situacao.ATIVA || !contratacao.getPeriodicidade().recorrente()) {
            return Optional.empty();
        }
        LocalDate maior = cobrancas.maiorCompetencia(contratacao.getId()).orElse(null);
        LocalDate competencia = CalendarioDeCobranca.proximaCompetencia(contratacao.getAncora(),
                contratacao.getPeriodicidade(), maior);
        if (cobrancas.existsByContratacaoIdAndCompetencia(contratacao.getId(), competencia)) {
            return Optional.empty();
        }
        LocalDate vencimento = CalendarioDeCobranca.vencimento(competencia, contratacao.getDiaVencimento(), null);
        return Optional.of(cobrancas.save(new CobrancaAluno(contratacao, competencia, vencimento)));
    }
}
