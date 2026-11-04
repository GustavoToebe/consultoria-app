package br.com.treinos.api.alunos;

import br.com.plataforma.comum.web.BadRequestException;
import br.com.treinos.api.fotos.RespostaDeFoto;
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

/**
 * Foto de perfil pela equipe: quem vê o aluno vê a foto (sem foto, ou aluno de outra consultoria: 404); quem altera o
 * aluno ({@code ALUNO_ALTERAR}) troca e apaga.
 */
@RestController
public class FotoPerfilController {

    private final FotoPerfilService fotos;

    public FotoPerfilController(FotoPerfilService fotos) {
        this.fotos = fotos;
    }

    @PreAuthorize("hasAuthority('PERM_ALUNO_LER')")
    @GetMapping("/alunos/{id}/foto-perfil")
    public ResponseEntity<byte[]> ver(@PathVariable UUID id) {
        return RespostaDeFoto.de(fotos.lerDoTreinador(id));
    }

    /** A equipe troca a foto de perfil (não a de corpo) com as mesmas regras do aluno. */
    @PreAuthorize("hasAuthority('PERM_ALUNO_ALTERAR')")
    @PutMapping(value = "/alunos/{id}/foto-perfil", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public FotoPerfilAlunoController.FotoPerfilGravada trocar(@PathVariable UUID id,
                                                              @RequestPart("arquivo") MultipartFile arquivo) {
        try {
            return new FotoPerfilAlunoController.FotoPerfilGravada(fotos.gravarPelaEquipe(id, arquivo.getBytes()));
        } catch (IOException e) {
            throw new BadRequestException("Não foi possível ler o arquivo enviado.");
        }
    }

    @PreAuthorize("hasAuthority('PERM_ALUNO_ALTERAR')")
    @DeleteMapping("/alunos/{id}/foto-perfil")
    public ResponseEntity<Void> remover(@PathVariable UUID id) {
        fotos.removerPelaEquipe(id);
        return ResponseEntity.noContent().build();
    }
}
