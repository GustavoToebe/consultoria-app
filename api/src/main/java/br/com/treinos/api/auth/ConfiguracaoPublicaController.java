package br.com.treinos.api.auth;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;

/**
 * O que o app precisa saber antes do login: se há verificação humana e qual a chave pública do widget. Assim trocar a chave
 * não exige novo build. Só a chave pública sai daqui; o segredo nunca.
 */
@RestController
@RequestMapping("/publico/configuracao")
public class ConfiguracaoPublicaController {

    public record Configuracao(boolean verificacaoHumana, String siteKey) {
    }

    private final VerificacaoHumana verificacao;

    public ConfiguracaoPublicaController(VerificacaoHumana verificacao) {
        this.verificacao = verificacao;
    }

    @GetMapping
    public ResponseEntity<Configuracao> configuracao() {
        boolean ligada = verificacao.habilitada();
        return ResponseEntity.ok().cacheControl(CacheControl.maxAge(Duration.ofMinutes(5)).cachePublic())
                .body(new Configuracao(ligada, ligada ? verificacao.siteKey() : ""));
    }
}
