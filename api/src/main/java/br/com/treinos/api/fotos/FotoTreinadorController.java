package br.com.treinos.api.fotos;

import br.com.treinos.api.fotos.ComparacaoDeFotosService.ArquivoComparacao;
import br.com.treinos.api.fotos.ComparacaoDeFotosService.FormatoPedido;
import br.com.treinos.api.fotos.ComparacaoDeFotosService.Item;
import br.com.treinos.api.security.UsuarioAutenticado;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/** Fotos da atualização e da anamnese, lado do treinador: mesma permissão do detalhe, e a foto precisa ser dele. */
@RestController
public class FotoTreinadorController {

    public record GrupoComparacao(@NotNull @Size(min = 2, max = 2) List<@NotNull UUID> fotoIds) {
    }

    public record PedidoComparacao(@NotNull FormatoPedido formato, boolean comLogo,
                                   @NotNull @Size(min = 1, max = 6) List<@NotNull @Valid GrupoComparacao> imagens) {
    }

    private final FotoService fotos;
    private final ComparacaoDeFotosService comparacao;

    public FotoTreinadorController(FotoService fotos, ComparacaoDeFotosService comparacao) {
        this.fotos = fotos;
        this.comparacao = comparacao;
    }

    @PreAuthorize("hasAuthority('PERM_ATUALIZACAO_LER') and hasAuthority('PERM_ALUNO_SENSIVEL_LER')")
    @GetMapping("/alunos/{alunoId}/fotos")
    public List<Item> linhaDoTempo(@PathVariable UUID alunoId) {
        return comparacao.linhaDoTempo(alunoId);
    }

    @PreAuthorize("hasAuthority('PERM_ATUALIZACAO_LER') and hasAuthority('PERM_ALUNO_SENSIVEL_LER')")
    @PostMapping("/alunos/{alunoId}/fotos/comparacao")
    public ResponseEntity<byte[]> comparar(@AuthenticationPrincipal UsuarioAutenticado eu, @PathVariable UUID alunoId,
                                           @Valid @RequestBody PedidoComparacao pedido) {
        ArquivoComparacao arquivo = comparacao.gerar(eu, alunoId, pedido.formato(), pedido.comLogo(),
                pedido.imagens().stream().map(GrupoComparacao::fotoIds).toList());
        return ResponseEntity.ok()
                .contentType(arquivo.tipo())
                .cacheControl(CacheControl.noStore())
                .header("X-Content-Type-Options", "nosniff")
                .header("Content-Disposition", "attachment; filename=\"" + arquivo.nome() + "\"")
                .body(arquivo.bytes());
    }

    @PreAuthorize("hasAuthority('PERM_ATUALIZACAO_LER') and hasAuthority('PERM_ALUNO_SENSIVEL_LER')")
    @GetMapping("/atualizacoes/{atualizacaoId}/fotos/{fotoId}")
    public ResponseEntity<byte[]> ver(@PathVariable UUID atualizacaoId, @PathVariable UUID fotoId) {
        return RespostaDeFoto.de(fotos.lerDoTreinador(atualizacaoId, fotoId));
    }

    @PreAuthorize("hasAuthority('PERM_ANAMNESE_LER') and hasAuthority('PERM_ALUNO_SENSIVEL_LER')")
    @GetMapping("/anamneses/{anamneseId}/fotos/{fotoId}")
    public ResponseEntity<byte[]> verDaAnamnese(@PathVariable UUID anamneseId, @PathVariable UUID fotoId) {
        return RespostaDeFoto.de(fotos.lerDaAnamnese(anamneseId, fotoId));
    }
}
