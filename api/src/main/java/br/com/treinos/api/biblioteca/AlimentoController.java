package br.com.treinos.api.biblioteca;

import br.com.treinos.api.biblioteca.dto.BibliotecaDtos.AlimentoRequest;
import br.com.treinos.api.biblioteca.dto.BibliotecaDtos.AlimentoResponse;
import br.com.treinos.api.biblioteca.dto.BibliotecaDtos.ImportacaoResultado;
import br.com.treinos.api.biblioteca.dto.BibliotecaDtos.ImportarCatalogoRequest;
import br.com.treinos.api.biblioteca.dto.BibliotecaDtos.PreviaCsv;
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
    private final ImportacaoCsvService csv;

    public AlimentoController(BibliotecaService biblioteca, ImportacaoCsvService csv) {
        this.biblioteca = biblioteca;
        this.csv = csv;
    }

    @PreAuthorize("hasRole('TREINADOR')")
    @GetMapping
    public List<AlimentoResponse> listar(@RequestParam(required = false) String busca) {
        return biblioteca.listarAlimentos(busca);
    }

    @PreAuthorize("hasRole('TREINADOR')")
    @PostMapping
    public AlimentoResponse criar(@RequestBody @Valid AlimentoRequest request) {
        return biblioteca.criarAlimento(request);
    }

    @PreAuthorize("hasRole('TREINADOR')")
    @PutMapping("/{id}")
    public AlimentoResponse alterar(@PathVariable UUID id, @RequestBody @Valid AlimentoRequest request) {
        return biblioteca.alterarAlimento(id, request);
    }

    @PreAuthorize("hasRole('TREINADOR')")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> inativar(@PathVariable UUID id) {
        biblioteca.inativarAlimento(id);
        return ResponseEntity.noContent().build();
    }

    @PreAuthorize("hasRole('TREINADOR')")
    @PostMapping("/importar-catalogo")
    public ImportacaoResultado importarCatalogo(@RequestBody @Valid ImportarCatalogoRequest request) {
        return biblioteca.importarCatalogoAlimentos(request.ids());
    }

    @PreAuthorize("hasRole('TREINADOR')")
    @PostMapping(value = "/importar-csv", consumes = {"text/plain", "text/csv"})
    public PreviaCsv<ImportacaoCsvService.AlimentoCsv> previaCsv(@RequestBody String texto) {
        return csv.previaAlimentos(texto);
    }

    @PreAuthorize("hasRole('TREINADOR')")
    @PostMapping(value = "/importar-csv", params = "confirmar=true", consumes = {"text/plain", "text/csv"})
    public ImportacaoResultado confirmarCsv(@RequestBody String texto, @RequestParam String hash) {
        return csv.confirmarAlimentos(texto, hash);
    }
}
