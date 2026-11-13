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
 * Capa de vídeo (aulão ou post {@code VIDEO}): JPEG já regravado sem metadados, no banco, como a foto do mural (D7). {@code aulaId}
 * e {@code postId} nulos = pendente; quem liga a capa ao dono é um UPDATE em JPQL (por isso as duas colunas são só leitura aqui).
 * Os bytes nunca vão a log nem a {@code toString}; saem pela API com {@code no-store}.
 */
@Entity
@Table(name = "comunidade_capa")
public class ComunidadeCapa {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;

    @Basic(fetch = FetchType.LAZY)
    @Column(nullable = false, updatable = false)
    private byte[] bytes;

    @Column(nullable = false, updatable = false)
    private int tamanho;

    @Column(name = "criado_em", nullable = false, updatable = false)
    private Instant criadoEm;

    @Column(name = "aula_id", insertable = false, updatable = false)
    private UUID aulaId;

    @Column(name = "post_id", insertable = false, updatable = false)
    private UUID postId;

    protected ComunidadeCapa() {}

    ComunidadeCapa(byte[] bytes, Instant agora) {
        this.bytes = bytes.clone();
        this.tamanho = bytes.length;
        this.criadoEm = agora;
    }

    public UUID getId() { return id; }
    public UUID getAulaId() { return aulaId; }
    public UUID getPostId() { return postId; }
    byte[] getBytes() { return bytes.clone(); }

    @Override
    public String toString() {
        return "ComunidadeCapa[" + id + "]";
    }
}
