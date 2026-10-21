package br.com.treinos.api.integracao;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Lado do Saraiva do contrato de integração com a Central (contrato-integracao-v1). Autenticado só pelo filtro HMAC
 * ({@link IntegracaoFiltro}): a autoridade {@code PERM_INTEGRACAO} não existe para usuário nenhum.
 */
@RestController
@RequestMapping("/integracao/v1")
public class IntegracaoController {

    private final InstanciaService instancias;
    private final IntegracaoProperties propriedades;

    public IntegracaoController(InstanciaService instancias, IntegracaoProperties propriedades) {
        this.instancias = instancias;
        this.propriedades = propriedades;
    }

    @GetMapping("/saude")
    @PreAuthorize("hasAuthority('PERM_INTEGRACAO')")
    public Map<String, Object> saude() {
        return instancias.saude(propriedades.produto());
    }

    @GetMapping("/recursos")
    @PreAuthorize("hasAuthority('PERM_INTEGRACAO')")
    public List<InstanciaService.Recurso> recursos() {
        return instancias.recursos();
    }

    /** 5.1: {@code 201} criado; {@code 200} + {@code Idempotency-Replayed} na repetição; 409 se a chave veio com outro corpo. */
    @PostMapping("/instancias")
    @PreAuthorize("hasAuthority('PERM_INTEGRACAO')")
    public ResponseEntity<JsonNode> provisionar(@RequestHeader("Idempotency-Key") UUID chave,
                                                HttpServletRequest request, @Valid @RequestBody ProvisionarRequest corpo) {
        String hash = (String) request.getAttribute(IntegracaoFiltro.ATRIBUTO_HASH_CORPO);
        var resultado = instancias.provisionar(chave, hash, corpo);
        var resposta = ResponseEntity.status(resultado.status());
        if (resultado.repeticao()) {
            resposta = resposta.header("Idempotency-Replayed", "true");
        }
        return resposta.body(resultado.corpo());
    }

    @GetMapping("/instancias/{tenantId}")
    @PreAuthorize("hasAuthority('PERM_INTEGRACAO')")
    public Map<String, Object> consultar(@PathVariable UUID tenantId) {
        return instancias.consultar(tenantId);
    }

    /** 5.3: versão menor ou igual não é erro ({@code aplicado=false}); a Central não repete. */
    @PutMapping("/instancias/{tenantId}/direitos")
    @PreAuthorize("hasAuthority('PERM_INTEGRACAO')")
    public DireitosService.Resultado direitos(@PathVariable UUID tenantId, @Valid @RequestBody DireitosInstancia corpo) {
        return instancias.aplicarDireitos(tenantId, corpo);
    }

    /**
     * Contrato v1, seção 5.6 (obrigatória para todo aplicativo): novo link de primeiro acesso do administrador que
     * ainda não aceitou o convite. O e-mail sai por aqui (depois do commit) e o link volta na resposta, para a Central
     * mostrá-lo ao operador uma única vez.
     */
    @PostMapping("/instancias/{tenantId}/convite-administrador")
    @PreAuthorize("hasAuthority('PERM_INTEGRACAO')")
    public ResponseEntity<ProvisionamentoService.ConviteEmitido> reemitirConvite(@PathVariable UUID tenantId) {
        return ResponseEntity.status(HttpStatus.CREATED).body(instancias.reemitirConvite(tenantId));
    }
}
