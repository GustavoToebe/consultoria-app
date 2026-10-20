package br.com.treinos.api.pagamentos;

import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.pagamentos.provedor.ProvedoresDePagamento;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import java.util.function.Supplier;

/**
 * Todas as mudanças de situação de uma cobrança, para qualquer provedor: a baixa manual do treinador passa por aqui e a
 * baixa que o provedor confirmou usa as mesmas regras. Cada operação trava aluno, contratação e
 * cobrança nessa ordem ({@link Travas}) e é idempotente: repetir devolve o estado atual com {@code mudou = false}, e só
 * quem mudou de verdade gera auditoria e cobrança seguinte. Roda dentro da transação de quem chama.
 */
@Service
public class BaixaDeCobranca {

    /**
     * O pagamento a registrar. {@code versaoEsperada} só a baixa do treinador traz (o provedor não tem versão a conferir) e
     * {@code idExterno} só a do provedor (a transação dele).
     */
    public record Baixa(String provedor, FormaDePagamento forma, LocalDate pagoEm, UUID baixaPor, String observacao,
                        Long versaoEsperada, String idExterno) {

        public Baixa(String provedor, FormaDePagamento forma, LocalDate pagoEm, UUID baixaPor, String observacao,
                     Long versaoEsperada) {
            this(provedor, forma, pagoEm, baixaPor, observacao, versaoEsperada, null);
        }
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
        return baixar(baixa, () -> travas.daCobranca(cobrancaId));
    }

    /** A baixa que o provedor confirmou: a mesma regra, sem recusar aluno que saiu (ver {@link Travas#daCobrancaDoProvedor}). */
    @Transactional(propagation = Propagation.MANDATORY)
    public Resultado baixarDoProvedor(UUID cobrancaId, Baixa baixa) {
        return baixar(baixa, () -> travas.daCobrancaDoProvedor(cobrancaId));
    }

    /** O provedor é conferido antes de travar nada: provedor desconhecido não toma lock. */
    private Resultado baixar(Baixa baixa, Supplier<Travas.DaCobranca> trava) {
        if (!provedores.conhece(baixa.provedor())) {
            throw new IllegalArgumentException("Provedor de pagamento desconhecido.");
        }
        Travas.DaCobranca t = trava.get();
        CobrancaAluno c = t.cobranca();
        if (c.getSituacao() == CobrancaAluno.Situacao.PAGA) {
            return resultado(t, false);
        }
        exigirAberta(c);
        conferirVersao(c, baixa.versaoEsperada());
        c.pagar(baixa.provedor(), baixa.forma(), baixa.pagoEm(), baixa.baixaPor(), baixa.observacao(), baixa.idExterno());
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

    /**
     * O dinheiro voltou ao pagador (estorno feito pelo treinador na InfinitePay ou no banco, ou contestação perdida): PAGA ou
     * CONTESTADA vira ESTORNADA. O registro da baixa (data, forma, quem deu) fica, e a cobrança deixa de cobrir o período. Não
     * tem volta: ESTORNADA não muda mais. Só pelo treinador ({@code POST /cobrancas/{id}/estornar}); o provedor nunca estorna
     * sozinho (um estorno informado só vai para a conferência). A mesma situação de novo é idempotente.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public Resultado estornar(UUID cobrancaId, String motivo, Long versaoEsperada) {
        Travas.DaCobranca t = travas.daCobranca(cobrancaId);
        CobrancaAluno c = t.cobranca();
        if (c.getSituacao() == CobrancaAluno.Situacao.ESTORNADA) {
            return resultado(t, false);
        }
        if (c.getSituacao() != CobrancaAluno.Situacao.PAGA && c.getSituacao() != CobrancaAluno.Situacao.CONTESTADA) {
            throw new ConflictException("Só uma cobrança paga ou contestada pode ser marcada como estornada.",
                    "COBRANCA_NAO_PAGA");
        }
        conferirVersao(c, versaoEsperada);
        c.estornar(motivo);
        return resultado(t, true);
    }

    /**
     * O pagador contestou o pagamento no banco ou no cartão: PAGA vira CONTESTADA e continua cobrindo o período até o banco
     * decidir. A InfinitePay não avisa contestação pela API, então só o treinador marca
     * ({@code POST /cobrancas/{id}/contestar}). A mesma situação de novo é idempotente.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public Resultado contestar(UUID cobrancaId, String motivo, Long versaoEsperada) {
        Travas.DaCobranca t = travas.daCobranca(cobrancaId);
        CobrancaAluno c = t.cobranca();
        if (c.getSituacao() == CobrancaAluno.Situacao.CONTESTADA) {
            return resultado(t, false);
        }
        exigirPaga(c);
        conferirVersao(c, versaoEsperada);
        c.contestar(motivo);
        return resultado(t, true);
    }

    /**
     * A contestação terminou a favor do treinador: CONTESTADA volta a PAGA, com a mesma baixa (data, forma, quem deu). PAGA de
     * novo é idempotente; qualquer outra situação é 409 (estornada não volta).
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public Resultado manterPaga(UUID cobrancaId, String motivo, Long versaoEsperada) {
        Travas.DaCobranca t = travas.daCobranca(cobrancaId);
        CobrancaAluno c = t.cobranca();
        if (c.getSituacao() == CobrancaAluno.Situacao.PAGA) {
            return resultado(t, false);
        }
        if (c.getSituacao() != CobrancaAluno.Situacao.CONTESTADA) {
            throw new ConflictException("Só uma cobrança contestada pode voltar a ficar paga.", "COBRANCA_NAO_CONTESTADA");
        }
        conferirVersao(c, versaoEsperada);
        c.manterPaga(motivo);
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
