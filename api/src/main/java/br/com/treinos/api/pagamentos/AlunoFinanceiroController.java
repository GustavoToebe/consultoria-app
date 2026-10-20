package br.com.treinos.api.pagamentos;

import br.com.treinos.api.execucao.AlunoAppService;
import br.com.treinos.api.pagamentos.PagamentosDtos.FinanceiroDoAluno;
import br.com.treinos.api.pagamentos.PagamentosDtos.LinkDePagamento;
import br.com.treinos.api.pagamentos.PagamentosDtos.RetornoDoPagamentoRequest;
import br.com.treinos.api.security.UsuarioAutenticado;
import jakarta.validation.Valid;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * O plano comercial e as cobranças do próprio aluno: sempre o da sessão, nunca um id do cliente. As escritas são pedir o
 * link de pagamento de uma cobrança dele e avisar que voltou do checkout; a anotação da InfinitePay fica na rota, não no
 * controller, para a leitura seguir funcionando com ela desligada.
 */
@RestController
@ExigePagamentos
public class AlunoFinanceiroController {

    private final AlunoFinanceiroService financeiro;
    private final LinkDePagamentoService links;
    private final AvisoInfinitePayService avisos;

    public AlunoFinanceiroController(AlunoFinanceiroService financeiro, LinkDePagamentoService links,
                                     AvisoInfinitePayService avisos) {
        this.financeiro = financeiro;
        this.links = links;
        this.avisos = avisos;
    }

    @PreAuthorize("hasRole('ALUNO')")
    @GetMapping("/aluno/financeiro")
    public ResponseEntity<FinanceiroDoAluno> meu(@AuthenticationPrincipal UsuarioAutenticado eu) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(financeiro.meu(eu));
    }

    @ExigeInfinitePay
    @PreAuthorize("hasRole('ALUNO')")
    @PostMapping("/aluno/financeiro/cobrancas/{id}/link")
    public ResponseEntity<LinkDePagamento> link(@PathVariable UUID id, @AuthenticationPrincipal UsuarioAutenticado eu) {
        String url = links.gerarDoAluno(id, AlunoAppService.alunoDaSessao(eu));
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(new LinkDePagamento(url));
    }

    /** O retorno do checkout entra na caixa de entrada dos avisos; a baixa, se houver, vem depois, da consulta ao provedor. */
    @ExigeInfinitePay
    @PreAuthorize("hasRole('ALUNO')")
    @PostMapping("/aluno/financeiro/retorno-pagamento")
    public ResponseEntity<Void> retorno(@Valid @RequestBody RetornoDoPagamentoRequest r,
                                        @AuthenticationPrincipal UsuarioAutenticado eu) {
        avisos.registrarRetorno(AlunoAppService.alunoDaSessao(eu), r);
        return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
    }
}
