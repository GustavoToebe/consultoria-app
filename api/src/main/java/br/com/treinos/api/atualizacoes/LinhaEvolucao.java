package br.com.treinos.api.atualizacoes;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Uma atualização enviada ou revisada com as respostas e o conteúdo da versão do questionário que o aluno respondeu,
 * lidos numa consulta só para a evolução das respostas (sem N+1). Respostas sensíveis: nunca em log nem em toString
 * de exceção.
 */
public record LinhaEvolucao(UUID atualizacaoId, LocalDate data, String respostas, String conteudo) { }
