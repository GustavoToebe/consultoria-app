package br.com.treinos.api.alunos;

import br.com.plataforma.comum.web.BadRequestException;
import br.com.treinos.api.fotos.RespostaDeFoto;
import br.com.treinos.api.security.UsuarioAutenticado;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Instant;

/** Foto de perfil, lado do aluno: só a própria, sempre a da sessão. Os bytes nunca vão para cache. */
@RestController
public class FotoPerfilAlunoController {

    public record FotoPerfilGravada(Instant atualizadaEm) { }

    private final FotoPerfilService fotos;

    public FotoPerfilAlunoController(FotoPerfilService fotos) {
        this.fotos = fotos;
    }

    @PreAuthorize("hasRole('ALUNO')")
    @PutMapping(value = "/aluno/foto-perfil", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public FotoPerfilGravada trocar(@AuthenticationPrincipal UsuarioAutenticado eu, @RequestPart("arquivo") MultipartFile arquivo) {
        try {
            return new FotoPerfilGravada(fotos.gravarDoAluno(eu, arquivo.getBytes()));
        } catch (IOException e) {
            throw new BadRequestException("Não foi possível ler o arquivo enviado.");
        }
    }

    @PreAuthorize("hasRole('ALUNO')")
    @DeleteMapping("/aluno/foto-perfil")
    public ResponseEntity<Void> remover(@AuthenticationPrincipal UsuarioAutenticado eu) {
        fotos.removerDoAluno(eu);
        return ResponseEntity.noContent().build();
    }

    @PreAuthorize("hasRole('ALUNO')")
    @GetMapping("/aluno/foto-perfil")
    public ResponseEntity<byte[]> ver(@AuthenticationPrincipal UsuarioAutenticado eu) {
        return RespostaDeFoto.de(fotos.lerDoAluno(eu));
    }
}
