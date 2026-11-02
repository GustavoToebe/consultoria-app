package br.com.treinos.api.pastas;

import br.com.treinos.api.atualizacoes.PesoSugeridoDaPastaService;
import br.com.treinos.api.pastas.PastaDtos.CopiarPastaRequest;
import br.com.treinos.api.pastas.PastaDtos.CopiarPastaResposta;
import br.com.treinos.api.pastas.PastaDtos.FinalizarRequest;
import br.com.treinos.api.pastas.PastaDtos.PastaRequest;
import br.com.treinos.api.pastas.PastaDtos.PastaResumo;
import br.com.treinos.api.pastas.PastaDtos.PastaVigenteResposta;
import br.com.treinos.api.pastas.PastaDtos.PesoSugeridoDaPasta;
import br.com.treinos.api.pastas.PastaDtos.PublicarPastaRequest;
import br.com.treinos.api.pastas.PastaDtos.PublicarPastaResposta;
import br.com.treinos.api.security.UsuarioAutenticado;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/** Pastas de plano do treinador: agrupam treino e dieta do aluno e definem o período. */
@RestController
public class PastaController {

    private final PastaService pastas;
    private final PesoSugeridoDaPastaService pesoSugerido;

    public PastaController(PastaService pastas, PesoSugeridoDaPastaService pesoSugerido) {
        this.pastas = pastas;
        this.pesoSugerido = pesoSugerido;
    }

    @PreAuthorize("hasAuthority('PERM_ALUNO_LER')")
    @GetMapping("/alunos/{alunoId}/pastas")
    public List<PastaResumo> listar(@PathVariable UUID alunoId) {
        return pastas.listar(alunoId);
    }

    @PreAuthorize("hasAuthority('PERM_ALUNO_LER')")
    @GetMapping("/alunos/{alunoId}/pastas/vigente")
    public PastaVigenteResposta vigente(@PathVariable UUID alunoId) {
        return pastas.vigente(alunoId);
    }

    @PreAuthorize("hasAuthority('PERM_PASTA_ALTERAR')")
    @PostMapping("/alunos/{alunoId}/pastas")
    public PastaResumo criar(@PathVariable UUID alunoId, @RequestBody @Valid PastaRequest request) {
        return pastas.criar(alunoId, request);
    }

    @PreAuthorize("hasAuthority('PERM_PASTA_ALTERAR')")
    @PutMapping("/pastas/{id}")
    public PastaResumo atualizar(@PathVariable UUID id, @RequestBody @Valid PastaRequest request) {
        return pastas.atualizar(id, request);
    }

    @PreAuthorize("hasAuthority('PERM_PASTA_ALTERAR')")
    @PostMapping("/pastas/{id}/replicar")
    public PastaResumo replicar(@PathVariable UUID id, @RequestBody @Valid PastaRequest request) {
        return pastas.replicar(id, request);
    }

    /**
     * Publica o rascunho de treino, dieta e mobilidade da pasta de uma vez. A rota abre com a permissão de publicar de
     * treino OU de dieta; o serviço confere a de CADA tipo presente na pasta, antes de qualquer efeito.
     */
    @PreAuthorize("hasAuthority('PERM_TREINO_PUBLICAR') or hasAuthority('PERM_DIETA_PUBLICAR')")
    @PostMapping("/pastas/{id}/publicar")
    public PublicarPastaResposta publicar(@PathVariable UUID id, @RequestBody @Valid PublicarPastaRequest request,
                                          @AuthenticationPrincipal UsuarioAutenticado eu) {
        return pastas.publicarTudo(id, request.confirmarAvisos(), eu.usuarioId());
    }

    @PreAuthorize("hasAuthority('PERM_PASTA_ALTERAR') and hasAuthority('PERM_ALUNO_LER')")
    @PostMapping("/pastas/{id}/copiar-para-aluno")
    public CopiarPastaResposta copiarParaAluno(@PathVariable UUID id, @RequestBody @Valid CopiarPastaRequest request) {
        return pastas.copiarParaAluno(id, request);
    }

    /** Peso que a atualização enviada da pasta gravou, para o "Finalizar pasta"; dado sensível. */
    @PreAuthorize("hasAuthority('PERM_ALUNO_SENSIVEL_LER') and hasAuthority('PERM_ATUALIZACAO_LER')")
    @GetMapping("/pastas/{id}/peso-sugerido")
    public PesoSugeridoDaPasta pesoSugerido(@PathVariable UUID id) {
        return pesoSugerido.doPasta(id);
    }

    @PreAuthorize("hasAuthority('PERM_PASTA_ALTERAR')")
    @PostMapping("/pastas/{id}/finalizar")
    public PastaResumo finalizar(@PathVariable UUID id, @RequestBody @Valid FinalizarRequest request,
                                 @AuthenticationPrincipal UsuarioAutenticado eu) {
        return pastas.finalizar(id, request, eu.usuarioId());
    }

    @PreAuthorize("hasAuthority('PERM_PASTA_ALTERAR')")
    @PostMapping("/pastas/{id}/reabrir")
    public PastaResumo reabrir(@PathVariable UUID id) {
        return pastas.reabrir(id);
    }

    @PreAuthorize("hasAuthority('PERM_PASTA_ALTERAR')")
    @DeleteMapping("/pastas/{id}")
    public ResponseEntity<Void> excluir(@PathVariable UUID id) { pastas.excluir(id); return ResponseEntity.noContent().build(); }
}
