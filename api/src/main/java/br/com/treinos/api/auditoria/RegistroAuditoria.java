package br.com.treinos.api.auditoria;
import jakarta.persistence.*;
import org.hibernate.annotations.TenantId;
import java.time.Instant;
import java.util.UUID;
/** Conteúdo estritamente descritivo da ação; nunca valores ou textos clínicos. */
@Entity @Table(name="auditoria")
public class RegistroAuditoria {
    @Id private UUID id;
    @TenantId @Column(name="consultoria_id",nullable=false,updatable=false) private UUID consultoriaId;
    @Column(name="usuario_id") private UUID usuarioId;
    private String acao;
    private String entidade;
    @Column(name="entidade_id") private UUID entidadeId;
    private String resumo;
    private String ip;
    @Column(name="user_agent") private String userAgent;
    @Column(name="criado_em") private Instant criadoEm;
    protected RegistroAuditoria() { }
    public UUID getId() { return id; }
    public UUID getUsuarioId() { return usuarioId; }
    public String getAcao() { return acao; }
    public String getEntidade() { return entidade; }
    public UUID getEntidadeId() { return entidadeId; }
    public String getResumo() { return resumo; }
    public Instant getCriadoEm() { return criadoEm; }
    public String getIp() { return ip; }
    public String getUserAgent() { return userAgent; }
}
