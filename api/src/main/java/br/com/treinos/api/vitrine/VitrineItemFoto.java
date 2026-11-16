package br.com.treinos.api.vitrine;

import jakarta.persistence.Basic;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.TenantId;

import java.time.Instant;
import java.util.UUID;

/** Foto do item da vitrine (1:1, V075): JPEG já regravado sem metadados, no banco. Os bytes nunca vão a log nem a {@code toString}. */
@Entity
@Table(name = "vitrine_item_foto")
public class VitrineItemFoto {

    @Id
    @Column(name = "item_id", nullable = false, updatable = false)
    private UUID itemId;

    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;

    @Basic(fetch = FetchType.LAZY)
    @Column(nullable = false)
    private byte[] jpeg;

    @Column(nullable = false)
    private int tamanho;

    @Column(name = "atualizada_em", nullable = false)
    private Instant atualizadaEm;

    protected VitrineItemFoto() {
    }

    VitrineItemFoto(UUID itemId) {
        this.itemId = itemId;
    }

    void trocar(byte[] jpeg, Instant agora) {
        this.jpeg = jpeg.clone();
        this.tamanho = jpeg.length;
        this.atualizadaEm = agora;
    }

    public UUID getItemId() { return itemId; }
    public Instant getAtualizadaEm() { return atualizadaEm; }
    byte[] getJpeg() { return jpeg.clone(); }

    @Override
    public String toString() {
        return "VitrineItemFoto[" + itemId + "]";
    }
}
