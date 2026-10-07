package br.com.treinos.api.consultoria;

import java.util.UUID;

/**
 * O que o app precisa para vestir a marca do treinador (depois do login ou ao abrir o convite). Sem dado de aluno.
 * {@code logoUrl} é relativo à API (o app junta com a URL base) e muda de versão a cada envio, para o cache.
 */
public record MarcaPublica(UUID id, String nome, String lema, String corPrimaria, String fonteTitulo,
                           String temaPadrao, String logoUrl) {

    public static MarcaPublica de(Consultoria c) {
        String logoUrl = c.getLogoTipo() == null ? null
                : "/publico/marcas/" + c.getId() + "/logo?v=" + c.getLogoVersao();
        return new MarcaPublica(c.getId(), c.getNome(), c.getLema(), c.getCorPrimaria(), c.getFonteTitulo().name(),
                c.getTemaPadrao().name(), logoUrl);
    }
}
