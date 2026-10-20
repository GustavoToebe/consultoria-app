package br.com.treinos.api.pagamentos;

import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.pagamentos.provedor.ProvedoresDePagamento;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Todas as mudanças de situação de uma cobrança, para qualquer provedor: a baixa manual do treinador passa por aqui e a
 * Fase 2 (webhook conferido, estorno, contestação) usará as mesmas regras. Cada operação trava aluno, contratação e
 * cobrança nessa ordem ({@link Travas}) e é idempotente: repetir devolve o estado atual com {@code mudou = false}, e só
 * quem mudou de verdade gera auditoria e cobrança seguinte. Roda dentro da transação de quem chama.
 */
@Service
public class BaixaDeCobranca {

    /** O pagamento a registrar. {@code versaoEsperada} só a baixa do treinador traz (o provedor não tem versão a conferir). */
    public record Baixa(String provedor, FormaDePagamento forma, LocalDate pagoEm, UUID baixaPor, String observacao,
                        Long versaoEsperada) {
    }

    /** A cobrança depois da operação, o nome do aluno e a contratação (para a resposta) e se algo mudou. */
    public record Resultado(CobrancaAluno cobranca, String alunoNome, ContratacaoAluno contratacao, boolean mudou) {
    }

    private final Travas travas;
    private final GeradorDeCobrancas gerador;
    private final ProvedoresDePagamento provedores;
    private final CobrancaAlunoRepository cobrancas;

    BaixaDeCobranca(Travas travas, GeradorDeCobrancas gerador, ProvedoresDePagamento provedores,
                    CobrancaAlunoRepository cobrancas) {
        this.travas = travas;
        this.gerador = gerador;
        this.provedores = provedores;
        this.cobrancas = cobrancas;
    }

    /** ABERTA vira PAGA; parcela única encerra a contratação, as demais geram a seguinte se a de maior competência não está aberta. */
    @Transactional(propagation = Propagation.MANDATORY)
    public Resultado baixar(UUID cobrancaId, Baixa baixa) {
        if (!provedores.conhece(baixa.provedor())) {
            throw new IllegalArgumentException("Provedor de pagamento desconhecido.");
        }
        Travas.DaCobranca t = travas.daCobranca(cobrancaId);
        CobrancaAluno c = t.cobranca();
        if (c.getSituacao() == CobrancaAluno.Situacao.PAGA) {
            return resultado(t, false);
        }
        exigirAberta(c);
        conferirVersao(c, baixa.versaoEsperada());
        c.pagar(baixa.provedor(), baixa.forma(), baixa.pagoEm(), baixa.baixaPor(), baixa.observacao());
        if (!t.contratacao().getPeriodicidade().recorrente()) {
            if (t.contratacao().isVigente()) {
                t.contratacao().encerrar(Instant.now());
            }
        } else {
            gerador.garantirSeguinte(t.contratacao());
        }
        return resultado(t, true);
    }

    /**
     * Volta a baixa manual: PAGA vira ABERTA. Baixa de provedor não se desfaz aqui (409), nem a da parcela única de uma
     * contratação já encerrada (409 PARCELA_UNICA_ENCERRADA: reabrir cobraria de novo sem contratação). Já ABERTA: nada muda.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public Resultado desfazerBaixa(UUID cobrancaId, String motivo, Long versaoEsperada) {
        Travas.DaCobranca t = travas.daCobranca(cobrancaId);
        CobrancaAluno c = t.cobranca();
        if (c.getSituacao() == CobrancaAluno.Situacao.ABERTA) {
            return resultado(t, false);
        }
        if (c.getSituacao() != CobrancaAluno.Situacao.PAGA) {
            throw new ConflictException("Só uma cobrança paga pode ter a baixa desfeita.", "COBRANCA_NAO_PAGA");
        }
        if (!CobrancaAluno.MANUAL.equals(c.getProvedor())) {
            throw new ConflictException("Só a baixa manual pode ser desfeita.", "BAIXA_NAO_MANUAL");
        }
        if (!t.contratacao().getPeriodicidade().recorrente()
                && t.contratacao().getSituacao() == ContratacaoAluno.Situacao.ENCERRADA) {
            throw new ConflictException("Esta cobrança era a parcela única de um plano já encerrado; para cobrar de novo, "
                    + "contrate o plano outra vez.", "PARCELA_UNICA_ENCERRADA");
        }
        conferirVersao(c, versaoEsperada);
        c.reabrir(motivo);
        return resultado(t, true);
    }

    /**
     * ABERTA vira CANCELADA e vale como "pular o período": gera a seguinte se a de maior competência não ficou aberta; na
     * parcela única encerra a contratação. Já cancelada: nada muda.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public Resultado cancelar(UUID cobrancaId, String motivo, Long versaoEsperada) {
        Travas.DaCobranca t = travas.daCobranca(cobrancaId);
        CobrancaAluno c = t.cobranca();
        if (c.getSituacao() == CobrancaAluno.Situacao.CANCELADA) {
            return resultado(t, false);
        }
        exigirAberta(c);
        conferirVersao(c, versaoEsperada);
        c.cancelar(motivo);
        if (t.contratacao().getPeriodicidade().recorrente()) {
            gerador.garantirSeguinte(t.contratacao());
        } else if (t.contratacao().isVigente()) {
            // Parcela única cancelada: não há mais o que cobrar, e a contratação vigente bloquearia uma nova.
            t.contratacao().encerrar(Instant.now());
        }
        return resultado(t, true);
    }

    /** O provedor devolveu o dinheiro: PAGA vira ESTORNADA (o registro da baixa fica). Ainda sem chamador (Fase 2). */
    @Transactional(propagation = Propagation.MANDATORY)
    public Resultado estornar(UUID cobrancaId, String motivo) {
        Travas.DaCobranca t = travas.daCobranca(cobrancaId);
        CobrancaAluno c = t.cobranca();
        if (c.getSituacao() == CobrancaAluno.Situacao.ESTORNADA) {
            return resultado(t, false);
        }
        exigirPaga(c);
        c.estornar(motivo);
        return resultado(t, true);
    }

    /** O pagador contestou a cobrança no banco: PAGA vira CONTESTADA. Ainda sem chamador (Fase 2). */
    @Transactional(propagation = Propagation.MANDATORY)
    public Resultado contestar(UUID cobrancaId, String motivo) {
        Travas.DaCobranca t = travas.daCobranca(cobrancaId);
        CobrancaAluno c = t.cobranca();
        if (c.getSituacao() == CobrancaAluno.Situacao.CONTESTADA) {
            return resultado(t, false);
        }
        exigirPaga(c);
        c.contestar(motivo);
        return resultado(t, true);
    }

    /** Grava já, para a resposta levar a versão nova e uma violação de unicidade aparecer aqui, não no commit. */
    private Resultado resultado(Travas.DaCobranca t, boolean mudou) {
        if (mudou) {
            cobrancas.flush();
        }
        return new Resultado(t.cobranca(), t.aluno().getNome(), t.contratacao(), mudou);
    }

    private static void exigirAberta(CobrancaAluno c) {
        if (c.getSituacao() != CobrancaAluno.Situacao.ABERTA) {
            throw new ConflictException("Esta cobrança não está em aberto.", "COBRANCA_NAO_ABERTA");
        }
    }

    private static void exigirPaga(CobrancaAluno c) {
        if (c.getSituacao() != CobrancaAluno.Situacao.PAGA) {
            throw new ConflictException("Só uma cobrança paga pode mudar para esta situação.", "COBRANCA_NAO_PAGA");
        }
    }

    private static void conferirVersao(CobrancaAluno c, Long esperada) {
        if (esperada != null && !esperada.equals(c.getVersao())) {
            throw new ConflictException("Outra pessoa ou aba alterou esta cobrança. Recarregue para ver a versão atual.",
                    "CONFLITO_EDICAO");
        }
    }
}
