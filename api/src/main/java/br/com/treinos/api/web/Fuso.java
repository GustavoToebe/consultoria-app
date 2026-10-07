package br.com.treinos.api.web;

import java.time.ZoneId;

/**
 * Fuso das datas de domínio (dia do treino, registro de peso): Brasília, como a Central. O Error Prone recusa
 * {@code now()} sem fuso (JavaTimeDefaultTimeZone), que pegaria o fuso do servidor.
 */
public final class Fuso {
    public static final String ID = "America/Sao_Paulo";
    public static final ZoneId BRASILIA = ZoneId.of(ID);

    private Fuso() { }
}
