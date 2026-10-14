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

/** Contratos HTTP comuns aos planos de treino e de dieta. {@code C} é o conteúdo de cada tipo. */
public final class PlanoDtos {

    private PlanoDtos() { }

    /** Rascunho vazio, de uma receita ({@code receitaId}) ou cópia de outro plano ({@code copiarDoPlanoId}). */
    public record CriarPlanoRequest(
            @NotBlank @Size(max = 120) String titulo,
            LocalDate inicio,
            LocalDate fim,
            UUID receitaId,
            UUID copiarDoPlanoId,
            UUID pastaId) {
        public CriarPlanoRequest(String titulo, LocalDate inicio, LocalDate fim, UUID receitaId, UUID copiarDoPlanoId) {
            this(titulo, inicio, fim, receitaId, copiarDoPlanoId, null);
        }
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

    /** {@code pastaId}: replica para dentro dessa pasta (o período dela vale); sem ele, vale o período informado. */
    public record ReplicarRequest(@NotBlank @Size(max = 120) String titulo, LocalDate inicio, LocalDate fim,
                                  UUID pastaId) {
        public ReplicarRequest(String titulo, LocalDate inicio, LocalDate fim) {
            this(titulo, inicio, fim, null);
        }
    }

    /**
     * Copia um plano para outro aluno. {@code pastaId}: pasta do destino que recebe a cópia; sem ele nasce uma pasta nova
     * (com {@code titulo}, {@code inicio} e {@code fim}), o que exige a permissão de alterar pastas.
     */
    public record CopiarPlanoRequest(@NotNull UUID alunoId, UUID pastaId, @NotBlank @Size(max = 120) String titulo,
                                     LocalDate inicio, LocalDate fim) {
    }

    public record CopiaResposta(UUID pastaId, UUID planoId) {
    }

    public record SalvarComoReceitaRequest(@NotBlank @Size(max = 120) String nome, @Size(max = 400) String descricao) {
    }

    public record PlanoResumo(UUID id, UUID alunoId, UUID pastaId, String titulo, LocalDate inicio, LocalDate fim,
                              boolean ativo, int versaoPublicada, Instant publicadoEm,
                              boolean rascunhoAlteradoDepoisDePublicar, Long versao) {
        public static PlanoResumo de(PlanoBase p) {
            return new PlanoResumo(p.getId(), p.getAlunoId(), p.getPastaId(), p.getTitulo(), p.getInicio(), p.getFim(), p.isAtivo(),
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

    /** Plano com todas as versões publicadas, para a exportação de dados do aluno. */
    public record PlanoPublicado<C>(PlanoResumo plano, List<VersaoDetalhe<C>> versoes) {
    }

    public record VersaoDetalhe<C>(UUID id, UUID planoId, int numero, String titulo, LocalDate inicio, LocalDate fim,
                                   Instant publicadoEm, C conteudo) {
    }
}
