package br.com.treinos.api.agenda;

import java.util.EnumSet;
import java.util.Set;

/**
 * Situação de um compromisso da agenda presencial. Só {@code CANCELADO} libera o horário do responsável; realizado e
 * falta continuam ocupando o horário (aconteceram, ou deveriam ter acontecido, naquele tempo).
 */
public enum SituacaoCompromisso {
    AGENDADO, REALIZADO, CANCELADO, FALTOU;

    /** Situações que só fazem sentido depois do início do compromisso. */
    static final Set<SituacaoCompromisso> DEPOIS_DO_INICIO = EnumSet.of(REALIZADO, FALTOU);
    /** O que o aluno vê no app: os marcados e os desmarcados (para saber que não vai acontecer). */
    static final Set<SituacaoCompromisso> DO_ALUNO = EnumSet.of(AGENDADO, CANCELADO);

    boolean ocupaHorario() {
        return this != CANCELADO;
    }
}
