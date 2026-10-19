package br.com.treinos.api.questionarios;

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
 * Imagem de pergunta ou de opção de um questionário (escala de referência, aparelho...). PNG ou JPEG já regravado sem
 * metadados, pequeno, no banco (como a logo). O conteúdo do questionário a cita pelo id; quem pode ver o questionário ou
 * o aluno que o responde a vê pela API, com token. O treinador responde pela licença da imagem que envia.
 */
@Entity
@Table(name = "questionario_imagem")
public class QuestionarioImagem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;
    @Column(nullable = false, updatable = false)
    private String tipo;
    @Basic(fetch = FetchType.LAZY)
    @Column(nullable = false, updatable = false)
    private byte[] bytes;
    @Column(nullable = false, updatable = false)
    private int tamanho;
    @Column(name = "criada_em", nullable = false, updatable = false)
    private Instant criadaEm;

    protected QuestionarioImagem() {
    }

    QuestionarioImagem(String tipo, byte[] bytes, Instant agora) {
        this.tipo = tipo;
        this.bytes = bytes.clone();
        this.tamanho = bytes.length;
        this.criadaEm = agora;
    }

    public UUID getId() { return id; }
    public String getTipo() { return tipo; }
    byte[] getBytes() { return bytes.clone(); }
    public Instant getCriadaEm() { return criadaEm; }

    @Override
    public String toString() {
        return "QuestionarioImagem[" + id + "]";
    }
}
