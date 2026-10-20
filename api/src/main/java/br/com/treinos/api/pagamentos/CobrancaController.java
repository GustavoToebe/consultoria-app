package br.com.treinos.api.pagamentos;

import br.com.treinos.api.pagamentos.PagamentosDtos.BaixaManualRequest;
import br.com.treinos.api.pagamentos.PagamentosDtos.CobrancaResponse;
import br.com.treinos.api.pagamentos.PagamentosDtos.MotivoRequest;
import br.com.treinos.api.pagamentos.PagamentosDtos.PaginaCobrancas;
import br.com.treinos.api.security.UsuarioAutenticado;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Cobranças. As listas mostram aluno, então pedem também {@code ALUNO_LER}; baixa, desfazer e cancelar pedem
 * {@code FINANCEIRO_ALTERAR}. O corpo nunca traz valor: ele sai da contratação.
 */
@RestController
@ExigePagamentos
public class CobrancaController {

    private static final String LER = "hasAuthority('PERM_FINANCEIRO_LER') and hasAuthority('PERM_ALUNO_LER')";
    private static final String ALTERAR = LER + " and hasAuthority('PERM_FINANCEIRO_ALTERAR')";

    private final CobrancaService cobrancas;

    public CobrancaController(CobrancaService cobrancas) {
        this.cobrancas = cobrancas;
    }

    /** {@code meus=true}: só os alunos cujo responsável é quem pede. Preferência de listagem, não restrição de acesso. */
    @PreAuthorize(LER)
    @GetMapping("/financeiro/cobrancas")
    public PaginaCobrancas listar(@RequestParam(required = false) String situacao,
                                  @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate de,
                                  @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate ate,
                                  @RequestParam(defaultValue = "false") boolean meus,
                                  @RequestParam(defaultValue = "0") int pagina,
                                  @AuthenticationPrincipal UsuarioAutenticado eu) {
        return cobrancas.listar(situacao, de, ate, meus ? eu.usuarioId() : null, pagina);
    }

    @PreAuthorize(LER)
    @GetMapping("/alunos/{id}/cobrancas")
    public List<CobrancaResponse> doAluno(@PathVariable UUID id) {
        return cobrancas.doAluno(id);
    }

    @PreAuthorize(ALTERAR)
    @PostMapping("/cobrancas/{id}/baixa-manual")
    public CobrancaResponse baixaManual(@PathVariable UUID id, @Valid @RequestBody BaixaManualRequest r,
                                        @AuthenticationPrincipal UsuarioAutenticado eu) {
        return cobrancas.baixaManual(id, r, eu.usuarioId());
    }

    @PreAuthorize(ALTERAR)
    @PostMapping("/cobrancas/{id}/desfazer-baixa")
    public CobrancaResponse desfazerBaixa(@PathVariable UUID id, @Valid @RequestBody MotivoRequest r) {
        return cobrancas.desfazerBaixa(id, r);
    }

    @PreAuthorize(ALTERAR)
    @PostMapping("/cobrancas/{id}/cancelar")
    public CobrancaResponse cancelar(@PathVariable UUID id, @Valid @RequestBody MotivoRequest r) {
        return cobrancas.cancelar(id, r);
    }
}
