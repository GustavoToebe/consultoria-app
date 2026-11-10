package br.com.treinos.api.atividade;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/** Atividade recente da ficha do aluno. A rota exige {@code ALUNO_LER}; cada tipo de evento confere a própria permissão no serviço. */
@RestController
public class AtividadeRecenteController {
    private final AtividadeRecenteService atividade;

    public AtividadeRecenteController(AtividadeRecenteService atividade) {
        this.atividade = atividade;
    }

    /** {@code limite}: padrão 5, de 1 a 20 (fora disso o servidor corta, sem erro). */
    @PreAuthorize("hasAuthority('PERM_ALUNO_LER')")
    @GetMapping("/alunos/{alunoId}/atividade-recente")
    public AtividadeRecenteService.Resposta recente(@PathVariable UUID alunoId, @RequestParam(required = false) Integer limite) {
        return atividade.doAluno(alunoId, limite);
    }
}
