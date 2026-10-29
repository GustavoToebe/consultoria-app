package br.com.treinos.api.retorno;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Concluir treino, o "retorno" ao aluno ({@code TREINOS_RETORNO_HABILITADO}). Desligado por padrão: as rotas
 * {@link ExigeRetorno} respondem 503 {@code RETORNO_INDISPONIVEL} e o app esconde tudo ({@code retornoHabilitado} no
 * {@code GET /eu}). Exportar e apagar (LGPD) rodam sempre, com a chave ligada ou não.
 */
@ConfigurationProperties("treinos.retorno")
public record RetornoProperties(boolean habilitado) {
}
