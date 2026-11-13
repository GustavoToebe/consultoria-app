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

/**
 * Voto identificado: uma linha por (usuário, opção). {@code votadoEm} é o instante em que aquela opção foi escolhida e não muda
 * enquanto a opção continua escolhida; retirar apaga a linha (nenhum histórico). Nunca em log.
 */
@Entity
@Table(name = "comunidade_enquete_voto")
public class ComunidadeEnqueteVoto {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;

    @Column(name = "post_id", nullable = false, updatable = false)
    private UUID postId;

    @Column(name = "opcao_id", nullable = false, updatable = false)
    private UUID opcaoId;

    @Column(name = "usuario_id", nullable = false, updatable = false)
    private UUID usuarioId;

    @Column(name = "votado_em", nullable = false, updatable = false)
    private Instant votadoEm;

    protected ComunidadeEnqueteVoto() {}

    ComunidadeEnqueteVoto(UUID postId, UUID opcaoId, UUID usuarioId, Instant votadoEm) {
        this.postId = postId;
        this.opcaoId = opcaoId;
        this.usuarioId = usuarioId;
        this.votadoEm = votadoEm;
    }

    public UUID getId() { return id; }
    public UUID getPostId() { return postId; }
    public UUID getOpcaoId() { return opcaoId; }
    public UUID getUsuarioId() { return usuarioId; }
    public Instant getVotadoEm() { return votadoEm; }

    @Override
    public String toString() {
        return "ComunidadeEnqueteVoto[" + id + "]";
    }
}
