package br.com.treinos.api.anamneses;

import br.com.treinos.api.anamneses.AnamneseDtos.AnamneseDetalhe;
import br.com.treinos.api.anamneses.AnamneseDtos.AnamneseResumo;
import br.com.treinos.api.anamneses.AnamneseDtos.AtribuirRequest;
import br.com.treinos.api.anamneses.AnamneseDtos.DispensarRequest;
import br.com.treinos.api.anamneses.AnamneseDtos.RevisarRequest;
import br.com.treinos.api.security.UsuarioAutenticado;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * Anamnese, lado da equipe. Ler exige {@code ANAMNESE_LER} e {@code ALUNO_SENSIVEL_LER} (respostas são dado sensível,
 * como as da atualização); atribuir, dispensar, marcar revisada e aplicar ou descartar as alterações do cadastro que a
 * anamnese propôs exigem também {@code ANAMNESE_ALTERAR}.
 */
@RestController
public class AnamneseController {

    private static final String LER = "hasAuthority('PERM_ANAMNESE_LER') and hasAuthority('PERM_ALUNO_SENSIVEL_LER')";
    private static final String ALTERAR = LER + " and hasAuthority('PERM_ANAMNESE_ALTERAR')";

    private final AnamneseService anamneses;

    public AnamneseController(AnamneseService anamneses) {
        this.anamneses = anamneses;
    }

    @PreAuthorize(ALTERAR)
    @PostMapping("/alunos/{id}/anamneses")
    public AnamneseDetalhe atribuir(@PathVariable UUID id, @Valid @RequestBody AtribuirRequest r,
                                    @AuthenticationPrincipal UsuarioAutenticado eu) {
        return anamneses.atribuir(id, r.questionarioId(), eu.usuarioId());
    }

    @PreAuthorize(LER)
    @GetMapping("/alunos/{id}/anamneses")
    public List<AnamneseResumo> doAluno(@PathVariable UUID id) {
        return anamneses.doAluno(id);
    }

    @PreAuthorize(LER)
    @GetMapping("/anamneses/{id}")
    public AnamneseDetalhe detalhe(@PathVariable UUID id) {
        return anamneses.detalhe(id);
    }

    @PreAuthorize(ALTERAR)
    @PostMapping("/anamneses/{id}/dispensar")
    public AnamneseDetalhe dispensar(@PathVariable UUID id, @Valid @RequestBody DispensarRequest r,
                                     @AuthenticationPrincipal UsuarioAutenticado eu) {
        return anamneses.dispensar(id, r, eu.usuarioId());
    }

    /** A permissão do campo (peso e objetivo: {@code ALUNO_SENSIVEL_ALTERAR}) é conferida no serviço, por alteração. */
    @PreAuthorize(ALTERAR)
    @PostMapping("/anamneses/{id}/alteracoes/{alteracaoId}/aplicar")
    public AnamneseDetalhe aplicarAlteracao(@PathVariable UUID id, @PathVariable UUID alteracaoId,
                                            @AuthenticationPrincipal UsuarioAutenticado eu) {
        return anamneses.aplicarAlteracao(id, alteracaoId, eu.usuarioId());
    }

    @PreAuthorize(ALTERAR)
    @PostMapping("/anamneses/{id}/alteracoes/{alteracaoId}/descartar")
    public AnamneseDetalhe descartarAlteracao(@PathVariable UUID id, @PathVariable UUID alteracaoId,
                                              @AuthenticationPrincipal UsuarioAutenticado eu) {
        return anamneses.descartarAlteracao(id, alteracaoId, eu.usuarioId());
    }

    @PreAuthorize(ALTERAR)
    @PostMapping("/anamneses/{id}/revisar")
    public AnamneseDetalhe revisar(@PathVariable UUID id, @Valid @RequestBody RevisarRequest r,
                                   @AuthenticationPrincipal UsuarioAutenticado eu) {
        return anamneses.revisar(id, r.versao(), eu.usuarioId());
    }
}
