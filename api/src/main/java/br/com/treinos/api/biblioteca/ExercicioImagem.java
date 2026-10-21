package br.com.treinos.api.biblioteca;

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
 * Imagem ou GIF próprio que o treinador envia para um exercício da biblioteca (V021). Uma por exercício, no banco como a
 * imagem do questionário: JPEG, PNG ou GIF já regravado sem metadados, até 1 MB e 800 px. O {@code id} é o do exercício.
 */
@Entity
@Table(name = "exercicio_imagem")
public class ExercicioImagem {

    @Id
    @Column(name = "exercicio_id")
    private UUID exercicioId;
    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;
    @Column(nullable = false)
    private String tipo;
    @Basic(fetch = FetchType.LAZY)
    @Column(nullable = false)
    private byte[] bytes;
    @Column(nullable = false)
    private int tamanho;
    @Column(name = "atualizada_em", nullable = false)
    private Instant atualizadaEm;

    protected ExercicioImagem() {
    }

    ExercicioImagem(UUID exercicioId, String tipo, byte[] bytes, Instant agora) {
        this.exercicioId = exercicioId;
        substituir(tipo, bytes, agora);
    }

    void substituir(String tipo, byte[] bytes, Instant agora) {
        this.tipo = tipo;
        this.bytes = bytes.clone();
        this.tamanho = bytes.length;
        this.atualizadaEm = agora;
    }

    public UUID getExercicioId() {
        return exercicioId;
    }

    public String getTipo() {
        return tipo;
    }

    byte[] getBytes() {
        return bytes.clone();
    }

    public Instant getAtualizadaEm() {
        return atualizadaEm;
    }

    @Override
    public String toString() {
        return "ExercicioImagem[" + exercicioId + "]";
    }
}
