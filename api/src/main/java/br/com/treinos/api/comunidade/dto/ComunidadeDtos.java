package br.com.treinos.api.comunidade.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import tools.jackson.databind.JsonNode;

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

    /** Limite do comentário (aula e mural), em unidades UTF-16 ({@code String.length()}: o emoji vale 2) depois do strip. */
    public static final int LIMITE_DO_COMENTARIO = 280;

    public record ComentarioRequest(@NotBlank @Size(max = LIMITE_DO_COMENTARIO) String texto) {
        /** O strip vem antes da validação: o limite vale para o texto que fica gravado. A coluna segue em 2000 (comentário antigo não é cortado). */
        public ComentarioRequest {
            texto = texto == null ? null : texto.strip();
        }
    }

    /** Uma página de comentários (mesmo formato de /atualizacoes/pagina); total conta só os visíveis. */
    public record PaginaDeComentarios(List<ComentarioResponse> itens, long total) {}

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

    /** Conquista no perfil: a do próprio aluno ({@link ConquistaResponse}) ou a que um colega vê ({@link ConquistaDoColega}). */
    public sealed interface ConquistaDoPerfil permits ConquistaResponse, ConquistaDoColega {}

    public record ConquistaResponse(
            UUID id,
            String tipo,
            String titulo,
            String descricao,
            String icone,
            Instant conquistadaEm) implements ConquistaDoPerfil {}

    /** A conquista vista por outro aluno: sem id e sem horário (o instante exato mostraria quando o colega abriu o app). */
    public record ConquistaDoColega(String tipo, String titulo, String descricao, String icone) implements ConquistaDoPerfil {}

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
     * Perfil de um colega (só aluno ativo da mesma consultoria). Reservado ({@code reservado = true}) e visto por outro aluno, só
     * saem {@code autorId}, {@code nome}, {@code apelido}, {@code ehVoce} e {@code reservado}: o resto fica nulo e sai do JSON
     * (nível, conquistas, destaques, cor, moldura, foto, atividade e recordes; decisão 3); {@code apelido} sai sempre, nulo sem apelido. Visível, ou o próprio aluno, traz tudo.
     * Nunca contato, data de nascimento, medidas, dieta ou dado de saúde.
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record PerfilResponse(
            UUID autorId,
            String nome,
            @JsonInclude(JsonInclude.Include.ALWAYS) String apelido,
            boolean ehVoce,
            boolean reservado,
            Integer treinosConcluidos,
            Integer nivel,
            List<ConquistaDoPerfil> conquistas,
            List<DestaqueDoPerfil> destaques,
            String cor,
            String moldura,
            Boolean temFoto,
            AtividadeRecente atividade,
            List<RecordeDoColega> recordes) {

        /** A resposta de quem não pode ver mais que o nome e o apelido. */
        public static PerfilResponse soONome(UUID autorId, String nome, String apelido) {
            return new PerfilResponse(autorId, nome, apelido, false, true, null, null, null, null, null, null, null, null, null);
        }
    }

    /** Insígnia fixada no topo do perfil: o tipo e o título e o ícone do {@code TipoConquista}. */
    public record DestaqueDoPerfil(String tipo, String titulo, String icone) {}

    /** Última conquista: só tipo, título, ícone e o dia (Brasília), nunca a hora. */
    public record ConquistaRecente(String tipo, String titulo, String icone, java.time.LocalDate data) {}

    /** Atividade recente (decisão 8): só datas. Nada de nome do treino, exercício, carga, duração, horário ou plano. */
    public record AtividadeRecente(List<java.time.LocalDate> diasTreinadosUltimos30, List<ConquistaRecente> ultimasConquistas) {}

    /** Maior carga levantada num exercício (kg, como o {@code RecordesService} calcula): sem data, série nem treino. */
    public record RecordeDoColega(String exercicio, java.math.BigDecimal carga) {}

    /** Item da lista de colegas visíveis (decisão 12). {@code autorId} é o id de usuário que o mural expõe. */
    public record ColegaDaLista(UUID autorId, String nome, String apelido, int nivel, boolean temFoto) {}

    public record PaginaDeColegas(List<ColegaDaLista> itens, long total) {}

    /**
     * Preferências do próprio perfil ({@code GET}/{@code PUT /aluno/comunidade/perfil}). {@code perfilReservado} é a escolha
     * explícita (nulo = não escolheu); {@code reservadoEfetivo} já aplica a regra da idade; {@code destaques} são nomes de
     * {@code TipoConquista} na ordem escolhida (até 4); {@code cor} e {@code moldura} saem sempre preenchidas (o padrão quando
     * o aluno não escolheu); {@code opcoesDeDestaque} são as conquistas que o aluno já ganhou.
     */
    public record PerfilPreferenciasResponse(
            Boolean perfilReservado,
            boolean reservadoEfetivo,
            List<String> destaques,
            String cor,
            String moldura,
            List<ConquistaResponse> opcoesDeDestaque) {}

    /**
     * Substitui as quatro preferências de uma vez: {@code perfilReservado} é obrigatório e vem como {@code true}, {@code false}
     * ou {@code null} explícito (volta à regra da idade); campo ausente = 422, para um corpo incompleto não devolver sem querer
     * um perfil reservado à regra da idade (que pode mostrá-lo). Por isso é um {@code JsonNode}: ausente chega como Java nulo e o
     * {@code null} do JSON como {@code NullNode}. {@code destaques} nulo ou vazio limpa, {@code cor} e {@code moldura} nulos
     * voltam ao padrão. Nunca traz data de nascimento.
     */
    public record PerfilPreferenciasRequest(
            JsonNode perfilReservado,
            @Size(max = 10) List<@Size(max = 40) String> destaques,
            @Size(max = 20) String cor,
            @Size(max = 20) String moldura) {}

    /** Preferências do perfil na exportação LGPD (sem a data de nascimento, que sai no cadastro). */
    public record PerfilExportado(Boolean perfilReservado, List<String> destaques, String cor, String moldura) {}

    /** Tudo o que o aluno escreveu ou marcou na comunidade (exportação LGPD). Inclui o que a moderação ocultou. */
    public record ComunidadeExportada(
            String apelido,
            PerfilExportado perfil,
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
