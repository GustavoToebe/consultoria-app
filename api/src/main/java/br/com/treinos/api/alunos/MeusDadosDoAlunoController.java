package br.com.treinos.api.alunos;

import br.com.treinos.api.alunos.dto.MeusDadosRequest;
import br.com.treinos.api.alunos.dto.MeusDadosResponse;
import br.com.treinos.api.security.UsuarioAutenticado;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/** "Meus dados": só o cadastro do próprio aluno, sempre o da sessão (nunca id no caminho nem no corpo). */
@RestController
public class MeusDadosDoAlunoController {

    private final MeusDadosDoAlunoService meusDados;

    public MeusDadosDoAlunoController(MeusDadosDoAlunoService meusDados) {
        this.meusDados = meusDados;
    }

    @PreAuthorize("hasRole('ALUNO')")
    @GetMapping("/aluno/meus-dados")
    public MeusDadosResponse ler(@AuthenticationPrincipal UsuarioAutenticado eu) {
        return meusDados.ler(eu);
    }

    @PreAuthorize("hasRole('ALUNO')")
    @PutMapping("/aluno/meus-dados")
    public MeusDadosResponse alterar(@AuthenticationPrincipal UsuarioAutenticado eu, @RequestBody @Valid MeusDadosRequest pedido) {
        return meusDados.alterar(eu, pedido);
    }
}
