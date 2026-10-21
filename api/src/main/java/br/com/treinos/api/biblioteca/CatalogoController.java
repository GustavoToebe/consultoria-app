package br.com.treinos.api.biblioteca;

import br.com.treinos.api.biblioteca.dto.BibliotecaDtos.CatalogoAlimentoResponse;
import br.com.treinos.api.biblioteca.dto.BibliotecaDtos.CatalogoExercicioResponse;
import br.com.treinos.api.biblioteca.dto.BibliotecaDtos.CatalogoPagina;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Catálogo público, só leitura: o treinador escolhe o que importar para a biblioteca dele. A busca ignora acento e
 * maiúsculas; {@code limite} vale 50 por padrão (máximo 200) e {@code total} diz quantos itens casaram.
 * {@code grupo} pode vir repetido ({@code ?grupo=A&grupo=B}) e vale "ou"; sem ele não filtra. Não se usa
 * {@code List<String>} no parâmetro porque o Spring separa um valor único por vírgula e há grupos com vírgula
 * ("Verduras, hortaliças e derivados").
 */
@RestController
@RequestMapping("/catalogo")
public class CatalogoController {

    private final BibliotecaService biblioteca;

    public CatalogoController(BibliotecaService biblioteca) {
        this.biblioteca = biblioteca;
    }

    @PreAuthorize("hasAuthority('PERM_BIBLIOTECA_LER')")
    @GetMapping("/exercicios")
    public CatalogoPagina<CatalogoExercicioResponse> exercicios(@RequestParam(required = false) String busca,
                                                                @RequestParam(required = false) String modalidade,
                                                                @RequestParam(required = false) Integer limite,
                                                                HttpServletRequest http) {
        return biblioteca.catalogoExercicios(busca, gruposDe(http), modalidade, limite);
    }

    @PreAuthorize("hasAuthority('PERM_BIBLIOTECA_LER')")
    @GetMapping("/exercicios/grupos")
    public List<String> gruposDeExercicios() {
        return biblioteca.gruposDoCatalogoDeExercicios();
    }

    @PreAuthorize("hasAuthority('PERM_BIBLIOTECA_LER')")
    @GetMapping("/alimentos")
    public CatalogoPagina<CatalogoAlimentoResponse> alimentos(@RequestParam(required = false) String busca,
                                                              @RequestParam(required = false) Integer limite,
                                                              HttpServletRequest http) {
        return biblioteca.catalogoAlimentos(busca, gruposDe(http), limite);
    }

    @PreAuthorize("hasAuthority('PERM_BIBLIOTECA_LER')")
    @GetMapping("/alimentos/grupos")
    public List<String> gruposDeAlimentos() {
        return biblioteca.gruposDoCatalogoDeAlimentos();
    }

    private static List<String> gruposDe(HttpServletRequest http) {
        String[] valores = http.getParameterValues("grupo");
        return valores == null ? List.of() : List.of(valores);
    }
}
