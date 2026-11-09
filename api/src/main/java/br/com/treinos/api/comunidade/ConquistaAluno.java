package br.com.treinos.api.comunidade;

import jakarta.persistence.*;
import org.hibernate.annotations.TenantId;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "conquista_aluno")
public class ConquistaAluno {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;

    @Column(name = "aluno_id", nullable = false)
    private UUID alunoId;

    @Column(nullable = false, length = 60)
    private String tipo;

    @Column(nullable = false, length = 120)
    private String titulo;

    @Column(nullable = false, length = 300)
    private String descricao;

    @Column(nullable = false, length = 60)
    private String icone;

    @Column(name = "conquistada_em", nullable = false, updatable = false)
    private Instant conquistadaEm = Instant.now();

    protected ConquistaAluno() {}

    public ConquistaAluno(UUID alunoId, String tipo, String titulo, String descricao, String icone) {
        this.alunoId = alunoId;
        this.tipo = tipo;
        this.titulo = titulo;
        this.descricao = descricao;
        this.icone = icone;
    }

    public UUID getId() { return id; }
    public UUID getConsultoriaId() { return consultoriaId; }
    public UUID getAlunoId() { return alunoId; }
    public String getTipo() { return tipo; }
    public String getTitulo() { return titulo; }
    public String getDescricao() { return descricao; }
    public String getIcone() { return icone; }
    public Instant getConquistadaEm() { return conquistadaEm; }
}
