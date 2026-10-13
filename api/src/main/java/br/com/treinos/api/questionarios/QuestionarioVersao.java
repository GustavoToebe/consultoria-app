package br.com.treinos.api.questionarios;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.TenantId;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

/** Versão publicada de um questionário: imutável (colunas sem update e trigger no banco). */
@Entity
@Table(name = "questionario_versao")
public class QuestionarioVersao {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;

    @Column(name = "questionario_id", nullable = false, updatable = false)
    private UUID questionarioId;

    @Column(nullable = false, updatable = false)
    private int numero;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb", nullable = false, updatable = false)
    private String conteudo;

    @Column(name = "publicado_em", nullable = false, updatable = false)
    private Instant publicadoEm = Instant.now();

    @Column(name = "publicado_por", updatable = false)
    private UUID publicadoPor;

    protected QuestionarioVersao() {
    }

    public QuestionarioVersao(UUID questionarioId, int numero, String conteudo, UUID publicadoPor) {
        this.questionarioId = questionarioId;
        this.numero = numero;
        this.conteudo = conteudo;
        this.publicadoPor = publicadoPor;
    }

    public UUID getId() { return id; }
    public UUID getConsultoriaId() { return consultoriaId; }
    public UUID getQuestionarioId() { return questionarioId; }
    public int getNumero() { return numero; }
    public String getConteudo() { return conteudo; }
    public Instant getPublicadoEm() { return publicadoEm; }
    public UUID getPublicadoPor() { return publicadoPor; }
}
