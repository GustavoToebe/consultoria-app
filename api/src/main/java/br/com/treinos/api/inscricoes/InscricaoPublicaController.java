package br.com.treinos.api.inscricoes;

import br.com.treinos.api.auth.LimiteTentativas;
import br.com.treinos.api.auth.VerificacaoHumana;
import br.com.treinos.api.inscricoes.InscricaoDtos.InscricaoPublica;
import br.com.treinos.api.inscricoes.InscricaoDtos.InscricaoPublicaRequest;
import br.com.treinos.api.inscricoes.InscricaoDtos.InscricaoRecebida;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Página pública da inscrição (sem login). O código fica no caminho: é o link que a consultoria divulga, não um segredo
 * de uso único como o convite. O envio passa primeiro pela verificação humana (como o cadastro de treinador; desligada,
 * passa direto) e pelo limite por IP; a resposta é sempre a mesma mensagem neutra.
 */
@RestController
@RequestMapping("/publico/inscricoes")
public class InscricaoPublicaController {

    static final String RECEBIDA = "Recebemos sua inscrição. A equipe vai entrar em contato pelo WhatsApp.";

    private final InscricaoPublicaService inscricoes;
    private final LimiteTentativas limite;
    private final VerificacaoHumana verificacao;

    public InscricaoPublicaController(InscricaoPublicaService inscricoes, LimiteTentativas limite,
                                      VerificacaoHumana verificacao) {
        this.inscricoes = inscricoes;
        this.limite = limite;
        this.verificacao = verificacao;
    }

    @GetMapping("/{codigo}")
    public InscricaoPublica consultar(@PathVariable String codigo, HttpServletRequest http) {
        limite.inscricaoConsulta(http.getRemoteAddr());
        return inscricoes.consultar(codigo);
    }

    @PostMapping("/{codigo}")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public InscricaoRecebida inscrever(@PathVariable String codigo, @RequestBody @Valid InscricaoPublicaRequest request,
                                       HttpServletRequest http) {
        verificacao.exigir(request.turnstileToken(), http.getRemoteAddr());
        limite.inscricao(http.getRemoteAddr());
        inscricoes.inscrever(codigo, request);
        return new InscricaoRecebida(RECEBIDA);
    }
}
