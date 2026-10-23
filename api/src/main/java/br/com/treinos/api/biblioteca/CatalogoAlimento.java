package br.com.treinos.api.biblioteca;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.util.UUID;

/** Catálogo público de alimentos: só leitura, sem {@code @TenantId}. Cada item grava a fonte dos valores. */
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

    @Column(nullable = false, length = 400)
    private String fonte;

    private String grupo;

    @Column(name = "codigo_fonte")
    private String codigoFonte;

    /** Nutrientes que a fonte marca como traço ({@code Tr}), gravados como 0: ex. {@code gordura,carboidrato}. */
    private String tracos;

    @Column(name = "nome_busca", nullable = false)
    private String nomeBusca;

    /** Fator de correção do catálogo público; nulo = a fonte não informou (nunca 1). */
    @Column(name = "fator_correcao")
    private BigDecimal fatorCorrecao;

    /** Fator de cocção do catálogo público; nulo = a fonte não informou. */
    @Column(name = "fator_coccao")
    private BigDecimal fatorCoccao;

    /** Citação curta de onde vieram os fatores; nula quando o item não tem fator. */
    @Column(name = "fonte_fatores", length = 300)
    private String fonteFatores;

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

    public BigDecimal getFatorCorrecao() {
        return fatorCorrecao;
    }

    public BigDecimal getFatorCoccao() {
        return fatorCoccao;
    }

    public String getFonteFatores() {
        return fonteFatores;
    }
}
