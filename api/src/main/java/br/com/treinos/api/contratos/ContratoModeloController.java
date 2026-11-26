package br.com.treinos.api.contratos;

import br.com.treinos.api.contratos.ContratoDtos.ArquivarModeloRequest;
import br.com.treinos.api.contratos.ContratoDtos.ModeloRequest;
import br.com.treinos.api.contratos.ContratoDtos.ModeloResponse;
import br.com.treinos.api.contratos.ContratoDtos.PreviaDoModelo;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * Modelos de contrato (D4a): ler com {@code CONTRATO_LER}; criar, editar, arquivar e ver a prévia com {@code CONTRATO_ALTERAR}.
 * Só a equipe. O texto do modelo nunca vai a log.
 */
@RestController
@ExigeContratos
public class ContratoModeloController {

    private static final String LER = "hasAuthority('PERM_CONTRATO_LER')";
    private static final String ALTERAR = "hasAuthority('PERM_CONTRATO_ALTERAR')";

    private final ContratoModeloService modelos;

    public ContratoModeloController(ContratoModeloService modelos) {
        this.modelos = modelos;
    }

    @PreAuthorize(LER)
    @GetMapping("/contratos/modelos")
    public List<ModeloResponse> listar() {
        return modelos.listar();
    }

    @PreAuthorize(ALTERAR)
    @PostMapping("/contratos/modelos")
    @ResponseStatus(HttpStatus.CREATED)
    public ModeloResponse criar(@RequestBody ModeloRequest r) {
        return modelos.criar(r);
    }

    @PreAuthorize(ALTERAR)
    @PutMapping("/contratos/modelos/{id}")
    public ModeloResponse alterar(@PathVariable UUID id, @RequestBody ModeloRequest r) {
        return modelos.alterar(id, r);
    }

    @PreAuthorize(ALTERAR)
    @PostMapping("/contratos/modelos/{id}/arquivar")
    public ModeloResponse arquivar(@PathVariable UUID id, @RequestBody ArquivarModeloRequest r) {
        return modelos.arquivar(id, r);
    }

    @PreAuthorize(ALTERAR)
    @PostMapping("/contratos/modelos/{id}/previa")
    public PreviaDoModelo previa(@PathVariable UUID id) {
        return modelos.previa(id);
    }
}
