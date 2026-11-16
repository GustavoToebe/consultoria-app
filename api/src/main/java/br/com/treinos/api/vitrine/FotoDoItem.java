package br.com.treinos.api.vitrine;

import java.time.Instant;
import java.util.UUID;

/** Que item tem foto e desde quando, sem carregar os bytes (a lista da vitrine). */
record FotoDoItem(UUID itemId, Instant atualizadaEm) {
}
