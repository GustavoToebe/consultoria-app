package br.com.treinos.api.pagamentos;

import br.com.treinos.api.execucao.AlunoAppService;
import br.com.treinos.api.pagamentos.CheckoutTransparenteAsaasDtos.CartaoAlunoResponse;
import br.com.treinos.api.pagamentos.CheckoutTransparenteAsaasDtos.GerarPixAlunoRequest;
import br.com.treinos.api.pagamentos.CheckoutTransparenteAsaasDtos.PagarCartaoAlunoRequest;
import br.com.treinos.api.pagamentos.CheckoutTransparenteAsaasDtos.PixAlunoResponse;
import br.com.treinos.api.pagamentos.CheckoutTransparenteAsaasDtos.SituacaoCobrancaAlunoResponse;
import br.com.treinos.api.pagamentos.FormasDeRecebimentoDtos.CodigoPix;
import br.com.treinos.api.pagamentos.PagamentosDtos.ContratacaoResponse;
import br.com.treinos.api.pagamentos.PagamentosDtos.FinanceiroDoAluno;
import br.com.treinos.api.pagamentos.PagamentosDtos.LembretesDoAlunoRequest;
import br.com.treinos.api.pagamentos.PagamentosDtos.LembretesDoAlunoResponse;
import br.com.treinos.api.pagamentos.PagamentosDtos.LinkDePagamento;
import br.com.treinos.api.pagamentos.PagamentosDtos.RetornoDoPagamentoRequest;
import br.com.treinos.api.security.UsuarioAutenticado;
import jakarta.servlet.http.HttpServletRequest;
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
    private final CheckoutTransparenteAsaasService checkoutAsaas;

    public AlunoFinanceiroController(AlunoFinanceiroService financeiro, LinkDePagamentoService links,
                                     AvisoInfinitePayService avisos, LembretesService lembretes,
                                     CheckoutTransparenteAsaasService checkoutAsaas) {
        this.financeiro = financeiro;
        this.links = links;
        this.avisos = avisos;
        this.lembretes = lembretes;
        this.checkoutAsaas = checkoutAsaas;
    }

    @PreAuthorize("hasRole('ALUNO')")
    @GetMapping("/aluno/financeiro")
    public ResponseEntity<FinanceiroDoAluno> meu(@AuthenticationPrincipal UsuarioAutenticado eu) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(financeiro.meu(eu));
    }

    @PreAuthorize("hasRole('ALUNO')")
    @GetMapping({"/eu/contratacao", "/aluno/contratacao"})
    public ResponseEntity<ContratacaoResponse> minhaContratacao(@AuthenticationPrincipal UsuarioAutenticado eu) {
        return financeiro.minhaContratacao(eu)
                .map(c -> ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(c))
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @ExigeInfinitePay
    @PreAuthorize("hasRole('ALUNO')")
    @PostMapping("/aluno/financeiro/cobrancas/{id}/link")
    public ResponseEntity<LinkDePagamento> link(@PathVariable UUID id, @AuthenticationPrincipal UsuarioAutenticado eu) {
        String url = links.gerarDoAluno(id, AlunoAppService.alunoDaSessao(eu));
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(new LinkDePagamento(url));
    }

    /** O Pix copia e cola da cobrança aberta do aluno; o valor é sempre o da cobrança e o código nunca fica em cache nem em log. */
    @PreAuthorize("hasRole('ALUNO')")
    @PostMapping("/aluno/financeiro/cobrancas/{id}/pix")
    public ResponseEntity<CodigoPix> pix(@PathVariable UUID id, @AuthenticationPrincipal UsuarioAutenticado eu) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(new CodigoPix(financeiro.codigoPix(eu, id)));
    }

    /** Checkout Transparente (Overtraining Pay / Asaas): gera QR Code e copia e cola Pix para a cobrança aberta do aluno. */
    @ExigeAsaas
    @PreAuthorize("hasRole('ALUNO')")
    @PostMapping("/aluno/financeiro/cobrancas/{id}/overtraining-pay/pix")
    public ResponseEntity<PixAlunoResponse> overtrainingPayPix(@PathVariable UUID id,
                                                               @RequestBody(required = false) GerarPixAlunoRequest r,
                                                               @AuthenticationPrincipal UsuarioAutenticado eu) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(checkoutAsaas.gerarPix(eu, id, r));
    }

    /** Checkout Transparente (Overtraining Pay / Asaas): processa cartão de crédito (1..12x) sem persistir PAN/CVV. */
    @ExigeAsaas
    @PreAuthorize("hasRole('ALUNO')")
    @PostMapping("/aluno/financeiro/cobrancas/{id}/overtraining-pay/cartao")
    public ResponseEntity<CartaoAlunoResponse> overtrainingPayCartao(@PathVariable UUID id,
                                                                     @Valid @RequestBody PagarCartaoAlunoRequest r,
                                                                     @AuthenticationPrincipal UsuarioAutenticado eu,
                                                                     HttpServletRequest http) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(checkoutAsaas.pagarCartao(eu, id, r, http.getRemoteAddr()));
    }

    /** Consulta a situação atual de uma cobrança do próprio aluno (polling após Pix/Cartão). */
    @PreAuthorize("hasRole('ALUNO')")
    @GetMapping("/aluno/financeiro/cobrancas/{id}/situacao")
    public ResponseEntity<SituacaoCobrancaAlunoResponse> situacaoCobranca(@PathVariable UUID id,
                                                                          @AuthenticationPrincipal UsuarioAutenticado eu) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(checkoutAsaas.consultarSituacao(eu, id));
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
