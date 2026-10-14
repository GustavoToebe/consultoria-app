package br.com.treinos.api.painel;

import br.com.treinos.api.painel.PainelService.PainelTreinador;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class PainelTreinadorController {

    private final PainelService painel;

    public PainelTreinadorController(PainelService painel) {
        this.painel = painel;
    }

    @PreAuthorize("hasAuthority('PERM_PAINEL_VER')")
    @GetMapping("/painel")
    public PainelTreinador painel(@org.springframework.web.bind.annotation.RequestParam(defaultValue="false") boolean meus,
                                  @org.springframework.web.bind.annotation.RequestParam(defaultValue="7") int dias) {
        return painel.painel(meus, dias);
    }
}
