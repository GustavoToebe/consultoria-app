package br.com.treinos.api.conta;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Minha conta e consumo do plano: só consulta, só com {@code CONTA_LER} (nos perfis padrão, o Administrador). */
@RestController
public class ContaController {

    private final ContaService service;

    public ContaController(ContaService service) {
        this.service = service;
    }

    @PreAuthorize("hasAuthority('PERM_CONTA_LER')")
    @GetMapping("/minha-conta")
    public MinhaContaResposta minhaConta() {
        return service.minhaConta();
    }

    @PreAuthorize("hasAuthority('PERM_CONTA_LER')")
    @GetMapping("/minha-conta/consumo")
    public ConsumoPlanoDto consumo() {
        return service.consumo();
    }
}
