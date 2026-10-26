package br.com.treinos.api.ciclo;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/** Leitura do treinador. Desligado ou sexo diferente de feminino não devolve o histórico. */
@RestController
public class CicloTreinadorController {

    private final CicloMenstrualService ciclo;

    public CicloTreinadorController(CicloMenstrualService ciclo) {
        this.ciclo = ciclo;
    }

    @PreAuthorize("hasAuthority('PERM_ALUNO_LER') and hasAuthority('PERM_ALUNO_SENSIVEL_LER')")
    @GetMapping("/alunos/{id}/ciclo")
    public CicloDtos.CicloDoTreinador ler(@PathVariable UUID id) {
        return ciclo.doTreinador(id);
    }
}
