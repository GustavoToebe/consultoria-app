package br.com.treinos.api.comunidade.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class ComunidadeDtos {
    private ComunidadeDtos() {}

    public record CriarAulaRequest(
            @NotBlank @Size(max = 120) String titulo,
            String descricao,
            @NotBlank @Size(max = 500) String videoUrl,
            @Size(max = 500) String miniaturaUrl,
            @Size(max = 60) String categoria,
            Integer ordem,
            Boolean publicada) {}

    public record AulaResumo(
            UUID id,
            String titulo,
            String descricao,
            String videoUrl,
            String miniaturaUrl,
            String categoria,
            int ordem,
            boolean publicada,
            Instant criadaEm,
            long totalComentarios) {}

    public record ComentarioRequest(@NotBlank @Size(max = 2000) String texto) {}

    public record ComentarioResponse(
            UUID id,
            UUID autorId,
            String autorNome,
            String autorFotoUrl,
            String texto,
            Instant criadoEm) {}

    public record CriarPostRequest(
            @NotBlank @Size(max = 2000) String texto,
            @Size(max = 500) String imagemUrl) {}

    public record ReacaoRequest(@NotBlank @Size(max = 16) String emoji) {}

    public record MuralPostResponse(
            UUID id,
            UUID autorId,
            String autorNome,
            String autorFotoUrl,
            String texto,
            String imagemUrl,
            boolean fixado,
            Instant criadoEm,
            Map<String, Long> reacoes,
            List<String> minhasReacoes,
            long totalComentarios) {}

    public record ConquistaResponse(
            UUID id,
            String tipo,
            String titulo,
            String descricao,
            String icone,
            Instant conquistadaEm) {}

    public record ItemRanking(
            UUID alunoId,
            String alunoNome,
            String fotoUrl,
            int pontuacao,
            int treinosConcluidos,
            int recordesBatidos,
            int posicao) {}

    public record ItemRankingForca(
            UUID alunoId,
            String alunoNome,
            String fotoUrl,
            String exercicio,
            double cargaKg,
            int posicao) {}

    public record RankingResponse(
            List<ItemRanking> constancia,
            List<ItemRankingForca> forca,
            boolean participaRankingForca) {}

    public record OptInRankingRequest(boolean participa) {}
}
