package br.com.treinos.api.comunidade;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.TenantId;

import java.time.Instant;
import java.util.UUID;

/** Denúncia de um post (C10): uma por post e usuário. Só a equipe vê a contagem; ninguém vê quem denunciou. */
@Entity
@Table(name = "comunidade_mural_denuncia")
public class ComunidadeMuralDenuncia {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;

    @Column(name = "post_id", nullable = false, updatable = false)
    private UUID postId;

    @Column(name = "usuario_id", nullable = false, updatable = false)
    private UUID usuarioId;

    @Column(nullable = false, updatable = false, length = 20)
    private String motivo;

    @Column(name = "criado_em", nullable = false, updatable = false)
    private Instant criadoEm = Instant.now();

    protected ComunidadeMuralDenuncia() {
    }

    ComunidadeMuralDenuncia(UUID postId, UUID usuarioId, MotivoDeDenuncia motivo) {
        this.postId = postId;
        this.usuarioId = usuarioId;
        this.motivo = motivo.name();
    }

    public UUID getPostId() { return postId; }
    public String getMotivo() { return motivo; }
    public Instant getCriadoEm() { return criadoEm; }
}
