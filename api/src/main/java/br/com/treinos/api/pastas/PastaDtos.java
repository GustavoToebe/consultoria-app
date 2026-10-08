package br.com.treinos.api.pastas;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/** Contratos HTTP das pastas de plano. */
public final class PastaDtos {

    private PastaDtos() { }

    public record PastaRequest(@NotBlank @Size(max = 120) String titulo, LocalDate inicio, LocalDate fim) {
    }

    public record PastaResumo(UUID id, UUID alunoId, String titulo, LocalDate inicio, LocalDate fim,
                              Instant concluidaEm) {
        public static PastaResumo de(PastaPlano p) {
            return new PastaResumo(p.getId(), p.getAlunoId(), p.getTitulo(), p.getInicio(), p.getFim(),
                    p.getConcluidaEm());
        }
    }

    /**
     * Finalizar a pasta. Peso e observação são opcionais e vão para o registro de peso do aluno; a observação só vale
     * junto com o peso. {@code data} vazia = hoje.
     */
    public record FinalizarRequest(
            LocalDate data,
            @DecimalMin(value = "0", inclusive = false) @DecimalMax(value = "500", inclusive = false)
            @Digits(integer = 3, fraction = 2) BigDecimal pesoKg,
            @Size(max = 300) String observacao) {
    }
}
