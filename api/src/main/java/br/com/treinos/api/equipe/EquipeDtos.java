package br.com.treinos.api.equipe;
import br.com.treinos.api.consultoria.MarcaPublica;
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
    /** {@code emailEnviado}: o link também foi por e-mail; senão quem convidou copia o link da resposta. */
    public record ConviteResponse(String codigo,String link,Instant expiraEm,boolean emailEnviado) {
        public ConviteResponse comEmailEnviado(boolean enviado) { return new ConviteResponse(codigo,link,expiraEm,enviado); }
    }
    public record UsuarioRequest(@NotBlank @Size(max=120) String nome,@NotNull UUID perfilId,@NotNull Boolean ativo) { }
    /** Código e senha só no corpo, nunca o código no caminho (log de acesso, histórico, prévia de link). */
    public record AceitarRequest(@NotBlank @Size(max=64) String codigo,@NotBlank @Size(max=200) String senha) { }
    /** Código só no corpo, nunca no caminho (log de acesso, histórico, prévia de link). */
    public record ConsultarConviteRequest(@NotBlank @Size(max=64) String codigo) { }
    /** Só a marca da consultoria: nenhum dado de quem foi convidado. */
    public record ConviteEquipePublico(MarcaPublica consultoria) { }
    public record MeuPerfilRequest(@NotBlank @Size(max=120) String nome,@Size(max=30) String telefone) { }
}
