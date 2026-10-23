package br.com.treinos.api.fotos;

import br.com.plataforma.comum.web.BadRequestException;
import br.com.treinos.api.security.UsuarioAutenticado;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import br.com.treinos.api.fotos.ComparacaoDeFotosService.Item;
import br.com.treinos.api.fotos.ComparacaoDeFotosService.UsoDeImagem;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
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

/** Fotos da atualização e da anamnese, lado do aluno: só as próprias. Foto de corpo é dado sensível: nunca em cache, nunca em URL pública. */
@RestController
public class FotoAlunoController {

    public record FotoCriada(UUID id) { }

    public record PedidoUso(@NotNull Boolean autorizado) { }

    private final FotoService fotos;
    private final ComparacaoDeFotosService comparacao;

    public FotoAlunoController(FotoService fotos, ComparacaoDeFotosService comparacao) {
        this.fotos = fotos;
        this.comparacao = comparacao;
    }

    @PreAuthorize("hasRole('ALUNO')")
    @GetMapping("/aluno/fotos/linha-do-tempo")
    public List<Item> linhaDoTempo(@AuthenticationPrincipal UsuarioAutenticado eu) {
        return comparacao.linhaDoTempoDoAluno(eu);
    }

    @PreAuthorize("hasRole('ALUNO')")
    @GetMapping("/aluno/uso-de-imagem")
    public UsoDeImagem usoDeImagem(@AuthenticationPrincipal UsuarioAutenticado eu) {
        return comparacao.usoDeImagem(eu);
    }

    @PreAuthorize("hasRole('ALUNO')")
    @PutMapping("/aluno/uso-de-imagem")
    public UsoDeImagem definirUsoDeImagem(@AuthenticationPrincipal UsuarioAutenticado eu,
                                          @Valid @RequestBody PedidoUso pedido) {
        return comparacao.definirUsoDeImagem(eu, pedido.autorizado());
    }

    @PreAuthorize("hasRole('ALUNO')")
    @GetMapping("/aluno/fotos/configuracao")
    public FotoService.Configuracao configuracao() {
        return fotos.configuracao();
    }

    /** {@code pastaId} (atualização) ou {@code anamneseId} (anamnese pendente) vai como parâmetro, junto do arquivo. */
    @PreAuthorize("hasRole('ALUNO')")
    @PostMapping(value = "/aluno/fotos", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public FotoCriada subir(@AuthenticationPrincipal UsuarioAutenticado eu,
                            @RequestParam(value = "pastaId", required = false) UUID pastaId,
                            @RequestParam(value = "anamneseId", required = false) UUID anamneseId,
                            @RequestPart("arquivo") MultipartFile arquivo) {
        try {
            return new FotoCriada(fotos.subir(eu, pastaId, anamneseId, arquivo.getBytes()));
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
