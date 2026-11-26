package br.com.treinos.api.contratos;

import br.com.treinos.api.contratos.ContratoDtos.AssinarRequest;
import br.com.treinos.api.contratos.ContratoDtos.ContratoDoAlunoDetalhe;
import br.com.treinos.api.contratos.ContratoDtos.ContratoDoAlunoResumo;
import br.com.treinos.api.execucao.AlunoAppService;
import br.com.treinos.api.security.UsuarioAutenticado;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * Os contratos do próprio aluno (hasRole ALUNO, sempre o aluno da sessão; nunca id de aluno no caminho): lê os pendentes e os
 * assinados e assina com o aceite e as evidências (D2). O IP é o mesmo que o login e a auditoria usam.
 */
@RestController
@ExigeContratos
public class ContratoAlunoController {

    private final ContratoDoAlunoService contratos;

    public ContratoAlunoController(ContratoDoAlunoService contratos) {
        this.contratos = contratos;
    }

    @PreAuthorize("hasRole('ALUNO')")
    @GetMapping("/aluno/contratos")
    public List<ContratoDoAlunoResumo> listar(@AuthenticationPrincipal UsuarioAutenticado eu) {
        return contratos.listar(AlunoAppService.alunoDaSessao(eu));
    }

    @PreAuthorize("hasRole('ALUNO')")
    @GetMapping("/aluno/contratos/{id}")
    public ContratoDoAlunoDetalhe obter(@AuthenticationPrincipal UsuarioAutenticado eu, @PathVariable UUID id) {
        return contratos.obter(AlunoAppService.alunoDaSessao(eu), id);
    }

    @PreAuthorize("hasRole('ALUNO')")
    @PostMapping("/aluno/contratos/{id}/assinar")
    public ContratoDoAlunoDetalhe assinar(@AuthenticationPrincipal UsuarioAutenticado eu, @PathVariable UUID id,
                                          @RequestBody AssinarRequest r, HttpServletRequest http) {
        AlunoAppService.alunoDaSessao(eu);
        return contratos.assinar(eu, id, r, http.getRemoteAddr(), http.getHeader(HttpHeaders.USER_AGENT));
    }
}
