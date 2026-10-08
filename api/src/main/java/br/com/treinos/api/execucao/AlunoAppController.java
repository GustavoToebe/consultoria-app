package br.com.treinos.api.execucao;

import br.com.treinos.api.execucao.dto.ExecucaoDtos.DiaDeTreino;
import br.com.treinos.api.execucao.dto.ExecucaoDtos.DietaAtual;
import br.com.treinos.api.execucao.dto.ExecucaoDtos.LoteRequest;
import br.com.treinos.api.execucao.dto.ExecucaoDtos.LoteResponse;
import br.com.treinos.api.execucao.dto.ExecucaoDtos.PainelAluno;
import br.com.treinos.api.execucao.dto.ExecucaoDtos.PastaDoAluno;
import br.com.treinos.api.execucao.dto.ExecucaoDtos.PesoResponse;
import br.com.treinos.api.execucao.dto.ExecucaoDtos.PlanosDaPasta;
import br.com.treinos.api.security.UsuarioAutenticado;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Rotas do aluno (seção 9.4). O aluno é sempre o da sessão. */
@RestController
@RequestMapping("/aluno")
public class AlunoAppController {

    private final AlunoAppService alunoApp;
    private final SincronizacaoService sincronizacao;
    private final HistoricoService historico;
    private final PesoService pesos;

    public AlunoAppController(AlunoAppService alunoApp, SincronizacaoService sincronizacao, HistoricoService historico,
                              PesoService pesos) {
        this.alunoApp = alunoApp;
        this.sincronizacao = sincronizacao;
        this.historico = historico;
        this.pesos = pesos;
    }

    @PreAuthorize("hasRole('ALUNO')")
    @GetMapping("/painel")
    public PainelAluno painel(@AuthenticationPrincipal UsuarioAutenticado eu) {
        return alunoApp.painel(eu);
    }

    @PreAuthorize("hasRole('ALUNO')")
    @GetMapping("/dieta")
    public DietaAtual dieta(@AuthenticationPrincipal UsuarioAutenticado eu) {
        return alunoApp.dieta(eu);
    }

    @PreAuthorize("hasRole('ALUNO')")
    @GetMapping("/pastas")
    public List<PastaDoAluno> pastas(@AuthenticationPrincipal UsuarioAutenticado eu) {
        return alunoApp.pastas(eu);
    }

    @PreAuthorize("hasRole('ALUNO')")
    @GetMapping("/pastas/{id}")
    public PlanosDaPasta planosDaPasta(@AuthenticationPrincipal UsuarioAutenticado eu, @PathVariable UUID id) {
        return alunoApp.planosDaPasta(eu, id);
    }

    @PreAuthorize("hasRole('ALUNO')")
    @PostMapping("/execucoes/lote")
    public LoteResponse lote(@AuthenticationPrincipal UsuarioAutenticado eu, @RequestBody @Valid LoteRequest request) {
        return sincronizacao.receber(eu.consultoriaId(), AlunoAppService.alunoDaSessao(eu), request.registros());
    }

    @PreAuthorize("hasRole('ALUNO')")
    @GetMapping("/execucoes")
    public List<DiaDeTreino> execucoes(@AuthenticationPrincipal UsuarioAutenticado eu,
                                       @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate de,
                                       @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate ate) {
        return historico.historico(AlunoAppService.alunoDaSessao(eu), de, ate);
    }

    @PreAuthorize("hasRole('ALUNO')")
    @GetMapping("/pesos")
    public List<PesoResponse> pesos(@AuthenticationPrincipal UsuarioAutenticado eu) {
        return pesos.listar(AlunoAppService.alunoDaSessao(eu));
    }
}
