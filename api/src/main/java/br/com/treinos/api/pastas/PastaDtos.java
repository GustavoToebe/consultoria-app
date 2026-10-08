package br.com.treinos.api.pastas;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.UUID;

/** Contratos HTTP das pastas de plano. */
public final class PastaDtos {

    private PastaDtos() { }

    public record PastaRequest(@NotBlank @Size(max = 120) String titulo, LocalDate inicio, LocalDate fim) {
    }

    public record PastaResumo(UUID id, UUID alunoId, String titulo, LocalDate inicio, LocalDate fim) {
        public static PastaResumo de(PastaPlano p) {
            return new PastaResumo(p.getId(), p.getAlunoId(), p.getTitulo(), p.getInicio(), p.getFim());
        }
    }
}
