package br.com.treinos.api.fotos;

import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

/** Foto de corpo é dado sensível: a resposta nunca vai para cache (nem do navegador, nem de proxy) e não é farejada como outro tipo. */
final class RespostaDeFoto {

    private RespostaDeFoto() {
    }

    static ResponseEntity<byte[]> de(byte[] jpeg) {
        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_JPEG)
                .cacheControl(CacheControl.noStore())
                .header("X-Content-Type-Options", "nosniff")
                .header("Content-Disposition", "inline; filename=\"foto.jpg\"")
                .body(jpeg);
    }
}
