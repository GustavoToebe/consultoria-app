package br.com.treinos.api.agenda;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.TenantId;

import java.time.Instant;
import java.util.UUID;

/**
 * Um aluno num compromisso (V042): participante com a situação dele (realizado, falta ou cancelado valem só para ele).
 * Quem muda a lista de participantes e as situações é o {@link AgendaService}, que também mantém {@code cancelado} do
 * compromisso e a versão dele.
 */
@Entity
@Table(name = "compromisso_aluno")
public class CompromissoAluno {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;

    @Column(name = "compromisso_id", nullable = false, updatable = false)
    private UUID compromissoId;

    @Column(name = "aluno_id", nullable = false, updatable = false)
    private UUID alunoId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SituacaoCompromisso situacao;

    @Column(name = "criado_em", nullable = false, updatable = false)
    private Instant criadoEm = Instant.now();

    @Column(name = "atualizado_em", nullable = false)
    private Instant atualizadoEm = criadoEm;

    protected CompromissoAluno() {
    }

    CompromissoAluno(UUID compromissoId, UUID alunoId, SituacaoCompromisso situacao) {
        this.compromissoId = compromissoId;
        this.alunoId = alunoId;
        this.situacao = situacao;
    }

    public UUID getId() { return id; }
    public UUID getConsultoriaId() { return consultoriaId; }
    public UUID getCompromissoId() { return compromissoId; }
    public UUID getAlunoId() { return alunoId; }
    public SituacaoCompromisso getSituacao() { return situacao; }
    public Instant getCriadoEm() { return criadoEm; }
    public Instant getAtualizadoEm() { return atualizadoEm; }

    void alterarSituacao(SituacaoCompromisso nova) {
        this.situacao = nova;
        this.atualizadoEm = Instant.now();
    }
}
