package br.com.treinos.api.comunidade.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
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
            @Size(max = 60) String categoria,
            Integer ordem,
            Boolean publicada,
            UUID capaId) {}

    /** {@code capaId}: a capa enviada pela equipe (bytes em {@code .../capas/{id}}); nulo = sem capa. */
    public record AulaResumo(
            UUID id,
            String titulo,
            String descricao,
            String videoUrl,
            UUID capaId,
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
     * {@code autorNome} já vem montado pelo servidor (V085): para outro ALUNO, o nome pela escolha do autor ({@code exibicaoDoNome}:
     * só o primeiro nome por padrão) e {@code autorApelido} nulo, porque o apelido já entrou no nome; para a EQUIPE, o nome completo.
     * {@code autorApelido} (só para a equipe) é o apelido atual do aluno autor (lido na hora, não é cópia); nulo se não houver ou se o autor é da equipe.
     * {@code autorEhAluno}: aluno ativo, não anonimizado, da consultoria (o perfil dele abre); equipe e conta encerrada, falso.
     * {@code daEquipe}: o autor comentou como equipe (gravado na hora; não muda se o autor deixar a equipe).
     */
    public record ComentarioResponse(
            UUID id,
            UUID autorId,
            String autorNome,
            String autorApelido,
            boolean autorEhAluno,
            String autorFotoUrl,
            String texto,
            Instant criadoEm,
            boolean daEquipe) {}

    /**
     * {@code tipo} ausente = {@code CONVERSA}. {@code videoUrl} só no tipo {@code VIDEO} (equipe); {@code fotoIds} só do aluno
     * (0 a 4, enviadas antes por {@code POST /aluno/comunidade/mural/fotos}); {@code capaId} só no {@code VIDEO} (enviada por
     * {@code POST /comunidade/capas}); {@code opcoes}, {@code variasRespostas} e {@code encerraEm} só na {@code ENQUETE}, que é
     * da equipe. Os limites e as regras por tipo e papel são do serviço (422 {@code POST_INVALIDO} no campo); aqui só um teto
     * para não ler corpo enorme.
     */
    public record CriarPostRequest(
            @Size(max = 20) String tipo,
            @NotBlank @Size(max = 2000) String texto,
            @Size(max = 500) String videoUrl,
            @Size(max = 20) List<UUID> fotoIds,
            UUID capaId,
            @Size(max = 20) List<@Size(max = 500) String> opcoes,
            Boolean variasRespostas,
            Instant encerraEm,
            UUID podId) {}

    /**
     * Pod (V082): grupo pequeno com mural próprio. {@code membros} é a contagem; {@code temMenor} só diz se algum membro nasceu
     * depois de 18 anos atrás (sem nome nem idade; quem não tem data de nascimento não conta). Nunca lista de membros.
     */
    public record PodResumo(UUID id, String nome, long membros, boolean temMenor, Instant criadoEm) {}

    /** Corpo do {@code POST}/{@code PUT /comunidade/pods}; 2 a 40 caracteres depois do strip (o serviço confere). */
    public record PodRequest(@NotNull @Size(max = 200) String nome) {}

    /** Corpo do {@code PUT /alunos/{id}/pod}: {@code podId} nulo tira o aluno do pod. */
    public record AtribuirPodRequest(UUID podId) {}

    /** O pod do próprio aluno, como a tela dele precisa: só id e nome, nunca os colegas. */
    public record PodDoAluno(UUID id, String nome) {}

    /** O pod do aluno na exportação: só o nome, nunca a lista de membros (dado de terceiros). */
    public record PodExportado(String nome) {}

    /** Id da foto pendente que acabou de ser enviada. */
    public record FotoCriada(UUID id) {}

    /** Id da capa pendente que acabou de ser enviada; vai em {@code capaId} do aulão ou do post de vídeo. */
    public record CapaCriada(UUID id) {}

    public record DenunciaRequest(@NotBlank @Size(max = 20) String motivo) {}

    /** As duas chaves do treinador (C9). */
    public record ConfiguracaoRequest(@NotNull Boolean alunosPublicam, @NotNull Boolean alunosAnexamFotos) {}

    public record ConfiguracaoResponse(boolean alunosPublicam, boolean alunosAnexamFotos) {}

    /**
     * O que o aluno precisa saber: se publica, se pode anexar foto (sem dizer o motivo, que pode ser a idade) e o pod dele
     * ({@code pod} nulo = sem pod; lido do banco a cada requisição).
     */
    public record ConfiguracaoDoAluno(boolean alunosPublicam, boolean podeAnexarFoto, PodDoAluno pod) {}

    /** Corpo do {@code PUT .../votos}: o conjunto de opções escolhidas (vazio retira o voto). */
    public record VotoRequest(List<UUID> opcaoIds) {}

    /**
     * A enquete no mural. {@code encerrada} já considera {@code encerraEm}; {@code meusVotos} são as opções que o próprio usuário
     * escolheu; {@code participantes} são os usuários distintos que votaram (não a soma dos votos das opções).
     */
    public record EnqueteResponse(
            boolean variasRespostas,
            boolean encerrada,
            Instant encerraEm,
            List<OpcaoDaEnquete> opcoes,
            List<UUID> meusVotos,
            long participantes) {}

    /** {@code votantesAmostra}: até 3 votantes, os mais recentes da opção (para as mini-fotos). */
    public record OpcaoDaEnquete(UUID id, String texto, long votos, List<VotanteDaAmostra> votantesAmostra) {}

    /**
     * {@code nome} já montado pelo servidor (para aluno, pela escolha do votante e com {@code apelido} sempre nulo; para a equipe,
     * nome completo e apelido). {@code temFoto} segue a mesma regra de {@code GET .../perfis/{autorId}/foto}; sem foto o app mostra as iniciais.
     */
    public record VotanteDaAmostra(UUID autorId, String nome, @JsonInclude(JsonInclude.Include.NON_NULL) String apelido, boolean temFoto) {}

    /** O painel "Mostrar votos": a pergunta, os participantes únicos, a contagem por opção e a página de votantes. */
    public record VotosDaEnquete(String pergunta, long participantes, List<OpcaoComVotos> opcoes, PaginaDeVotantes votantes) {}

    public record OpcaoComVotos(UUID opcaoId, String texto, long votos) {}

    /** Uma linha por voto (ordem {@code votadoEm desc, id}); {@code total} conta os votos do filtro, não os participantes. */
    public record PaginaDeVotantes(List<Votante> itens, long total) {}

    /**
     * Voto identificado: {@code nome} já montado pelo servidor (aluno visto por aluno: pela escolha do votante e {@code apelido}
     * sempre ausente; equipe vendo aluno: nome completo e o {@code apelido} atual à parte, que some se não há ou se o aluno é inativo); {@code votadoEm} é o horário em que ESTA opção foi escolhida (o do voto vigente).
     */
    public record Votante(
            UUID autorId,
            UUID opcaoId,
            String nome,
            @JsonInclude(JsonInclude.Include.NON_NULL) String apelido,
            boolean temFoto,
            Instant votadoEm,
            boolean ehVoce) {}

    /**
     * {@code autorEhAluno} como em {@link ComentarioResponse}: só aluno ativo abre o perfil. {@code fotos} são ids, na ordem
     * (os bytes vêm de {@code .../mural/fotos/{id}}). {@code capaId} (só no {@code VIDEO}; nulo sem capa) abre em
     * {@code .../comunidade/capas/{id}}. {@code enquete} só vem no tipo {@code ENQUETE} (nulo nos outros). {@code reacoes} conta
     * por código ({@code CURTIR}, {@code FORCA}, {@code FOGO}, {@code PALMAS}, {@code RISO}) e {@code minhasReacoes} lista os
     * códigos que o próprio usuário deu. {@code respondida} só vale em {@code DUVIDA}: existe comentário visível
     * da equipe. {@code denuncias} é a contagem e só sai na rota da equipe (o aluno nunca a vê: o campo some do JSON).
     */
    public record MuralPostResponse(
            UUID id,
            UUID autorId,
            String autorNome,
            String autorApelido,
            boolean autorEhAluno,
            String autorFotoUrl,
            String texto,
            String tipo,
            String videoUrl,
            UUID capaId,
            List<UUID> fotos,
            EnqueteResponse enquete,
            boolean respondida,
            boolean fixado,
            Instant criadoEm,
            UUID podId,
            String podNome,
            Map<String, Long> reacoes,
            List<String> minhasReacoes,
            long totalComentarios,
            @JsonInclude(JsonInclude.Include.NON_NULL) Long denuncias) {}

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
     * de colegas; o perfil de um colega só abre pelo mural, em {@code PerfilResponse}). Empate divide a posição. Os quatro últimos
     * são o XP do próprio aluno ({@code RegrasXp}): {@code xp} total, {@code nivel} (1 + xp / 100) e a barra até o próximo
     * ({@code xpNoNivel} de 0 a 99 e {@code faltam} de 1 a 100). O colega nunca vê o XP, só o nível.
     */
    public record RankingResponse(
            int posicao,
            int treinosConcluidos,
            int pontuacao,
            long participantes,
            int nivel,
            long xp,
            int xpNoNivel,
            int faltam) {}

    /**
     * Perfil de um colega (só aluno ativo da mesma consultoria). Reservado ({@code reservado = true}) e visto por outro aluno, só
     * saem {@code autorId}, {@code nome}, {@code apelido}, {@code ehVoce} e {@code reservado}: o resto fica nulo e sai do JSON
     * (nível, conquistas, destaques, cor, moldura, foto, atividade e recordes; decisão 3). {@code nome} já vem montado pela escolha do
     * aluno ({@code exibicaoDoNome}, V085) e {@code apelido} é sempre nulo (entrou no nome). Visível, ou o próprio aluno, traz tudo.
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

    /**
     * Item da lista de colegas visíveis (decisão 12). {@code autorId} é o id de usuário que o mural expõe; {@code nome} já montado
     * pela escolha do colega ({@code exibicaoDoNome}) e {@code apelido} sempre nulo.
     */
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
            List<ConquistaResponse> opcoesDeDestaque,
            String exibicaoDoNome) {}

    /**
     * Substitui as quatro preferências de uma vez: {@code perfilReservado} é obrigatório e vem como {@code true}, {@code false}
     * ou {@code null} explícito (volta à regra da idade); campo ausente = 422, para um corpo incompleto não devolver sem querer
     * um perfil reservado à regra da idade (que pode mostrá-lo). Por isso é um {@code JsonNode}: ausente chega como Java nulo e o
     * {@code null} do JSON como {@code NullNode}. {@code destaques} nulo ou vazio limpa, {@code cor}, {@code moldura} e {@code exibicaoDoNome}
     * nulos voltam ao padrão ({@code NOME}); {@code exibicaoDoNome} fora de {@code NOME}, {@code NOME_COMPLETO}, {@code APELIDO} e
     * {@code NOME_E_APELIDO} = 422 {@code PERFIL_INVALIDO}. Nunca traz data de nascimento.
     */
    public record PerfilPreferenciasRequest(
            JsonNode perfilReservado,
            @Size(max = 10) List<@Size(max = 40) String> destaques,
            @Size(max = 20) String cor,
            @Size(max = 20) String moldura,
            String exibicaoDoNome) {}

    /** Preferências do perfil na exportação LGPD (sem a data de nascimento, que sai no cadastro); {@code exibicaoDoNome} nulo = não escolheu. */
    public record PerfilExportado(Boolean perfilReservado, List<String> destaques, String cor, String moldura, String exibicaoDoNome) {}

    /** Tudo o que o aluno escreveu ou marcou na comunidade (exportação LGPD). Inclui o que a moderação ocultou. */
    public record ComunidadeExportada(
            String apelido,
            PerfilExportado perfil,
            PodExportado pod,
            List<PostExportado> posts,
            List<ComentarioExportado> comentariosDeAulas,
            List<ComentarioExportado> comentariosDoMural,
            List<ReacaoExportada> reacoes,
            List<VotoExportado> votos,
            List<FotoExportada> fotos,
            List<DenunciaExportada> denuncias,
            List<ConquistaResponse> conquistas,
            boolean truncado) {}

    /** {@code podId} nulo = mural geral. */
    public record PostExportado(UUID id, String tipo, String texto, String videoUrl, boolean fixado, boolean oculto, Instant criadoEm,
                                UUID podId) {}

    /** Foto enviada pelo aluno, só metadados (a imagem não sai); {@code postId} nulo = ainda pendente. */
    public record FotoExportada(UUID id, UUID postId, int tamanho, Instant criadoEm) {}

    /** Denúncia que o próprio aluno fez. */
    public record DenunciaExportada(UUID postId, String motivo, Instant criadoEm) {}

    /** {@code alvoId} é a aula ou o post comentado. */
    public record ComentarioExportado(UUID id, UUID alvoId, String texto, boolean oculto, Instant criadoEm) {}

    public record ReacaoExportada(UUID postId, String codigo, Instant criadoEm) {}

    /** Voto do próprio aluno numa enquete: a opção escolhida e o horário em que a escolheu. */
    public record VotoExportado(UUID postId, UUID opcaoId, String opcaoTexto, Instant votadoEm) {}
}
