package br.com.treinos.api.sessoesconcluidas;

import br.com.treinos.api.retorno.ExigeRetorno;
import br.com.treinos.api.sessoesconcluidas.SessaoConcluidaDtos.SessoesConcluidasResponse;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Sessões que um aluno concluiu, vistas pelo treinador. Aluno de outra consultoria = 404. O comentário do aluno é dado
 * sensível e vem nulo sem {@code ALUNO_SENSIVEL_LER}.
 */
@ExigeRetorno
@RestController
@RequestMapping("/alunos/{alunoId}/sessoes-concluidas")
public class SessoesConcluidasTreinadorController {

    private final SessaoConcluidaService sessoes;

    public SessoesConcluidasTreinadorController(SessaoConcluidaService sessoes) {
        this.sessoes = sessoes;
    }

    @PreAuthorize("hasAuthority('PERM_REGISTRO_LER')")
    @GetMapping
    public SessoesConcluidasResponse sessoes(@PathVariable UUID alunoId,
                                             @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate de,
                                             @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate ate) {
        return sessoes.doAluno(alunoId, de, ate);
    }
}
