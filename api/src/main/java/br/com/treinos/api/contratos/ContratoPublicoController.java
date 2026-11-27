package br.com.treinos.api.contratos;

import br.com.treinos.api.auth.LimiteTentativas;
import br.com.treinos.api.contratos.ContratoDtos.AbrirContratoPublicoRequest;
import br.com.treinos.api.contratos.ContratoDtos.AssinarContratoPublicoRequest;
import br.com.treinos.api.contratos.ContratoDtos.ConsultarContratoPublicoRequest;
import br.com.treinos.api.contratos.ContratoDtos.ContratoPublicoAberto;
import br.com.treinos.api.contratos.ContratoDtos.ContratoPublicoAssinado;
import br.com.treinos.api.contratos.ContratoDtos.ContratoPublicoConsulta;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Página pública do contrato do responsável (sem login): o código do link vai só no corpo, nunca no caminho (log de acesso, histórico,
 * prévia de link). O link sozinho mostra a marca e o título; texto, PDF e assinatura exigem o CPF do responsável. Com
 * {@code TREINOS_CONTRATOS_HABILITADO=false} responde 503 {@code CONTRATOS_INDISPONIVEL} ({@link ExigeContratos}). Limite por IP nas quatro
 * rotas e erros de CPF por IP e por código (429 + {@code Retry-After}).
 */
@RestController
@ExigeContratos
@RequestMapping("/publico/contratos")
public class ContratoPublicoController {

    private final ContratoPublicoService contratos;
    private final LimiteTentativas limite;

    public ContratoPublicoController(ContratoPublicoService contratos, LimiteTentativas limite) {
        this.contratos = contratos;
        this.limite = limite;
    }

    @PreAuthorize("permitAll()")
    @PostMapping("/consultar")
    public ContratoPublicoConsulta consultar(@RequestBody ConsultarContratoPublicoRequest r, HttpServletRequest http) {
        limite.contratoPublico(http.getRemoteAddr());
        return contratos.consultar(r.codigo());
    }

    @PreAuthorize("permitAll()")
    @PostMapping("/abrir")
    public ContratoPublicoAberto abrir(@RequestBody AbrirContratoPublicoRequest r, HttpServletRequest http) {
        limite.contratoPublico(http.getRemoteAddr());
        return contratos.abrir(r.codigo(), r.cpf(), http.getRemoteAddr());
    }

    /** O PDF do contrato, só com o CPF conferido: {@code attachment}, {@code no-store}. */
    @PreAuthorize("permitAll()")
    @PostMapping("/arquivo")
    public ResponseEntity<byte[]> arquivo(@RequestBody AbrirContratoPublicoRequest r, HttpServletRequest http) {
        limite.contratoPublico(http.getRemoteAddr());
        return ContratoController.pdf(contratos.arquivo(r.codigo(), r.cpf(), http.getRemoteAddr()));
    }

    @PreAuthorize("permitAll()")
    @PostMapping("/assinar")
    public ContratoPublicoAssinado assinar(@RequestBody AssinarContratoPublicoRequest r, HttpServletRequest http) {
        limite.contratoPublico(http.getRemoteAddr());
        return contratos.assinar(r.codigo(), r, http.getRemoteAddr(), http.getHeader(HttpHeaders.USER_AGENT));
    }
}
