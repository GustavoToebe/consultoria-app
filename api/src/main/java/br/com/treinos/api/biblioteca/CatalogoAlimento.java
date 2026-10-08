package br.com.treinos.api.biblioteca;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.util.UUID;

/** Catálogo público de alimentos (V006): só leitura, sem {@code @TenantId}. Cada item grava a fonte dos valores. */
@Entity
@Table(name = "catalogo_alimento")
public class CatalogoAlimento {

    @Id
    private UUID id;

    @Column(nullable = false)
    private String nome;

    @Column(name = "base_quantidade", nullable = false)
    private BigDecimal baseQuantidade;

    @Column(name = "base_unidade", nullable = false)
    private String baseUnidade;

    @Column(nullable = false)
    private BigDecimal kcal;

    @Column(nullable = false)
    private BigDecimal proteina;

    @Column(nullable = false)
    private BigDecimal carboidrato;

    @Column(nullable = false)
    private BigDecimal gordura;

    @Column(name = "gramas_por_unidade")
    private BigDecimal gramasPorUnidade;

    @Column(nullable = false)
    private String fonte;

    private String grupo;

    @Column(name = "codigo_fonte")
    private String codigoFonte;

    /** Nutrientes que a fonte marca como traço ({@code Tr}), gravados como 0: ex. {@code gordura,carboidrato}. */
    private String tracos;

    @Column(name = "nome_busca", nullable = false)
    private String nomeBusca;

    protected CatalogoAlimento() {
    }

    public UUID getId() {
        return id;
    }

    public String getNome() {
        return nome;
    }

    public BigDecimal getBaseQuantidade() {
        return baseQuantidade;
    }

    public String getBaseUnidade() {
        return baseUnidade;
    }

    public BigDecimal getKcal() {
        return kcal;
    }

    public BigDecimal getProteina() {
        return proteina;
    }

    public BigDecimal getCarboidrato() {
        return carboidrato;
    }

    public BigDecimal getGordura() {
        return gordura;
    }

    public BigDecimal getGramasPorUnidade() {
        return gramasPorUnidade;
    }

    public String getFonte() {
        return fonte;
    }

    public String getGrupo() {
        return grupo;
    }

    public String getCodigoFonte() {
        return codigoFonte;
    }

    public String getTracos() {
        return tracos;
    }

    public String getNomeBusca() {
        return nomeBusca;
    }
}
