package br.com.treinos.api.inscricoes;

import br.com.treinos.api.inscricoes.InscricaoDtos.ModeloRequest;
import br.com.treinos.api.inscricoes.InscricaoDtos.ModeloResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/** Respostas prontas para o WhatsApp. Ler com {@code INSCRICAO_LER}; criar, alterar e excluir com {@code INSCRICAO_ALTERAR}. */
@RestController
@RequestMapping("/inscricoes/modelos-de-mensagem")
public class ModelosDeMensagemController {

    private final ModelosDeMensagemService modelos;

    public ModelosDeMensagemController(ModelosDeMensagemService modelos) {
        this.modelos = modelos;
    }

    @PreAuthorize("hasAuthority('PERM_INSCRICAO_LER')")
    @GetMapping
    public List<ModeloResponse> listar() {
        return modelos.listar();
    }

    @PreAuthorize("hasAuthority('PERM_INSCRICAO_ALTERAR')")
    @PostMapping
    public ModeloResponse criar(@RequestBody @Valid ModeloRequest request) {
        return modelos.criar(request);
    }

    @PreAuthorize("hasAuthority('PERM_INSCRICAO_ALTERAR')")
    @PutMapping("/{id}")
    public ModeloResponse alterar(@PathVariable UUID id, @RequestBody @Valid ModeloRequest request) {
        return modelos.alterar(id, request);
    }

    @PreAuthorize("hasAuthority('PERM_INSCRICAO_ALTERAR')")
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void excluir(@PathVariable UUID id, @RequestParam long versao) {
        modelos.excluir(id, versao);
    }
}
