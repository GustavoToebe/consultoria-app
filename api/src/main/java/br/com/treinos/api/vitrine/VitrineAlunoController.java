package br.com.treinos.api.vitrine;

import br.com.treinos.api.fotos.RespostaDeFoto;
import br.com.treinos.api.vitrine.VitrineDtos.ItemDoAlunoResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/** A vitrine vista pelo aluno: só os itens ativos da consultoria dele, só leitura. Item inativo ou de outra consultoria = 404. */
@RestController
@ExigeVitrine
public class VitrineAlunoController {

    private final VitrineService vitrine;
    private final FotosDaVitrineService fotos;

    public VitrineAlunoController(VitrineService vitrine, FotosDaVitrineService fotos) {
        this.vitrine = vitrine;
        this.fotos = fotos;
    }

    @PreAuthorize("hasRole('ALUNO')")
    @GetMapping("/aluno/vitrine")
    public List<ItemDoAlunoResponse> itens() {
        return vitrine.listarDoAluno();
    }

    @PreAuthorize("hasRole('ALUNO')")
    @GetMapping("/aluno/vitrine/itens/{id}/foto")
    public ResponseEntity<byte[]> foto(@PathVariable UUID id) {
        return RespostaDeFoto.de(fotos.lerDoAluno(id));
    }
}
