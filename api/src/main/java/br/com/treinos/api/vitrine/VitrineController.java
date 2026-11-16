package br.com.treinos.api.vitrine;

import br.com.plataforma.comum.web.BadRequestException;
import br.com.treinos.api.fotos.RespostaDeFoto;
import br.com.treinos.api.vitrine.VitrineDtos.ItemRequest;
import br.com.treinos.api.vitrine.VitrineDtos.ItemResponse;
import br.com.treinos.api.vitrine.VitrineDtos.OrdemRequest;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

/**
 * Vitrine da consultoria, pela equipe. Ler com {@code VITRINE_LER}; criar, alterar, apagar, ordenar e trocar a foto com
 * {@code VITRINE_ALTERAR}. Item de outra consultoria = 404.
 */
@RestController
@ExigeVitrine
public class VitrineController {

    private final VitrineService vitrine;
    private final FotosDaVitrineService fotos;

    public VitrineController(VitrineService vitrine, FotosDaVitrineService fotos) {
        this.vitrine = vitrine;
        this.fotos = fotos;
    }

    @PreAuthorize("hasAuthority('PERM_VITRINE_LER')")
    @GetMapping("/vitrine/itens")
    public List<ItemResponse> listar() {
        return vitrine.listar();
    }

    @PreAuthorize("hasAuthority('PERM_VITRINE_ALTERAR')")
    @PostMapping("/vitrine/itens")
    public ItemResponse criar(@RequestBody ItemRequest request) {
        return vitrine.criar(request);
    }

    @PreAuthorize("hasAuthority('PERM_VITRINE_ALTERAR')")
    @PutMapping("/vitrine/itens/{id}")
    public ItemResponse alterar(@PathVariable UUID id, @RequestBody ItemRequest request) {
        return vitrine.alterar(id, request);
    }

    @PreAuthorize("hasAuthority('PERM_VITRINE_ALTERAR')")
    @DeleteMapping("/vitrine/itens/{id}")
    public ResponseEntity<Void> excluir(@PathVariable UUID id, @RequestParam(required = false) Long versao) {
        vitrine.excluir(id, versao);
        return ResponseEntity.noContent().build();
    }

    /** A tela manda todos os ids na nova ordem (Subir/Descer é conta dela); 204, e a lista é lida de novo. */
    @PreAuthorize("hasAuthority('PERM_VITRINE_ALTERAR')")
    @PutMapping("/vitrine/itens/ordem")
    public ResponseEntity<Void> ordenar(@RequestBody OrdemRequest request) {
        vitrine.ordenar(request);
        return ResponseEntity.noContent().build();
    }

    @PreAuthorize("hasAuthority('PERM_VITRINE_LER')")
    @GetMapping("/vitrine/itens/{id}/foto")
    public ResponseEntity<byte[]> verFoto(@PathVariable UUID id) {
        return RespostaDeFoto.de(fotos.lerDaEquipe(id));
    }

    @PreAuthorize("hasAuthority('PERM_VITRINE_ALTERAR')")
    @PutMapping(value = "/vitrine/itens/{id}/foto", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ItemResponse trocarFoto(@PathVariable UUID id, @RequestPart("arquivo") MultipartFile arquivo) {
        try {
            fotos.gravar(id, arquivo.getBytes());
            return vitrine.buscar(id);
        } catch (IOException e) {
            throw new BadRequestException("Não foi possível ler o arquivo enviado.");
        }
    }

    @PreAuthorize("hasAuthority('PERM_VITRINE_ALTERAR')")
    @DeleteMapping("/vitrine/itens/{id}/foto")
    public ResponseEntity<Void> removerFoto(@PathVariable UUID id) {
        fotos.remover(id);
        return ResponseEntity.noContent().build();
    }
}
