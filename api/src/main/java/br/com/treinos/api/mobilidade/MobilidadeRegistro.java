package br.com.treinos.api.mobilidade;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.Immutable;
import org.hibernate.annotations.TenantId;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Item de mobilidade marcado (ou desmarcado) pelo aluno num dia. Só leitura pelo JPA: a gravação é o upsert idempotente do
 * {@link MobilidadeRegistroUpsert} (SQL nativo, com a consultoria e o aluno sempre explícitos).
 */
@Entity
@Immutable
@Table(name = "mobilidade_registro")
public class MobilidadeRegistro {

    @Id
    private UUID id;

    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;

    @Column(name = "aluno_id", nullable = false)
    private UUID alunoId;

    @Column(name = "plano_versao_id", nullable = false)
    private UUID planoVersaoId;

    @Column(name = "secao_uid", nullable = false)
    private UUID secaoUid;

    @Column(name = "item_uid", nullable = false)
    private UUID itemUid;

    @Column(nullable = false)
    private LocalDate data;

    @Column(nullable = false)
    private boolean feito;

    @Column(nullable = false)
    private String situacao;

    protected MobilidadeRegistro() {
    }

    public UUID getId() { return id; }
    public UUID getConsultoriaId() { return consultoriaId; }
    public UUID getAlunoId() { return alunoId; }
    public UUID getPlanoVersaoId() { return planoVersaoId; }
    public UUID getSecaoUid() { return secaoUid; }
    public UUID getItemUid() { return itemUid; }
    public LocalDate getData() { return data; }
    public boolean isFeito() { return feito; }
    public String getSituacao() { return situacao; }
}
