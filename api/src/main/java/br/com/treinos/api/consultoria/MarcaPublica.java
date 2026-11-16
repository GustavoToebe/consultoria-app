package br.com.treinos.api.consultoria;

import java.util.UUID;

/**
 * O que o app precisa para vestir a marca do treinador (depois do login ou ao abrir o convite). Sem dado de aluno.
 * {@code logoUrl} é relativo à API (o app junta com a URL base) e muda de versão a cada envio, para o cache.
 */
public record MarcaPublica(UUID id, String nome, String corPrimaria, String fonteTitulo,
                           String temaPadrao, String logoUrl) {

    public static MarcaPublica de(Consultoria c) {
        return new MarcaPublica(c.getId(), c.getNome(), c.getCorPrimaria(), c.getFonteTitulo().name(),
                c.getTemaPadrao().name(), logoUrl(c.getId(), c.getLogoTipo(), c.getLogoVersao()));
    }

    /** O caminho da logo pública; nulo sem logo ({@code logoTipo} nulo). Quem não carrega a entidade (marketplace) usa este. */
    public static String logoUrl(UUID consultoriaId, String logoTipo, int logoVersao) {
        return logoTipo == null ? null : "/publico/marcas/" + consultoriaId + "/logo?v=" + logoVersao;
    }
}
