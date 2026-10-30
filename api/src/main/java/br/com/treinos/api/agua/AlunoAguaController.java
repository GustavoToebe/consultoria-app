package br.com.treinos.api.agua;

import br.com.treinos.api.agua.AguaDoDiaDtos.AguaRegistrada;
import br.com.treinos.api.agua.AguaDoDiaDtos.LoteAguaRequest;
import br.com.treinos.api.execucao.AlunoAppService;
import br.com.treinos.api.execucao.dto.ExecucaoDtos.LoteResponse;
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
 * O aluno marca a água que bebeu no dia, inclusive sem internet (o app envia na mesma fila das séries). Sempre o aluno da
 * sessão. A tela só aparece com "Água por dia" na dieta publicada; a rota não depende disso (o dia já marcado continua seu).
 */
@RestController
@RequestMapping("/aluno/agua")
public class AlunoAguaController {

    private final AguaDoDiaService agua;

    public AlunoAguaController(AguaDoDiaService agua) {
        this.agua = agua;
    }

    @PreAuthorize("hasRole('ALUNO')")
    @PostMapping
    public LoteResponse lote(@AuthenticationPrincipal UsuarioAutenticado eu, @RequestBody @Valid LoteAguaRequest request) {
        return agua.receber(eu.consultoriaId(), AlunoAppService.alunoDaSessao(eu), request.registros());
    }

    @PreAuthorize("hasRole('ALUNO')")
    @GetMapping
    public List<AguaRegistrada> registros(@AuthenticationPrincipal UsuarioAutenticado eu,
                                          @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate de,
                                          @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate ate) {
        return agua.doAlunoDaSessao(AlunoAppService.alunoDaSessao(eu), de, ate);
    }
}
