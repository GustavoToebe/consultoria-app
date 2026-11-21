package br.com.treinos.api.whatsapp;

import br.com.treinos.api.whatsapp.WhatsAppDtos.ConexaoRequest;
import br.com.treinos.api.whatsapp.WhatsAppDtos.ConexaoResponse;
import br.com.treinos.api.whatsapp.WhatsAppDtos.ModeloRequest;
import br.com.treinos.api.whatsapp.WhatsAppDtos.ModeloResponse;
import br.com.treinos.api.whatsapp.WhatsAppDtos.ModelosResponse;
import jakarta.validation.Valid;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Conexão e modelos do WhatsApp da consultoria: tudo (inclusive ler) exige {@code WHATSAPP_ALTERAR}, que é sensível e só o
 * Administrador tem. O token de acesso só entra: nenhuma resposta o devolve.
 */
@RestController
@ExigeWhatsApp
public class WhatsAppController {

    private static final String PERMISSAO = "hasAuthority('PERM_WHATSAPP_ALTERAR')";

    private final WhatsAppConexaoService servico;

    public WhatsAppController(WhatsAppConexaoService servico) {
        this.servico = servico;
    }

    @PreAuthorize(PERMISSAO)
    @GetMapping("/whatsapp/conexao")
    public ResponseEntity<ConexaoResponse> conexao() {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(servico.obter());
    }

    @PreAuthorize(PERMISSAO)
    @PutMapping("/whatsapp/conexao")
    public ResponseEntity<ConexaoResponse> salvarConexao(@Valid @RequestBody ConexaoRequest r) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(servico.salvar(r));
    }

    @PreAuthorize(PERMISSAO)
    @DeleteMapping("/whatsapp/conexao")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removerConexao(@RequestParam(required = false) Long versao) {
        servico.remover(versao);
    }

    @PreAuthorize(PERMISSAO)
    @GetMapping("/whatsapp/modelos")
    public ResponseEntity<ModelosResponse> modelos() {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(servico.listarModelos());
    }

    @PreAuthorize(PERMISSAO)
    @PutMapping("/whatsapp/modelos/{tipo}")
    public ResponseEntity<ModeloResponse> salvarModelo(@PathVariable TipoDeAviso tipo, @Valid @RequestBody ModeloRequest r) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(servico.salvarModelo(tipo, r));
    }

    @PreAuthorize(PERMISSAO)
    @DeleteMapping("/whatsapp/modelos/{tipo}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removerModelo(@PathVariable TipoDeAviso tipo, @RequestParam(required = false) Long versao) {
        servico.removerModelo(tipo, versao);
    }
}
