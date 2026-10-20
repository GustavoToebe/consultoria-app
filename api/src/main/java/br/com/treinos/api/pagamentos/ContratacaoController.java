package br.com.treinos.api.pagamentos;

import br.com.treinos.api.pagamentos.PagamentosDtos.AlterarContratacaoRequest;
import br.com.treinos.api.pagamentos.PagamentosDtos.ContratacaoResponse;
import br.com.treinos.api.pagamentos.PagamentosDtos.ContratarRequest;
import br.com.treinos.api.pagamentos.PagamentosDtos.VersaoRequest;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/** O plano comercial contratado por cada aluno. As rotas do aluno também pedem {@code ALUNO_LER}. */
@RestController
@ExigePagamentos
public class ContratacaoController {

    private static final String LER = "hasAuthority('PERM_FINANCEIRO_LER') and hasAuthority('PERM_ALUNO_LER')";
    private static final String ALTERAR = LER + " and hasAuthority('PERM_FINANCEIRO_ALTERAR')";

    private final ContratacaoService contratacoes;

    public ContratacaoController(ContratacaoService contratacoes) {
        this.contratacoes = contratacoes;
    }

    @PreAuthorize(LER)
    @GetMapping("/alunos/{id}/contratacoes")
    public List<ContratacaoResponse> doAluno(@PathVariable UUID id) {
        return contratacoes.doAluno(id);
    }

    @PreAuthorize(ALTERAR)
    @PostMapping("/alunos/{id}/contratacoes")
    public ContratacaoResponse contratar(@PathVariable UUID id, @Valid @RequestBody ContratarRequest r) {
        return contratacoes.contratar(id, r);
    }

    @PreAuthorize(ALTERAR)
    @PutMapping("/contratacoes/{id}")
    public ContratacaoResponse alterar(@PathVariable UUID id, @Valid @RequestBody AlterarContratacaoRequest r) {
        return contratacoes.alterar(id, r);
    }

    @PreAuthorize(ALTERAR)
    @PostMapping("/contratacoes/{id}/pausar")
    public ContratacaoResponse pausar(@PathVariable UUID id, @Valid @RequestBody VersaoRequest r) {
        return contratacoes.pausar(id, r.versao());
    }

    @PreAuthorize(ALTERAR)
    @PostMapping("/contratacoes/{id}/retomar")
    public ContratacaoResponse retomar(@PathVariable UUID id, @Valid @RequestBody VersaoRequest r) {
        return contratacoes.retomar(id, r.versao());
    }

    @PreAuthorize(ALTERAR)
    @PostMapping("/contratacoes/{id}/encerrar")
    public ContratacaoResponse encerrar(@PathVariable UUID id, @Valid @RequestBody VersaoRequest r) {
        return contratacoes.encerrar(id, r.versao());
    }
}
