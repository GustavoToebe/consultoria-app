package br.com.treinos.api.contratos;

import br.com.treinos.api.contratos.ContratoDtos.CancelarRequest;
import br.com.treinos.api.contratos.ContratoDtos.ContratoDetalhe;
import br.com.treinos.api.contratos.ContratoDtos.ContratoResumo;
import br.com.treinos.api.contratos.ContratoDtos.GerarContratoRequest;
import br.com.treinos.api.contratos.ContratoDtos.PreviaDoContrato;
import br.com.treinos.api.contratos.ContratoDtos.ProrrogarRequest;
import br.com.treinos.api.security.UsuarioAutenticado;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * Contratos dos alunos, lado da equipe (D1 a D23): ler com {@code CONTRATO_LER}; prévia, gerar (que já é o envio, D23), cancelar e
 * prorrogar com {@code CONTRATO_ALTERAR}. Aluno de outra consultoria ou contrato dela = 404. Texto, CPF, IP e nome nunca vão a log.
 */
@RestController
@ExigeContratos
public class ContratoController {

    private static final String LER = "hasAuthority('PERM_CONTRATO_LER')";
    private static final String ALTERAR = "hasAuthority('PERM_CONTRATO_ALTERAR')";

    private final ContratoService contratos;

    public ContratoController(ContratoService contratos) {
        this.contratos = contratos;
    }

    @PreAuthorize(LER)
    @GetMapping("/alunos/{id}/contratos")
    public List<ContratoResumo> listar(@PathVariable UUID id) {
        return contratos.listar(id);
    }

    @PreAuthorize(LER)
    @GetMapping("/contratos/{id}")
    public ContratoDetalhe obter(@PathVariable UUID id) {
        return contratos.obter(id);
    }

    /** O modelo preenchido, sem gravar: {@code faltas} lista o que impede gerar. */
    @PreAuthorize(ALTERAR)
    @PostMapping("/alunos/{id}/contratos/previa")
    public PreviaDoContrato previa(@PathVariable UUID id, @RequestBody GerarContratoRequest r) {
        return contratos.previa(id, r);
    }

    /** 201 na primeira vez; o mesmo {@code pedidoId} de novo devolve o contrato que já foi gerado, em 200. */
    @PreAuthorize(ALTERAR)
    @PostMapping("/alunos/{id}/contratos")
    public ResponseEntity<ContratoDetalhe> gerar(@AuthenticationPrincipal UsuarioAutenticado eu, @PathVariable UUID id,
                                                 @RequestBody GerarContratoRequest r) {
        var gerado = contratos.gerar(eu, id, r);
        return ResponseEntity.status(gerado.criado() ? HttpStatus.CREATED : HttpStatus.OK).body(gerado.contrato());
    }

    @PreAuthorize(ALTERAR)
    @PostMapping("/contratos/{id}/cancelar")
    public ContratoDetalhe cancelar(@PathVariable UUID id, @RequestBody CancelarRequest r) {
        return contratos.cancelar(id, r);
    }

    @PreAuthorize(ALTERAR)
    @PostMapping("/contratos/{id}/prorrogar")
    public ContratoDetalhe prorrogar(@PathVariable UUID id, @RequestBody ProrrogarRequest r) {
        return contratos.prorrogar(id, r);
    }
}
