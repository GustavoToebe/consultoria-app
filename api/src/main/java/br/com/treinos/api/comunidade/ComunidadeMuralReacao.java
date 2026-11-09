package br.com.treinos.api.comunidade;

import jakarta.persistence.*;
import org.hibernate.annotations.TenantId;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "comunidade_mural_reacao")
public class ComunidadeMuralReacao {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;

    @Column(name = "post_id", nullable = false)
    private UUID postId;

    @Column(name = "usuario_id", nullable = false)
    private UUID usuarioId;

    @Column(nullable = false, length = 16)
    private String emoji;

    @Column(name = "criado_em", nullable = false, updatable = false)
    private Instant criadoEm = Instant.now();

    protected ComunidadeMuralReacao() {}

    public ComunidadeMuralReacao(UUID postId, UUID usuarioId, String emoji) {
        this.postId = postId;
        this.usuarioId = usuarioId;
        this.emoji = emoji;
    }

    public UUID getId() { return id; }
    public UUID getConsultoriaId() { return consultoriaId; }
    public UUID getPostId() { return postId; }
    public UUID getUsuarioId() { return usuarioId; }
    public String getEmoji() { return emoji; }
    public Instant getCriadoEm() { return criadoEm; }
}
