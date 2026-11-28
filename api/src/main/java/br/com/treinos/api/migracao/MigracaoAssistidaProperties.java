package br.com.treinos.api.migracao;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Migração assistida ({@code TREINOS_MIGRACAO_ASSISTIDA_HABILITADA}), fase 1: diagnóstico do arquivo. Ligada por padrão (leva 1, 27/11; em produção vale o `consultoria.env`). Com a chave desligada, as
 * rotas {@link ExigeMigracaoAssistida} respondem 503 {@code MIGRACAO_INDISPONIVEL} e o app esconde tudo
 * ({@code migracaoAssistidaHabilitada} no {@code GET /eu}).
 */
@ConfigurationProperties("treinos.migracao-assistida")
public record MigracaoAssistidaProperties(boolean habilitado) {
}
