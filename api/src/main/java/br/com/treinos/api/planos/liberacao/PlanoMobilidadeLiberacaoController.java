package br.com.treinos.api.planos.liberacao;

import br.com.treinos.api.conta.ExigeFuncionalidade;
import br.com.treinos.api.conta.RecursosDoApp;
import br.com.treinos.api.mobilidade.PlanoMobilidadeService;
import br.com.treinos.api.planos.dto.PlanoDtos.AlterarLiberacaoRequest;
import br.com.treinos.api.planos.dto.PlanoDtos.LiberarAgoraRequest;
import br.com.treinos.api.planos.dto.PlanoDtos.PlanoResumo;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/** "Alterar data" e "Liberar agora" da mobilidade agendada: as mesmas do treino, com a permissão de publicar do treino. */
@RestController
@ExigeFuncionalidade(RecursosDoApp.FUNCIONALIDADE_MOBILIDADE)
public class PlanoMobilidadeLiberacaoController {

    private final PlanoMobilidadeService mobilidades;

    PlanoMobilidadeLiberacaoController(PlanoMobilidadeService mobilidades) {
        this.mobilidades = mobilidades;
    }

    @PreAuthorize("hasAuthority('PERM_TREINO_PUBLICAR')")
    @PutMapping("/planos-mobilidade/{id}/liberacao")
    public PlanoResumo alterar(@PathVariable UUID id, @RequestBody @Valid AlterarLiberacaoRequest request) {
        return mobilidades.alterarLiberacao(id, request.liberarEm());
    }

    @PreAuthorize("hasAuthority('PERM_TREINO_PUBLICAR')")
    @PostMapping("/planos-mobilidade/{id}/liberar-agora")
    public PlanoResumo liberarAgora(@PathVariable UUID id, @RequestBody(required = false) LiberarAgoraRequest request) {
        return mobilidades.liberarAgora(id, request == null ? null : request.avisarAluno());
    }
}
