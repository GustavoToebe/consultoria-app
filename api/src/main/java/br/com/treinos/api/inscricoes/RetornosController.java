package br.com.treinos.api.inscricoes;

import br.com.treinos.api.inscricoes.InscricaoDtos.InscricaoDetalhe;
import br.com.treinos.api.inscricoes.InscricaoDtos.RetornoPendente;
import br.com.treinos.api.inscricoes.InscricaoDtos.RetornoRequest;
import br.com.treinos.api.inscricoes.InscricaoDtos.VersaoRequest;
import br.com.treinos.api.security.UsuarioAutenticado;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/** Retornos (próxima ação) das inscrições. Ler com {@code INSCRICAO_LER}; marcar, reagendar e concluir com {@code INSCRICAO_ALTERAR}. */
@RestController
@RequestMapping("/inscricoes")
public class RetornosController {

    private final RetornosService retornos;

    public RetornosController(RetornosService retornos) {
        this.retornos = retornos;
    }

    @PreAuthorize("hasAuthority('PERM_INSCRICAO_LER')")
    @GetMapping("/retornos")
    public List<RetornoPendente> pendentes(@AuthenticationPrincipal UsuarioAutenticado eu,
                                           @RequestParam(defaultValue = "false") boolean meus) {
        return retornos.pendentes(meus ? eu.usuarioId() : null);
    }

    @PreAuthorize("hasAuthority('PERM_INSCRICAO_ALTERAR')")
    @PostMapping("/{id}/retornos")
    public InscricaoDetalhe marcar(@AuthenticationPrincipal UsuarioAutenticado eu, @PathVariable UUID id,
                                   @RequestBody @Valid RetornoRequest request) {
        return retornos.marcar(id, request, eu.usuarioId());
    }

    @PreAuthorize("hasAuthority('PERM_INSCRICAO_ALTERAR')")
    @PutMapping("/retornos/{retornoId}")
    public InscricaoDetalhe alterar(@AuthenticationPrincipal UsuarioAutenticado eu, @PathVariable UUID retornoId,
                                    @RequestBody @Valid RetornoRequest request) {
        return retornos.alterar(retornoId, request, eu.usuarioId());
    }

    @PreAuthorize("hasAuthority('PERM_INSCRICAO_ALTERAR')")
    @PostMapping("/retornos/{retornoId}/concluir")
    public InscricaoDetalhe concluir(@AuthenticationPrincipal UsuarioAutenticado eu, @PathVariable UUID retornoId,
                                     @RequestBody @Valid VersaoRequest request) {
        return retornos.concluir(retornoId, request.versao(), eu.usuarioId());
    }
}
