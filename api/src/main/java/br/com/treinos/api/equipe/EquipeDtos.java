package br.com.treinos.api.equipe;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.Set;
import java.util.UUID;
public final class EquipeDtos {
    private EquipeDtos() { }
    public record PerfilRequest(@NotBlank @Size(max=120) String nome,@Size(max=500) String descricao,
                                @NotNull Set<@NotNull String> permissoes,Boolean ativo,Long versao) { }
    public record PerfilResponse(UUID id,String nome,String descricao,boolean acessoTotal,boolean sistema,boolean ativo,
                                 Set<String> permissoes,long usuarios,Long versao) { }
    public record UsuarioResponse(UUID id,String nome,String email,UUID perfilId,String perfilNome,boolean ativo,
                                  boolean convitePendente,Instant conviteExpiraEm,Instant ultimoAcesso) { }
    public record ConviteRequest(@NotBlank @Size(max=120) String nome,@NotBlank @Email @Size(max=254) String email,
                                @NotNull UUID perfilId) { }
    public record ConviteResponse(String codigo,String link,Instant expiraEm) { }
    public record UsuarioRequest(@NotBlank @Size(max=120) String nome,@NotNull UUID perfilId,@NotNull Boolean ativo) { }
    public record AceitarRequest(@NotBlank @Size(max=200) String senha) { }
    public record MeuPerfilRequest(@NotBlank @Size(max=120) String nome,@Size(max=30) String telefone) { }
}
