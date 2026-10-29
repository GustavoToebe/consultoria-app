package br.com.treinos.api.avaliacoes;

import br.com.treinos.api.avaliacoes.AvaliacaoFisicaDtos.AvaliacaoResponse;
import br.com.treinos.api.execucao.AlunoAppService;
import br.com.treinos.api.security.UsuarioAutenticado;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** As avaliações físicas do próprio aluno, só leitura (sempre o aluno da sessão; nunca id no caminho). */
@RestController
public class AvaliacaoFisicaAlunoController {

    private final AvaliacaoFisicaService avaliacoes;

    public AvaliacaoFisicaAlunoController(AvaliacaoFisicaService avaliacoes) {
        this.avaliacoes = avaliacoes;
    }

    @PreAuthorize("hasRole('ALUNO')")
    @GetMapping("/aluno/avaliacoes-fisicas")
    public List<AvaliacaoResponse> minhas(@AuthenticationPrincipal UsuarioAutenticado eu) {
        return avaliacoes.listar(AlunoAppService.alunoDaSessao(eu));
    }
}
