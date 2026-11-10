package br.com.treinos.api.comunidade;

/**
 * Cor de destaque do perfil na comunidade (lista curta e fechada; decisão 7 do plano {@code perfil-estilo-steam}). O app
 * escolhe o tom de cada uma para os temas claro, escuro, areia e contraste alto e espelha esta lista: mudou uma, mude a outra.
 * Nulo no cadastro = {@link #PADRAO}.
 */
public enum CorDoPerfil {
    AZUL, VERDE, ROXO, LARANJA, ROSA;

    public static final CorDoPerfil PADRAO = AZUL;

    /** Nulo ou fora da lista (maiúsculas exatas) = {@code null}; quem valida decide o erro. */
    public static CorDoPerfil ler(String texto) {
        for (CorDoPerfil c : values()) {
            if (c.name().equals(texto)) {
                return c;
            }
        }
        return null;
    }
}
