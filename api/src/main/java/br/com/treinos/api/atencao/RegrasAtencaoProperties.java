package br.com.treinos.api.atencao;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Regras de atenção do treinador ({@code TREINOS_REGRAS_ATENCAO_HABILITADO}). Desligado por padrão: nada é avaliado no envio, as
 * rotas {@link ExigeRegrasAtencao} respondem 503 {@code REGRAS_ATENCAO_INDISPONIVEIS}, a lista e o detalhe de atualizações trazem
 * os pontos nulos e o app esconde tudo ({@code regrasAtencaoHabilitada} no {@code GET /eu}).
 */
@ConfigurationProperties("treinos.regras-atencao")
public record RegrasAtencaoProperties(boolean habilitado) {
}
