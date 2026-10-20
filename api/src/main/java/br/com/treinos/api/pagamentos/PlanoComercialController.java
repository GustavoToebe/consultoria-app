package br.com.treinos.api.pagamentos;

import br.com.treinos.api.pagamentos.PagamentosDtos.PlanoRequest;
import br.com.treinos.api.pagamentos.PagamentosDtos.PlanoResponse;
import br.com.treinos.api.pagamentos.PagamentosDtos.VersaoRequest;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/** Planos comerciais: ler com {@code FINANCEIRO_LER}, criar, editar e arquivar com {@code FINANCEIRO_ALTERAR}. */
@RestController
@ExigePagamentos
public class PlanoComercialController {

    private static final String LER = "hasAuthority('PERM_FINANCEIRO_LER')";
    private static final String ALTERAR = LER + " and hasAuthority('PERM_FINANCEIRO_ALTERAR')";

    private final PlanoComercialService planos;

    public PlanoComercialController(PlanoComercialService planos) {
        this.planos = planos;
    }

    @PreAuthorize(LER)
    @GetMapping("/financeiro/planos")
    public List<PlanoResponse> listar(@RequestParam(defaultValue = "false") boolean arquivados) {
        return planos.listar(arquivados);
    }

    @PreAuthorize(ALTERAR)
    @PostMapping("/financeiro/planos")
    public PlanoResponse criar(@Valid @RequestBody PlanoRequest r) {
        return planos.criar(r);
    }

    @PreAuthorize(ALTERAR)
    @PutMapping("/financeiro/planos/{id}")
    public PlanoResponse alterar(@PathVariable UUID id, @Valid @RequestBody PlanoRequest r) {
        return planos.alterar(id, r);
    }

    @PreAuthorize(ALTERAR)
    @PostMapping("/financeiro/planos/{id}/arquivar")
    public PlanoResponse arquivar(@PathVariable UUID id, @Valid @RequestBody VersaoRequest r) {
        return planos.arquivar(id, r.versao());
    }
}
