package br.com.treinos.api.cep;

import br.com.treinos.api.auth.LimiteTentativas;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * Rua, bairro, cidade e UF de um CEP, para o app preencher o endereço (ficha do aluno e resposta ENDERECO da anamnese).
 * O CEP vai no corpo (POST), não no caminho: o endereço do aluno não deve ficar no log de acesso do proxy nem no {@code path}
 * dos erros. Vale para o aluno e para quem pode gravar endereço (a ficha só mostra os campos com essa permissão); a rota não
 * toca em dado da consultoria. Limite por IP, porque cada consulta pode virar uma chamada ao serviço de CEP.
 */
@RestController
public class CepController {

    /** CEP como digitado (com ou sem máscara); o serviço confere o formato. */
    public record ConsultaDeCep(@Size(max = 20) String cep) { }

    private final CepService cep;
    private final LimiteTentativas limite;

    public CepController(CepService cep, LimiteTentativas limite) {
        this.cep = cep;
        this.limite = limite;
    }

    @PreAuthorize("hasRole('ALUNO') or hasAuthority('PERM_ALUNO_SENSIVEL_ALTERAR')")
    @PostMapping("/enderecos/cep/consultar")
    public EnderecoDoCep buscar(@Valid @RequestBody ConsultaDeCep consulta, HttpServletRequest http) {
        limite.cepConsulta(http.getRemoteAddr());
        return cep.buscar(consulta.cep());
    }
}
