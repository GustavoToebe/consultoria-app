package br.com.treinos.api.questionarios;

import java.util.UUID;

/** Linha de contagem agrupada por questionário (alunos, pastas ou envios que o usam). */
public record ContagemPorQuestionario(UUID questionarioId, long total) { }
