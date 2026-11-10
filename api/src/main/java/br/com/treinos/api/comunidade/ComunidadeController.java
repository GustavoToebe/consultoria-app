package br.com.treinos.api.comunidade;

import br.com.treinos.api.comunidade.dto.ComunidadeDtos.*;
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
@RequestMapping("/comunidade")
public class ComunidadeController {

    private final ComunidadeService comunidade;
    private final ApelidoDoAlunoService apelidos;

    public ComunidadeController(ComunidadeService comunidade, ApelidoDoAlunoService apelidos) {
        this.comunidade = comunidade;
        this.apelidos = apelidos;
    }

    // ---- Aulões (Equipe) ----

    @PreAuthorize("hasAuthority('PERM_TREINO_LER')")
    @GetMapping("/aulas")
    public List<AulaResumo> listarAulas() {
        return comunidade.listarAulasEquipe();
    }

    @PreAuthorize("hasAuthority('PERM_COMUNIDADE_MODERAR')")
    @PostMapping("/aulas")
    public AulaResumo criarAula(@RequestBody @Valid CriarAulaRequest request) {
        return comunidade.criarAula(request);
    }

    @PreAuthorize("hasAuthority('PERM_COMUNIDADE_MODERAR')")
    @PutMapping("/aulas/{id}")
    public AulaResumo alterarAula(@PathVariable UUID id, @RequestBody @Valid CriarAulaRequest request) {
        return comunidade.alterarAula(id, request);
    }

    @PreAuthorize("hasAuthority('PERM_COMUNIDADE_MODERAR')")
    @DeleteMapping("/aulas/{id}")
    public ResponseEntity<Void> excluirAula(@PathVariable UUID id) {
        comunidade.excluirAula(id);
        return ResponseEntity.noContent().build();
    }

    @PreAuthorize("hasAuthority('PERM_TREINO_LER')")
    @GetMapping("/aulas/{id}/comentarios")
    public PaginaDeComentarios listarComentariosAula(@PathVariable UUID id, @RequestParam(required = false) Integer pagina,
                                                     @RequestParam(required = false) Integer tamanho,
                                                     @AuthenticationPrincipal UsuarioAutenticado eu) {
        return comunidade.listarComentariosAula(id, eu, pagina, tamanho);
    }

    @PreAuthorize("hasAuthority('PERM_COMUNIDADE_MODERAR')")
    @PostMapping("/aulas/{id}/comentarios")
    public ComentarioResponse comentarAula(@PathVariable UUID id, @RequestBody @Valid ComentarioRequest request,
                                           @AuthenticationPrincipal UsuarioAutenticado eu) {
        return comunidade.adicionarComentarioAula(id, request.texto(), eu);
    }

    @PreAuthorize("hasAuthority('PERM_COMUNIDADE_MODERAR')")
    @DeleteMapping("/aulas/comentarios/{id}")
    public ResponseEntity<Void> excluirComentarioAula(@PathVariable UUID id) {
        comunidade.excluirComentarioAula(id);
        return ResponseEntity.noContent().build();
    }

    // ---- Mural (Equipe / Moderação) ----

    @PreAuthorize("hasAuthority('PERM_TREINO_LER')")
    @GetMapping("/mural")
    public Page<MuralPostResponse> listarMural(@RequestParam(defaultValue = "0") int pagina,
                                               @RequestParam(defaultValue = "20") int tamanho,
                                               @AuthenticationPrincipal UsuarioAutenticado eu) {
        return comunidade.listarMural(PageRequest.of(Math.max(0, pagina), Math.clamp(tamanho, 1, 50)), eu);
    }

    @PreAuthorize("hasAuthority('PERM_COMUNIDADE_MODERAR')")
    @PostMapping("/mural")
    public MuralPostResponse criarPost(@RequestBody @Valid CriarPostRequest request,
                                       @AuthenticationPrincipal UsuarioAutenticado eu) {
        return comunidade.criarPostMural(request, eu);
    }

    @PreAuthorize("hasAuthority('PERM_COMUNIDADE_MODERAR')")
    @PostMapping("/mural/{id}/fixar")
    public ResponseEntity<Void> fixarPost(@PathVariable UUID id) {
        comunidade.fixarPost(id);
        return ResponseEntity.noContent().build();
    }

    @PreAuthorize("hasAuthority('PERM_COMUNIDADE_MODERAR')")
    @DeleteMapping("/mural/{id}")
    public ResponseEntity<Void> moderarPost(@PathVariable UUID id) {
        comunidade.moderarPost(id);
        return ResponseEntity.noContent().build();
    }

    @PreAuthorize("hasAuthority('PERM_TREINO_LER')")
    @GetMapping("/mural/{id}/comentarios")
    public PaginaDeComentarios listarComentariosMural(@PathVariable UUID id, @RequestParam(required = false) Integer pagina,
                                                      @RequestParam(required = false) Integer tamanho) {
        return comunidade.listarComentariosMural(id, pagina, tamanho);
    }

    @PreAuthorize("hasAuthority('PERM_COMUNIDADE_MODERAR')")
    @DeleteMapping("/mural/comentarios/{id}")
    public ResponseEntity<Void> moderarComentarioMural(@PathVariable UUID id) {
        comunidade.moderarComentarioMural(id);
        return ResponseEntity.noContent().build();
    }

    /** Limpa o apelido de um aluno (o aluno pode pôr outro depois). {@code autorId} é o id de usuário do mural; idempotente. */
    @PreAuthorize("hasAuthority('PERM_COMUNIDADE_MODERAR')")
    @DeleteMapping("/perfis/{autorId}/apelido")
    public ResponseEntity<Void> removerApelido(@PathVariable UUID autorId) {
        apelidos.remover(autorId);
        return ResponseEntity.noContent().build();
    }
}
