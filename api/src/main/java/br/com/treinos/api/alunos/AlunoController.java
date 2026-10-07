package br.com.treinos.api.alunos;

import br.com.treinos.api.alunos.dto.AlunoDtos.AlunoDetalhe;
import br.com.treinos.api.alunos.dto.AlunoDtos.AlunoRequest;
import br.com.treinos.api.alunos.dto.AlunoDtos.ConviteResponse;
import br.com.treinos.api.alunos.dto.AlunoDtos.PaginaAlunos;
import br.com.treinos.api.alunos.dto.AlunoDtos.SituacaoRequest;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/alunos")
public class AlunoController {

    private final AlunoService alunos;
    private final ConviteService convites;

    public AlunoController(AlunoService alunos, ConviteService convites) {
        this.alunos = alunos;
        this.convites = convites;
    }

    @PreAuthorize("hasRole('TREINADOR')")
    @GetMapping
    public PaginaAlunos listar(@RequestParam(required = false) String busca,
                               @RequestParam(required = false) String situacao,
                               @RequestParam(defaultValue = "0") int pagina,
                               @RequestParam(defaultValue = "30") int tamanho) {
        return alunos.listar(busca, situacao, pagina, tamanho);
    }

    @PreAuthorize("hasRole('TREINADOR')")
    @PostMapping
    public AlunoDetalhe criar(@RequestBody @Valid AlunoRequest request) {
        return alunos.criar(request);
    }

    @PreAuthorize("hasRole('TREINADOR')")
    @GetMapping("/{id}")
    public AlunoDetalhe detalhe(@PathVariable UUID id) {
        return alunos.detalhe(id);
    }

    @PreAuthorize("hasRole('TREINADOR')")
    @PutMapping("/{id}")
    public AlunoDetalhe alterar(@PathVariable UUID id, @RequestBody @Valid AlunoRequest request) {
        return alunos.alterar(id, request);
    }

    @PreAuthorize("hasRole('TREINADOR')")
    @PatchMapping("/{id}/situacao")
    public AlunoDetalhe situacao(@PathVariable UUID id, @RequestBody @Valid SituacaoRequest request) {
        return alunos.alterarSituacao(id, request.ativo());
    }

    @PreAuthorize("hasRole('TREINADOR')")
    @PostMapping("/{id}/convite")
    public ConviteResponse convite(@PathVariable UUID id) {
        return convites.gerar(id);
    }
}
