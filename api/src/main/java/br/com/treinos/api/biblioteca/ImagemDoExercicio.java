package br.com.treinos.api.biblioteca;

import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

/**
 * Bytes e tipo da imagem própria de um exercício, para a resposta das rotas. Como a foto de perfil e a imagem do
 * questionário: nunca vai para cache, não é farejada como outro tipo e o GIF segue animado ({@code inline}).
 */
public final class ImagemDoExercicio {

    private final String tipo;
    private final byte[] bytes;

    ImagemDoExercicio(String tipo, byte[] bytes) {
        this.tipo = tipo;
        this.bytes = bytes.clone();
    }

    public ResponseEntity<byte[]> resposta() {
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(tipo))
                .cacheControl(CacheControl.noStore())
                .header("X-Content-Type-Options", "nosniff")
                .header("Content-Disposition", "inline")
                .body(bytes.clone());
    }
}
