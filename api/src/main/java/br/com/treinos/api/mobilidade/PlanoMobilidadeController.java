package br.com.treinos.api.mobilidade;

import br.com.treinos.api.planos.ResultadoValidacao;
import br.com.treinos.api.receitas.ConteudoMobilidade;
import br.com.treinos.api.planos.dto.PlanoDtos.CriarPlanoRequest;
import br.com.treinos.api.planos.dto.PlanoDtos.PlanoDetalhe;
import br.com.treinos.api.planos.dto.PlanoDtos.PlanoResumo;
import br.com.treinos.api.planos.dto.PlanoDtos.PublicarRequest;
import br.com.treinos.api.planos.dto.PlanoDtos.ReplicarRequest;
import br.com.treinos.api.planos.dto.PlanoDtos.SalvarComoReceitaRequest;
import br.com.treinos.api.planos.dto.PlanoDtos.SalvarRascunhoRequest;
import br.com.treinos.api.planos.dto.PlanoDtos.VersaoDetalhe;
import br.com.treinos.api.receitas.Receita;
import br.com.treinos.api.receitas.ReceitaService;
import br.com.treinos.api.receitas.ReceitaService.ReceitaResponse;
import br.com.treinos.api.security.UsuarioAutenticado;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/** Planos de dieta do treinador: mesmas rotas do treino, trocando {@code planos-treino} por {@code planos-mobilidade}. */
@RestController
public class PlanoMobilidadeController {

    private final PlanoMobilidadeService planos;
    private final ReceitaService receitas;

    public PlanoMobilidadeController(PlanoMobilidadeService planos, ReceitaService receitas) {
        this.planos = planos;
        this.receitas = receitas;
    }

    @PreAuthorize("hasAuthority('PERM_TREINO_LER')")
    @GetMapping("/alunos/{alunoId}/planos-mobilidade")
    public List<PlanoResumo> listar(@PathVariable UUID alunoId) {
        return planos.listar(alunoId);
    }

    @PreAuthorize("hasAuthority('PERM_TREINO_ALTERAR')")
    @PostMapping("/alunos/{alunoId}/planos-mobilidade")
    public PlanoDetalhe<ConteudoMobilidade> criar(@PathVariable UUID alunoId, @RequestBody @Valid CriarPlanoRequest request) {
        return planos.criar(alunoId, request);
    }

    @PreAuthorize("hasAuthority('PERM_TREINO_ALTERAR')")
    @DeleteMapping("/planos-mobilidade/{id}")
    public ResponseEntity<Void> excluir(@PathVariable UUID id) { planos.excluir(id); return ResponseEntity.noContent().build(); }

    @PreAuthorize("hasAuthority('PERM_TREINO_LER')")
    @GetMapping("/planos-mobilidade/{id}")
    public PlanoDetalhe<ConteudoMobilidade> detalhe(@PathVariable UUID id) {
        return planos.detalhe(id);
    }

    @PreAuthorize("hasAuthority('PERM_TREINO_ALTERAR')")
    @PutMapping("/planos-mobilidade/{id}/rascunho")
    public PlanoDetalhe<ConteudoMobilidade> salvarRascunho(@PathVariable UUID id,
                                                      @RequestBody @Valid SalvarRascunhoRequest<ConteudoMobilidade> request) {
        return planos.salvarRascunho(id, request);
    }

    @PreAuthorize("hasAuthority('PERM_TREINO_LER')")
    @PostMapping("/planos-mobilidade/{id}/validar")
    public ResultadoValidacao validar(@PathVariable UUID id) {
        return planos.validar(id);
    }

    @PreAuthorize("hasAuthority('PERM_TREINO_PUBLICAR')")
    @PostMapping("/planos-mobilidade/{id}/publicar")
    public PlanoDetalhe<ConteudoMobilidade> publicar(@PathVariable UUID id, @RequestBody @Valid PublicarRequest request,
                                                @AuthenticationPrincipal UsuarioAutenticado eu) {
        return planos.publicar(id, request, eu.usuarioId());
    }

    @PreAuthorize("hasAuthority('PERM_TREINO_ALTERAR')")
    @PostMapping("/planos-mobilidade/{id}/replicar")
    public PlanoDetalhe<ConteudoMobilidade> replicar(@PathVariable UUID id, @RequestBody @Valid ReplicarRequest request) {
        return planos.replicar(id, request);
    }

    @PreAuthorize("hasAuthority('PERM_TREINO_LER')")
    @GetMapping("/planos-mobilidade/{id}/versoes/{numero}")
    public VersaoDetalhe<ConteudoMobilidade> versao(@PathVariable UUID id, @PathVariable int numero) {
        return planos.versao(id, numero);
    }

    @PreAuthorize("hasAuthority('PERM_TREINO_LER') and hasAuthority('PERM_MODELO_ALTERAR')")
    @PostMapping("/planos-mobilidade/{id}/salvar-como-receita")
    public ReceitaResponse salvarComoReceita(@PathVariable UUID id, @RequestBody @Valid SalvarComoReceitaRequest request) {
        return receitas.salvarConteudo(Receita.Tipo.MOBILIDADE, request.nome(), request.descricao(),
                planos.rascunho(id));
    }
}
