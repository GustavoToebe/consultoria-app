package br.com.treinos.api.pagamentos;

import br.com.treinos.api.pagamentos.PagamentosDtos.Conferencias;
import br.com.treinos.api.security.UsuarioAutenticado;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/** Pagamentos online confirmados que ficaram para o treinador conferir. Nunca dá baixa. */
@RestController
@ExigePagamentos
@ExigeInfinitePay
public class ConferenciaController {

    private final ConferenciaService conferencias;

    public ConferenciaController(ConferenciaService conferencias) {
        this.conferencias = conferencias;
    }

    /** Traz o nome do aluno: por isso também {@code ALUNO_LER}. */
    @PreAuthorize("hasAuthority('PERM_FINANCEIRO_LER') and hasAuthority('PERM_ALUNO_LER')")
    @GetMapping("/financeiro/conferencias")
    public ResponseEntity<Conferencias> listar() {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(conferencias.listar());
    }

    @PreAuthorize("hasAuthority('PERM_FINANCEIRO_ALTERAR')")
    @PostMapping("/financeiro/conferencias/{id}/conferido")
    public ResponseEntity<Void> conferido(@PathVariable UUID id, @AuthenticationPrincipal UsuarioAutenticado eu) {
        conferencias.conferido(id, eu.usuarioId());
        return ResponseEntity.noContent().build();
    }
}
