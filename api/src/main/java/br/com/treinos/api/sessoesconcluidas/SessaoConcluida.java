package br.com.treinos.api.sessoesconcluidas;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.Immutable;
import org.hibernate.annotations.TenantId;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Sessão do treino que o aluno concluiu (ou reabriu) num dia. Só leitura pelo JPA: a gravação é o upsert idempotente do
 * {@link SessaoConcluidaUpsert} (SQL nativo, com a consultoria e o aluno sempre explícitos). O {@code comentario} é dado
 * sensível do aluno: não vai a {@code toString}, log nem auditoria.
 */
@Entity
@Immutable
@Table(name = "sessao_concluida")
public class SessaoConcluida {

    @Id
    private UUID id;

    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;

    @Column(name = "aluno_id", nullable = false)
    private UUID alunoId;

    @Column(name = "plano_versao_id", nullable = false)
    private UUID planoVersaoId;

    @Column(name = "sessao_uid", nullable = false)
    private UUID sessaoUid;

    @Column(nullable = false)
    private LocalDate data;

    @Column(nullable = false)
    private boolean concluida;

    private String resultado;

    @Column(name = "duracao_segundos")
    private Integer duracaoSegundos;

    private String comentario;

    @Column(nullable = false)
    private String situacao;

    protected SessaoConcluida() {
    }

    public UUID getId() { return id; }
    public UUID getConsultoriaId() { return consultoriaId; }
    public UUID getAlunoId() { return alunoId; }
    public UUID getPlanoVersaoId() { return planoVersaoId; }
    public UUID getSessaoUid() { return sessaoUid; }
    public LocalDate getData() { return data; }
    public boolean isConcluida() { return concluida; }
    public String getResultado() { return resultado; }
    public Integer getDuracaoSegundos() { return duracaoSegundos; }
    public String getComentario() { return comentario; }
    public String getSituacao() { return situacao; }

    @Override
    public String toString() {
        return "SessaoConcluida[id=" + id + "]";
    }
}
