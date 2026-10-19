package br.com.treinos.api.alunos;

import br.com.treinos.api.fotos.RespostaDeFoto;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/** Foto de perfil vista pela equipe: quem vê o aluno vê a foto. Sem foto (ou aluno de outra consultoria): 404. */
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
}
