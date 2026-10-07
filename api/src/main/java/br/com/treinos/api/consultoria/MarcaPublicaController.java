package br.com.treinos.api.consultoria;

import br.com.treinos.api.web.NaoEncontradoException;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.util.UUID;

/**
 * Logo pública (seção 9.1): aparece na tela de convite antes do login e no PDF. O UUID da consultoria não é
 * adivinhável e a imagem não tem dado de aluno. A URL leva a versão ({@code ?v=}), então o cache pode ser longo.
 */
@RestController
@RequestMapping("/publico/marcas")
public class MarcaPublicaController {

    private final MarcaService marcas;

    public MarcaPublicaController(MarcaService marcas) {
        this.marcas = marcas;
    }

    @GetMapping("/{consultoriaId}/logo")
    public ResponseEntity<byte[]> logo(@PathVariable UUID consultoriaId) {
        return marcas.logoPublica(consultoriaId)
                .map(logo -> ResponseEntity.ok()
                        .contentType(MediaType.parseMediaType(logo.tipo()))
                        .header("X-Content-Type-Options", "nosniff")
                        .header(HttpHeaders.CONTENT_DISPOSITION, "inline")
                        .cacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePublic().immutable())
                        .body(logo.bytes()))
                .orElseThrow(() -> new NaoEncontradoException("Logo não encontrada."));
    }
}
