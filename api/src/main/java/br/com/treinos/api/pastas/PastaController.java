package br.com.treinos.api.pastas;

import br.com.treinos.api.pastas.PastaDtos.PastaRequest;
import br.com.treinos.api.pastas.PastaDtos.PastaResumo;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
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

    public PastaController(PastaService pastas) {
        this.pastas = pastas;
    }

    @PreAuthorize("hasRole('TREINADOR')")
    @GetMapping("/alunos/{alunoId}/pastas")
    public List<PastaResumo> listar(@PathVariable UUID alunoId) {
        return pastas.listar(alunoId);
    }

    @PreAuthorize("hasRole('TREINADOR')")
    @PostMapping("/alunos/{alunoId}/pastas")
    public PastaResumo criar(@PathVariable UUID alunoId, @RequestBody @Valid PastaRequest request) {
        return pastas.criar(alunoId, request);
    }

    @PreAuthorize("hasRole('TREINADOR')")
    @PutMapping("/pastas/{id}")
    public PastaResumo atualizar(@PathVariable UUID id, @RequestBody @Valid PastaRequest request) {
        return pastas.atualizar(id, request);
    }

    @PreAuthorize("hasRole('TREINADOR')")
    @PostMapping("/pastas/{id}/replicar")
    public PastaResumo replicar(@PathVariable UUID id, @RequestBody @Valid PastaRequest request) {
        return pastas.replicar(id, request);
    }
}
