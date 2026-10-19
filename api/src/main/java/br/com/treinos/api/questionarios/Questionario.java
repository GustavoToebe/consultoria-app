package br.com.treinos.api.questionarios;

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

import java.time.Instant;
import java.util.UUID;

/**
 * Questionário de uma consultoria, de atualização ou de anamnese ({@link Finalidade}, fixa desde a criação): o rascunho é
 * editável; publicar cria uma {@link QuestionarioVersao} imutável. Um por consultoria e finalidade é o padrão (sempre
 * publicado e ativo).
 */
@Entity
@Table(name = "questionario")
public class Questionario {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;

    @Column(nullable = false)
    private String nome;

    private String descricao;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, updatable = false)
    private Finalidade finalidade = Finalidade.ATUALIZACAO;

    @Column(nullable = false)
    private boolean padrao;

    @Column(nullable = false)
    private boolean arquivado;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb", nullable = false)
    private String rascunho;

    @Column(name = "rascunho_alterado_em", nullable = false)
    private Instant rascunhoAlteradoEm = Instant.now();

    @Column(name = "versao_publicada", nullable = false)
    private int versaoPublicada;

    @Column(name = "publicado_em")
    private Instant publicadoEm;

    @Column(name = "criado_em", insertable = false, updatable = false)
    private Instant criadoEm;

    @Version
    private Long versao;

    protected Questionario() {
    }

    /** Questionário novo: só rascunho (sem versão publicada), nunca padrão. */
    public Questionario(String nome, String descricao, String rascunho) {
        this(nome, descricao, rascunho, Finalidade.ATUALIZACAO);
    }

    public Questionario(String nome, String descricao, String rascunho, Finalidade finalidade) {
        this.finalidade = finalidade;
        this.nome = nome;
        this.descricao = descricao;
        this.rascunho = rascunho;
    }

    /** Edita rascunho, nome e descrição; não mexe na versão publicada. */
    public void salvarRascunho(String nome, String descricao, String rascunho) {
        this.nome = nome;
        this.descricao = descricao;
        this.rascunho = rascunho;
        this.rascunhoAlteradoEm = Instant.now();
    }

    public void publicar(int numero, Instant quando) {
        this.versaoPublicada = numero;
        this.publicadoEm = quando;
    }

    public void definirPadrao(boolean padrao) { this.padrao = padrao; }

    public void arquivar() { this.arquivado = true; }

    public void desarquivar() { this.arquivado = false; }

    /** Disponível para escolher: publicado ao menos uma vez e não arquivado. */
    public boolean isUsavel() { return versaoPublicada > 0 && !arquivado; }

    public UUID getId() { return id; }
    public UUID getConsultoriaId() { return consultoriaId; }
    public String getNome() { return nome; }
    public String getDescricao() { return descricao; }
    public Finalidade getFinalidade() { return finalidade; }
    public boolean isPadrao() { return padrao; }
    public boolean isArquivado() { return arquivado; }
    public String getRascunho() { return rascunho; }
    public Instant getRascunhoAlteradoEm() { return rascunhoAlteradoEm; }
    public int getVersaoPublicada() { return versaoPublicada; }
    public Instant getPublicadoEm() { return publicadoEm; }
    public Instant getCriadoEm() { return criadoEm; }
    public Long getVersao() { return versao; }
}
