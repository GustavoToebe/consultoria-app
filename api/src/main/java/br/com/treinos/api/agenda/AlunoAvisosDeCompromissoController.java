package br.com.treinos.api.agenda;

import br.com.treinos.api.agenda.AgendaDtos.AvisoDeCompromisso;
import br.com.treinos.api.execucao.AlunoAppService;
import br.com.treinos.api.security.UsuarioAutenticado;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * Avisos de compromisso do aluno da sessão (D12): os não vistos e marcar como visto. O app monta o texto; aqui só vai
 * a estrutura. Sempre o aluno da sessão, nunca um id do cliente; resposta {@code no-store}.
 */
@RestController
public class AlunoAvisosDeCompromissoController {

    private final AvisosDeCompromissoService avisos;

    public AlunoAvisosDeCompromissoController(AvisosDeCompromissoService avisos) {
        this.avisos = avisos;
    }

    @PreAuthorize("hasRole('ALUNO')")
    @GetMapping("/aluno/avisos-de-compromisso")
    public ResponseEntity<List<AvisoDeCompromisso>> naoVistos(@AuthenticationPrincipal UsuarioAutenticado eu) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(avisos.naoVistos(AlunoAppService.alunoDaSessao(eu)));
    }

    @PreAuthorize("hasRole('ALUNO')")
    @PostMapping("/aluno/avisos-de-compromisso/{id}/visto")
    public ResponseEntity<Void> visto(@AuthenticationPrincipal UsuarioAutenticado eu, @PathVariable UUID id) {
        avisos.marcarVisto(AlunoAppService.alunoDaSessao(eu), id);
        return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
    }
}
