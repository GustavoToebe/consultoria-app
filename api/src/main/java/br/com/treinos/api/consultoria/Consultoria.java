package br.com.treinos.api.consultoria;

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
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

/**
 * Cada treinador é uma consultoria. Tabela raiz do isolamento, por isso sem {@code @TenantId} (exceção registrada no
 * {@code ArquiteturaTest}). Os bytes da logo não são mapeados aqui para não serem carregados em todo login; só o
 * tipo e a versão, que formam a URL pública.
 *
 * <p>{@code configuracao} é JSON guardado como texto e convertido no service com o Jackson 3:
 * evita depender do FormatMapper do Hibernate.</p>
 */
@Entity
@Table(name = "consultoria")
public class Consultoria {

    public enum Fonte { PADRAO, METAL, ESPORTIVA, CONDENSADA }

    public enum Tema { ESCURO, CLARO }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String nome;

    @Column(nullable = false, updatable = false)
    private String slug;

    private String lema;

    @Column(name = "cor_primaria", nullable = false)
    private String corPrimaria = "#C62828";

    @Enumerated(EnumType.STRING)
    @Column(name = "fonte_titulo", nullable = false)
    private Fonte fonteTitulo = Fonte.PADRAO;

    @Enumerated(EnumType.STRING)
    @Column(name = "tema_padrao", nullable = false)
    private Tema temaPadrao = Tema.ESCURO;

    @Column(name = "logo_tipo", insertable = false, updatable = false)
    private String logoTipo;

    @Column(name = "logo_versao", insertable = false, updatable = false)
    private int logoVersao;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false)
    private String configuracao;

    @Column(name = "criado_em", insertable = false, updatable = false)
    private Instant criadoEm;

    @Version
    private Long versao;

    protected Consultoria() {
    }

    public Consultoria(String nome, String slug, String configuracao) {
        this.nome = nome;
        this.slug = slug;
        this.configuracao = configuracao;
    }

    public UUID getId() {
        return id;
    }

    public String getNome() {
        return nome;
    }

    public String getSlug() {
        return slug;
    }

    public String getLema() {
        return lema;
    }

    public String getCorPrimaria() {
        return corPrimaria;
    }

    public Fonte getFonteTitulo() {
        return fonteTitulo;
    }

    public Tema getTemaPadrao() {
        return temaPadrao;
    }

    public String getLogoTipo() {
        return logoTipo;
    }

    public int getLogoVersao() {
        return logoVersao;
    }

    public String getConfiguracao() {
        return configuracao;
    }

    public Instant getCriadoEm() {
        return criadoEm;
    }

    public Long getVersao() {
        return versao;
    }

    public void alterarMarca(String nome, String lema, String corPrimaria, Fonte fonteTitulo, Tema temaPadrao) {
        this.nome = nome;
        this.lema = lema;
        this.corPrimaria = corPrimaria;
        this.fonteTitulo = fonteTitulo;
        this.temaPadrao = temaPadrao;
    }

    public void alterarConfiguracao(String configuracao) {
        this.configuracao = configuracao;
    }
}
