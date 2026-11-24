package br.com.treinos.api.pagamentos;

import br.com.treinos.api.pagamentos.PagamentosDtos.CobrancaDoAluno;
import br.com.treinos.api.pagamentos.PagamentosDtos.CobrancaResponse;
import br.com.treinos.api.pagamentos.PagamentosDtos.ContratacaoResponse;
import br.com.treinos.api.pagamentos.PagamentosDtos.LancamentoResponse;
import br.com.treinos.api.pagamentos.PagamentosDtos.PlanoResponse;

import br.com.treinos.api.web.Fuso;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

/** Entidade para resposta HTTP. Nada aqui lê o banco: quem chama já tem os nomes. */
final class Respostas {

    private Respostas() {
    }

    static PlanoResponse plano(PlanoComercial p) {
        return new PlanoResponse(p.getId(), p.getNome(), p.getValorCentavos(), p.getPeriodicidade(),
                p.isArquivado(), p.getCriadoEm(), p.getVersao(), p.getTempoMinimoMeses(), p.getRegraDeSaida(),
                p.getLinkDePagamento(), p.isIncluiTreino(), p.isIncluiDieta(), p.isKiwifyAssinatura(), p.getKiwifyProdutoId());
    }

    /** Sem o bloco {@code contrato}: a resposta do aluno (que nunca vê o saldo) e a do recorrente. */
    static ContratacaoResponse contratacao(ContratacaoAluno c, String planoNome) {
        return contratacao(c, planoNome, null);
    }

    /** {@code contrato} é o bloco do contrato fechado, lido por quem chama ({@code CobrancaAlunoRepository.contratoDe}). */
    static ContratacaoResponse contratacao(ContratacaoAluno c, String planoNome, PagamentosDtos.ContratoDaContratacao contrato) {
        VigenciaDoPlano v = VigenciaDoPlano.de(c, LocalDate.now(Fuso.BRASILIA));
        return new ContratacaoResponse(c.getId(), c.getAlunoId(), c.getPlanoComercialId(), planoNome, c.getPeriodicidade(),
                c.getValorCentavos(), c.getMotivoValor(), c.getInicio(), c.getDiaVencimento(), c.getSituacao(),
                c.getEncerradaEm(), c.getCriadoEm(), c.getVersao(), v.termino(), v.diasRestantes(), v.alerta(),
                c.getMinimoAte(), contrato);
    }

    /** {@code alunoCpf}: o do aluno, já decidido por quem chama (nulo sem {@code ALUNO_SENSIVEL_LER}). */
    static CobrancaResponse cobranca(LinhaDeCobranca l, LocalDate hoje, String alunoCpf, boolean automatica) {
        CobrancaAluno c = l.cobranca();
        boolean vencida = c.vencida(hoje);
        return new CobrancaResponse(c.getId(), c.getContratacaoId(), c.getAlunoId(), l.alunoNome(), l.planoNome(),
                c.getCompetencia(), c.getVencimento(), c.getValorCentavos(), c.getSituacao(), vencida,
                vencida ? diasDeAtraso(c, hoje) : null, c.getForma(), c.getProvedor(), c.getPagoEm(), c.getBaixaPor(),
                l.baixaPorNome(), c.getObservacao(), c.getMotivo(), c.getVersao(), c.getCriadoEm(), c.getIdExterno(),
                alunoCpf, c.getTipo(), c.getDescricao(), c.getAcordoId(), automatica ? CobrancaAutomatica.KIWIFY : null);
    }

    /** Só o que o aluno pode ver: sem observação, motivo, quem deu a baixa nem o provedor. */
    static CobrancaDoAluno cobrancaDoAluno(CobrancaAluno c, LocalDate hoje, boolean automatica) {
        return new CobrancaDoAluno(c.getId(), c.getCompetencia(), c.getVencimento(), c.getValorCentavos(),
                c.getSituacao(), c.vencida(hoje), c.getForma(), c.getPagoEm(), c.getTipo(), c.getDescricao(),
                automatica ? CobrancaAutomatica.KIWIFY : null, doContrato(c));
    }

    /** Entrada, parcela e pagamento do saldo de um contrato fechado: AVULSA ou RENEGOCIACAO só têm contratação nele (V098). */
    static boolean doContrato(CobrancaAluno c) {
        return c.getContratacaoId() != null && CobrancaAluno.DO_CONTRATO.contains(c.getTipo());
    }

    static LancamentoResponse lancamento(LancamentoFinanceiro l) {
        return new LancamentoResponse(l.getId(), l.getData(), l.getDescricao(), l.getValorCentavos(), l.getTipo(),
                l.getCategoria(), l.getCriadoEm(), l.getVersao());
    }

    static long diasDeAtraso(CobrancaAluno c, LocalDate hoje) {
        return ChronoUnit.DAYS.between(c.getVencimento(), hoje);
    }
}
