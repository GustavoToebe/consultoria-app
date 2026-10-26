package br.com.treinos.api.ciclo;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.TenantId;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Sintomas de um dia. Não cria nem altera um registro de menstruação. A observação é dado sensível. */
@Entity
@Table(name = "ciclo_dia")
public class CicloDia {

    @Id
    private UUID id;

    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;

    @Column(name = "aluno_id", nullable = false, updatable = false)
    private UUID alunoId;

    @Column(nullable = false, updatable = false)
    private LocalDate data;

    @Enumerated(EnumType.STRING)
    private FluxoMenstrual fluxo;

    @Enumerated(EnumType.STRING)
    private Colica colica;

    @JdbcTypeCode(SqlTypes.ARRAY)
    private List<String> sintomas;

    private String observacao;

    @Column(name = "criado_em", nullable = false, updatable = false)
    private Instant criadoEm = Instant.now();

    @Column(name = "alterado_em", nullable = false)
    private Instant alteradoEm = criadoEm;

    protected CicloDia() { }

    public CicloDia(UUID id, UUID alunoId, LocalDate data, FluxoMenstrual fluxo, Colica colica,
                    List<String> sintomas, String observacao) {
        this.id = id;
        this.alunoId = alunoId;
        this.data = data;
        this.fluxo = fluxo;
        this.colica = colica;
        this.sintomas = sintomas;
        this.observacao = observacao;
    }

    public UUID getId() { return id; }
    public UUID getAlunoId() { return alunoId; }
    public LocalDate getData() { return data; }
    public FluxoMenstrual getFluxo() { return fluxo; }
    public Colica getColica() { return colica; }
    public List<String> getSintomas() { return sintomas == null ? List.of() : sintomas; }
    public String getObservacao() { return observacao; }
    public Instant getCriadoEm() { return criadoEm; }
    public Instant getAlteradoEm() { return alteradoEm; }

    public boolean mesmoConteudo(FluxoMenstrual fluxo, Colica colica, List<String> sintomas, String observacao) {
        return this.fluxo == fluxo && this.colica == colica
                && getSintomas().equals(sintomas)
                && java.util.Objects.equals(this.observacao, observacao);
    }

    public void substituir(FluxoMenstrual fluxo, Colica colica, List<String> sintomas, String observacao) {
        this.fluxo = fluxo;
        this.colica = colica;
        this.sintomas = sintomas;
        this.observacao = observacao;
        this.alteradoEm = Instant.now();
    }
}
