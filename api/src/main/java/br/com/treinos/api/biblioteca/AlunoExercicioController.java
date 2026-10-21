package br.com.treinos.api.biblioteca;

import br.com.treinos.api.biblioteca.DemonstracaoDoAlunoService.Demonstracao;
import br.com.treinos.api.execucao.AlunoAppService;
import br.com.treinos.api.security.UsuarioAutenticado;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/** Demonstração dos exercícios do plano do aluno (hasRole ALUNO, sempre o aluno da sessão). */
@RestController
@RequestMapping("/aluno/exercicios")
public class AlunoExercicioController {

    private final DemonstracaoDoAlunoService demonstracoes;

    public AlunoExercicioController(DemonstracaoDoAlunoService demonstracoes) {
        this.demonstracoes = demonstracoes;
    }

    @PreAuthorize("hasRole('ALUNO')")
    @GetMapping("/demonstracoes")
    public List<Demonstracao> demonstracoes(@AuthenticationPrincipal UsuarioAutenticado eu) {
        return demonstracoes.doAluno(AlunoAppService.alunoDaSessao(eu));
    }

    @PreAuthorize("hasRole('ALUNO')")
    @GetMapping("/{id}/imagem")
    public ResponseEntity<byte[]> imagem(@AuthenticationPrincipal UsuarioAutenticado eu, @PathVariable UUID id) {
        return demonstracoes.imagem(AlunoAppService.alunoDaSessao(eu), id).resposta();
    }
}
