package br.com.treinos.api.alunos;

import jakarta.persistence.Basic;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.TenantId;

import java.time.Instant;
import java.util.UUID;

/**
 * Foto de perfil do aluno (opcional): um JPEG pequeno, já sem metadados, por aluno. Dado pessoal: os bytes nunca vão para
 * log nem {@code toString}, saem na anonimização e a exportação leva só a data.
 */
@Entity
@Table(name = "aluno_foto_perfil")
public class FotoPerfil {

    @Id
    @Column(name = "aluno_id", nullable = false, updatable = false)
    private UUID alunoId;
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

    protected FotoPerfil() {
    }

    FotoPerfil(UUID alunoId) {
        this.alunoId = alunoId;
    }

    void trocar(byte[] jpeg, Instant agora) {
        this.jpeg = jpeg.clone();
        this.tamanho = jpeg.length;
        this.atualizadaEm = agora;
    }

    public UUID getAlunoId() {
        return alunoId;
    }

    byte[] getJpeg() {
        return jpeg.clone();
    }

    public Instant getAtualizadaEm() {
        return atualizadaEm;
    }

    @Override
    public String toString() {
        return "FotoPerfil[" + alunoId + "]";
    }
}
