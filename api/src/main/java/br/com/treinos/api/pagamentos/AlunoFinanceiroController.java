package br.com.treinos.api.pagamentos;

import br.com.treinos.api.execucao.AlunoAppService;
import br.com.treinos.api.pagamentos.PagamentosDtos.FinanceiroDoAluno;
import br.com.treinos.api.pagamentos.PagamentosDtos.LembretesDoAlunoRequest;
import br.com.treinos.api.pagamentos.PagamentosDtos.LembretesDoAlunoResponse;
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
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * O plano comercial e as cobranças do próprio aluno: sempre o da sessão, nunca um id do cliente. As escritas são pedir o
 * link de pagamento de uma cobrança dele, avisar que voltou do checkout e ligar ou desligar, só para ele, os lembretes de
 * cobrança por e-mail; a anotação da InfinitePay fica na rota, não no
 * controller, para a leitura seguir funcionando com ela desligada.
 */
@RestController
@ExigePagamentos
public class AlunoFinanceiroController {

    private final AlunoFinanceiroService financeiro;
    private final LinkDePagamentoService links;
    private final AvisoInfinitePayService avisos;
    private final LembretesService lembretes;

    public AlunoFinanceiroController(AlunoFinanceiroService financeiro, LinkDePagamentoService links,
                                     AvisoInfinitePayService avisos, LembretesService lembretes) {
        this.financeiro = financeiro;
        this.links = links;
        this.avisos = avisos;
        this.lembretes = lembretes;
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

    /** Se o aluno recebe os lembretes de cobrança por e-mail (sempre o da sessão). */
    @PreAuthorize("hasRole('ALUNO')")
    @GetMapping("/aluno/lembretes-de-cobranca")
    public ResponseEntity<LembretesDoAlunoResponse> lembretes(@AuthenticationPrincipal UsuarioAutenticado eu) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(lembretes.doAluno(eu));
    }

    /** O aluno liga ou desliga os lembretes só para ele; o corpo nunca leva id. */
    @PreAuthorize("hasRole('ALUNO')")
    @PutMapping("/aluno/lembretes-de-cobranca")
    public ResponseEntity<LembretesDoAlunoResponse> definirLembretes(@Valid @RequestBody LembretesDoAlunoRequest r,
                                                                     @AuthenticationPrincipal UsuarioAutenticado eu) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(lembretes.definirDoAluno(eu, r.receber()));
    }
}
