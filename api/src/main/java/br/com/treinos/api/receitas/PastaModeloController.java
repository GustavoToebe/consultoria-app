package br.com.treinos.api.receitas;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/pastas-modelos")
public class PastaModeloController {
    private final PastaModeloService pastas;
    public PastaModeloController(PastaModeloService pastas) { this.pastas = pastas; }
    @PreAuthorize("hasRole('TREINADOR')") @GetMapping
    public List<PastaModeloService.Response> listar() { return pastas.listar(); }
    @PreAuthorize("hasRole('TREINADOR')") @PostMapping
    public PastaModeloService.Response criar(@RequestBody @Valid PastaModeloService.Request r) { return pastas.criar(r); }
    @PreAuthorize("hasRole('TREINADOR')") @PutMapping("/{id}")
    public PastaModeloService.Response alterar(@PathVariable UUID id, @RequestBody @Valid PastaModeloService.Request r) { return pastas.alterar(id, r); }
    @PreAuthorize("hasRole('TREINADOR')") @DeleteMapping("/{id}")
    public ResponseEntity<Void> excluir(@PathVariable UUID id) { pastas.excluir(id); return ResponseEntity.noContent().build(); }
}
