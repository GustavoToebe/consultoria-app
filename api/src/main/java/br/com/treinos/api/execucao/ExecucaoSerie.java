package br.com.treinos.api.execucao;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.Immutable;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.TenantId;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Série registrada pelo aluno. Só leitura pelo JPA: a gravação é o upsert idempotente do {@link ExecucaoUpsert}
 * (SQL nativo, com a consultoria e o aluno sempre explícitos). {@code exercicioId} e {@code serieTrabalho} vêm da versão
 * do plano, nunca do cliente.
 */
@Entity
@Immutable
@Table(name = "execucao_serie")
public class ExecucaoSerie {

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

    @Column(name = "exercicio_uid", nullable = false)
    private UUID exercicioUid;

    @Column(name = "serie_uid", nullable = false)
    private UUID serieUid;

    @Column(name = "exercicio_id")
    private UUID exercicioId;

    @Column(name = "serie_trabalho", nullable = false)
    private boolean serieTrabalho;

    @Column(nullable = false)
    private LocalDate data;

    private BigDecimal carga;

    @Column(nullable = false)
    private String unidade;

    private Integer repeticoes;

    @Column(nullable = false)
    private boolean concluida;

    private String observacao;

    @Column(name = "alterado_no_aparelho_em", nullable = false)
    private Instant alteradoNoAparelhoEm;

    @Column(name = "recebido_em", nullable = false)
    private Instant recebidoEm;

    @Column(name = "conta_no_progresso", nullable = false)
    private boolean contaNoProgresso;

    /** Etapas registradas (JSON, lido pelo {@code HistoricoService}); nulo = a série registrada inteira. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private String etapas;

    @Column(name = "referencia_carga")
    private BigDecimal referenciaCarga;

    @Column(name = "referencia_origem")
    private String referenciaOrigem;

    protected ExecucaoSerie() {
    }

    public UUID getId() {
        return id;
    }

    public UUID getConsultoriaId() {
        return consultoriaId;
    }

    public UUID getAlunoId() {
        return alunoId;
    }

    public UUID getPlanoVersaoId() {
        return planoVersaoId;
    }

    public UUID getSessaoUid() {
        return sessaoUid;
    }

    public UUID getExercicioUid() {
        return exercicioUid;
    }

    public UUID getSerieUid() {
        return serieUid;
    }

    public UUID getExercicioId() {
        return exercicioId;
    }

    public boolean isSerieTrabalho() {
        return serieTrabalho;
    }

    public LocalDate getData() {
        return data;
    }

    public BigDecimal getCarga() {
        return carga;
    }

    public String getUnidade() {
        return unidade;
    }

    public Integer getRepeticoes() {
        return repeticoes;
    }

    public boolean isConcluida() {
        return concluida;
    }

    public String getObservacao() {
        return observacao;
    }

    public Instant getAlteradoNoAparelhoEm() {
        return alteradoNoAparelhoEm;
    }

    public Instant getRecebidoEm() {
        return recebidoEm;
    }

    public boolean isContaNoProgresso() {
        return contaNoProgresso;
    }

    public String getEtapas() {
        return etapas;
    }

    public BigDecimal getReferenciaCarga() {
        return referenciaCarga;
    }

    public String getReferenciaOrigem() {
        return referenciaOrigem;
    }
}
