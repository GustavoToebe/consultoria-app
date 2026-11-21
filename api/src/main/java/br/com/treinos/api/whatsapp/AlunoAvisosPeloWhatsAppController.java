package br.com.treinos.api.whatsapp;

import br.com.treinos.api.security.UsuarioAutenticado;
import br.com.treinos.api.whatsapp.WhatsAppDtos.AvisosDoAlunoRequest;
import br.com.treinos.api.whatsapp.WhatsAppDtos.AvisosDoAlunoResponse;
import jakarta.validation.Valid;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/** O aluno liga ou desliga, só para ele, os avisos pelo WhatsApp da consultoria (sempre o da sessão; o corpo nunca leva id). */
@RestController
@ExigeWhatsApp
public class AlunoAvisosPeloWhatsAppController {

    private final AvisosDoAlunoService avisos;

    public AlunoAvisosPeloWhatsAppController(AvisosDoAlunoService avisos) {
        this.avisos = avisos;
    }

    @PreAuthorize("hasRole('ALUNO')")
    @GetMapping("/aluno/avisos-pelo-whatsapp")
    public ResponseEntity<AvisosDoAlunoResponse> meu(@AuthenticationPrincipal UsuarioAutenticado eu) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(avisos.doAluno(eu));
    }

    @PreAuthorize("hasRole('ALUNO')")
    @PutMapping("/aluno/avisos-pelo-whatsapp")
    public ResponseEntity<AvisosDoAlunoResponse> definir(@Valid @RequestBody AvisosDoAlunoRequest r,
                                                         @AuthenticationPrincipal UsuarioAutenticado eu) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(avisos.definir(eu, r.receber()));
    }
}
