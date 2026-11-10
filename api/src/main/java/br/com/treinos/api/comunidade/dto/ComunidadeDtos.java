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
            @Size(max = 4000) String descricao,
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

    public record ApelidoRequest(String apelido) {

        /** O apelido é dado do aluno: o {@code toString} não o mostra. */
        @Override
        public String toString() {
            return "ApelidoRequest[...]";
        }
    }

    /**
     * {@code autorApelido} é o apelido atual do aluno autor (lido na hora, não é cópia); nulo se não houver ou se o autor é da equipe.
     * {@code autorEhAluno}: aluno ativo, não anonimizado, da consultoria (o perfil dele abre); equipe e conta encerrada, falso.
     */
    public record ComentarioResponse(
            UUID id,
            UUID autorId,
            String autorNome,
            String autorApelido,
            boolean autorEhAluno,
            String autorFotoUrl,
            String texto,
            Instant criadoEm) {}

    public record CriarPostRequest(
            @NotBlank @Size(max = 2000) String texto,
            @Size(max = 500) String imagemUrl) {}

    public record ReacaoRequest(@NotBlank @Size(max = 16) String emoji) {}

    /** {@code autorEhAluno} como em {@link ComentarioResponse}: só aluno ativo abre o perfil. */
    public record MuralPostResponse(
            UUID id,
            UUID autorId,
            String autorNome,
            String autorApelido,
            boolean autorEhAluno,
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

    /**
     * O ranking de constância mostra ao aluno só a posição dele: nunca nome, id ou contagem de outro aluno (sem opt-in e sem lista
     * de colegas; o perfil de um colega só abre pelo mural, em {@code PerfilResponse}). Empate divide a posição.
     */
    public record RankingResponse(
            int posicao,
            int treinosConcluidos,
            int pontuacao,
            long participantes) {}

    /**
     * Perfil de um colega (só aluno ativo da mesma consultoria): nome, apelido, treinos concluídos e as conquistas já desbloqueadas.
     * Nunca foto, contato, medidas, dieta ou dado de saúde.
     */
    public record PerfilResponse(
            UUID autorId,
            String nome,
            String apelido,
            int treinosConcluidos,
            List<ConquistaResponse> conquistas,
            boolean ehVoce) {}

    /** Tudo o que o aluno escreveu ou marcou na comunidade (exportação LGPD). Inclui o que a moderação ocultou. */
    public record ComunidadeExportada(
            String apelido,
            List<PostExportado> posts,
            List<ComentarioExportado> comentariosDeAulas,
            List<ComentarioExportado> comentariosDoMural,
            List<ReacaoExportada> reacoes,
            List<ConquistaResponse> conquistas,
            boolean truncado) {}

    public record PostExportado(UUID id, String texto, String imagemUrl, boolean fixado, boolean oculto, Instant criadoEm) {}

    /** {@code alvoId} é a aula ou o post comentado. */
    public record ComentarioExportado(UUID id, UUID alvoId, String texto, boolean oculto, Instant criadoEm) {}

    public record ReacaoExportada(UUID postId, String emoji, Instant criadoEm) {}
}
