package br.com.treinos.api.sessoesconcluidas;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * "Concluir treino". A resposta do lote reaproveita {@code ExecucaoDtos.LoteResponse} (mesma fila do app). O
 * {@code comentario} é texto livre do aluno (dado sensível): os records que o carregam sobrescrevem {@code toString}
 * para ele (e a duração) nunca irem parar numa mensagem de log ou de erro.
 */
public final class SessaoConcluidaDtos {

    private SessaoConcluidaDtos() {
    }

    /**
     * Uma sessão concluída (ou reaberta) no aparelho. Sem Bean Validation por campo de propósito: registro ruim vira
     * {@code RECUSADO} com motivo, sem derrubar o lote inteiro. {@code resultado} é texto ({@code COMPLETA} ou
     * {@code PARCIAL}) pela mesma razão: valor desconhecido recusa só este registro.
     */
    public record RegistroSessaoConcluida(UUID id, UUID planoVersaoId, UUID sessaoUid, LocalDate data, Boolean concluida,
                                          String resultado, Long duracaoSegundos, String comentario,
                                          Instant alteradoNoAparelhoEm) {
        @Override
        public String toString() {
            return "RegistroSessaoConcluida[id=" + id + "]";
        }
    }

    public record LoteSessoesConcluidasRequest(@NotNull @Size(max = 300) List<@NotNull RegistroSessaoConcluida> registros) {
        @Override
        public String toString() {
            return "LoteSessoesConcluidasRequest[registros=" + (registros == null ? 0 : registros.size()) + "]";
        }
    }

    /** O que o aluno, o treinador e a exportação leem: só o que foi aceito, sem id nem situação. */
    public record SessaoConcluidaLinha(UUID planoVersaoId, UUID sessaoUid, LocalDate data, boolean concluida,
                                       String resultado, Integer duracaoSegundos, String comentario) {
        @Override
        public String toString() {
            return "SessaoConcluidaLinha[planoVersaoId=" + planoVersaoId + ", sessaoUid=" + sessaoUid + ", data=" + data + "]";
        }
    }

    /**
     * Lista do período e o total de sessões concluídas em todo o histórico do aluno (não só no período). A mesma forma serve
     * ao aluno e ao treinador; para o treinador sem {@code ALUNO_SENSIVEL_LER} o {@code comentario} de cada linha vem nulo.
     */
    public record SessoesConcluidasResponse(long totalConcluidos, List<SessaoConcluidaLinha> sessoes) {
    }
}
