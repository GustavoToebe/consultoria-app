package br.com.treinos.api.conta;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * Minha conta e consumo do plano, só com {@code CONTA_LER} (nos perfis padrão, o Administrador). A única ação é pedir o
 * link de pagamento de uma cobrança aberta: o pagamento acontece no Mercado Pago, fora do app.
 */
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

    @PreAuthorize("hasAuthority('PERM_CONTA_LER')")
    @PostMapping("/minha-conta/cobrancas/{id}/pagar")
    public ContaService.LinkDePagamento pagar(@PathVariable UUID id) {
        return service.linkDePagamento(id);
    }
}
