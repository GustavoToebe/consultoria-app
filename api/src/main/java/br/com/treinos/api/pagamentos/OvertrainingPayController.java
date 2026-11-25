package br.com.treinos.api.pagamentos;

import br.com.treinos.api.pagamentos.OvertrainingPayDtos.CobrancaTesteResposta;
import br.com.treinos.api.pagamentos.OvertrainingPayDtos.OvertrainingPayResposta;
import br.com.treinos.api.pagamentos.OvertrainingPayDtos.SalvarOvertrainingPayRequest;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Rotas de onboarding, homologação e configuração do Overtraining Pay (Asaas) da consultoria.
 */
@RestController
@ExigePagamentos
@ExigeAsaas
public class OvertrainingPayController {

    private static final String LER = "hasAuthority('PERM_FINANCEIRO_LER')";
    private static final String ALTERAR = "hasAuthority('PERM_FINANCEIRO_ALTERAR')";

    private final OvertrainingPayService service;

    public OvertrainingPayController(OvertrainingPayService service) {
        this.service = service;
    }

    @PreAuthorize(LER)
    @GetMapping("/financeiro/overtraining-pay")
    public ResponseEntity<OvertrainingPayResposta> obter() {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.obter());
    }

    @PreAuthorize(ALTERAR)
    @PutMapping("/financeiro/overtraining-pay")
    public ResponseEntity<OvertrainingPayResposta> salvar(@RequestBody SalvarOvertrainingPayRequest r) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.salvar(r));
    }

    @PreAuthorize(ALTERAR)
    @PostMapping("/financeiro/overtraining-pay/sincronizar-status")
    public ResponseEntity<OvertrainingPayResposta> sincronizarStatus() {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.sincronizarStatus());
    }

    @PreAuthorize(ALTERAR)
    @PostMapping("/financeiro/overtraining-pay/cobranca-teste")
    public ResponseEntity<CobrancaTesteResposta> gerarCobrancaTeste() {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.gerarCobrancaTeste());
    }

    @PreAuthorize(LER)
    @GetMapping("/financeiro/overtraining-pay/cobranca-teste/{id}")
    public ResponseEntity<CobrancaTesteResposta> consultarCobrancaTeste(@PathVariable String id) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.consultarCobrancaTeste(id));
    }

    @PreAuthorize(ALTERAR)
    @DeleteMapping("/financeiro/overtraining-pay")
    public ResponseEntity<Void> remover(@RequestParam(required = false) Long versao) {
        service.remover(versao);
        return ResponseEntity.status(HttpStatus.NO_CONTENT).cacheControl(CacheControl.noStore()).build();
    }
}
