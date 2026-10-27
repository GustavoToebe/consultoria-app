package br.com.treinos.api.ciclo;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Acompanhamento do ciclo menstrual ({@code TREINOS_CICLO_HABILITADO}). Desligado por padrão (decisão do Gustavo de
 * 27/10: o módulo fica no código, sem uso, até ser retomado): as rotas da aluna e do treinador respondem 503
 * {@code CICLO_INDISPONIVEL_NO_APP} e o app esconde tudo ({@code cicloHabilitado} no {@code GET /eu}). Exportar e apagar
 * (LGPD) e desligar quando o sexo deixa de ser feminino rodam sempre, com a chave ligada ou não.
 */
@ConfigurationProperties("treinos.ciclo")
public record CicloProperties(boolean habilitado) {
}
