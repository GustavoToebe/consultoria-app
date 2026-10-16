package br.com.treinos.api.fotos;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/** Fotos da atualização, lado do treinador: mesma permissão do detalhe da atualização, e a foto precisa ser dela. */
@RestController
public class FotoTreinadorController {

    private final FotoService fotos;

    public FotoTreinadorController(FotoService fotos) {
        this.fotos = fotos;
    }

    @PreAuthorize("hasAuthority('PERM_ATUALIZACAO_LER') and hasAuthority('PERM_ALUNO_SENSIVEL_LER')")
    @GetMapping("/atualizacoes/{atualizacaoId}/fotos/{fotoId}")
    public ResponseEntity<byte[]> ver(@PathVariable UUID atualizacaoId, @PathVariable UUID fotoId) {
        return RespostaDeFoto.de(fotos.lerDoTreinador(atualizacaoId, fotoId));
    }
}
