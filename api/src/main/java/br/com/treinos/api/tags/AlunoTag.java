package br.com.treinos.api.tags;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import org.hibernate.annotations.TenantId;

import java.io.Serializable;
import java.time.Instant;
import java.util.UUID;

/** A tag no aluno (V093): chave {@code (aluno_id, tag_id)}; some com o aluno ou com a tag (cascade) e na anonimização. */
@Entity
@Table(name = "aluno_tag")
@IdClass(AlunoTag.Chave.class)
public class AlunoTag {

    /** Chave composta; os nomes são os dos campos {@code @Id}. */
    public record Chave(UUID alunoId, UUID tagId) implements Serializable {
    }

    @Id
    @Column(name = "aluno_id", nullable = false, updatable = false)
    private UUID alunoId;
    @Id
    @Column(name = "tag_id", nullable = false, updatable = false)
    private UUID tagId;
    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;
    @Column(name = "criado_em", nullable = false, updatable = false)
    private Instant criadoEm;

    protected AlunoTag() {
    }

    AlunoTag(UUID alunoId, UUID tagId, Instant agora) {
        this.alunoId = alunoId;
        this.tagId = tagId;
        this.criadoEm = agora;
    }

    public UUID getAlunoId() { return alunoId; }
    public UUID getTagId() { return tagId; }
}
