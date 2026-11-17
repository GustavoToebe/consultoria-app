package br.com.treinos.api.inscricoes;

import br.com.treinos.api.inscricoes.IndicacaoDoAlunoService.Indicacao;
import br.com.treinos.api.security.UsuarioAutenticado;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Link de indicação do próprio aluno, sempre o da sessão (nunca id no caminho nem no corpo). */
@RestController
public class IndicacaoDoAlunoController {

    private final IndicacaoDoAlunoService indicacao;

    public IndicacaoDoAlunoController(IndicacaoDoAlunoService indicacao) {
        this.indicacao = indicacao;
    }

    @PreAuthorize("hasRole('ALUNO')")
    @GetMapping("/aluno/indicacao")
    public Indicacao ler(@AuthenticationPrincipal UsuarioAutenticado eu) {
        return indicacao.link(eu);
    }
}
