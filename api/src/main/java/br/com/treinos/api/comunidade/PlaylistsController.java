package br.com.treinos.api.comunidade;

import br.com.treinos.api.comunidade.dto.ComunidadeDtos.AulasEmLoteRequest;
import br.com.treinos.api.comunidade.dto.ComunidadeDtos.OrdemRequest;
import br.com.treinos.api.comunidade.dto.ComunidadeDtos.PlaylistRequest;
import br.com.treinos.api.comunidade.dto.ComunidadeDtos.PlaylistResumo;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * Playlists de aulões ("coleções" na tela; V088), só da equipe: leitura com {@code TREINO_LER}, escrita com
 * {@code COMUNIDADE_MODERAR}. O aluno lê em {@code GET /aluno/comunidade/playlists} ({@code AlunoComunidadeController}). As rotas
 * literais ({@code /playlists/ordem}, {@code /aulas/playlist}) têm prioridade sobre as de {@code {id}}: o teste de integração trava isso.
 */
@RestController
public class PlaylistsController {

    private final PlaylistsService playlists;

    public PlaylistsController(PlaylistsService playlists) {
        this.playlists = playlists;
    }

    @PreAuthorize("hasAuthority('PERM_TREINO_LER')")
    @GetMapping("/comunidade/playlists")
    public List<PlaylistResumo> listar() {
        return playlists.listarDaEquipe();
    }

    @PreAuthorize("hasAuthority('PERM_COMUNIDADE_MODERAR')")
    @PostMapping("/comunidade/playlists")
    public PlaylistResumo criar(@RequestBody @Valid PlaylistRequest request) {
        return playlists.criar(request.nome());
    }

    @PreAuthorize("hasAuthority('PERM_COMUNIDADE_MODERAR')")
    @PutMapping("/comunidade/playlists/{id}")
    public PlaylistResumo alterar(@PathVariable UUID id, @RequestBody @Valid PlaylistRequest request) {
        return playlists.alterar(id, request.nome());
    }

    /** Os aulões da playlist ficam sem playlist (nunca são apagados); 204. */
    @PreAuthorize("hasAuthority('PERM_COMUNIDADE_MODERAR')")
    @DeleteMapping("/comunidade/playlists/{id}")
    public ResponseEntity<Void> excluir(@PathVariable UUID id) {
        playlists.excluir(id);
        return ResponseEntity.noContent().build();
    }

    @PreAuthorize("hasAuthority('PERM_COMUNIDADE_MODERAR')")
    @PutMapping("/comunidade/playlists/ordem")
    public ResponseEntity<Void> reordenar(@RequestBody @Valid OrdemRequest request) {
        playlists.reordenar(request.ids());
        return ResponseEntity.noContent().build();
    }

    @PreAuthorize("hasAuthority('PERM_COMUNIDADE_MODERAR')")
    @PutMapping("/comunidade/playlists/{id}/aulas/ordem")
    public ResponseEntity<Void> reordenarAulas(@PathVariable UUID id, @RequestBody @Valid OrdemRequest request) {
        playlists.reordenarAulas(id, request.ids());
        return ResponseEntity.noContent().build();
    }

    /** Lote: {@code playlistId} nulo tira os aulões da playlist; 204. */
    @PreAuthorize("hasAuthority('PERM_COMUNIDADE_MODERAR')")
    @PutMapping("/comunidade/aulas/playlist")
    public ResponseEntity<Void> moverAulas(@RequestBody @Valid AulasEmLoteRequest request) {
        playlists.moverEmLote(request.aulaIds(), request.playlistId());
        return ResponseEntity.noContent().build();
    }
}
