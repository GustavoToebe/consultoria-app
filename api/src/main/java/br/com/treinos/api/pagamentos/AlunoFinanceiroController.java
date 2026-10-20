package br.com.treinos.api.pagamentos;

import br.com.treinos.api.pagamentos.PagamentosDtos.FinanceiroDoAluno;
import br.com.treinos.api.security.UsuarioAutenticado;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** O plano comercial e as cobranças do próprio aluno: sempre o da sessão, nunca um id do cliente. Só leitura, sem "pagar". */
@RestController
@ExigePagamentos
public class AlunoFinanceiroController {

    private final AlunoFinanceiroService financeiro;

    public AlunoFinanceiroController(AlunoFinanceiroService financeiro) {
        this.financeiro = financeiro;
    }

    @PreAuthorize("hasRole('ALUNO')")
    @GetMapping("/aluno/financeiro")
    public ResponseEntity<FinanceiroDoAluno> meu(@AuthenticationPrincipal UsuarioAutenticado eu) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(financeiro.meu(eu));
    }
}
