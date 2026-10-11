package br.com.treinos.api.biblioteca;

import br.com.treinos.api.biblioteca.dto.SuplementoDtos.SuplementoRequest;
import br.com.treinos.api.biblioteca.dto.SuplementoDtos.SuplementoResponse;
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
@RequestMapping("/suplementos")
public class SuplementoController {

    private final SuplementoService service;

    public SuplementoController(SuplementoService service) {
        this.service = service;
    }

    @PreAuthorize("hasAuthority('PERM_BIBLIOTECA_LER')")
    @GetMapping
    public List<SuplementoResponse> listar(@RequestParam(required = false) String busca,
                                           @RequestParam(required = false) String categoria) {
        return service.listar(busca, categoria);
    }

    @PreAuthorize("hasAuthority('PERM_BIBLIOTECA_LER')")
    @GetMapping("/categorias")
    public List<String> categorias() {
        return service.categorias();
    }

    @PreAuthorize("hasAuthority('PERM_BIBLIOTECA_ALTERAR')")
    @PostMapping
    public SuplementoResponse criar(@RequestBody @Valid SuplementoRequest request) {
        return service.criar(request);
    }

    @PreAuthorize("hasAuthority('PERM_BIBLIOTECA_ALTERAR')")
    @PutMapping("/{id}")
    public SuplementoResponse alterar(@PathVariable UUID id, @RequestBody @Valid SuplementoRequest request) {
        return service.alterar(id, request);
    }

    @PreAuthorize("hasAuthority('PERM_BIBLIOTECA_ALTERAR')")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> inativar(@PathVariable UUID id) {
        service.inativar(id);
        return ResponseEntity.noContent().build();
    }
}
