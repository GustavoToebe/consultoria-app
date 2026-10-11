package br.com.treinos.api.receitas;
import br.com.treinos.api.planos.dto.PlanoDtos.SalvarComoReceitaRequest;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;

@RestController
public class AplicarModeloController {
    private final AplicarModeloService modelos;
    public AplicarModeloController(AplicarModeloService modelos) { this.modelos = modelos; }
    @PreAuthorize("hasAuthority('PERM_MODELO_APLICAR') and hasAuthority('PERM_ALUNO_LER')") @PostMapping("/receitas/{id}/aplicar")
    public AplicarModeloService.Response aplicar(@PathVariable UUID id, @RequestBody @Valid AplicarModeloService.Request r) {
        return modelos.aplicar(id,r);
    }
    @PreAuthorize("hasAuthority('PERM_MODELO_ALTERAR') and hasAuthority('PERM_ALUNO_LER') and hasAuthority('PERM_TREINO_LER') and hasAuthority('PERM_DIETA_LER')") @PostMapping("/pastas/{id}/salvar-como-modelo")
    public ReceitaService.ReceitaResponse salvarPasta(@PathVariable UUID id, @RequestBody @Valid SalvarComoReceitaRequest r) {
        return modelos.salvarPasta(id,r);
    }
}
