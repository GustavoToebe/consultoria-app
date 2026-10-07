package br.com.treinos.api.biblioteca;

import br.com.treinos.api.biblioteca.dto.BibliotecaDtos.ExercicioRequest;
import br.com.treinos.api.biblioteca.dto.BibliotecaDtos.ExercicioResponse;
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
@RequestMapping("/exercicios")
public class ExercicioController {

    private final BibliotecaService biblioteca;
    private final ImportacaoCsvService csv;

    public ExercicioController(BibliotecaService biblioteca, ImportacaoCsvService csv) {
        this.biblioteca = biblioteca;
        this.csv = csv;
    }

    @PreAuthorize("hasRole('TREINADOR')")
    @GetMapping
    public List<ExercicioResponse> listar(@RequestParam(required = false) String busca) {
        return biblioteca.listarExercicios(busca);
    }

    @PreAuthorize("hasRole('TREINADOR')")
    @PostMapping
    public ExercicioResponse criar(@RequestBody @Valid ExercicioRequest request) {
        return biblioteca.criarExercicio(request);
    }

    @PreAuthorize("hasRole('TREINADOR')")
    @PutMapping("/{id}")
    public ExercicioResponse alterar(@PathVariable UUID id, @RequestBody @Valid ExercicioRequest request) {
        return biblioteca.alterarExercicio(id, request);
    }

    /** Inativa: planos já montados continuam com a cópia do nome. */
    @PreAuthorize("hasRole('TREINADOR')")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> inativar(@PathVariable UUID id) {
        biblioteca.inativarExercicio(id);
        return ResponseEntity.noContent().build();
    }

    @PreAuthorize("hasRole('TREINADOR')")
    @PostMapping("/importar-catalogo")
    public ImportacaoResultado importarCatalogo(@RequestBody @Valid ImportarCatalogoRequest request) {
        return biblioteca.importarCatalogoExercicios(request.ids());
    }

    @PreAuthorize("hasRole('TREINADOR')")
    @PostMapping(value = "/importar-csv", consumes = {"text/plain", "text/csv"})
    public PreviaCsv<ImportacaoCsvService.ExercicioCsv> previaCsv(@RequestBody String texto) {
        return csv.previaExercicios(texto);
    }

    @PreAuthorize("hasRole('TREINADOR')")
    @PostMapping(value = "/importar-csv", params = "confirmar=true", consumes = {"text/plain", "text/csv"})
    public ImportacaoResultado confirmarCsv(@RequestBody String texto, @RequestParam String hash) {
        return csv.confirmarExercicios(texto, hash);
    }
}
