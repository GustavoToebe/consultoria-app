package br.com.treinos.api.comunidade;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.TenantId;

import java.util.UUID;

/** Uma opção da enquete (2 a 6 por post); imutável desde a criação. O texto nunca vai a log. */
@Entity
@Table(name = "comunidade_enquete_opcao")
public class ComunidadeEnqueteOpcao {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;

    @Column(name = "post_id", nullable = false, updatable = false)
    private UUID postId;

    @Column(nullable = false, updatable = false)
    private int ordem;

    @Column(nullable = false, updatable = false, length = 80)
    private String texto;

    protected ComunidadeEnqueteOpcao() {}

    ComunidadeEnqueteOpcao(UUID postId, int ordem, String texto) {
        this.postId = postId;
        this.ordem = ordem;
        this.texto = texto;
    }

    public UUID getId() { return id; }
    public UUID getPostId() { return postId; }
    public int getOrdem() { return ordem; }
    public String getTexto() { return texto; }

    @Override
    public String toString() {
        return "ComunidadeEnqueteOpcao[" + id + "]";
    }
}
