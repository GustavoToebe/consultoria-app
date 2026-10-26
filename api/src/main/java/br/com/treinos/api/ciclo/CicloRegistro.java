package br.com.treinos.api.ciclo;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.TenantId;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/** Um período de menstruação. O id nasce no aparelho. {@code fim} nulo = em andamento. Sem texto livre. */
@Entity
@Table(name = "ciclo_registro")
public class CicloRegistro {

    @Id
    private UUID id;

    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;

    @Column(name = "aluno_id", nullable = false, updatable = false)
    private UUID alunoId;

    @Column(nullable = false)
    private LocalDate inicio;

    private LocalDate fim;

    @Column(name = "criado_em", nullable = false, updatable = false)
    private Instant criadoEm = Instant.now();

    @Column(name = "alterado_em", nullable = false)
    private Instant alteradoEm = criadoEm;

    protected CicloRegistro() { }

    public CicloRegistro(UUID id, UUID alunoId, LocalDate inicio, LocalDate fim) {
        this.id = id;
        this.alunoId = alunoId;
        this.inicio = inicio;
        this.fim = fim;
    }

    public UUID getId() { return id; }
    public UUID getAlunoId() { return alunoId; }
    public LocalDate getInicio() { return inicio; }
    public LocalDate getFim() { return fim; }
    public Instant getCriadoEm() { return criadoEm; }
    public Instant getAlteradoEm() { return alteradoEm; }

    public boolean mesmoConteudo(LocalDate inicio, LocalDate fim) {
        return this.inicio.equals(inicio) && java.util.Objects.equals(this.fim, fim);
    }

    public void alterar(LocalDate inicio, LocalDate fim) {
        this.inicio = inicio;
        this.fim = fim;
        this.alteradoEm = Instant.now();
    }
}
