package br.com.treinos.api.consultoria;

import jakarta.validation.constraints.NotNull;
import tools.jackson.databind.JsonNode;

/**
 * {@code PUT /consultoria/documentos-pdf}: o modelo escolhido e só as opções sobrescritas (objeto; nulo = nenhuma), com a
 * {@code versao} da consultoria que a tela leu. As opções são conferidas por {@link OpcoesPdf}, não pelo binding do JSON.
 */
public record DocumentosPdfRequest(@NotNull Consultoria.ModeloPdf modelo, JsonNode opcoes, @NotNull Long versao) {
}
