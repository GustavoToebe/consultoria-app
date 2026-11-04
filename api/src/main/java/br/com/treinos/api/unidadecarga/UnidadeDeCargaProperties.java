package br.com.treinos.api.unidadecarga;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Escolha de kg ou lb para o aluno ver e digitar a carga ({@code TREINOS_UNIDADE_CARGA_HABILITADA}). Desligado por padrão:
 * o app esconde a escolha e tudo segue em kg ({@code unidadeDeCargaHabilitada} no {@code GET /eu}). Só informa o app: a
 * carga é guardada sempre em kg, a unidade escolhida fica no aparelho e nenhuma rota depende desta chave.
 */
@ConfigurationProperties("treinos.unidade-carga")
public record UnidadeDeCargaProperties(boolean habilitado) {
}
