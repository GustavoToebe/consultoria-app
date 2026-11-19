package br.com.treinos.api.pagamentos;

import br.com.treinos.api.pagamentos.KiwifyDtos.KiwifyRequest;
import br.com.treinos.api.pagamentos.KiwifyDtos.KiwifyResponse;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Credencial da Kiwify do treinador: ler com {@code FINANCEIRO_LER}, configurar e remover com {@code FINANCEIRO_ALTERAR}. Os
 * segredos nunca voltam; a resposta traz {@code no-store} porque a URL do webhook carrega o token da consultoria.
 */
@RestController
@ExigePagamentos
@ExigeKiwify
public class KiwifyController {

    private static final String LER = "hasAuthority('PERM_FINANCEIRO_LER')";
    private static final String ALTERAR = LER + " and hasAuthority('PERM_FINANCEIRO_ALTERAR')";

    private final KiwifyConfiguracaoService kiwify;

    public KiwifyController(KiwifyConfiguracaoService kiwify) {
        this.kiwify = kiwify;
    }

    @PreAuthorize(LER)
    @GetMapping("/financeiro/kiwify")
    public ResponseEntity<KiwifyResponse> obter() {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(kiwify.obter());
    }

    @PreAuthorize(ALTERAR)
    @PutMapping("/financeiro/kiwify")
    public ResponseEntity<KiwifyResponse> salvar(@RequestBody KiwifyRequest r) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(kiwify.salvar(r));
    }

    @PreAuthorize(ALTERAR)
    @DeleteMapping("/financeiro/kiwify")
    public ResponseEntity<Void> remover(@RequestParam(required = false) Long versao) {
        kiwify.remover(versao);
        return ResponseEntity.status(HttpStatus.NO_CONTENT).cacheControl(CacheControl.noStore()).build();
    }
}
