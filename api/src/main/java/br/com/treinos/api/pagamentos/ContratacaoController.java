package br.com.treinos.api.pagamentos;

import br.com.treinos.api.pagamentos.PagamentosDtos.AlterarContratacaoRequest;
import br.com.treinos.api.pagamentos.PagamentosDtos.ContratacaoResponse;
import br.com.treinos.api.pagamentos.PagamentosDtos.ContratarRequest;
import br.com.treinos.api.pagamentos.PagamentosDtos.EncerrarRequest;
import br.com.treinos.api.pagamentos.PagamentosDtos.PagamentoDoSaldoRequest;
import br.com.treinos.api.pagamentos.PagamentosDtos.PagamentoDoSaldoResponse;
import br.com.treinos.api.pagamentos.PagamentosDtos.PreviaDeGeracao;
import br.com.treinos.api.pagamentos.PagamentosDtos.PreviaDeGeracaoRequest;
import br.com.treinos.api.pagamentos.PagamentosDtos.PreviaDoContrato;
import br.com.treinos.api.pagamentos.PagamentosDtos.PreviaDoContratoRequest;
import br.com.treinos.api.pagamentos.PagamentosDtos.PreviaDoEncerramento;
import br.com.treinos.api.pagamentos.PagamentosDtos.ResumoDaSaidaDoAluno;
import br.com.treinos.api.pagamentos.PagamentosDtos.VersaoRequest;
import br.com.treinos.api.security.UsuarioAutenticado;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
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
    private final EncerramentoDaContratacao encerramento;
    private final ContratoFechadoService fechados;

    public ContratacaoController(ContratacaoService contratacoes, EncerramentoDaContratacao encerramento,
                                 ContratoFechadoService fechados) {
        this.contratacoes = contratacoes;
        this.encerramento = encerramento;
        this.fechados = fechados;
    }

    @PreAuthorize(LER)
    @GetMapping("/alunos/{id}/contratacoes")
    public List<ContratacaoResponse> doAluno(@PathVariable UUID id) {
        return contratacoes.doAluno(id);
    }

    @PreAuthorize(ALTERAR)
    @PostMapping("/alunos/{id}/contratacoes")
    public ContratacaoResponse contratar(@PathVariable UUID id, @Valid @RequestBody ContratarRequest r,
                                         @AuthenticationPrincipal UsuarioAutenticado eu) {
        return contratacoes.contratar(id, r, eu.usuarioId());
    }

    /** Contrato fechado: a prévia (só leitura, sem auditoria) das parcelas e da soma; o app não calcula. */
    @PreAuthorize(ALTERAR)
    @PostMapping("/contratacoes/previa-do-contrato")
    public PreviaDoContrato previaDoContrato(@RequestBody PreviaDoContratoRequest r) {
        return fechados.previa(r);
    }

    /**
     * Um pagamento do saldo de um contrato de saldo livre (a 5ª exceção à regra do valor do servidor). 201 na primeira vez; o mesmo
     * {@code pedidoId} de novo devolve o que já foi criado, em 200.
     */
    @PreAuthorize(ALTERAR)
    @PostMapping("/contratacoes/{id}/pagamentos-do-saldo")
    public ResponseEntity<PagamentoDoSaldoResponse> pagarSaldo(@PathVariable UUID id, @RequestBody PagamentoDoSaldoRequest r,
                                                               @AuthenticationPrincipal UsuarioAutenticado eu) {
        var resultado = fechados.pagarSaldo(id, r, eu.usuarioId());
        return ResponseEntity.status(resultado.repetido() ? HttpStatus.OK : HttpStatus.CREATED).body(resultado.resposta());
    }

    /** D10: o que contratar geraria em aberto (só leitura; o app não calcula). */
    @PreAuthorize(ALTERAR)
    @PostMapping("/contratacoes/previa-de-geracao")
    public PreviaDeGeracao previaDeGeracao(@Valid @RequestBody PreviaDeGeracaoRequest r) {
        return contratacoes.previaDeGeracao(r);
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

    /** O que o encerramento faria agora (só leitura; contratação já encerrada = 409). */
    @PreAuthorize(LER)
    @GetMapping("/contratacoes/{id}/previa-de-encerramento")
    public PreviaDoEncerramento previaDoEncerramento(@PathVariable UUID id) {
        return encerramento.previa(id);
    }

    /** O que inativar o aluno faz com o financeiro (o painel de inativar chama direto; só leitura). */
    @PreAuthorize(LER)
    @GetMapping("/alunos/{id}/resumo-da-saida")
    public ResumoDaSaidaDoAluno resumoDaSaida(@PathVariable UUID id) {
        return encerramento.resumoDoAluno(id);
    }

    @PreAuthorize(ALTERAR)
    @PostMapping("/contratacoes/{id}/encerrar")
    public ContratacaoResponse encerrar(@PathVariable UUID id, @Valid @RequestBody EncerrarRequest r) {
        return encerramento.encerrar(id, r);
    }
}
