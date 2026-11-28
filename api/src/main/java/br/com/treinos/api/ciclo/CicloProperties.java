package br.com.treinos.api.ciclo;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Acompanhamento do ciclo menstrual ({@code TREINOS_CICLO_HABILITADO}). Ligado por padrão (leva 1, 27/11; em produção vale o `consultoria.env`; antes era desligado por decisão de 27/10).
 * Com a chave desligada, as rotas da aluna e do treinador respondem 503
 * {@code CICLO_INDISPONIVEL_NO_APP} e o app esconde tudo ({@code cicloHabilitado} no {@code GET /eu}). Exportar e apagar
 * (LGPD) e desligar quando o sexo deixa de ser feminino rodam sempre, com a chave ligada ou não.
 */
@ConfigurationProperties("treinos.ciclo")
public record CicloProperties(boolean habilitado) {
}
