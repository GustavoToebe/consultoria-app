package br.com.treinos.api.biblioteca;

import br.com.treinos.api.biblioteca.dto.BibliotecaDtos.AlimentoRequest;
import br.com.treinos.api.biblioteca.dto.BibliotecaDtos.AlimentoResponse;
import br.com.treinos.api.biblioteca.dto.BibliotecaDtos.FatoresDoAlimento;
import br.com.treinos.api.biblioteca.dto.BibliotecaDtos.ImportacaoResultado;
import br.com.treinos.api.biblioteca.dto.BibliotecaDtos.ImportarCatalogoRequest;
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
@RequestMapping("/alimentos")
public class AlimentoController {

    private final BibliotecaService biblioteca;

    public AlimentoController(BibliotecaService biblioteca) {
        this.biblioteca = biblioteca;
    }

    @PreAuthorize("hasAuthority('PERM_BIBLIOTECA_LER')")
    @GetMapping
    public List<AlimentoResponse> listar(@RequestParam(required = false) String busca) {
        return biblioteca.listarAlimentos(busca);
    }

    /**
     * Fatores atuais dos alimentos ({@code ?ids=a,b,...}, até 200) para a lista de compras do editor da dieta. Abre a
     * quem lê a biblioteca, a dieta do aluno ou os modelos (quem abre o editor), porque os fatores não são dado do aluno.
     */
    @PreAuthorize("hasAuthority('PERM_BIBLIOTECA_LER') or hasAuthority('PERM_DIETA_LER') or hasAuthority('PERM_MODELO_LER')")
    @GetMapping("/fatores")
    public List<FatoresDoAlimento> fatores(@RequestParam(required = false) List<UUID> ids) {
        return biblioteca.fatoresDosAlimentos(ids);
    }

    @PreAuthorize("hasAuthority('PERM_BIBLIOTECA_ALTERAR')")
    @PostMapping
    public AlimentoResponse criar(@RequestBody @Valid AlimentoRequest request) {
        return biblioteca.criarAlimento(request);
    }

    @PreAuthorize("hasAuthority('PERM_BIBLIOTECA_ALTERAR')")
    @PutMapping("/{id}")
    public AlimentoResponse alterar(@PathVariable UUID id, @RequestBody @Valid AlimentoRequest request) {
        return biblioteca.alterarAlimento(id, request);
    }

    @PreAuthorize("hasAuthority('PERM_BIBLIOTECA_ALTERAR')")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> inativar(@PathVariable UUID id) {
        biblioteca.inativarAlimento(id);
        return ResponseEntity.noContent().build();
    }

    @PreAuthorize("hasAuthority('PERM_BIBLIOTECA_ALTERAR')")
    @PostMapping("/importar-catalogo")
    public ImportacaoResultado importarCatalogo(@RequestBody @Valid ImportarCatalogoRequest request) {
        return biblioteca.importarCatalogoAlimentos(request.ids());
    }
}
