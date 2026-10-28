package br.com.treinos.api.agenda;

import br.com.treinos.api.agenda.AgendaDtos.CompromissoDoAluno;
import br.com.treinos.api.execucao.AlunoAppService;
import br.com.treinos.api.security.UsuarioAutenticado;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Os próximos compromissos do aluno da sessão, só leitura (o aluno não marca nem escolhe horário). */
@RestController
public class AlunoCompromissosController {

    private final AgendaService agenda;

    public AlunoCompromissosController(AgendaService agenda) {
        this.agenda = agenda;
    }

    @PreAuthorize("hasRole('ALUNO')")
    @GetMapping("/aluno/compromissos")
    public List<CompromissoDoAluno> proximos(@AuthenticationPrincipal UsuarioAutenticado eu) {
        return agenda.doAluno(AlunoAppService.alunoDaSessao(eu));
    }
}
