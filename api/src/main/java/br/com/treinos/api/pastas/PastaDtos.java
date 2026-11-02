package br.com.treinos.api.pastas;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Contratos HTTP das pastas de plano. */
public final class PastaDtos {

    private PastaDtos() { }

    public record PastaRequest(@NotBlank @Size(max = 120) String titulo, LocalDate inicio, LocalDate fim) {
    }

    public record PastaResumo(UUID id, UUID alunoId, String titulo, LocalDate inicio, LocalDate fim,
                              Instant concluidaEm, UUID questionarioId) {
        public static PastaResumo de(PastaPlano p) {
            return new PastaResumo(p.getId(), p.getAlunoId(), p.getTitulo(), p.getInicio(), p.getFim(),
                    p.getConcluidaEm(), p.getQuestionarioId());
        }
    }

    /** Pasta vigente do aluno; {@code pasta} nulo = nenhuma. */
    public record PastaVigenteResposta(PastaResumo pasta) {
    }

    /**
     * Publicar tudo. {@code confirmarAvisos} tem o mesmo sentido da publicação de um plano só. {@code versoes} é
     * {@code {planoId: versao}} (a {@code versao} do lock otimista de cada plano) dos planos da pasta que a tela viu:
     * obrigatório, pode ser vazio. Plano pendente cuja versão atual difira da enviada, ou que não esteja no mapa, dá 409
     * {@code CONFLITO_EDICAO} e nada é publicado. Ids a mais no mapa são ignorados.
     */
    public record PublicarPastaRequest(boolean confirmarAvisos, @NotNull Map<UUID, @NotNull Long> versoes) {
    }

    /** {@code tipo}: {@code treino}, {@code dieta} ou {@code mobilidade}. */
    public record PlanoPublicadoNaPasta(String tipo, UUID planoId, int versao) {
    }

    /**
     * Plano que ficou como estava: já publicado e sem alteração no rascunho depois disso. Só aparecem os tipos que a
     * pessoa pode ler ({@code TREINO_LER} para treino e mobilidade, {@code DIETA_LER} para dieta).
     */
    public record PlanoPuladoNaPasta(String tipo, UUID planoId) {
    }

    public record PublicarPastaResposta(List<PlanoPublicadoNaPasta> publicados, List<PlanoPuladoNaPasta> pulados) {
    }

    /** Copia a pasta para outro aluno: o destino recebe uma pasta nova com este título e período. */
    public record CopiarPastaRequest(@NotNull UUID alunoId, @NotBlank @Size(max = 120) String titulo,
                                     LocalDate inicio, LocalDate fim) {
    }

    public record PlanoCopiadoDaPasta(String tipo, UUID planoId) {
    }

    /**
     * Tipo de plano da origem que a cópia não levou. {@code tipo} em minúsculas, como em {@link PlanoCopiadoDaPasta};
     * {@code motivo} é um código fixo ({@link PastaService#MOTIVO_FORA_DO_PLANO}). Sem dado de pessoa.
     */
    public record PlanoPuladoNaCopia(String tipo, String motivo) {
    }

    /** {@code pulados}: o que existia na origem e não foi copiado (mobilidade com a funcionalidade desligada no plano). */
    public record CopiarPastaResposta(UUID pastaId, List<PlanoCopiadoDaPasta> planos, List<PlanoPuladoNaCopia> pulados) {
    }

    /** Peso (e a data dele) que a atualização enviada da pasta gravou; ambos nulos quando não há. Nunca zero. */
    public record PesoSugeridoDaPasta(BigDecimal pesoKg, LocalDate data) {
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
