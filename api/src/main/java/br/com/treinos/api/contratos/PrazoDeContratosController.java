package br.com.treinos.api.contratos;

import br.com.treinos.api.contratos.PrazoDeContratosService.PrazoDeContratos;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/** Prazo para assinar o contrato da consultoria (S6): ler com {@code CONTRATO_LER}, gravar com {@code CONTRATO_ALTERAR}. */
@RestController
@ExigeContratos
public class PrazoDeContratosController {

    private final PrazoDeContratosService prazo;

    public PrazoDeContratosController(PrazoDeContratosService prazo) {
        this.prazo = prazo;
    }

    @PreAuthorize("hasAuthority('PERM_CONTRATO_LER')")
    @GetMapping("/consultoria/contratos")
    public PrazoDeContratos obter() {
        return prazo.obter();
    }

    @PreAuthorize("hasAuthority('PERM_CONTRATO_ALTERAR')")
    @PutMapping("/consultoria/contratos")
    public PrazoDeContratos alterar(@RequestBody PrazoDeContratos r) {
        return prazo.alterar(r);
    }
}
