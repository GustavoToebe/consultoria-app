package br.com.treinos.api.recordes;

import br.com.treinos.api.recordes.RecordesDaSemanaService.RecordesDaSemanaResponse;
import br.com.treinos.api.retorno.ExigeRetorno;
import br.com.treinos.api.security.UsuarioAutenticado;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * "Recordes da semana" (Engajamento 0.5): no Início do treinador (alunos ativos; {@code meus=true} só os dele) e na ficha.
 * Com {@code REGISTRO_LER}, como o resto dos registros. Só com {@code TREINOS_RETORNO_HABILITADO}.
 */
@ExigeRetorno
@RestController
public class RecordesTreinadorController {

    private final RecordesDaSemanaService recordes;

    public RecordesTreinadorController(RecordesDaSemanaService recordes) {
        this.recordes = recordes;
    }

    @PreAuthorize("hasAuthority('PERM_REGISTRO_LER')")
    @GetMapping("/recordes/semana")
    public RecordesDaSemanaResponse daConsultoria(@AuthenticationPrincipal UsuarioAutenticado eu,
                                                  @RequestParam(defaultValue = "false") boolean meus) {
        return recordes.daConsultoria(meus ? eu.usuarioId() : null);
    }

    @PreAuthorize("hasAuthority('PERM_REGISTRO_LER')")
    @GetMapping("/alunos/{alunoId}/recordes/semana")
    public RecordesDaSemanaResponse doAluno(@PathVariable UUID alunoId) {
        return recordes.doAluno(alunoId);
    }
}
