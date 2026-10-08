package br.com.treinos.api.biblioteca;

import br.com.treinos.api.biblioteca.dto.BibliotecaDtos.CatalogoAlimentoResponse;
import br.com.treinos.api.biblioteca.dto.BibliotecaDtos.CatalogoExercicioResponse;
import br.com.treinos.api.biblioteca.dto.BibliotecaDtos.CatalogoPagina;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Catálogo público, só leitura: o treinador escolhe o que importar para a biblioteca dele. A busca ignora acento e
 * maiúsculas; {@code limite} vale 50 por padrão (máximo 200) e {@code total} diz quantos itens casaram.
 */
@RestController
@RequestMapping("/catalogo")
public class CatalogoController {

    private final BibliotecaService biblioteca;

    public CatalogoController(BibliotecaService biblioteca) {
        this.biblioteca = biblioteca;
    }

    @PreAuthorize("hasRole('TREINADOR')")
    @GetMapping("/exercicios")
    public CatalogoPagina<CatalogoExercicioResponse> exercicios(@RequestParam(required = false) String busca,
                                                                @RequestParam(required = false) String grupo,
                                                                @RequestParam(required = false) String modalidade,
                                                                @RequestParam(required = false) Integer limite) {
        return biblioteca.catalogoExercicios(busca, grupo, modalidade, limite);
    }

    @PreAuthorize("hasRole('TREINADOR')")
    @GetMapping("/exercicios/grupos")
    public List<String> gruposDeExercicios() {
        return biblioteca.gruposDoCatalogoDeExercicios();
    }

    @PreAuthorize("hasRole('TREINADOR')")
    @GetMapping("/alimentos")
    public CatalogoPagina<CatalogoAlimentoResponse> alimentos(@RequestParam(required = false) String busca,
                                                              @RequestParam(required = false) String grupo,
                                                              @RequestParam(required = false) Integer limite) {
        return biblioteca.catalogoAlimentos(busca, grupo, limite);
    }

    @PreAuthorize("hasRole('TREINADOR')")
    @GetMapping("/alimentos/grupos")
    public List<String> gruposDeAlimentos() {
        return biblioteca.gruposDoCatalogoDeAlimentos();
    }
}
