package br.com.treinos.api.equipe;
import jakarta.persistence.*;
import org.hibernate.annotations.TenantId;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.Instant;
import java.util.UUID;
@Entity @Table(name="usuario_convite")
public class UsuarioConvite {
    @Id @GeneratedValue(strategy=GenerationType.UUID) private UUID id;
    @TenantId @Column(name="consultoria_id",nullable=false,updatable=false) private UUID consultoriaId;
    private String email;
    private String nome;
    @Column(name="perfil_id") private UUID perfilId;
    @JdbcTypeCode(SqlTypes.CHAR) @Column(name="codigo_hash",length=64) private String codigoHash;
    @Column(name="expira_em") private Instant expiraEm;
    @Column(name="usado_em") private Instant usadoEm;
    @Column(name="criado_por") private UUID criadoPor;
    @Column(name="criado_em",insertable=false,updatable=false) private Instant criadoEm;
    protected UsuarioConvite() { }
    public UsuarioConvite(String nome,String email,UUID perfilId,String hash,Instant expiraEm,UUID criadoPor) {
        this.nome=nome;this.email=email;this.perfilId=perfilId;this.codigoHash=hash;this.expiraEm=expiraEm;this.criadoPor=criadoPor;
    }
    public UUID getId() { return id; }
    public String getEmail() { return email; }
    public String getNome() { return nome; }
    public UUID getPerfilId() { return perfilId; }
    public Instant getExpiraEm() { return expiraEm; }
    public Instant getUsadoEm() { return usadoEm; }
    public void consumir() { usadoEm=Instant.now(); }
}
