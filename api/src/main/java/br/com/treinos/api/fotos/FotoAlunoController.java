package br.com.treinos.api.fotos;

import br.com.plataforma.comum.web.BadRequestException;
import br.com.treinos.api.security.UsuarioAutenticado;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.UUID;

/** Fotos da atualização, lado do aluno: só as próprias. Foto de corpo é dado sensível: nunca em cache, nunca em URL pública. */
@RestController
public class FotoAlunoController {

    public record FotoCriada(UUID id) { }

    private final FotoService fotos;

    public FotoAlunoController(FotoService fotos) {
        this.fotos = fotos;
    }

    @PreAuthorize("hasRole('ALUNO')")
    @GetMapping("/aluno/fotos/configuracao")
    public FotoService.Configuracao configuracao() {
        return fotos.configuracao();
    }

    /** {@code pastaId} vai como campo do formulário (multipart), junto do arquivo. */
    @PreAuthorize("hasRole('ALUNO')")
    @PostMapping(value = "/aluno/fotos", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public FotoCriada subir(@AuthenticationPrincipal UsuarioAutenticado eu, @RequestParam("pastaId") UUID pastaId,
                            @RequestPart("arquivo") MultipartFile arquivo) {
        try {
            return new FotoCriada(fotos.subir(eu, pastaId, arquivo.getBytes()));
        } catch (IOException e) {
            throw new BadRequestException("Não foi possível ler o arquivo enviado.");
        }
    }

    @PreAuthorize("hasRole('ALUNO')")
    @DeleteMapping("/aluno/fotos/{id}")
    public ResponseEntity<Void> remover(@AuthenticationPrincipal UsuarioAutenticado eu, @PathVariable UUID id) {
        fotos.remover(eu, id);
        return ResponseEntity.noContent().build();
    }

    @PreAuthorize("hasRole('ALUNO')")
    @GetMapping("/aluno/fotos/{id}")
    public ResponseEntity<byte[]> ver(@AuthenticationPrincipal UsuarioAutenticado eu, @PathVariable UUID id) {
        return RespostaDeFoto.de(fotos.lerDoAluno(eu, id));
    }
}
