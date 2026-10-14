package br.com.treinos.api.dieta;

import br.com.treinos.api.planos.CopiarPlanoService;
import br.com.treinos.api.planos.ResultadoValidacao;
import br.com.treinos.api.planos.dto.PlanoDtos.CopiaResposta;
import br.com.treinos.api.planos.dto.PlanoDtos.CopiarPlanoRequest;
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

/** Planos de dieta do treinador: mesmas rotas do treino, trocando {@code planos-treino} por {@code planos-dieta}. */
@RestController
public class PlanoDietaController {

    private final PlanoDietaService planos;
    private final ReceitaService receitas;
    private final CopiarPlanoService copias;

    public PlanoDietaController(PlanoDietaService planos, ReceitaService receitas, CopiarPlanoService copias) {
        this.planos = planos;
        this.receitas = receitas;
        this.copias = copias;
    }

    @PreAuthorize("hasAuthority('PERM_DIETA_LER')")
    @GetMapping("/alunos/{alunoId}/planos-dieta")
    public List<PlanoResumo> listar(@PathVariable UUID alunoId) {
        return planos.listar(alunoId);
    }

    @PreAuthorize("hasAuthority('PERM_DIETA_ALTERAR')")
    @PostMapping("/alunos/{alunoId}/planos-dieta")
    public PlanoDetalhe<ConteudoDieta> criar(@PathVariable UUID alunoId, @RequestBody @Valid CriarPlanoRequest request) {
        return planos.criar(alunoId, request);
    }

    @PreAuthorize("hasAuthority('PERM_DIETA_ALTERAR')")
    @DeleteMapping("/planos-dieta/{id}")
    public ResponseEntity<Void> excluir(@PathVariable UUID id) { planos.excluir(id); return ResponseEntity.noContent().build(); }

    @PreAuthorize("hasAuthority('PERM_DIETA_LER')")
    @GetMapping("/planos-dieta/{id}")
    public PlanoDetalhe<ConteudoDieta> detalhe(@PathVariable UUID id) {
        return planos.detalhe(id);
    }

    @PreAuthorize("hasAuthority('PERM_DIETA_ALTERAR')")
    @PutMapping("/planos-dieta/{id}/rascunho")
    public PlanoDetalhe<ConteudoDieta> salvarRascunho(@PathVariable UUID id,
                                                      @RequestBody @Valid SalvarRascunhoRequest<ConteudoDieta> request) {
        return planos.salvarRascunho(id, request);
    }

    @PreAuthorize("hasAuthority('PERM_DIETA_LER')")
    @PostMapping("/planos-dieta/{id}/validar")
    public ResultadoValidacao validar(@PathVariable UUID id) {
        return planos.validar(id);
    }

    @PreAuthorize("hasAuthority('PERM_DIETA_PUBLICAR')")
    @PostMapping("/planos-dieta/{id}/publicar")
    public PlanoDetalhe<ConteudoDieta> publicar(@PathVariable UUID id, @RequestBody @Valid PublicarRequest request,
                                                @AuthenticationPrincipal UsuarioAutenticado eu) {
        return planos.publicar(id, request, eu.usuarioId());
    }

    @PreAuthorize("hasAuthority('PERM_DIETA_ALTERAR')")
    @PostMapping("/planos-dieta/{id}/replicar")
    public PlanoDetalhe<ConteudoDieta> replicar(@PathVariable UUID id, @RequestBody @Valid ReplicarRequest request) {
        return planos.replicar(id, request);
    }

    @PreAuthorize("hasAuthority('PERM_DIETA_ALTERAR') and hasAuthority('PERM_ALUNO_LER')")
    @PostMapping("/planos-dieta/{id}/copiar-para-aluno")
    public CopiaResposta copiarParaAluno(@PathVariable UUID id, @RequestBody @Valid CopiarPlanoRequest request) {
        return copias.dieta(id, request);
    }

    @PreAuthorize("hasAuthority('PERM_DIETA_LER')")
    @GetMapping("/planos-dieta/{id}/versoes/{numero}")
    public VersaoDetalhe<ConteudoDieta> versao(@PathVariable UUID id, @PathVariable int numero) {
        return planos.versao(id, numero);
    }

    @PreAuthorize("hasAuthority('PERM_DIETA_LER') and hasAuthority('PERM_MODELO_ALTERAR')")
    @PostMapping("/planos-dieta/{id}/salvar-como-receita")
    public ReceitaResponse salvarComoReceita(@PathVariable UUID id, @RequestBody @Valid SalvarComoReceitaRequest request) {
        return receitas.salvarConteudo(Receita.Tipo.PLANO_DIETA, request.nome(), request.descricao(),
                planos.rascunho(id));
    }
}
