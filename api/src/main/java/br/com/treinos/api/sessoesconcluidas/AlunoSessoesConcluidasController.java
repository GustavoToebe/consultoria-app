package br.com.treinos.api.sessoesconcluidas;

import br.com.treinos.api.execucao.AlunoAppService;
import br.com.treinos.api.execucao.dto.ExecucaoDtos.LoteResponse;
import br.com.treinos.api.retorno.ExigeRetorno;
import br.com.treinos.api.security.UsuarioAutenticado;
import br.com.treinos.api.sessoesconcluidas.SessaoConcluidaDtos.LoteSessoesConcluidasRequest;
import br.com.treinos.api.sessoesconcluidas.SessaoConcluidaDtos.SessoesConcluidasResponse;
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

/**
 * O aluno conclui (e reabre) sessões do treino, inclusive sem internet (o app envia na mesma fila das séries). Sempre o
 * aluno da sessão. Só responde com {@code TREINOS_RETORNO_HABILITADO=true}; ligada a chave, ler e gravar ficam liberados
 * (o plano comercial não barra: não é uma funcionalidade do catálogo).
 */
@ExigeRetorno
@RestController
@RequestMapping("/aluno/sessoes-concluidas")
public class AlunoSessoesConcluidasController {

    private final SessaoConcluidaService sessoes;

    public AlunoSessoesConcluidasController(SessaoConcluidaService sessoes) {
        this.sessoes = sessoes;
    }

    @PreAuthorize("hasRole('ALUNO')")
    @PostMapping
    public LoteResponse lote(@AuthenticationPrincipal UsuarioAutenticado eu,
                             @RequestBody @Valid LoteSessoesConcluidasRequest request) {
        return sessoes.receber(eu.consultoriaId(), AlunoAppService.alunoDaSessao(eu), request.registros());
    }

    @PreAuthorize("hasRole('ALUNO')")
    @GetMapping
    public SessoesConcluidasResponse sessoes(@AuthenticationPrincipal UsuarioAutenticado eu,
                                             @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate de,
                                             @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate ate) {
        return sessoes.doAlunoDaSessao(AlunoAppService.alunoDaSessao(eu), de, ate);
    }
}
