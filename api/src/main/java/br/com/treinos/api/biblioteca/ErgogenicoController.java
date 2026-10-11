package br.com.treinos.api.biblioteca;

import br.com.treinos.api.biblioteca.dto.ErgogenicoDtos.ErgogenicoRequest;
import br.com.treinos.api.biblioteca.dto.ErgogenicoDtos.ErgogenicoResponse;
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

/** Dado sensível: só quem tem {@code ERGOGENICO_LER} lê e {@code ERGOGENICO_ALTERAR} grava (por padrão, o Administrador). */
@RestController
@RequestMapping("/ergogenicos")
public class ErgogenicoController {

    private final ErgogenicoService service;

    public ErgogenicoController(ErgogenicoService service) {
        this.service = service;
    }

    @PreAuthorize("hasAuthority('PERM_ERGOGENICO_LER')")
    @GetMapping
    public List<ErgogenicoResponse> listar(@RequestParam(required = false) String busca,
                                           @RequestParam(required = false) CategoriaErgogenico categoria) {
        return service.listar(busca, categoria);
    }

    @PreAuthorize("hasAuthority('PERM_ERGOGENICO_ALTERAR')")
    @PostMapping
    public ErgogenicoResponse criar(@RequestBody @Valid ErgogenicoRequest request) {
        return service.criar(request);
    }

    @PreAuthorize("hasAuthority('PERM_ERGOGENICO_ALTERAR')")
    @PutMapping("/{id}")
    public ErgogenicoResponse alterar(@PathVariable UUID id, @RequestBody @Valid ErgogenicoRequest request) {
        return service.alterar(id, request);
    }

    @PreAuthorize("hasAuthority('PERM_ERGOGENICO_ALTERAR')")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> inativar(@PathVariable UUID id) {
        service.inativar(id);
        return ResponseEntity.noContent().build();
    }
}
