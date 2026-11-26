package br.com.treinos.api.contratos;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Contrato digital do aluno ({@code TREINOS_CONTRATOS_HABILITADO}). Desligado por padrão: as rotas {@link ExigeContratos}
 * respondem 503 {@code CONTRATOS_INDISPONIVEL} e o app esconde tudo ({@code contratosHabilitados} no {@code GET /eu}). A exportação e
 * a anonimização (LGPD) rodam sempre, com a chave ligada ou não.
 */
@ConfigurationProperties("treinos.contratos")
public record ContratosProperties(boolean habilitado) {
}
