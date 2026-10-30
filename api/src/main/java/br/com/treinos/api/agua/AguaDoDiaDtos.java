package br.com.treinos.api.agua;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Água do dia. A resposta do lote reaproveita {@code ExecucaoDtos.LoteResponse} (mesma fila do app). */
public final class AguaDoDiaDtos {

    private AguaDoDiaDtos() {
    }

    /**
     * A água de um dia como está no aparelho. Sem Bean Validation por campo de propósito: registro ruim vira
     * {@code RECUSADO} com motivo, sem derrubar o lote inteiro.
     */
    public record RegistroAgua(UUID id, LocalDate data, Integer aguaMl, Instant alteradoNoAparelhoEm) {
    }

    public record LoteAguaRequest(@NotNull @Size(max = 300) List<@NotNull RegistroAgua> registros) {
    }

    /** O que o aluno e a equipe leem: o dia e os mililitros, sem id. */
    public record AguaRegistrada(LocalDate data, int aguaMl) {
    }
}
