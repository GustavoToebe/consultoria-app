package br.com.treinos.api.lesoes;

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
import java.time.LocalDate;
import java.util.UUID;

/** Lesão do histórico do aluno. Dado sensível (LGPD): nunca em log, no git ou em outro serviço. */
@Entity
@Table(name = "lesao_aluno")
public class LesaoAluno {

    public enum Situacao { ATIVA, EM_RECUPERACAO, RECUPERADA }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;

    @Column(name = "aluno_id", nullable = false, updatable = false)
    private UUID alunoId;

    @Column(nullable = false)
    private String regiao;

    private String descricao;

    @Column(name = "data_inicio")
    private LocalDate dataInicio;

    @Column(name = "data_fim")
    private LocalDate dataFim;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Situacao situacao;

    private String observacao;

    @Column(name = "registrado_por", nullable = false)
    private UUID registradoPor;

    @Column(name = "criado_em", insertable = false, updatable = false)
    private Instant criadoEm;

    protected LesaoAluno() {
    }

    public LesaoAluno(UUID alunoId, UUID registradoPor) {
        this.alunoId = alunoId;
        this.registradoPor = registradoPor;
    }

    public void preencher(String regiao, String descricao, LocalDate dataInicio, LocalDate dataFim, Situacao situacao,
                          String observacao) {
        this.regiao = regiao;
        this.descricao = descricao;
        this.dataInicio = dataInicio;
        this.dataFim = dataFim;
        this.situacao = situacao;
        this.observacao = observacao;
    }

    public UUID getId() {
        return id;
    }

    public UUID getAlunoId() {
        return alunoId;
    }

    public String getRegiao() {
        return regiao;
    }

    public String getDescricao() {
        return descricao;
    }

    public LocalDate getDataInicio() {
        return dataInicio;
    }

    public LocalDate getDataFim() {
        return dataFim;
    }

    public Situacao getSituacao() {
        return situacao;
    }

    public String getObservacao() {
        return observacao;
    }
}
