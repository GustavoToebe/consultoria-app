package br.com.treinos.api.pagamentos;

import br.com.treinos.api.pagamentos.PagamentosDtos.CobrancaDoAluno;
import br.com.treinos.api.pagamentos.PagamentosDtos.CobrancaResponse;
import br.com.treinos.api.pagamentos.PagamentosDtos.ContratacaoResponse;
import br.com.treinos.api.pagamentos.PagamentosDtos.LancamentoResponse;
import br.com.treinos.api.pagamentos.PagamentosDtos.PlanoResponse;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

/** Entidade para resposta HTTP. Nada aqui lê o banco: quem chama já tem os nomes. */
final class Respostas {

    private Respostas() {
    }

    static PlanoResponse plano(PlanoComercial p) {
        return new PlanoResponse(p.getId(), p.getNome(), p.getValorCentavos(), p.getPeriodicidade(), p.isAceitaPix(),
                p.isAceitaBoleto(), p.isAceitaCartao(), p.isAceitaManual(), p.getMaxParcelas(), p.getTaxaCartao(),
                p.isArquivado(), p.getCriadoEm(), p.getVersao());
    }

    static ContratacaoResponse contratacao(ContratacaoAluno c, String planoNome) {
        return new ContratacaoResponse(c.getId(), c.getAlunoId(), c.getPlanoComercialId(), planoNome, c.getPeriodicidade(),
                c.getValorCentavos(), c.getMotivoValor(), c.getInicio(), c.getDiaVencimento(), c.getSituacao(),
                c.getEncerradaEm(), c.getCriadoEm(), c.getVersao());
    }

    static CobrancaResponse cobranca(LinhaDeCobranca l, LocalDate hoje) {
        CobrancaAluno c = l.cobranca();
        boolean vencida = c.vencida(hoje);
        return new CobrancaResponse(c.getId(), c.getContratacaoId(), c.getAlunoId(), l.alunoNome(), l.planoNome(),
                c.getCompetencia(), c.getVencimento(), c.getValorCentavos(), c.getSituacao(), vencida,
                vencida ? diasDeAtraso(c, hoje) : null, c.getForma(), c.getProvedor(), c.getPagoEm(), c.getBaixaPor(),
                l.baixaPorNome(), c.getObservacao(), c.getMotivo(), c.getVersao());
    }

    /** Só o que o aluno pode ver: sem observação, motivo, quem deu a baixa nem o provedor. */
    static CobrancaDoAluno cobrancaDoAluno(CobrancaAluno c, LocalDate hoje) {
        return new CobrancaDoAluno(c.getId(), c.getCompetencia(), c.getVencimento(), c.getValorCentavos(),
                c.getSituacao(), c.vencida(hoje), c.getForma(), c.getPagoEm());
    }

    static LancamentoResponse lancamento(LancamentoFinanceiro l) {
        return new LancamentoResponse(l.getId(), l.getData(), l.getDescricao(), l.getValorCentavos(), l.getTipo(),
                l.getCategoria(), l.getCriadoEm(), l.getVersao());
    }

    static long diasDeAtraso(CobrancaAluno c, LocalDate hoje) {
        return ChronoUnit.DAYS.between(c.getVencimento(), hoje);
    }
}
