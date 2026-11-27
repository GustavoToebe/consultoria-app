package br.com.treinos.api.planos.liberacao;

import br.com.treinos.api.dieta.PlanoDietaService;
import br.com.treinos.api.planos.dto.PlanoDtos.AlterarLiberacaoRequest;
import br.com.treinos.api.planos.dto.PlanoDtos.LiberarAgoraRequest;
import br.com.treinos.api.planos.dto.PlanoDtos.PlanoResumo;
import br.com.treinos.api.treino.PlanoTreinoService;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * Plano agendado (V106), treino e dieta: "Alterar data" e "Liberar agora". Quem publica (a permissão de publicar do tipo) é quem
 * mexe na liberação. A mobilidade tem a mesma rota em {@link PlanoMobilidadeLiberacaoController} (a funcionalidade é do plano da
 * consultoria). Plano sem agendamento = 409 {@code PLANO_NAO_AGENDADO}; de outra consultoria ou arquivado = 404.
 */
@RestController
public class PlanoLiberacaoController {

    private final PlanoTreinoService treinos;
    private final PlanoDietaService dietas;

    PlanoLiberacaoController(PlanoTreinoService treinos, PlanoDietaService dietas) {
        this.treinos = treinos;
        this.dietas = dietas;
    }

    @PreAuthorize("hasAuthority('PERM_TREINO_PUBLICAR')")
    @PutMapping("/planos-treino/{id}/liberacao")
    public PlanoResumo alterarDoTreino(@PathVariable UUID id, @RequestBody @Valid AlterarLiberacaoRequest request) {
        return treinos.alterarLiberacao(id, request.liberarEm());
    }

    @PreAuthorize("hasAuthority('PERM_TREINO_PUBLICAR')")
    @PostMapping("/planos-treino/{id}/liberar-agora")
    public PlanoResumo liberarTreinoAgora(@PathVariable UUID id, @RequestBody(required = false) LiberarAgoraRequest request) {
        return treinos.liberarAgora(id, request == null ? null : request.avisarAluno());
    }

    @PreAuthorize("hasAuthority('PERM_DIETA_PUBLICAR')")
    @PutMapping("/planos-dieta/{id}/liberacao")
    public PlanoResumo alterarDaDieta(@PathVariable UUID id, @RequestBody @Valid AlterarLiberacaoRequest request) {
        return dietas.alterarLiberacao(id, request.liberarEm());
    }

    @PreAuthorize("hasAuthority('PERM_DIETA_PUBLICAR')")
    @PostMapping("/planos-dieta/{id}/liberar-agora")
    public PlanoResumo liberarDietaAgora(@PathVariable UUID id, @RequestBody(required = false) LiberarAgoraRequest request) {
        return dietas.liberarAgora(id, request == null ? null : request.avisarAluno());
    }
}
