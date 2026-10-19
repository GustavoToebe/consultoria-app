package br.com.treinos.api.inscricoes;

import java.util.Set;

/**
 * Situação comercial da inscrição. Abertas = ainda em atendimento. {@code ACEITA} só pelo aceite (cria o aluno) e
 * {@code RECUSADA} só pelo recusar (as duas com evento próprio na auditoria). Recusada e desistente saem sozinhas depois
 * de 180 dias.
 */
public enum SituacaoInscricao {
    NOVA, EM_CONTATO, EM_NEGOCIACAO, ACEITA, RECUSADA, DESISTIU;

    public static final Set<SituacaoInscricao> ABERTAS = Set.of(NOVA, EM_CONTATO, EM_NEGOCIACAO);
    public static final Set<SituacaoInscricao> ENCERRADAS_SEM_ALUNO = Set.of(RECUSADA, DESISTIU);

    public boolean aberta() {
        return ABERTAS.contains(this);
    }
}
