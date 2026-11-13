package br.com.treinos.api.comunidade;

import br.com.plataforma.comum.web.ApiError;
import br.com.treinos.api.auth.LimiteTentativas;
import br.com.treinos.api.fotos.FotoException;
import br.com.treinos.api.fotos.JpegSemMetadados;
import br.com.treinos.api.tenant.TenantContext;
import br.com.treinos.api.web.NaoEncontradoException;
import br.com.treinos.api.web.ValidacaoException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/**
 * Capa do vídeo (D7), do aulão e do post {@code VIDEO}: enviada pela equipe, só JPEG conferido e regravado sem metadados (1600 px,
 * 300 KB depois da limpeza), guardada no banco e servida só pela API com {@code no-store}; nunca imagem remota. Pendente até o
 * dono (aulão ou post); a anterior é apagada ao trocar, ao ocultar o post e (por cascata) ao excluir o aulão. Conteúdo da equipe:
 * não entra na exportação nem na anonimização do aluno. Teto de {@value #POR_DIA} envios por consultoria em 24 h, num contador
 * atômico no banco (não conta linhas vivas: apagar não devolve cota e envios simultâneos não passam do teto). A pendente com mais de 24 h sai no próximo envio da consultoria
 * (shortcut: sem agendador, como a foto do mural; trocar por job se alguma consultoria ficar parada com pendentes).
 */
@Service
public class CapasDaComunidadeService {

    static final int BYTES_MAXIMO = 300_000;
    static final int LADO_MAXIMO = 1600;
    /**
     * Envios por consultoria em janela fixa de 24 h (o mesmo teto das imagens do questionário), no contador atômico
     * {@code LimiteTentativas.capaDaComunidadeCabe}: apagar a capa (troca, remoção, post oculto) não devolve cota.
     */
    static final int POR_DIA = 100;
    /** Idade a partir da qual a capa ainda pendente (sem aulão nem post) sai no próximo envio; não é a janela da cota. */
    static final Duration JANELA = Duration.ofHours(24);
    static final ApiError.FieldError CAPA_INDISPONIVEL = new ApiError.FieldError("capaId", "A capa não está disponível. Envie de novo.");

    private final ComunidadeCapaRepository capas;
    private final ComunidadeAulaRepository aulas;
    private final ComunidadeMuralPostRepository posts;
    private final LimiteTentativas limite;

    public CapasDaComunidadeService(ComunidadeCapaRepository capas, ComunidadeAulaRepository aulas, ComunidadeMuralPostRepository posts,
                                    LimiteTentativas limite) {
        this.capas = capas;
        this.aulas = aulas;
        this.posts = posts;
        this.limite = limite;
    }

    /**
     * 422 {@code FOTO_INVALIDA}/{@code FOTO_GRANDE_DEMAIS} do arquivo e {@code IMAGENS_LIMITE_DIARIO} do teto. A cota é gasta
     * depois de o arquivo passar na limpeza (arquivo inválido não gasta) e dentro da transação, no contador atômico da
     * consultoria da sessão (nunca do cliente).
     */
    @Transactional
    public UUID enviar(byte[] recebido) {
        byte[] jpeg = limpar(recebido);
        Instant agora = Instant.now();
        capas.apagarPendentesAntigas(agora.minus(JANELA));
        if (!limite.capaDaComunidadeCabe(Objects.requireNonNull(TenantContext.get()), POR_DIA)) {
            throw new ValidacaoException("Limite de " + POR_DIA + " capas por dia atingido. Tente de novo amanhã.",
                    "IMAGENS_LIMITE_DIARIO", List.of());
        }
        return capas.saveAndFlush(new ComunidadeCapa(jpeg, agora)).getId();
    }

    /** A equipe vê qualquer capa da consultoria, inclusive a pendente (para a prévia ao montar o post). */
    @Transactional(readOnly = true)
    public byte[] lerDaEquipe(UUID id) {
        return capas.findById(id).map(ComunidadeCapa::getBytes).orElseThrow(() -> new NaoEncontradoException("Capa não encontrada."));
    }

    /** O aluno só vê capa ligada a aulão publicado ou a post visível; a pendente e a do post oculto dão 404. */
    @Transactional(readOnly = true)
    public byte[] lerDoAluno(UUID id) {
        ComunidadeCapa capa = capas.findById(id).orElseThrow(() -> new NaoEncontradoException("Capa não encontrada."));
        boolean visivel = capa.getAulaId() != null
                ? aulas.findById(capa.getAulaId()).filter(ComunidadeAula::isPublicada).isPresent()
                : capa.getPostId() != null && posts.findById(capa.getPostId()).filter(p -> !p.isOculto()).isPresent();
        if (!visivel) {
            throw new NaoEncontradoException("Capa não encontrada.");
        }
        return capa.getBytes();
    }

    /**
     * Define a capa do aulão: {@code capaId} nulo remove; a mesma que já está ligada não muda; outra (pendente) troca e a anterior
     * sai antes (a UNIQUE é por aulão). Capa inexistente, de outra consultoria ou que já tem dono = 422 no campo {@code capaId}.
     */
    @Transactional
    public void definirDaAula(UUID aulaId, UUID capaId) {
        if (capaId == null) {
            capas.apagarDaAula(aulaId);
            return;
        }
        if (capas.existsByIdAndAulaId(capaId, aulaId)) {
            return;
        }
        capas.apagarDaAula(aulaId);
        if (capas.ligarAAula(capaId, aulaId) != 1) {
            throw new ValidacaoException("Dados inválidos.", "COMUNIDADE_INVALIDA", List.of(CAPA_INDISPONIVEL));
        }
    }

    /** Liga a capa pendente ao post {@code VIDEO} recém-criado; {@code false} = não está disponível (quem chama responde 422). */
    @Transactional
    public boolean ligarAoPost(UUID capaId, UUID postId) {
        return capas.ligarAoPost(capaId, postId) == 1;
    }

    /** Post oculto não guarda capa. */
    @Transactional
    public void apagarDoPost(UUID postId) {
        capas.apagarDoPost(postId);
    }

    /** Id da capa de cada aulão da lista (só os que têm), numa consulta. */
    @Transactional(readOnly = true)
    public Map<UUID, UUID> idsDasAulas(Collection<UUID> aulaIds) {
        Map<UUID, UUID> mapa = new HashMap<>();
        if (!aulaIds.isEmpty()) {
            capas.idsDasAulas(aulaIds).forEach(c -> mapa.put(c.getAulaId(), c.getId()));
        }
        return mapa;
    }

    @Transactional(readOnly = true)
    public Map<UUID, UUID> idsDosPosts(Collection<UUID> postIds) {
        Map<UUID, UUID> mapa = new HashMap<>();
        if (!postIds.isEmpty()) {
            capas.idsDosPosts(postIds).forEach(c -> mapa.put(c.getPostId(), c.getId()));
        }
        return mapa;
    }

    private static byte[] limpar(byte[] recebido) {
        if (recebido == null || recebido.length == 0) {
            throw FotoException.invalida();
        }
        if (recebido.length > 4 * BYTES_MAXIMO) {
            throw FotoException.grandeDemais();
        }
        byte[] limpo;
        try {
            limpo = JpegSemMetadados.limpar(recebido, LADO_MAXIMO);
        } catch (IllegalArgumentException e) {
            throw FotoException.invalida();
        }
        if (limpo.length > BYTES_MAXIMO) {
            throw FotoException.grandeDemais();
        }
        return limpo;
    }
}
