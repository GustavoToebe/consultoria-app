package br.com.treinos.api.pagamentos;

import br.com.treinos.api.pagamentos.PagamentosDtos.AcordoDesfeito;
import br.com.treinos.api.pagamentos.PagamentosDtos.DesfazerAcordoRequest;
import br.com.treinos.api.pagamentos.PagamentosDtos.PreviaDaRenegociacao;
import br.com.treinos.api.pagamentos.PagamentosDtos.PreviaDaRenegociacaoRequest;
import br.com.treinos.api.pagamentos.PagamentosDtos.RenegociacaoResponse;
import br.com.treinos.api.pagamentos.PagamentosDtos.RenegociarRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * Renegociar cobranças (D14): prévia, confirmar e desfazer, todos com {@code FINANCEIRO_ALTERAR} (mais as de leitura, como o resto das
 * cobranças, porque a tela mostra aluno). O valor do acordo é a terceira exceção à regra do valor do servidor; ver
 * {@link RenegociacaoService}. O corpo não usa Bean Validation: tudo é conferido no serviço, em 422 por campo sem repetir valor.
 */
@RestController
@ExigePagamentos
public class RenegociacaoController {

    private static final String ALTERAR = "hasAuthority('PERM_FINANCEIRO_LER') and hasAuthority('PERM_ALUNO_LER') "
            + "and hasAuthority('PERM_FINANCEIRO_ALTERAR')";

    private final RenegociacaoService renegociacao;

    public RenegociacaoController(RenegociacaoService renegociacao) {
        this.renegociacao = renegociacao;
    }

    /** Só leitura, sem efeito nem auditoria: as mesmas conferências do confirmar (menos o pedido e o motivo) e a conta do servidor. */
    @PreAuthorize(ALTERAR)
    @PostMapping("/cobrancas/renegociar/previa")
    public PreviaDaRenegociacao previa(@RequestBody PreviaDaRenegociacaoRequest r) {
        return renegociacao.previa(r);
    }

    /** 201 na primeira vez; o mesmo {@code pedidoId} de novo devolve o corpo de antes em 200, sem gravar. */
    @PreAuthorize(ALTERAR)
    @PostMapping("/cobrancas/renegociar")
    public ResponseEntity<RenegociacaoResponse> confirmar(@RequestBody RenegociarRequest r) {
        var resultado = renegociacao.confirmar(r);
        return ResponseEntity.status(resultado.repetido() ? HttpStatus.OK : HttpStatus.CREATED).body(resultado.resposta());
    }

    @PreAuthorize(ALTERAR)
    @PostMapping("/cobrancas/acordos/{acordoId}/desfazer")
    public AcordoDesfeito desfazer(@PathVariable UUID acordoId, @RequestBody DesfazerAcordoRequest r) {
        return renegociacao.desfazer(acordoId, r);
    }
}
