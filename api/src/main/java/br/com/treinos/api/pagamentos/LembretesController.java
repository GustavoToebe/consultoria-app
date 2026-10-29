package br.com.treinos.api.pagamentos;

import br.com.treinos.api.pagamentos.PagamentosDtos.LembretesDaCobranca;
import br.com.treinos.api.pagamentos.PagamentosDtos.LembretesRequest;
import br.com.treinos.api.pagamentos.PagamentosDtos.LembretesResponse;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * Lembretes de cobrança por e-mail: ler a configuração com {@code FINANCEIRO_LER}, mudar com {@code FINANCEIRO_ALTERAR}. Os
 * lembretes de uma cobrança e a mensagem do WhatsApp mostram o aluno (o telefone), então pedem também {@code ALUNO_LER}, como
 * as listas de cobrança.
 */
@RestController
@ExigePagamentos
public class LembretesController {

    private static final String LER = "hasAuthority('PERM_FINANCEIRO_LER')";
    private static final String ALTERAR = LER + " and hasAuthority('PERM_FINANCEIRO_ALTERAR')";
    private static final String LER_DA_COBRANCA = LER + " and hasAuthority('PERM_ALUNO_LER')";

    private final LembretesService lembretes;

    public LembretesController(LembretesService lembretes) {
        this.lembretes = lembretes;
    }

    @PreAuthorize(LER)
    @GetMapping("/financeiro/lembretes")
    public LembretesResponse obter() {
        return lembretes.obter();
    }

    @PreAuthorize(ALTERAR)
    @PutMapping("/financeiro/lembretes")
    public LembretesResponse salvar(@Valid @RequestBody LembretesRequest r) {
        return lembretes.salvar(r);
    }

    @PreAuthorize(LER_DA_COBRANCA)
    @GetMapping("/cobrancas/{id}/lembretes")
    public LembretesDaCobranca daCobranca(@PathVariable UUID id) {
        return lembretes.daCobranca(id);
    }
}
