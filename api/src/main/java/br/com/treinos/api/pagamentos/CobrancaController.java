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
 * Cobranças. As listas mostram aluno, então pedem também {@code ALUNO_LER}; baixa, desfazer, cancelar, estorno e
 * contestação pedem {@code FINANCEIRO_ALTERAR}. O corpo nunca traz valor: ele sai da contratação. Estorno e contestação só
 * registram o que aconteceu fora do app (na InfinitePay ou no banco): nada aqui move dinheiro.
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

    /**
     * {@code meus=true}: só os alunos cujo responsável é quem pede (preferência de listagem, não restrição de acesso).
     * Filtros opcionais, combinados com E: {@code situacao} repetível (VENCIDA = aberta com vencimento antes de hoje),
     * vencimento {@code de}/{@code ate}, {@code busca} no nome do aluno, {@code alunoId}, {@code planoId} e {@code forma}
     * ({@code MANUAL} ou {@code ONLINE}). Nenhum abre dado que a rota já não mostrava.
     */
    @PreAuthorize(LER)
    @GetMapping("/financeiro/cobrancas")
    public PaginaCobrancas listar(@RequestParam(required = false) List<String> situacao,
                                  @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate de,
                                  @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate ate,
                                  @RequestParam(required = false) String busca,
                                  @RequestParam(required = false) String alunoId,
                                  @RequestParam(required = false) String planoId,
                                  @RequestParam(required = false) String forma,
                                  @RequestParam(defaultValue = "false") boolean meus,
                                  @RequestParam(defaultValue = "0") int pagina,
                                  @AuthenticationPrincipal UsuarioAutenticado eu) {
        return cobrancas.listar(new CobrancaService.FiltroDeCobrancas(situacao, de, ate, busca, alunoId, planoId, forma),
                meus ? eu.usuarioId() : null, pagina);
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

    @PreAuthorize(ALTERAR)
    @PostMapping("/cobrancas/{id}/estornar")
    public CobrancaResponse estornar(@PathVariable UUID id, @Valid @RequestBody MotivoRequest r) {
        return cobrancas.estornar(id, r);
    }

    @PreAuthorize(ALTERAR)
    @PostMapping("/cobrancas/{id}/contestar")
    public CobrancaResponse contestar(@PathVariable UUID id, @Valid @RequestBody MotivoRequest r) {
        return cobrancas.contestar(id, r);
    }

    /** A contestação terminou a favor do treinador: a cobrança volta a ficar paga, com a mesma baixa. */
    @PreAuthorize(ALTERAR)
    @PostMapping("/cobrancas/{id}/manter-paga")
    public CobrancaResponse manterPaga(@PathVariable UUID id, @Valid @RequestBody MotivoRequest r) {
        return cobrancas.manterPaga(id, r);
    }
}
