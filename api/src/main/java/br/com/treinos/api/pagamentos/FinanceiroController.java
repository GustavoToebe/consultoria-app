package br.com.treinos.api.pagamentos;

import br.com.treinos.api.pagamentos.PagamentosDtos.Numeros;
import br.com.treinos.api.pagamentos.PagamentosDtos.PaginaInadimplentes;
import br.com.treinos.api.pagamentos.PagamentosDtos.Painel;
import br.com.treinos.api.security.UsuarioAutenticado;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;

/**
 * Painel, números, inadimplentes e exportação. Só agregados e a lista de quem deve; leitura com {@code FINANCEIRO_LER}
 * (as rotas que mostram aluno pedem também {@code ALUNO_LER}).
 */
@RestController
@ExigePagamentos
public class FinanceiroController {

    private static final String LER = "hasAuthority('PERM_FINANCEIRO_LER')";
    private static final String LER_COM_ALUNO = LER + " and hasAuthority('PERM_ALUNO_LER')";

    private final FinanceiroService financeiro;
    private final ExportacaoFinanceiraService exportacao;

    public FinanceiroController(FinanceiroService financeiro, ExportacaoFinanceiraService exportacao) {
        this.financeiro = financeiro;
        this.exportacao = exportacao;
    }

    @PreAuthorize(LER)
    @GetMapping("/financeiro/numeros")
    public Numeros numeros(@RequestParam(defaultValue = "6") int meses) {
        return financeiro.numeros(meses);
    }

    @PreAuthorize(LER)
    @GetMapping("/financeiro/painel")
    public Painel painel(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate de,
                         @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate ate,
                         @RequestParam(defaultValue = "false") boolean meus,
                         @AuthenticationPrincipal UsuarioAutenticado eu) {
        return financeiro.painel(de, ate, meus ? eu.usuarioId() : null);
    }

    @PreAuthorize(LER_COM_ALUNO)
    @GetMapping("/financeiro/inadimplentes")
    public PaginaInadimplentes inadimplentes(@RequestParam(defaultValue = "false") boolean meus,
                                             @RequestParam(defaultValue = "0") int pagina,
                                             @AuthenticationPrincipal UsuarioAutenticado eu) {
        return financeiro.inadimplentes(meus ? eu.usuarioId() : null, pagina);
    }

    /** CSV de cobranças (por vencimento) e lançamentos (por data); mostra o nome do aluno, por isso pede também ALUNO_LER. */
    @PreAuthorize(LER_COM_ALUNO)
    @GetMapping("/financeiro/exportacao")
    public ResponseEntity<byte[]> exportar(@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate de,
                                           @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate ate) {
        var csv = exportacao.exportar(de, ate);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + csv.nomeDoArquivo() + "\"")
                .cacheControl(CacheControl.noStore())
                .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                .body(csv.conteudo());
    }
}
