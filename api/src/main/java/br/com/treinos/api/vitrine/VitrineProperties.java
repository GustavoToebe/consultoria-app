package br.com.treinos.api.vitrine;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Vitrine da consultoria ({@code TREINOS_VITRINE_HABILITADA}). Desligada por padrão: as rotas {@link ExigeVitrine} respondem
 * 503 {@code VITRINE_INDISPONIVEL} e o app esconde tudo ({@code vitrineHabilitada} no {@code GET /eu}). A loja e o marketplace
 * (F2 e F3 do plano) terão chave própria, cada uma nascendo desligada.
 */
@ConfigurationProperties("treinos.vitrine")
public record VitrineProperties(boolean habilitada) {
}
