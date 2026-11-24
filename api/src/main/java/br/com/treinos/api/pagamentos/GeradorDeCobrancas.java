package br.com.treinos.api.pagamentos;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Optional;

/**
 * Cria as cobranças de uma contratação. A primeira nasce ao contratar; as seguintes, todo mês, paga a anterior ou não (D1 do
 * plano financeiro-em-fases): {@link #garantirAteHoje} cria cada competência até a primeira com vencimento a partir de hoje,
 * e quem o chama é a {@link RotinaDeGeracaoDeCobrancas} (diária), contratar e retomar. Pagar, cancelar e pausar não geram nada.
 * Sempre dentro da transação de quem já travou aluno e contratação (ver {@link Travas}); a conta das datas é do
 * {@link CalendarioDeCobranca}, e conferir a competência antes de inserir é o que torna repetir inofensivo (a unicidade do
 * banco é só rede de segurança).
 */
@Component
class GeradorDeCobrancas {

    private final CobrancaAlunoRepository cobrancas;
    private final GeracaoRepositorio geracao;

    GeradorDeCobrancas(CobrancaAlunoRepository cobrancas, GeracaoRepositorio geracao) {
        this.cobrancas = cobrancas;
        this.geracao = geracao;
    }

    /**
     * A primeira cobrança, na competência escolhida ao contratar ({@link CalendarioDeCobranca#primeiraCompetencia}, sempre na
     * grade da âncora): vencimento = primeira data a partir dela com o dia combinado.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    CobrancaAluno primeira(ContratacaoAluno contratacao, LocalDate competencia) {
        LocalDate vencimento = CalendarioDeCobranca.vencimento(competencia, contratacao.getDiaVencimento(), null);
        return cobrancas.save(new CobrancaAluno(contratacao, competencia, vencimento));
    }

    /**
     * Garante uma cobrança para cada competência até a primeira com vencimento a partir de {@code hoje}, sem olhar se as
     * anteriores estão pagas, abertas ou canceladas (a competência cancelada continua ocupada). Contratação pausada,
     * encerrada, de parcela única ou de contrato fechado (V098) não gera. Repetir no mesmo dia não faz nada. Devolve quantas criou.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    int garantirAteHoje(ContratacaoAluno contratacao, LocalDate hoje) {
        int criadas = 0;
        LocalDate vencimento = geracao.maiorVencimentoDaMensalidade(contratacao.getId(), CobrancaAluno.Tipo.MENSALIDADE)
                .orElse(null);
        while (vencimento == null || vencimento.isBefore(hoje)) {
            Optional<CobrancaAluno> nova = proxima(contratacao);
            if (nova.isEmpty()) {
                break;
            }
            vencimento = nova.get().getVencimento();
            criadas++;
        }
        return criadas;
    }

    /**
     * A próxima competência depois da maior que existe (e nunca antes do fim do período da última que cobre período);
     * nada para contratação parada, encerrada ou parcela única.
     */
    private Optional<CobrancaAluno> proxima(ContratacaoAluno contratacao) {
        if (contratacao.getSituacao() != ContratacaoAluno.Situacao.ATIVA || !contratacao.recorrente()) {
            return Optional.empty();
        }
        LocalDate maior = cobrancas.maiorCompetencia(contratacao.getId()).orElse(null);
        LocalDate maiorCoberta = cobrancas
                .maiorCompetenciaCoberta(contratacao.getId(), CobrancaAluno.NAO_COBREM_PERIODO).orElse(null);
        LocalDate competencia = CalendarioDeCobranca.proximaCompetencia(contratacao.getAncora(),
                contratacao.getPeriodicidade(), maior, maiorCoberta);
        if (cobrancas.existsMensalidade(contratacao.getId(), competencia)) {
            return Optional.empty();
        }
        LocalDate vencimento = CalendarioDeCobranca.vencimento(competencia, contratacao.getDiaVencimento(), null);
        return Optional.of(cobrancas.save(new CobrancaAluno(contratacao, competencia, vencimento)));
    }
}
