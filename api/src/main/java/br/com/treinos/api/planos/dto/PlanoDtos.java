package br.com.treinos.api.planos.dto;

import br.com.treinos.api.planos.PlanoBase;
import br.com.treinos.api.planos.VersaoBase;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Contratos HTTP comuns aos planos de treino e de dieta (seção 9.3). {@code C} é o conteúdo de cada tipo. */
public final class PlanoDtos {

    private PlanoDtos() { }

    /** Rascunho vazio, de uma receita ({@code receitaId}) ou cópia de outro plano ({@code copiarDoPlanoId}). */
    public record CriarPlanoRequest(
            @NotBlank @Size(max = 120) String titulo,
            LocalDate inicio,
            LocalDate fim,
            UUID receitaId,
            UUID copiarDoPlanoId) {
    }

    /** {@code versao} é o lock otimista: outra aba que salvou antes faz este voltar 409 {@code CONFLITO_EDICAO}. */
    public record SalvarRascunhoRequest<C>(
            @NotBlank @Size(max = 120) String titulo,
            LocalDate inicio,
            LocalDate fim,
            @NotNull @Valid C conteudo,
            @NotNull Long versao) {
    }

    public record PublicarRequest(@NotNull Long versao, boolean confirmarAvisos) {
    }

    public record ReplicarRequest(@NotBlank @Size(max = 120) String titulo, LocalDate inicio, LocalDate fim) {
    }

    public record SalvarComoReceitaRequest(@NotBlank @Size(max = 120) String nome, @Size(max = 400) String descricao) {
    }

    public record PlanoResumo(UUID id, UUID alunoId, String titulo, LocalDate inicio, LocalDate fim, boolean ativo,
                              int versaoPublicada, Instant publicadoEm, boolean rascunhoAlteradoDepoisDePublicar,
                              Long versao) {
        public static PlanoResumo de(PlanoBase p) {
            return new PlanoResumo(p.getId(), p.getAlunoId(), p.getTitulo(), p.getInicio(), p.getFim(), p.isAtivo(),
                    p.getVersaoPublicada(), p.getPublicadoEm(), p.rascunhoAlteradoDepoisDePublicar(), p.getVersao());
        }
    }

    public record VersaoResumo(UUID id, int numero, Instant publicadoEm) {
        public static VersaoResumo de(VersaoBase v) {
            return new VersaoResumo(v.getId(), v.getNumero(), v.getPublicadoEm());
        }
    }

    public record PlanoDetalhe<C>(PlanoResumo plano, C rascunho, List<VersaoResumo> versoes) {
    }

    public record VersaoDetalhe<C>(UUID id, UUID planoId, int numero, String titulo, LocalDate inicio, LocalDate fim,
                                   Instant publicadoEm, C conteudo) {
    }
}
