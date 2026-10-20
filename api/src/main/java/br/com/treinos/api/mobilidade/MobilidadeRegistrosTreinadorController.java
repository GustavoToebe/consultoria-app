package br.com.treinos.api.mobilidade;

import br.com.treinos.api.mobilidade.MobilidadeRegistroDtos.RegistroMobilidadeFeito;
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

/** Itens de mobilidade que um aluno marcou, vistos pelo treinador. Aluno de outra consultoria = 404. */
@RestController
@RequestMapping("/alunos/{alunoId}/mobilidade/registros")
public class MobilidadeRegistrosTreinadorController {

    private final MobilidadeRegistroService registros;

    public MobilidadeRegistrosTreinadorController(MobilidadeRegistroService registros) {
        this.registros = registros;
    }

    @PreAuthorize("hasAuthority('PERM_REGISTRO_LER')")
    @GetMapping
    public List<RegistroMobilidadeFeito> registros(@PathVariable UUID alunoId,
                                                   @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate de,
                                                   @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate ate) {
        return registros.doAluno(alunoId, de, ate);
    }
}
