package br.com.treinos.api.pagamentos;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Pagamentos do aluno ao treinador ({@code TREINOS_PAGAMENTOS_HABILITADO}). Desligado por padrão: as rotas do financeiro
 * respondem 503 {@code FINANCEIRO_INDISPONIVEL}. Exportar, apagar (LGPD) e encerrar a contratação do aluno que saiu
 * ({@link PagamentosDoAluno}) rodam sempre, com a chave ligada ou não. Na Fase 1 não há variável obrigatória.
 */
@ConfigurationProperties("treinos.pagamentos")
public record PagamentosProperties(boolean habilitado) {
}
