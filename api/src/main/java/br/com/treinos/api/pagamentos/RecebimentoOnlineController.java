package br.com.treinos.api.pagamentos;

import br.com.treinos.api.pagamentos.PagamentosDtos.RecebimentoOnlineRequest;
import br.com.treinos.api.pagamentos.PagamentosDtos.RecebimentoOnlineResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Recebimento online do treinador: ler com {@code FINANCEIRO_LER}, configurar e remover com {@code FINANCEIRO_ALTERAR}.
 * A chave nunca volta.
 */
@RestController
@ExigePagamentos
@ExigeInfinitePay
public class RecebimentoOnlineController {

    private static final String LER = "hasAuthority('PERM_FINANCEIRO_LER')";
    private static final String ALTERAR = LER + " and hasAuthority('PERM_FINANCEIRO_ALTERAR')";

    private final RecebimentoOnlineService recebimento;

    public RecebimentoOnlineController(RecebimentoOnlineService recebimento) {
        this.recebimento = recebimento;
    }

    @PreAuthorize(LER)
    @GetMapping("/financeiro/recebimento-online")
    public RecebimentoOnlineResponse obter() {
        return recebimento.obter();
    }

    @PreAuthorize(ALTERAR)
    @PutMapping("/financeiro/recebimento-online")
    public RecebimentoOnlineResponse salvar(@Valid @RequestBody RecebimentoOnlineRequest r) {
        return recebimento.salvar(r);
    }

    @PreAuthorize(ALTERAR)
    @DeleteMapping("/financeiro/recebimento-online")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remover(@RequestParam(required = false) Long versao) {
        recebimento.remover(versao);
    }
}
