package br.com.treinos.api.comunidade;

import jakarta.persistence.Basic;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.TenantId;

import java.time.Instant;
import java.util.UUID;

/**
 * Foto de um post do mural (C7): JPEG já regravado sem metadados, no banco. {@code postId} nulo = pendente (enviada, ainda sem
 * post). Os bytes nunca vão a log nem a {@code toString}; saem pela API com {@code no-store}.
 */
@Entity
@Table(name = "comunidade_mural_foto")
public class ComunidadeMuralFoto {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;

    @Column(name = "post_id")
    private UUID postId;

    @Column(name = "autor_id", nullable = false, updatable = false)
    private UUID autorId;

    @Basic(fetch = FetchType.LAZY)
    @Column(nullable = false, updatable = false)
    private byte[] bytes;

    @Column(nullable = false, updatable = false)
    private int tamanho;

    @Column(name = "criado_em", nullable = false, updatable = false)
    private Instant criadoEm;

    protected ComunidadeMuralFoto() {
    }

    ComunidadeMuralFoto(UUID autorId, byte[] bytes, Instant agora) {
        this.autorId = autorId;
        this.bytes = bytes.clone();
        this.tamanho = bytes.length;
        this.criadoEm = agora;
    }

    public UUID getId() { return id; }
    public UUID getPostId() { return postId; }
    public UUID getAutorId() { return autorId; }
    byte[] getBytes() { return bytes.clone(); }
    public int getTamanho() { return tamanho; }
    public Instant getCriadoEm() { return criadoEm; }

    @Override
    public String toString() {
        return "ComunidadeMuralFoto[" + id + "]";
    }
}
