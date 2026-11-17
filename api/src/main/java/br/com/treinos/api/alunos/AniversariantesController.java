package br.com.treinos.api.alunos;

import br.com.treinos.api.alunos.AniversariantesService.Aniversariante;
import br.com.treinos.api.security.UsuarioAutenticado;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Aniversariantes dos próximos 0, 3, 7 ou 15 dias, só nome, dia e mês (plano {@code docs/planos/aniversarios.md}). */
@RestController
public class AniversariantesController {

    private final AniversariantesService aniversariantes;

    public AniversariantesController(AniversariantesService aniversariantes) {
        this.aniversariantes = aniversariantes;
    }

    /** {@code dias} obrigatório (0, 3, 7 ou 15, senão 400); {@code meus=true} só os alunos do responsável autenticado. */
    @PreAuthorize("hasAuthority('PERM_ALUNO_LER')")
    @GetMapping("/alunos/aniversariantes")
    public List<Aniversariante> listar(@AuthenticationPrincipal UsuarioAutenticado eu, @RequestParam int dias,
                                       @RequestParam(defaultValue = "false") boolean meus) {
        return aniversariantes.proximos(dias, meus ? eu.usuarioId() : null);
    }
}
