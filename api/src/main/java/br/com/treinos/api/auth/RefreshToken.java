package br.com.treinos.api.auth;

import br.com.treinos.api.security.DestinoCliente;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

/**
 * Sessão longa (30 dias). O banco guarda só o SHA-256 do token. Cada uso gera outro e marca este como usado
 * ({@code usado_em}); usado ou revogado apresentado de novo é sinal de roubo e derruba todas as sessões do usuário.
 */
@Entity
@Table(name = "refresh_token")
public class RefreshToken {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "usuario_id", nullable = false, updatable = false)
    private UUID usuarioId;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "token_hash", nullable = false, updatable = false, length = 64)
    private String tokenHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, updatable = false)
    private DestinoCliente cliente;

    @Column(name = "criado_em", insertable = false, updatable = false)
    private Instant criadoEm;

    @Column(name = "expira_em", nullable = false, updatable = false)
    private Instant expiraEm;

    @Column(name = "usado_em")
    private Instant usadoEm;

    @Column(name = "revogado_em")
    private Instant revogadoEm;

    protected RefreshToken() {
    }

    public RefreshToken(UUID usuarioId, String tokenHash, DestinoCliente cliente, Instant expiraEm) {
        this.usuarioId = usuarioId;
        this.tokenHash = tokenHash;
        this.cliente = cliente;
        this.expiraEm = expiraEm;
    }

    public UUID getId() {
        return id;
    }

    public UUID getUsuarioId() {
        return usuarioId;
    }

    public DestinoCliente getCliente() {
        return cliente;
    }

    public Instant getCriadoEm() {
        return criadoEm;
    }

    /** Já usado na rotação ou revogado no logout: apresentar de novo é reuso. */
    public boolean isGasto() {
        return usadoEm != null || revogadoEm != null;
    }

    public boolean isExpirado(Instant agora) {
        return !expiraEm.isAfter(agora);
    }

    public void marcarUsado(Instant quando) {
        this.usadoEm = quando;
    }

    public void revogar(Instant quando) {
        this.revogadoEm = quando;
    }
}
