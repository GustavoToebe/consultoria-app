package br.com.treinos.api.conta;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/** Cobrança da consultoria. {@code vencida} não é gravada: é "aberta com vencimento antes de hoje" (fuso de Brasília). */
public record CobrancaLocal(UUID id, LocalDate competenciaInicio, LocalDate competenciaFim, LocalDate vencimento,
                            BigDecimal valor, String situacao, LocalDate pagoEm) {

    public static final String ABERTA = "ABERTA";
    public static final String PAGA = "PAGA";
    public static final String CANCELADA = "CANCELADA";
    public static final String ISENTA = "ISENTA";

    public boolean vencida(LocalDate hoje) {
        return ABERTA.equals(situacao) && vencimento.isBefore(hoje);
    }
}
