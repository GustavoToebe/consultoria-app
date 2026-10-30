package br.com.treinos.api.agua;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.Immutable;
import org.hibernate.annotations.TenantId;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Água que o aluno marcou num dia, em mililitros. Só leitura pelo JPA: a gravação é o upsert idempotente do
 * {@link AguaDoDiaUpsert} (SQL nativo, com a consultoria e o aluno sempre explícitos).
 */
@Entity
@Immutable
@Table(name = "agua_do_dia")
public class AguaDoDia {

    @Id
    private UUID id;

    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;

    @Column(name = "aluno_id", nullable = false)
    private UUID alunoId;

    @Column(nullable = false)
    private LocalDate data;

    @Column(name = "agua_ml", nullable = false)
    private int aguaMl;

    protected AguaDoDia() {
    }

    public UUID getId() { return id; }
    public UUID getConsultoriaId() { return consultoriaId; }
    public UUID getAlunoId() { return alunoId; }
    public LocalDate getData() { return data; }
    public int getAguaMl() { return aguaMl; }
}
