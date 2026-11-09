package br.com.treinos.api.comunidade;

import br.com.treinos.api.comunidade.dto.ComunidadeDtos.*;
import br.com.treinos.api.execucao.AlunoAppService;
import br.com.treinos.api.security.UsuarioAutenticado;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/aluno/comunidade")
public class AlunoComunidadeController {

    private final ComunidadeService comunidade;

    public AlunoComunidadeController(ComunidadeService comunidade) {
        this.comunidade = comunidade;
    }

    // ---- Aulões ----

    @PreAuthorize("hasRole('ALUNO')")
    @GetMapping("/aulas")
    public List<AulaResumo> listarAulas() {
        return comunidade.listarAulasAluno();
    }

    @PreAuthorize("hasRole('ALUNO')")
    @GetMapping("/aulas/{id}/comentarios")
    public List<ComentarioResponse> listarComentariosAula(@PathVariable UUID id) {
        return comunidade.listarComentariosAula(id);
    }

    @PreAuthorize("hasRole('ALUNO')")
    @PostMapping("/aulas/{id}/comentarios")
    public ComentarioResponse comentarAula(@PathVariable UUID id, @RequestBody @Valid ComentarioRequest request,
                                           @AuthenticationPrincipal UsuarioAutenticado eu) {
        return comunidade.adicionarComentarioAula(id, request.texto(), eu);
    }

    // ---- Mural ----

    @PreAuthorize("hasRole('ALUNO')")
    @GetMapping("/mural")
    public Page<MuralPostResponse> listarMural(@RequestParam(defaultValue = "0") int pagina,
                                               @RequestParam(defaultValue = "20") int tamanho,
                                               @AuthenticationPrincipal UsuarioAutenticado eu) {
        return comunidade.listarMural(PageRequest.of(Math.max(0, pagina), Math.clamp(tamanho, 1, 50)), eu);
    }

    @PreAuthorize("hasRole('ALUNO')")
    @PostMapping("/mural")
    public MuralPostResponse criarPost(@RequestBody @Valid CriarPostRequest request,
                                       @AuthenticationPrincipal UsuarioAutenticado eu) {
        return comunidade.criarPostMural(request, eu);
    }

    @PreAuthorize("hasRole('ALUNO')")
    @PostMapping("/mural/{id}/reacoes")
    public ResponseEntity<Void> reagirMural(@PathVariable UUID id, @RequestBody @Valid ReacaoRequest request,
                                            @AuthenticationPrincipal UsuarioAutenticado eu) {
        comunidade.alternarReacaoMural(id, request.emoji(), eu);
        return ResponseEntity.noContent().build();
    }

    @PreAuthorize("hasRole('ALUNO')")
    @GetMapping("/mural/{id}/comentarios")
    public List<ComentarioResponse> listarComentariosMural(@PathVariable UUID id) {
        return comunidade.listarComentariosMural(id);
    }

    @PreAuthorize("hasRole('ALUNO')")
    @PostMapping("/mural/{id}/comentarios")
    public ComentarioResponse comentarMural(@PathVariable UUID id, @RequestBody @Valid ComentarioRequest request,
                                            @AuthenticationPrincipal UsuarioAutenticado eu) {
        return comunidade.adicionarComentarioMural(id, request.texto(), eu);
    }

    // ---- Conquistas ----

    @PreAuthorize("hasRole('ALUNO')")
    @GetMapping("/conquistas")
    public List<ConquistaResponse> minhasConquistas(@AuthenticationPrincipal UsuarioAutenticado eu) {
        UUID alunoId = AlunoAppService.alunoDaSessao(eu);
        return comunidade.minhasConquistas(alunoId);
    }

    // ---- Ranking ----

    @PreAuthorize("hasRole('ALUNO')")
    @GetMapping("/ranking")
    public RankingResponse ranking(@AuthenticationPrincipal UsuarioAutenticado eu) {
        UUID alunoId = AlunoAppService.alunoDaSessao(eu);
        return comunidade.obterRanking(alunoId);
    }

    @PreAuthorize("hasRole('ALUNO')")
    @PutMapping("/ranking/opt-in")
    public ResponseEntity<Void> optInRanking(@RequestBody @Valid OptInRankingRequest request,
                                             @AuthenticationPrincipal UsuarioAutenticado eu) {
        UUID alunoId = AlunoAppService.alunoDaSessao(eu);
        comunidade.alterarOptInForca(alunoId, request.participa());
        return ResponseEntity.noContent().build();
    }
}
