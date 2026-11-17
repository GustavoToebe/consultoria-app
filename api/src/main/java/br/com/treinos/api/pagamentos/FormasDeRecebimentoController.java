package br.com.treinos.api.pagamentos;

import br.com.treinos.api.pagamentos.FormasDeRecebimentoDtos.FormasDeRecebimentoRequest;
import br.com.treinos.api.pagamentos.FormasDeRecebimentoDtos.FormasDeRecebimentoResponse;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * Formas de recebimento da consultoria: ler com {@code FINANCEIRO_LER} e {@code ALUNO_LER} (como as listas do financeiro),
 * gravar com {@code FINANCEIRO_ALTERAR}. A chave Pix nunca volta na resposta.
 */
@RestController
@ExigePagamentos
public class FormasDeRecebimentoController {

    private static final String LER = "hasAuthority('PERM_FINANCEIRO_LER') and hasAuthority('PERM_ALUNO_LER')";
    private static final String ALTERAR = LER + " and hasAuthority('PERM_FINANCEIRO_ALTERAR')";

    private final FormasDeRecebimentoService formas;

    public FormasDeRecebimentoController(FormasDeRecebimentoService formas) {
        this.formas = formas;
    }

    @PreAuthorize(LER)
    @GetMapping("/financeiro/formas-de-recebimento")
    public FormasDeRecebimentoResponse obter() {
        return formas.obter();
    }

    @PreAuthorize(ALTERAR)
    @PutMapping("/financeiro/formas-de-recebimento")
    public FormasDeRecebimentoResponse salvar(@Valid @RequestBody FormasDeRecebimentoRequest r) {
        return formas.salvar(r);
    }
}
