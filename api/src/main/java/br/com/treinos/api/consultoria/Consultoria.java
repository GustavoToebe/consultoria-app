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
import org.hibernate.annotations.OptimisticLock;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

/**
 * Cada treinador é uma consultoria. Tabela raiz do isolamento, por isso sem {@code @TenantId} (exceção registrada no
 * {@code ArquiteturaTest}). Os bytes da logo não são mapeados aqui para não serem carregados em todo login; só o
 * tipo e a versão, que formam a URL pública.
 */
@Entity
@Table(name = "consultoria")
public class Consultoria {

    public enum Fonte { PADRAO, METAL, ESPORTIVA, CONDENSADA }

    /** Paletas da marca (V055); o modo escuro ou claro de cada uma é decidido no app (`tema/tokens.PALETAS`). */
    public enum Tema { ESCURO, MEIA_NOITE, AMEIXA, OCEANO, CAFE, CLARO, AREIA, LAVANDA, CEU, ROSA }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String nome;

    @Column(nullable = false, updatable = false)
    private String slug;

    @Column(name = "cor_primaria", nullable = false)
    private String corPrimaria = "#C62828";

    @Enumerated(EnumType.STRING)
    @Column(name = "fonte_titulo", nullable = false)
    private Fonte fonteTitulo = Fonte.PADRAO;

    @Enumerated(EnumType.STRING)
    @Column(name = "tema_padrao", nullable = false)
    private Tema temaPadrao = Tema.CLARO;

    /** Ciclo de atualização padrão (V009): aluno sem valor próprio usa este; nulo = sem padrão. */
    @Column(name = "dias_atualizacao_padrao")
    private Integer diasAtualizacaoPadrao;

    /** Meta do peso padrão dos alunos (V052); o aluno pode ter a sua. */
    @Enumerated(EnumType.STRING)
    @Column(name = "meta_do_peso", nullable = false)
    private MetaDoPeso metaDoPeso = MetaDoPeso.REDUZIR;

    /** Textos das fases do ciclo, escritos pelo treinador. Nulo = nenhum. Nunca vai a log. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "textos_fases_ciclo", columnDefinition = "jsonb")
    private String textosFasesCiclo;

    /**
     * Chaves da comunidade (V071, C9). Fora do bloqueio otimista: ligar ou desligar não deve derrubar quem edita a marca.
     */
    @OptimisticLock(excluded = true)
    @Column(name = "comunidade_alunos_publicam", nullable = false)
    private boolean comunidadeAlunosPublicam = true;

    @OptimisticLock(excluded = true)
    @Column(name = "comunidade_alunos_anexam_fotos", nullable = false)
    private boolean comunidadeAlunosAnexamFotos = true;

    @Column(name = "logo_tipo", insertable = false, updatable = false)
    private String logoTipo;

    @Column(name = "logo_versao", insertable = false, updatable = false)
    private int logoVersao;

    @Column(name = "criado_em", insertable = false, updatable = false)
    private Instant criadoEm;

    @Version
    private Long versao;

    protected Consultoria() {
    }

    public Consultoria(String nome, String slug) {
        this.nome = nome;
        this.slug = slug;
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

    public String getCorPrimaria() {
        return corPrimaria;
    }

    public Fonte getFonteTitulo() {
        return fonteTitulo;
    }

    public Tema getTemaPadrao() {
        return temaPadrao;
    }

    public Integer getDiasAtualizacaoPadrao() {
        return diasAtualizacaoPadrao;
    }

    public MetaDoPeso getMetaDoPeso() {
        return metaDoPeso;
    }

    public void definirMetaDoPeso(MetaDoPeso metaDoPeso) {
        this.metaDoPeso = metaDoPeso;
    }

    public String getTextosFasesCiclo() {
        return textosFasesCiclo;
    }

    public void definirTextosFasesCiclo(String textosFasesCiclo) {
        this.textosFasesCiclo = textosFasesCiclo;
    }

    public boolean isComunidadeAlunosPublicam() {
        return comunidadeAlunosPublicam;
    }

    public boolean isComunidadeAlunosAnexamFotos() {
        return comunidadeAlunosAnexamFotos;
    }

    public void definirChavesDaComunidade(boolean alunosPublicam, boolean alunosAnexamFotos) {
        this.comunidadeAlunosPublicam = alunosPublicam;
        this.comunidadeAlunosAnexamFotos = alunosAnexamFotos;
    }

    public String getLogoTipo() {
        return logoTipo;
    }

    public int getLogoVersao() {
        return logoVersao;
    }

    public Instant getCriadoEm() {
        return criadoEm;
    }

    public Long getVersao() {
        return versao;
    }

    public void alterarMarca(String nome, String corPrimaria, Fonte fonteTitulo, Tema temaPadrao,
                             Integer diasAtualizacaoPadrao) {
        this.nome = nome;
        this.corPrimaria = corPrimaria;
        this.fonteTitulo = fonteTitulo;
        this.temaPadrao = temaPadrao;
        this.diasAtualizacaoPadrao = diasAtualizacaoPadrao;
    }
}
