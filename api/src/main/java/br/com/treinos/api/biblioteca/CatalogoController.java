package br.com.treinos.api.biblioteca;

import br.com.treinos.api.biblioteca.dto.BibliotecaDtos.CatalogoAlimentoResponse;
import br.com.treinos.api.biblioteca.dto.BibliotecaDtos.CatalogoExercicioResponse;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Catálogo público, só leitura: o treinador escolhe o que importar para a biblioteca dele. */
@RestController
@RequestMapping("/catalogo")
public class CatalogoController {

    private final BibliotecaService biblioteca;

    public CatalogoController(BibliotecaService biblioteca) {
        this.biblioteca = biblioteca;
    }

    @PreAuthorize("hasRole('TREINADOR')")
    @GetMapping("/exercicios")
    public List<CatalogoExercicioResponse> exercicios(@RequestParam(required = false) String busca) {
        return biblioteca.catalogoExercicios(busca);
    }

    @PreAuthorize("hasRole('TREINADOR')")
    @GetMapping("/alimentos")
    public List<CatalogoAlimentoResponse> alimentos(@RequestParam(required = false) String busca) {
        return biblioteca.catalogoAlimentos(busca);
    }
}
