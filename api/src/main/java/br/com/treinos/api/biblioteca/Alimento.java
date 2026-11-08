package br.com.treinos.api.biblioteca;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.TenantId;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * Alimento da biblioteca, ou suplemento na mesma tabela ({@link Tipo#SUPLEMENTO}). O suplemento reaproveita {@code grupo}
 * como categoria. Sem kcal, os macros ficam nulos: ausência não vira zero. Valores por {@code baseQuantidade}
 * {@code baseUnidade} (ex.: por 100 g). O app calcula o item da dieta ao editar e grava o resultado; a versão publicada
 * guarda os números e não recalcula depois.
 *
 * <p>{@code fatorCorrecao} (peso bruto ÷ líquido) e {@code fatorCoccao} (peso pronto ÷ cru) servem à lista de compras
 * do aluno (reunião de 17/10, R13/R14/R32). O cadastro, a importação e a V060 preenchem os dois com
 * {@link FatoresDeRendimento} quando vêm nulos. A publicação da dieta copia os valores do momento para os itens
 * (ver {@code PlanoDietaService.paraPublicar}).
 *
 * <p>{@code grupo} ("Carnes e derivados"...) é texto livre opcional que agrupa a lista de compras do aluno; também é
 * copiado na publicação. Ver {@link GrupoDoAlimento}.
 */
@Entity
@Table(name = "alimento")
public class Alimento {

    /** {@code ALIMENTO} soma na dieta como hoje. {@code SUPLEMENTO} pode ficar sem kcal (creatina, vitamina). */
    public enum Tipo { ALIMENTO, SUPLEMENTO }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;

    @Column(nullable = false)
    private String nome;

    @Column(name = "base_quantidade", nullable = false)
    private BigDecimal baseQuantidade;

    @Column(name = "base_unidade", nullable = false)
    private String baseUnidade;

    /** Nulo só em {@link Tipo#SUPLEMENTO} sem valor nutricional. */
    @Column(nullable = true)
    private BigDecimal kcal;

    /** Nulo quando a fonte só publicou a caloria. Ausente não vira zero. */
    @Column(nullable = true)
    private BigDecimal proteina;

    @Column(nullable = true)
    private BigDecimal carboidrato;

    @Column(nullable = true)
    private BigDecimal gordura;

    @Column(name = "gramas_por_unidade")
    private BigDecimal gramasPorUnidade;

    @Column(length = 400)
    private String fonte;

    @Column(name = "fator_correcao")
    private BigDecimal fatorCorrecao;

    @Column(name = "fator_coccao")
    private BigDecimal fatorCoccao;

    @Column(length = GrupoDoAlimento.MAXIMO)
    private String grupo;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, updatable = false)
    private Tipo tipo = Tipo.ALIMENTO;

    @Column(length = 80)
    private String marca;

    @Column(length = 500)
    private String link;

    @Column(length = 40)
    private String cupom;

    /** Lista de textos em JSON ({@code ["Maracujá","Morango"]}); nulo no alimento comum. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private String sabores;

    @Column(name = "porcoes_por_embalagem", length = 40)
    private String porcoesPorEmbalagem;

    @Column(length = 80)
    private String porcao;

    /** Sem acento, só no suplemento: é a chave única do nome. Nulo no alimento comum. */
    @Column(name = "nome_busca", length = 160)
    private String nomeBusca;

    @Column(nullable = false)
    private boolean ativo = true;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, updatable = false)
    private Exercicio.Origem origem;

    @Column(name = "criado_em", insertable = false, updatable = false)
    private Instant criadoEm;

    @Version
    private Long versao;

    protected Alimento() {
    }

    public Alimento(Valores valores, Exercicio.Origem origem) {
        this(valores, origem, Tipo.ALIMENTO);
    }

    public Alimento(Valores valores, Exercicio.Origem origem, Tipo tipo) {
        aplicar(valores);
        this.origem = origem;
        this.tipo = tipo == null ? Tipo.ALIMENTO : tipo;
    }

    public void alterar(Valores valores) {
        aplicar(valores);
    }

    private void aplicar(Valores v) {
        this.nome = v.nome();
        this.baseQuantidade = v.baseQuantidade();
        this.baseUnidade = v.baseUnidade();
        this.kcal = v.kcal();
        this.proteina = v.proteina();
        this.carboidrato = v.carboidrato();
        this.gordura = v.gordura();
        this.gramasPorUnidade = v.gramasPorUnidade();
        this.fonte = v.fonte();
        this.fatorCorrecao = v.fatorCorrecao();
        this.fatorCoccao = v.fatorCoccao();
        this.grupo = v.grupo();
        this.marca = v.marca();
        this.link = v.link();
        this.cupom = v.cupom();
        this.porcao = v.porcao();
        this.porcoesPorEmbalagem = v.porcoesPorEmbalagem();
        this.sabores = v.saboresJson();
        this.nomeBusca = v.nomeBusca();
    }

    public void inativar() {
        this.ativo = false;
    }

    public UUID getId() {
        return id;
    }

    public UUID getConsultoriaId() {
        return consultoriaId;
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

    public BigDecimal getFatorCorrecao() {
        return fatorCorrecao;
    }

    public BigDecimal getFatorCoccao() {
        return fatorCoccao;
    }

    public String getGrupo() {
        return grupo;
    }

    public Tipo getTipo() {
        return tipo;
    }

    public String getMarca() {
        return marca;
    }

    public String getLink() {
        return link;
    }

    public String getCupom() {
        return cupom;
    }

    public String getSabores() {
        return sabores;
    }

    public String getPorcoesPorEmbalagem() {
        return porcoesPorEmbalagem;
    }

    public String getPorcao() {
        return porcao;
    }

    public String getNomeBusca() {
        return nomeBusca;
    }

    public boolean isAtivo() {
        return ativo;
    }

    public Exercicio.Origem getOrigem() {
        return origem;
    }

    public Instant getCriadoEm() {
        return criadoEm;
    }

    public Long getVersao() {
        return versao;
    }

    /**
     * Valores editáveis do alimento, já validados pelo service ({@code grupo} já normalizado por
     * {@link GrupoDoAlimento}).
     */
    public record Valores(String nome, BigDecimal baseQuantidade, String baseUnidade, BigDecimal kcal,
                          BigDecimal proteina, BigDecimal carboidrato, BigDecimal gordura,
                          BigDecimal gramasPorUnidade, String fonte, BigDecimal fatorCorrecao,
                          BigDecimal fatorCoccao, String grupo, String marca, String link, String cupom,
                          String porcao, String porcoesPorEmbalagem, String saboresJson, String nomeBusca) {

        /** Alimento comum: sem marca, link, cupom, porção de rótulo nem nome de busca. */
        public static Valores deAlimento(String nome, BigDecimal baseQuantidade, String baseUnidade, BigDecimal kcal,
                                         BigDecimal proteina, BigDecimal carboidrato, BigDecimal gordura,
                                         BigDecimal gramasPorUnidade, String fonte, BigDecimal fatorCorrecao,
                                         BigDecimal fatorCoccao, String grupo) {
            return new Valores(nome, baseQuantidade, baseUnidade, kcal, proteina, carboidrato, gordura,
                    gramasPorUnidade, fonte, fatorCorrecao, fatorCoccao, grupo, null, null, null, null, null, null, null);
        }
    }
}
