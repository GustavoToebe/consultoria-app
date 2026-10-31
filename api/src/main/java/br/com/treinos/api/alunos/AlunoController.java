package br.com.treinos.api.alunos;

import br.com.treinos.api.alunos.dto.AlunoDtos.AlunoDetalhe;
import br.com.treinos.api.alunos.dto.AlunoDtos.AlunoRequest;
import br.com.treinos.api.alunos.dto.AlunoDtos.ConviteResponse;
import br.com.treinos.api.alunos.dto.AlunoDtos.DefinirAcessoRequest;
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

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/alunos")
public class AlunoController {

    private final AlunoService alunos;
    private final ConviteService convites;
    private final AcessoDoAlunoService acessos;

    public AlunoController(AlunoService alunos, ConviteService convites, AcessoDoAlunoService acessos) {
        this.alunos = alunos;
        this.convites = convites;
        this.acessos = acessos;
    }

    /**
     * Filtros avançados (31/10, {@link FiltrosDaListaDeAlunos}), todos opcionais e combinados com E: {@code responsavel}
     * (repetível: id de membro ou {@code nenhum}; com {@code meus=true} = 400 {@code FILTRO_INVALIDO}; membro de outra
     * consultoria = 404), {@code acesso} (repetível: COM, SEM, AGUARDANDO), {@code atualizacao} (repetível: as fases da
     * lista e SEM_PASTA; ATUALIZACAO_LER + ALUNO_SENSIVEL_LER), {@code plano} (COM, SEM; TREINO_LER), {@code pasta}
     * (A_RENOVAR; TREINO_LER) e {@code registro} (NUNCA, HA_MAIS_DE_7, HA_MAIS_DE_14, HA_MAIS_DE_30; REGISTRO_LER). Sem a
     * permissão do filtro = 403; valor desconhecido = 400 {@code FILTRO_INVALIDO}.
     */
    @PreAuthorize("hasAuthority('PERM_ALUNO_LER')")
    @GetMapping
    public PaginaAlunos listar(@RequestParam(required = false) String busca,
                               @RequestParam(required = false) String situacao,
                               @RequestParam(defaultValue = "0") int pagina,
                               @RequestParam(defaultValue = "30") int tamanho,
                               @RequestParam(defaultValue = "false") boolean meus,
                               @RequestParam(required = false) List<String> responsavel,
                               @RequestParam(required = false) List<String> acesso,
                               @RequestParam(required = false) List<String> atualizacao,
                               @RequestParam(required = false) String plano,
                               @RequestParam(required = false) String pasta,
                               @RequestParam(required = false) String registro) {
        return alunos.listar(busca, situacao, pagina, tamanho, meus,
                new FiltrosDaListaDeAlunos.Pedido(responsavel, acesso, atualizacao, plano, pasta, registro));
    }

    @PreAuthorize("hasAuthority('PERM_ALUNO_ALTERAR')")
    @PostMapping
    public AlunoDetalhe criar(@RequestBody @Valid AlunoRequest request) {
        return alunos.criar(request);
    }

    @PreAuthorize("hasAuthority('PERM_ALUNO_LER')")
    @GetMapping("/{id}")
    public AlunoDetalhe detalhe(@PathVariable UUID id) {
        return alunos.detalhe(id);
    }

    @PreAuthorize("hasAuthority('PERM_ALUNO_ALTERAR')")
    @PutMapping("/{id}")
    public AlunoDetalhe alterar(@PathVariable UUID id, @RequestBody @Valid AlunoRequest request) {
        return alunos.alterar(id, request);
    }

    @PreAuthorize("hasAuthority('PERM_ALUNO_ALTERAR')")
    @PatchMapping("/{id}/situacao")
    public AlunoDetalhe situacao(@PathVariable UUID id, @RequestBody @Valid SituacaoRequest request) {
        return alunos.alterarSituacao(id, request.ativo());
    }

    @PreAuthorize("hasAuthority('PERM_ALUNO_CONVITE')")
    @PostMapping("/{id}/convite")
    public ConviteResponse convite(@PathVariable UUID id) {
        return convites.gerar(id);
    }

    /** E-mail de login e senha provisória definidos pelo treinador; o aluno troca a senha no primeiro login. */
    @PreAuthorize("hasAuthority('PERM_ALUNO_CONVITE')")
    @PutMapping("/{id}/acesso")
    public AlunoDetalhe acesso(@PathVariable UUID id, @RequestBody @Valid DefinirAcessoRequest request) {
        return acessos.definir(id, request.email(), request.senha());
    }
}
