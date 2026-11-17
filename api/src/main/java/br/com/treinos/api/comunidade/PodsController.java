package br.com.treinos.api.comunidade;

import br.com.treinos.api.comunidade.dto.ComunidadeDtos.AtribuirPodRequest;
import br.com.treinos.api.comunidade.dto.ComunidadeDtos.PodRequest;
import br.com.treinos.api.comunidade.dto.ComunidadeDtos.PodResumo;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/** Pods da comunidade (V082): só a equipe com {@code COMUNIDADE_MODERAR}; o aluno só descobre o próprio pod em {@code GET /aluno/comunidade/configuracao}. */
@RestController
public class PodsController {

    private final PodsService pods;

    public PodsController(PodsService pods) {
        this.pods = pods;
    }

    @PreAuthorize("hasAuthority('PERM_COMUNIDADE_MODERAR')")
    @GetMapping("/comunidade/pods")
    public List<PodResumo> listar() {
        return pods.listar();
    }

    @PreAuthorize("hasAuthority('PERM_COMUNIDADE_MODERAR')")
    @PostMapping("/comunidade/pods")
    public PodResumo criar(@RequestBody @Valid PodRequest request) {
        return pods.criar(request.nome());
    }

    @PreAuthorize("hasAuthority('PERM_COMUNIDADE_MODERAR')")
    @PutMapping("/comunidade/pods/{id}")
    public PodResumo alterar(@PathVariable UUID id, @RequestBody @Valid PodRequest request) {
        return pods.alterar(id, request.nome());
    }

    /** {@code podId} nulo tira o aluno do pod; 204. */
    @PreAuthorize("hasAuthority('PERM_COMUNIDADE_MODERAR')")
    @PutMapping("/alunos/{id}/pod")
    public ResponseEntity<Void> atribuir(@PathVariable UUID id, @RequestBody AtribuirPodRequest request) {
        pods.atribuir(id, request.podId());
        return ResponseEntity.noContent().build();
    }
}
