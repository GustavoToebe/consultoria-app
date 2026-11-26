package br.com.treinos.api.consultoria;

import tools.jackson.databind.JsonNode;

import java.util.UUID;

/**
 * O que o app precisa para vestir a marca do treinador (depois do login ou ao abrir o convite). Sem dado de aluno.
 * {@code logoUrl} é relativo à API (o app junta com a URL base) e muda de versão a cada envio, para o cache.
 * {@code temaPdf} leva o id do modelo dos PDFs e {@code opcoesPdf} só as opções sobrescritas (objeto; ausente = valor do modelo).
 */
public record MarcaPublica(UUID id, String nome, String corPrimaria, String fonteTitulo,
                           String temaPadrao, String logoUrl, String temaPdf, JsonNode opcoesPdf) {

    public static MarcaPublica de(Consultoria c) {
        return new MarcaPublica(c.getId(), c.getNome(), c.getCorPrimaria(), c.getFonteTitulo().name(),
                c.getTemaPadrao().name(), logoUrl(c.getId(), c.getLogoTipo(), c.getLogoVersao()),
                c.getModeloPdf().name(), OpcoesPdf.ler(c.getOpcoesPdf()));
    }

    /** O caminho da logo pública; nulo sem logo ({@code logoTipo} nulo). Quem não carrega a entidade (marketplace) usa este. */
    public static String logoUrl(UUID consultoriaId, String logoTipo, int logoVersao) {
        return logoTipo == null ? null : "/publico/marcas/" + consultoriaId + "/logo?v=" + logoVersao;
    }
}
