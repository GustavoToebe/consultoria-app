package br.com.treinos.api.comunidade;

/**
 * Moldura da foto do perfil (lista curta e fechada; decisão 7 do plano {@code perfil-estilo-steam}). Cada uma é uma forma,
 * nunca só uma cor, e o app espelha esta lista. Nulo no cadastro = {@link #PADRAO}.
 */
public enum MolduraDoPerfil {
    SIMPLES, DUPLA, TRACEJADA, GROSSA;

    public static final MolduraDoPerfil PADRAO = SIMPLES;

    /** Nulo ou fora da lista (maiúsculas exatas) = {@code null}; quem valida decide o erro. */
    public static MolduraDoPerfil ler(String texto) {
        for (MolduraDoPerfil m : values()) {
            if (m.name().equals(texto)) {
                return m;
            }
        }
        return null;
    }
}
