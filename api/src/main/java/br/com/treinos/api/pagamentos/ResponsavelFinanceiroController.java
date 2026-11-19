package br.com.treinos.api.pagamentos;

import br.com.treinos.api.pagamentos.ResponsavelFinanceiroDtos.ResponsavelFinanceiroRequest;
import br.com.treinos.api.pagamentos.ResponsavelFinanceiroDtos.ResponsavelFinanceiroResponse;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * Responsável financeiro do aluno (D15): ler com {@code FINANCEIRO_LER} e {@code ALUNO_LER}, gravar e remover com
 * {@code FINANCEIRO_ALTERAR}. Dado pessoal de terceiro: nunca em log, auditoria nem mensagem de erro.
 */
@RestController
@ExigePagamentos
public class ResponsavelFinanceiroController {

    private static final String LER = "hasAuthority('PERM_FINANCEIRO_LER') and hasAuthority('PERM_ALUNO_LER')";
    private static final String ALTERAR = LER + " and hasAuthority('PERM_FINANCEIRO_ALTERAR')";

    private final ResponsavelFinanceiroService responsavel;

    public ResponsavelFinanceiroController(ResponsavelFinanceiroService responsavel) {
        this.responsavel = responsavel;
    }

    @PreAuthorize(LER)
    @GetMapping("/alunos/{id}/responsavel-financeiro")
    public ResponsavelFinanceiroResponse obter(@PathVariable UUID id) {
        return responsavel.obter(id);
    }

    @PreAuthorize(ALTERAR)
    @PutMapping("/alunos/{id}/responsavel-financeiro")
    public ResponsavelFinanceiroResponse salvar(@PathVariable UUID id, @RequestBody ResponsavelFinanceiroRequest r) {
        return responsavel.salvar(id, r);
    }

    @PreAuthorize(ALTERAR)
    @DeleteMapping("/alunos/{id}/responsavel-financeiro")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remover(@PathVariable UUID id, @RequestParam(required = false) Long versao) {
        responsavel.remover(id, versao);
    }
}
