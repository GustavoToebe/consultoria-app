package br.com.treinos.api.lesoes;

import br.com.treinos.api.lesoes.LesaoAluno.Situacao;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.UUID;

/** Contratos HTTP do histórico de lesões. */
public final class LesaoDtos {

    private LesaoDtos() { }

    public record LesaoRequest(
            @NotBlank @Size(max = 80) String regiao,
            @Size(max = 500) String descricao,
            LocalDate dataInicio,
            LocalDate dataFim,
            @NotNull Situacao situacao,
            @Size(max = 500) String observacao) {
    }

    public record LesaoResponse(UUID id, String regiao, String descricao, LocalDate dataInicio, LocalDate dataFim,
                                Situacao situacao, String observacao) {
        public static LesaoResponse de(LesaoAluno l) {
            return new LesaoResponse(l.getId(), l.getRegiao(), l.getDescricao(), l.getDataInicio(), l.getDataFim(),
                    l.getSituacao(), l.getObservacao());
        }
    }
}
