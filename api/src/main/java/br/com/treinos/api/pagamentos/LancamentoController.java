package br.com.treinos.api.pagamentos;

import br.com.treinos.api.pagamentos.PagamentosDtos.LancamentoRequest;
import br.com.treinos.api.pagamentos.PagamentosDtos.LancamentoResponse;
import br.com.treinos.api.pagamentos.PagamentosDtos.PaginaLancamentos;
import br.com.treinos.api.security.UsuarioAutenticado;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.UUID;

/** Lançamentos avulsos: ler com {@code FINANCEIRO_LER}; criar, editar e excluir com {@code FINANCEIRO_ALTERAR}, sempre com a versão. */
@RestController
@ExigePagamentos
public class LancamentoController {

    private static final String LER = "hasAuthority('PERM_FINANCEIRO_LER')";
    private static final String ALTERAR = LER + " and hasAuthority('PERM_FINANCEIRO_ALTERAR')";

    private final LancamentoService lancamentos;

    public LancamentoController(LancamentoService lancamentos) {
        this.lancamentos = lancamentos;
    }

    @PreAuthorize(LER)
    @GetMapping("/financeiro/lancamentos")
    public PaginaLancamentos listar(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate de,
                                    @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate ate,
                                    @RequestParam(defaultValue = "0") int pagina) {
        return lancamentos.listar(de, ate, pagina);
    }

    @PreAuthorize(ALTERAR)
    @PostMapping("/financeiro/lancamentos")
    public LancamentoResponse criar(@Valid @RequestBody LancamentoRequest r, @AuthenticationPrincipal UsuarioAutenticado eu) {
        return lancamentos.criar(r, eu.usuarioId());
    }

    @PreAuthorize(ALTERAR)
    @PutMapping("/financeiro/lancamentos/{id}")
    public LancamentoResponse alterar(@PathVariable UUID id, @Valid @RequestBody LancamentoRequest r) {
        return lancamentos.alterar(id, r);
    }

    @PreAuthorize(ALTERAR)
    @DeleteMapping("/financeiro/lancamentos/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void excluir(@PathVariable UUID id, @RequestParam Long versao) {
        lancamentos.excluir(id, versao);
    }
}
