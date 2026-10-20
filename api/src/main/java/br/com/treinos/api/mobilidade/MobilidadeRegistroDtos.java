package br.com.treinos.api.mobilidade;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Registro "feito" da mobilidade. A resposta do lote reaproveita {@code ExecucaoDtos.LoteResponse} (mesma fila do app). */
public final class MobilidadeRegistroDtos {

    private MobilidadeRegistroDtos() {
    }

    /**
     * Um item marcado (ou desmarcado) no aparelho. Sem Bean Validation por campo de propósito: registro ruim vira
     * {@code RECUSADO} com motivo, sem derrubar o lote inteiro.
     */
    public record RegistroMobilidade(UUID id, UUID planoVersaoId, UUID secaoUid, UUID itemUid, LocalDate data,
                                     Boolean feito, Instant alteradoNoAparelhoEm) {
    }

    public record LoteMobilidadeRequest(@NotNull @Size(max = 300) List<@NotNull RegistroMobilidade> registros) {
    }

    /** O que o aluno e o treinador leem: só o que foi aceito, sem id nem situação. */
    public record RegistroMobilidadeFeito(UUID planoVersaoId, UUID secaoUid, UUID itemUid, LocalDate data, boolean feito) {
    }
}
