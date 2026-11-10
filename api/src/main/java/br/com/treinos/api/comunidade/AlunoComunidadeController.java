package br.com.treinos.api.comunidade;

import br.com.treinos.api.auth.LimiteTentativas;
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
    private final ApelidoDoAlunoService apelidos;
    private final LimiteTentativas limite;

    public AlunoComunidadeController(ComunidadeService comunidade, ApelidoDoAlunoService apelidos, LimiteTentativas limite) {
        this.comunidade = comunidade;
        this.apelidos = apelidos;
        this.limite = limite;
    }

    // ---- Aulões ----

    @PreAuthorize("hasRole('ALUNO')")
    @GetMapping("/aulas")
    public List<AulaResumo> listarAulas() {
        return comunidade.listarAulasAluno();
    }

    @PreAuthorize("hasRole('ALUNO')")
    @GetMapping("/aulas/{id}/comentarios")
    public List<ComentarioResponse> listarComentariosAula(@PathVariable UUID id, @AuthenticationPrincipal UsuarioAutenticado eu) {
        return comunidade.listarComentariosAula(id, eu);
    }

    @PreAuthorize("hasRole('ALUNO')")
    @PostMapping("/aulas/{id}/comentarios")
    public ComentarioResponse comentarAula(@PathVariable UUID id, @RequestBody @Valid ComentarioRequest request,
                                           @AuthenticationPrincipal UsuarioAutenticado eu) {
        limite.comunidade(eu.usuarioId());
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
        limite.comunidade(eu.usuarioId());
        return comunidade.criarPostMural(request, eu);
    }

    @PreAuthorize("hasRole('ALUNO')")
    @PostMapping("/mural/{id}/reacoes")
    public ResponseEntity<Void> reagirMural(@PathVariable UUID id, @RequestBody @Valid ReacaoRequest request,
                                            @AuthenticationPrincipal UsuarioAutenticado eu) {
        limite.comunidade(eu.usuarioId());
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
        limite.comunidade(eu.usuarioId());
        return comunidade.adicionarComentarioMural(id, request.texto(), eu);
    }

    // ---- Apelido e perfil ----

    /** Sempre o aluno da sessão; vazio ou nulo apaga. */
    @PreAuthorize("hasRole('ALUNO')")
    @PutMapping("/apelido")
    public ResponseEntity<Void> definirApelido(@RequestBody ApelidoRequest request, @AuthenticationPrincipal UsuarioAutenticado eu) {
        limite.comunidade(eu.usuarioId());
        apelidos.alterar(eu, request.apelido());
        return ResponseEntity.noContent().build();
    }

    /** {@code autorId} é o id de usuário que o mural expõe; só colega ativo da mesma consultoria, senão 404 igual. */
    @PreAuthorize("hasRole('ALUNO')")
    @GetMapping("/perfis/{autorId}")
    public PerfilResponse perfil(@PathVariable UUID autorId, @AuthenticationPrincipal UsuarioAutenticado eu) {
        return comunidade.perfilDoColega(autorId, eu);
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
}
