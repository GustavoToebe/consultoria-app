package br.com.treinos.api.agua;

import br.com.treinos.api.agua.AguaDoDiaDtos.AguaRegistrada;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Água que um aluno marcou, vista pela equipe. Dado de dieta: exige também a permissão sensível. Outra consultoria = 404. */
@RestController
@RequestMapping("/alunos/{alunoId}/agua")
public class AguaTreinadorController {

    private final AguaDoDiaService agua;

    public AguaTreinadorController(AguaDoDiaService agua) {
        this.agua = agua;
    }

    @PreAuthorize("hasAuthority('PERM_REGISTRO_LER') and hasAuthority('PERM_ALUNO_SENSIVEL_LER')")
    @GetMapping
    public List<AguaRegistrada> registros(@PathVariable UUID alunoId,
                                          @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate de,
                                          @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate ate) {
        return agua.doAluno(alunoId, de, ate);
    }
}
