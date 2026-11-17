package br.com.treinos.api.execucao;

import br.com.treinos.api.execucao.dto.ExecucaoDtos.DiaDeTreino;
import br.com.treinos.api.execucao.dto.ExecucaoDtos.PesoRequest;
import br.com.treinos.api.execucao.dto.ExecucaoDtos.PesoResponse;
import br.com.treinos.api.execucao.dto.ExecucaoDtos.ProgressoPonto;
import br.com.treinos.api.security.UsuarioAutenticado;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Registros, progresso e peso de um aluno, vistos pelo treinador. Aluno de outra consultoria = 404. */
@RestController
@RequestMapping("/alunos/{alunoId}")
public class ExecucoesTreinadorController {

    private final HistoricoService historico;
    private final PesoService pesos;

    public ExecucoesTreinadorController(HistoricoService historico, PesoService pesos) {
        this.historico = historico;
        this.pesos = pesos;
    }

    @PreAuthorize("hasAuthority('PERM_REGISTRO_LER')")
    @GetMapping("/execucoes")
    public List<DiaDeTreino> execucoes(@PathVariable UUID alunoId,
                                       @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate de,
                                       @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate ate) {
        return historico.doAluno(alunoId, de, ate);
    }

    @PreAuthorize("hasAuthority('PERM_REGISTRO_LER')")
    @GetMapping("/progresso")
    public List<ProgressoPonto> progresso(@PathVariable UUID alunoId, @RequestParam UUID exercicioId) {
        return historico.progresso(alunoId, exercicioId);
    }

    @PreAuthorize("hasAuthority('PERM_ALUNO_SENSIVEL_LER')")
    @GetMapping("/pesos")
    public List<PesoResponse> pesos(@PathVariable UUID alunoId) {
        return pesos.listar(alunoId);
    }

    @PreAuthorize("hasAuthority('PERM_ALUNO_SENSIVEL_LER') and hasAuthority('PERM_ALUNO_SENSIVEL_ALTERAR')")
    @PostMapping("/pesos")
    public List<PesoResponse> registrarPeso(@PathVariable UUID alunoId, @RequestBody @Valid PesoRequest request,
                                            @AuthenticationPrincipal UsuarioAutenticado eu) {
        return pesos.registrar(alunoId, request, eu.usuarioId());
    }

    @PreAuthorize("hasAuthority('PERM_ALUNO_SENSIVEL_LER') and hasAuthority('PERM_ALUNO_SENSIVEL_ALTERAR')")
    @DeleteMapping("/pesos/{pesoId}")
    public ResponseEntity<Void> excluirPeso(@PathVariable UUID alunoId, @PathVariable UUID pesoId) {
        pesos.excluir(alunoId, pesoId);
        return ResponseEntity.noContent().build();
    }
}
