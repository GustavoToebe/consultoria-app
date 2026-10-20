package br.com.treinos.api.mobilidade;

import br.com.treinos.api.conta.ExigeFuncionalidade;
import br.com.treinos.api.conta.RecursosDoApp;
import br.com.treinos.api.execucao.AlunoAppService;
import br.com.treinos.api.execucao.dto.ExecucaoDtos.LoteResponse;
import br.com.treinos.api.mobilidade.MobilidadeRegistroDtos.LoteMobilidadeRequest;
import br.com.treinos.api.mobilidade.MobilidadeRegistroDtos.RegistroMobilidadeFeito;
import br.com.treinos.api.security.UsuarioAutenticado;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

/**
 * O aluno marca "feito" nos itens da mobilidade, inclusive sem internet (o app envia na mesma fila das séries). Sempre o
 * aluno da sessão. Gravar exige a funcionalidade {@code MOBILIDADE} do plano; ler o que já existe continua valendo.
 */
@RestController
@RequestMapping("/aluno/mobilidade/registros")
public class AlunoMobilidadeRegistrosController {

    private final MobilidadeRegistroService registros;

    public AlunoMobilidadeRegistrosController(MobilidadeRegistroService registros) {
        this.registros = registros;
    }

    @ExigeFuncionalidade(RecursosDoApp.FUNCIONALIDADE_MOBILIDADE)
    @PreAuthorize("hasRole('ALUNO')")
    @PostMapping
    public LoteResponse lote(@AuthenticationPrincipal UsuarioAutenticado eu, @RequestBody @Valid LoteMobilidadeRequest request) {
        return registros.receber(eu.consultoriaId(), AlunoAppService.alunoDaSessao(eu), request.registros());
    }

    @PreAuthorize("hasRole('ALUNO')")
    @GetMapping
    public List<RegistroMobilidadeFeito> registros(@AuthenticationPrincipal UsuarioAutenticado eu,
                                                   @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate de,
                                                   @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate ate) {
        return registros.doAlunoDaSessao(AlunoAppService.alunoDaSessao(eu), de, ate);
    }
}
