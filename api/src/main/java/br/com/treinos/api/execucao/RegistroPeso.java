package br.com.treinos.api.execucao;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.TenantId;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/** Peso do aluno numa data (um por dia). Dado sensível (LGPD): nunca em log. */
@Entity
@Table(name = "registro_peso")
public class RegistroPeso {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;

    @Column(name = "aluno_id", nullable = false, updatable = false)
    private UUID alunoId;

    @Column(nullable = false, updatable = false)
    private LocalDate data;

    @Column(name = "peso_kg", nullable = false)
    private BigDecimal pesoKg;

    private String observacao;

    @Column(name = "registrado_por", nullable = false)
    private UUID registradoPor;

    /**
     * Importação da planilha completa que criou a linha (V049); nulo = criada à mão. O "Desfazer" da importação só olha
     * as linhas com este id. Gravado só na criação.
     */
    @Column(name = "importacao_id", updatable = false)
    private UUID importacaoId;

    public UUID getImportacaoId() {
        return importacaoId;
    }

    /** Antes de gravar a linha nova: liga à importação que a cria. */
    public void marcarImportacao(UUID importacao) {
        this.importacaoId = importacao;
    }

    @Column(name = "criado_em", insertable = false, updatable = false)
    private Instant criadoEm;

    protected RegistroPeso() {
    }

    public RegistroPeso(UUID alunoId, LocalDate data, BigDecimal pesoKg, String observacao, UUID registradoPor) {
        this.alunoId = alunoId;
        this.data = data;
        this.pesoKg = pesoKg;
        this.observacao = observacao;
        this.registradoPor = registradoPor;
    }

    public void alterar(BigDecimal pesoKg, String observacao, UUID registradoPor) {
        this.pesoKg = pesoKg;
        this.observacao = observacao;
        this.registradoPor = registradoPor;
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

    public LocalDate getData() {
        return data;
    }

    public BigDecimal getPesoKg() {
        return pesoKg;
    }

    public String getObservacao() {
        return observacao;
    }

    public UUID getRegistradoPor() {
        return registradoPor;
    }

    public Instant getCriadoEm() {
        return criadoEm;
    }
}
