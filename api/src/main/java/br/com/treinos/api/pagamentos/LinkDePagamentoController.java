package br.com.treinos.api.pagamentos;

import br.com.treinos.api.pagamentos.PagamentosDtos.LinkDePagamento;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/** O link de pagamento de uma cobrança aberta, pedido pela equipe ({@code FINANCEIRO_ALTERAR}). O corpo não leva nada: o valor é do servidor. */
@RestController
@ExigePagamentos
@ExigeInfinitePay
public class LinkDePagamentoController {

    private static final String ALTERAR = "hasAuthority('PERM_FINANCEIRO_LER') and hasAuthority('PERM_ALUNO_LER') "
            + "and hasAuthority('PERM_FINANCEIRO_ALTERAR')";

    private final LinkDePagamentoService links;

    public LinkDePagamentoController(LinkDePagamentoService links) {
        this.links = links;
    }

    @PreAuthorize(ALTERAR)
    @PostMapping("/cobrancas/{id}/link")
    public ResponseEntity<LinkDePagamento> gerar(@PathVariable UUID id) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(new LinkDePagamento(links.gerar(id)));
    }
}
