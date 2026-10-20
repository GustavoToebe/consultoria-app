package br.com.treinos.api.numeros;

import br.com.treinos.api.numeros.NumerosService.Numeros;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class NumerosController {

    private final NumerosService numeros;

    public NumerosController(NumerosService numeros) {
        this.numeros = numeros;
    }

    @PreAuthorize("hasAuthority('PERM_PAINEL_VER')")
    @GetMapping("/numeros")
    public Numeros numeros() {
        return numeros.numeros();
    }
}
