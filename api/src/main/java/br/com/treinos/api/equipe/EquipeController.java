package br.com.treinos.api.equipe;
import br.com.treinos.api.conta.ExigeFuncionalidade;
import br.com.treinos.api.conta.RecursosDoApp;
import br.com.treinos.api.equipe.EquipeDtos.*;
import br.com.treinos.api.security.UsuarioAutenticado;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.UUID;
@RestController
public class EquipeController {
    private final EquipeService equipe;
    private final ConviteEquipeEmail conviteEmail;
    public EquipeController(EquipeService equipe,ConviteEquipeEmail conviteEmail) { this.equipe=equipe;this.conviteEmail=conviteEmail; }
    @PreAuthorize("hasAuthority('PERM_EQUIPE_LER')") @GetMapping("/permissoes/catalogo")
    public List<CatalogoPermissoes.Permissao> catalogo() { return CatalogoPermissoes.CATALOGO; }
    @PreAuthorize("hasAuthority('PERM_EQUIPE_LER')") @GetMapping("/perfis")
    public List<PerfilResponse> perfis() { return equipe.perfis(); }
    @ExigeFuncionalidade(RecursosDoApp.FUNCIONALIDADE_EQUIPE) @PreAuthorize("hasAuthority('PERM_PERFIL_ALTERAR')") @PostMapping("/perfis")
    public PerfilResponse criar(@RequestBody @Valid PerfilRequest r) { return equipe.criarPerfil(r); }
    @PreAuthorize("hasAuthority('PERM_PERFIL_ALTERAR')") @PutMapping("/perfis/{id}")
    public PerfilResponse alterar(@PathVariable UUID id,@RequestBody @Valid PerfilRequest r) { return equipe.alterarPerfil(id,r); }
    @ExigeFuncionalidade(RecursosDoApp.FUNCIONALIDADE_EQUIPE) @PreAuthorize("hasAuthority('PERM_PERFIL_ALTERAR')") @PostMapping("/perfis/{id}/duplicar")
    public PerfilResponse duplicar(@PathVariable UUID id) { return equipe.duplicarPerfil(id); }
    @PreAuthorize("hasAuthority('PERM_PERFIL_ALTERAR')") @DeleteMapping("/perfis/{id}")
    public ResponseEntity<Void> apagar(@PathVariable UUID id) { equipe.apagarPerfil(id);return ResponseEntity.noContent().build(); }
    @PreAuthorize("hasAuthority('PERM_EQUIPE_LER')") @GetMapping("/usuarios")
    public List<UsuarioResponse> usuarios() { return equipe.usuarios(); }
    // Também para quem atende interessados (escolher o responsável da inscrição e o padrão do link).
    @PreAuthorize("hasAuthority('PERM_ALUNO_LER') or hasAuthority('PERM_INSCRICAO_LER')") @GetMapping("/responsaveis")
    public List<EquipeService.Responsavel> responsaveis() { return equipe.responsaveis(); }
    @ExigeFuncionalidade(RecursosDoApp.FUNCIONALIDADE_EQUIPE) @PreAuthorize("hasAuthority('PERM_USUARIO_ALTERAR')") @PostMapping("/usuarios/convites")
    public ConviteResponse convidar(@RequestBody @Valid ConviteRequest r,@AuthenticationPrincipal UsuarioAutenticado eu) {
        // O convite já está gravado (transação do serviço fechada): a chamada HTTP do e-mail não segura conexão do banco.
        var convite=equipe.convidar(r,eu.usuarioId());
        return convite.comEmailEnviado(conviteEmail.enviar(br.com.treinos.api.web.Emails.normalizar(r.email()),convite.link()));
    }
    @PreAuthorize("hasAuthority('PERM_USUARIO_ALTERAR')") @DeleteMapping("/usuarios/convites/{id}")
    public ResponseEntity<Void> cancelarConvite(@PathVariable UUID id) { equipe.cancelarConvite(id);return ResponseEntity.noContent().build(); }
    @PreAuthorize("hasAuthority('PERM_USUARIO_ALTERAR')") @PutMapping("/usuarios/{id}")
    public UsuarioResponse usuario(@PathVariable UUID id,@RequestBody @Valid UsuarioRequest r) { return equipe.alterarUsuario(id,r); }
}
