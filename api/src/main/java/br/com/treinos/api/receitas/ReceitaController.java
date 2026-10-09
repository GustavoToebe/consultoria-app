package br.com.treinos.api.receitas;

import br.com.treinos.api.receitas.ReceitaService.ReceitaRequest;
import br.com.treinos.api.receitas.ReceitaService.ReceitaResponse;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/receitas")
public class ReceitaController {

    private final ReceitaService receitas;

    public ReceitaController(ReceitaService receitas) {
        this.receitas = receitas;
    }

    @PreAuthorize("hasAuthority('PERM_MODELO_LER')")
    @GetMapping
    public List<ReceitaResponse> listar(@RequestParam(required = false) Receita.Tipo tipo) {
        return receitas.listar(tipo);
    }

    @PreAuthorize("hasAuthority('PERM_MODELO_LER')")
    @GetMapping("/{id}")
    public ReceitaResponse detalhe(@PathVariable UUID id) { return receitas.detalhe(id); }

    @PreAuthorize("hasAuthority('PERM_MODELO_ALTERAR')")
    @PutMapping("/{id}/conteudo")
    public ReceitaResponse conteudo(@PathVariable UUID id, @RequestBody @Valid ReceitaService.ConteudoRequest request) {
        return receitas.salvarConteudo(id, request);
    }

    @PreAuthorize("hasAuthority('PERM_MODELO_ALTERAR')")
    @PostMapping("/{id}/duplicar")
    public ReceitaResponse duplicar(@PathVariable UUID id) { return receitas.duplicar(id); }

    @PreAuthorize("hasAuthority('PERM_MODELO_ALTERAR')")
    @PostMapping
    public ReceitaResponse criar(@RequestBody @Valid ReceitaRequest request) {
        return receitas.criar(request);
    }

    @PreAuthorize("hasAuthority('PERM_MODELO_ALTERAR')")
    @PutMapping("/{id}")
    public ReceitaResponse alterar(@PathVariable UUID id, @RequestBody @Valid ReceitaRequest request) {
        return receitas.alterar(id, request);
    }

    @PreAuthorize("hasAuthority('PERM_MODELO_ALTERAR')")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> excluir(@PathVariable UUID id) {
        receitas.excluir(id);
        return ResponseEntity.noContent().build();
    }
}
