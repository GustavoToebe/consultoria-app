package br.com.treinos.api.biblioteca;

import br.com.plataforma.comum.web.BadRequestException;
import br.com.treinos.api.biblioteca.dto.BibliotecaDtos.ExercicioResponse;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.UUID;

/** Imagem ou GIF próprio do exercício, lado da equipe. O aluno vê pela rota dele, só a dos exercícios do plano. */
@RestController
public class ExercicioImagemController {

    private final ExercicioImagemService imagens;

    public ExercicioImagemController(ExercicioImagemService imagens) {
        this.imagens = imagens;
    }

    @PreAuthorize("hasAuthority('PERM_BIBLIOTECA_LER')")
    @GetMapping("/exercicios/{id}/imagem")
    public ResponseEntity<byte[]> ver(@PathVariable UUID id) {
        return imagens.ler(id).resposta();
    }

    @PreAuthorize("hasAuthority('PERM_BIBLIOTECA_ALTERAR')")
    @PutMapping(value = "/exercicios/{id}/imagem", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ExercicioResponse enviar(@PathVariable UUID id, @RequestPart("arquivo") MultipartFile arquivo) {
        try {
            return imagens.enviar(id, arquivo.getBytes());
        } catch (IOException e) {
            throw new BadRequestException("Não foi possível ler o arquivo enviado.");
        }
    }

    @PreAuthorize("hasAuthority('PERM_BIBLIOTECA_ALTERAR')")
    @DeleteMapping("/exercicios/{id}/imagem")
    public ExercicioResponse remover(@PathVariable UUID id) {
        return imagens.remover(id);
    }
}
