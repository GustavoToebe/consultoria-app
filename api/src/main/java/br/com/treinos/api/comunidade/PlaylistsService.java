package br.com.treinos.api.comunidade;

import br.com.plataforma.comum.web.ApiError;
import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.comunidade.dto.ComunidadeDtos.PlaylistResumo;
import br.com.treinos.api.web.NaoEncontradoException;
import br.com.treinos.api.web.ValidacaoException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Playlists de aulões da comunidade (V088; "Coleções" na tela). Escrita da equipe ({@code COMUNIDADE_MODERAR}); o aluno só lê as que
 * têm aulão publicado. A {@code ordem} do aulão vale dentro da playlist e o aulão novo ou movido vai para o fim. Reordenar, mover em
 * lote, apagar e acrescentar travam a linha da playlist ({@code PESSIMISTIC_WRITE}), então duas pessoas não se atropelam. O nome
 * (texto livre) nunca vai a log. Apagar a playlist deixa os aulões sem playlist (FK {@code ON DELETE SET NULL (playlist_id)}).
 * Playlist ou aulão de outra consultoria responde o mesmo 404 de quem não existe (nas rotas com id na URL e no lote).
 */
@Service
@Transactional
public class PlaylistsService {

    static final int NOME_MAXIMO = 60;
    static final String PLAYLIST_NAO_ENCONTRADA = "Coleção não encontrada.";
    static final String AULA_NAO_ENCONTRADA = "Aula não encontrada.";

    private final ComunidadePlaylistRepository playlists;
    private final ComunidadeAulaRepository aulas;

    public PlaylistsService(ComunidadePlaylistRepository playlists, ComunidadeAulaRepository aulas) {
        this.playlists = playlists;
        this.aulas = aulas;
    }

    /** Todas as playlists da consultoria, com o total de aulões (publicados ou não). */
    @Transactional(readOnly = true)
    public List<PlaylistResumo> listarDaEquipe() {
        return resumos(false);
    }

    /** Só as que têm aulão publicado, e o total conta só os publicados: o aluno nunca abre uma coleção vazia. */
    @Transactional(readOnly = true)
    public List<PlaylistResumo> listarDoAluno() {
        return resumos(true).stream().filter(p -> p.totalAulas() > 0).toList();
    }

    private List<PlaylistResumo> resumos(boolean soPublicadas) {
        Map<UUID, Long> totais = new HashMap<>();
        aulas.totaisPorPlaylist(soPublicadas).forEach(t -> totais.put(t.getPlaylistId(), t.getTotal()));
        return playlists.findAllByOrderByOrdemAscNomeAscIdAsc().stream()
                .map(p -> new PlaylistResumo(p.getId(), p.getNome(), p.getOrdem(), totais.getOrDefault(p.getId(), 0L)))
                .toList();
    }

    /** A nova vai para o fim da lista de playlists. */
    public PlaylistResumo criar(String nome) {
        ComunidadePlaylist p = new ComunidadePlaylist(nomeLimpo(nome), playlists.maiorOrdem() + 1);
        salvar(p);
        return resumo(p);
    }

    public PlaylistResumo alterar(UUID id, String nome) {
        ComunidadePlaylist p = playlists.findById(id).orElseThrow(() -> new NaoEncontradoException(PLAYLIST_NAO_ENCONTRADA));
        String limpo = nomeLimpo(nome);
        if (!limpo.equals(p.getNome())) {
            p.renomear(limpo);
            salvar(p);
        }
        return resumo(p);
    }

    /** Os aulões ficam sem playlist (nunca são apagados): quem faz isso é a FK do banco. */
    public void excluir(UUID id) {
        ComunidadePlaylist p = playlists.travar(id).orElseThrow(() -> new NaoEncontradoException(PLAYLIST_NAO_ENCONTRADA));
        playlists.delete(p);
        playlists.flush();
    }

    /**
     * Nova ordem das playlists. A lista tem de trazer todas, sem repetir (senão 409 {@code CONFLITO_EDICAO}: a tela estava velha);
     * id inexistente ou de outra consultoria = 404 uniforme. As linhas são travadas na ordem do id.
     */
    public void reordenar(List<UUID> ids) {
        Set<UUID> unicos = new LinkedHashSet<>(ids);
        List<ComunidadePlaylist> travadas = playlists.travarTodas(unicos);
        if (travadas.size() != unicos.size()) {
            throw new NaoEncontradoException(PLAYLIST_NAO_ENCONTRADA);
        }
        if (unicos.size() != ids.size() || playlists.count() != ids.size()) {
            throw listaDesatualizada();
        }
        Map<UUID, ComunidadePlaylist> porId = travadas.stream().collect(Collectors.toMap(ComunidadePlaylist::getId, Function.identity()));
        int posicao = 0;
        for (UUID id : ids) {
            porId.get(id).definirOrdem(posicao++);
        }
    }

    /**
     * Nova ordem dos aulões de uma playlist (travada). Mesma regra de {@link #reordenar}: tem de trazer todos os aulões da playlist;
     * aulão inexistente, de outra consultoria ou de outra playlist = 404 uniforme.
     */
    public void reordenarAulas(UUID playlistId, List<UUID> ids) {
        if (playlists.travar(playlistId).isEmpty()) {
            throw new NaoEncontradoException(PLAYLIST_NAO_ENCONTRADA);
        }
        Set<UUID> unicos = new LinkedHashSet<>(ids);
        List<ComunidadeAula> doLote = aulas.findAllById(unicos);
        if (doLote.size() != unicos.size() || doLote.stream().anyMatch(a -> !playlistId.equals(a.getPlaylistId()))) {
            throw new NaoEncontradoException(AULA_NAO_ENCONTRADA);
        }
        if (unicos.size() != ids.size() || aulas.countByPlaylistId(playlistId) != ids.size()) {
            throw listaDesatualizada();
        }
        Map<UUID, ComunidadeAula> porId = doLote.stream().collect(Collectors.toMap(ComunidadeAula::getId, Function.identity()));
        int posicao = 0;
        for (UUID id : ids) {
            porId.get(id).posicionar(playlistId, posicao++);
        }
    }

    /**
     * Põe os aulões na playlist, no fim e na ordem enviada ({@code playlistId} nulo tira da playlist). Aulão que já está nela não
     * muda de posição. Trava a playlist de destino e as de origem (na ordem do id); aulão ou playlist inexistente ou de outra
     * consultoria = 404 uniforme e nada é movido. Repetir o mesmo id no pedido conta uma vez.
     */
    public void moverEmLote(List<UUID> aulaIds, UUID playlistId) {
        Set<UUID> unicos = new LinkedHashSet<>(aulaIds);
        Set<UUID> aTravar = new HashSet<>(aulas.playlistsDosAuloes(unicos));
        if (playlistId != null) {
            aTravar.add(playlistId);
        }
        List<ComunidadePlaylist> travadas = aTravar.isEmpty() ? List.of() : playlists.travarTodas(aTravar);
        if (playlistId != null && travadas.stream().noneMatch(p -> p.getId().equals(playlistId))) {
            throw new NaoEncontradoException(PLAYLIST_NAO_ENCONTRADA);
        }
        // Lidos só depois da trava: o estado que vale é o de depois de quem estava na frente.
        Map<UUID, ComunidadeAula> porId = aulas.findAllById(unicos).stream()
                .collect(Collectors.toMap(ComunidadeAula::getId, Function.identity()));
        if (porId.size() != unicos.size()) {
            throw new NaoEncontradoException(AULA_NAO_ENCONTRADA);
        }
        int proxima = playlistId == null ? 0 : aulas.maiorOrdemDaPlaylist(playlistId) + 1;
        for (UUID id : unicos) {
            ComunidadeAula a = porId.get(id);
            if (!Objects.equals(a.getPlaylistId(), playlistId)) {
                a.posicionar(playlistId, playlistId == null ? 0 : proxima++);
            }
        }
    }

    /**
     * Posição de um aulão que entra no fim da playlist do CORPO do aulão ({@code null} = sem playlist, posição 0). Trava a playlist;
     * id que não é da consultoria é 422 no campo {@code playlistId} (no corpo, ao contrário das rotas com id na URL).
     */
    int posicaoNoFim(UUID playlistId) {
        if (playlistId == null) {
            return 0;
        }
        if (playlists.travar(playlistId).isEmpty()) {
            throw new ValidacaoException("Dados inválidos.", "COMUNIDADE_INVALIDA",
                    List.of(new ApiError.FieldError("playlistId", PLAYLIST_NAO_ENCONTRADA)));
        }
        return aulas.maiorOrdemDaPlaylist(playlistId) + 1;
    }

    /** O nome já limpo (strip, espaços repetidos e NFC), de 1 a 60 caracteres; fora disso 422 {@code PLAYLIST_INVALIDA} no campo. */
    static String nomeLimpo(String nome) {
        String limpo = nome == null ? "" : Normalizer.normalize(nome.strip().replaceAll("\\s+", " "), Normalizer.Form.NFC);
        // length() nunca é mais frouxo que o char_length do banco.
        if (limpo.isEmpty() || limpo.length() > NOME_MAXIMO) {
            throw new ValidacaoException("Confira a coleção.", "PLAYLIST_INVALIDA",
                    List.of(new ApiError.FieldError("nome", "Use de 1 a " + NOME_MAXIMO + " caracteres.")));
        }
        return limpo;
    }

    /** Só o índice único do nome (sem diferença de maiúsculas) pode falhar aqui: o tamanho já foi conferido. */
    private void salvar(ComunidadePlaylist p) {
        try {
            playlists.saveAndFlush(p);
        } catch (DataIntegrityViolationException e) {
            throw new ConflictException("Já existe uma coleção com esse nome.", "PLAYLIST_NOME_EM_USO");
        }
    }

    private static ConflictException listaDesatualizada() {
        return new ConflictException("A lista mudou. Recarregue e tente de novo.", "CONFLITO_EDICAO");
    }

    private PlaylistResumo resumo(ComunidadePlaylist p) {
        return new PlaylistResumo(p.getId(), p.getNome(), p.getOrdem(), aulas.countByPlaylistId(p.getId()));
    }
}
