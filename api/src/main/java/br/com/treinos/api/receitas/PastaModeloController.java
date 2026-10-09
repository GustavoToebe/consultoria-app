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
    @PreAuthorize("hasAuthority('PERM_MODELO_LER')") @GetMapping
    public List<PastaModeloService.Response> listar() { return pastas.listar(); }
    @PreAuthorize("hasAuthority('PERM_MODELO_ALTERAR')") @PostMapping
    public PastaModeloService.Response criar(@RequestBody @Valid PastaModeloService.Request r) { return pastas.criar(r); }
    @PreAuthorize("hasAuthority('PERM_MODELO_ALTERAR')") @PutMapping("/{id}")
    public PastaModeloService.Response alterar(@PathVariable UUID id, @RequestBody @Valid PastaModeloService.Request r) { return pastas.alterar(id, r); }
    @PreAuthorize("hasAuthority('PERM_MODELO_ALTERAR')") @DeleteMapping("/{id}")
    public ResponseEntity<Void> excluir(@PathVariable UUID id) { pastas.excluir(id); return ResponseEntity.noContent().build(); }
}
