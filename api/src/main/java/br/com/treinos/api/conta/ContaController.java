package br.com.treinos.api.conta;

import br.com.treinos.api.conta.PagamentoTransparenteDto.CartaoAsaasResposta;
import br.com.treinos.api.conta.PagamentoTransparenteDto.GerarPixAsaasRequest;
import br.com.treinos.api.conta.PagamentoTransparenteDto.PagarCartaoAsaasRequest;
import br.com.treinos.api.conta.PagamentoTransparenteDto.PixAsaasResposta;
import br.com.treinos.api.conta.PagamentoTransparenteDto.SituacaoCobrancaResposta;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * Minha conta e consumo do plano, só com {@code CONTA_LER} (nos perfis padrão, o Administrador). Permite consultar a
 * conta, pagar via checkout transparente (Asaas Pix/Cartão), consultar a situação da cobrança ou pedir o link de
 * pagamento (contingência InfinitePay/Mercado Pago).
 */
@RestController
public class ContaController {

    private final ContaService service;

    public ContaController(ContaService service) {
        this.service = service;
    }

    @PreAuthorize("hasAuthority('PERM_CONTA_LER')")
    @GetMapping("/minha-conta")
    public MinhaContaResposta minhaConta() {
        return service.minhaConta();
    }

    @PreAuthorize("hasAuthority('PERM_CONTA_LER')")
    @GetMapping("/minha-conta/consumo")
    public ConsumoPlanoDto consumo() {
        return service.consumo();
    }

    @PreAuthorize("hasAuthority('PERM_CONTA_LER')")
    @PostMapping("/minha-conta/cobrancas/{id}/pagar")
    public ContaService.LinkDePagamento pagar(@PathVariable UUID id) {
        return service.linkDePagamento(id);
    }

    @PreAuthorize("hasAuthority('PERM_CONTA_LER')")
    @PostMapping("/minha-conta/cobrancas/{id}/asaas/pix")
    public PixAsaasResposta gerarPixAsaas(@PathVariable UUID id,
                                          @RequestBody(required = false) GerarPixAsaasRequest corpo) {
        return service.gerarPixAsaas(id, corpo);
    }

    @PreAuthorize("hasAuthority('PERM_CONTA_LER')")
    @PostMapping("/minha-conta/cobrancas/{id}/asaas/cartao")
    public CartaoAsaasResposta pagarCartaoAsaas(@PathVariable UUID id,
                                                @Valid @RequestBody PagarCartaoAsaasRequest corpo,
                                                HttpServletRequest http) {
        return service.pagarCartaoAsaas(id, corpo, http.getRemoteAddr());
    }

    @PreAuthorize("hasAuthority('PERM_CONTA_LER')")
    @GetMapping("/minha-conta/cobrancas/{id}/situacao")
    public SituacaoCobrancaResposta consultarSituacao(@PathVariable UUID id) {
        return service.consultarSituacaoCobranca(id);
    }
}
