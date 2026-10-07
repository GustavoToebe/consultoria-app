package br.com.treinos.api.planos;

import jakarta.persistence.Column;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.MappedSuperclass;
import jakarta.persistence.Version;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.TenantId;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Colunas comuns de {@code plano_treino} e {@code plano_dieta}. O rascunho é o único lugar editável; publicar copia
 * para uma versão nova e imutável (regra 2 do plano). {@code ativo} marca o plano vigente do aluno (um por aluno,
 * índice parcial no banco).
 */
@MappedSuperclass
public abstract class PlanoBase {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;

    @Column(name = "aluno_id", updatable = false)
    private UUID alunoId;

    @Column(nullable = false)
    private String titulo;

    private LocalDate inicio;

    private LocalDate fim;

    @Column(nullable = false)
    private boolean ativo;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false)
    private String rascunho;

    @Column(name = "rascunho_alterado_em", nullable = false)
    private Instant rascunhoAlteradoEm;

    @Column(name = "versao_publicada", nullable = false)
    private int versaoPublicada;

    @Column(name = "publicado_em")
    private Instant publicadoEm;

    @Column(name = "criado_em", insertable = false, updatable = false)
    private Instant criadoEm;

    @Version
    private Long versao;

    protected PlanoBase() {
    }

    protected PlanoBase(UUID alunoId, String titulo, LocalDate inicio, LocalDate fim, String rascunho) {
        this.alunoId = alunoId;
        this.titulo = titulo;
        this.inicio = inicio;
        this.fim = fim;
        this.rascunho = rascunho;
        this.rascunhoAlteradoEm = Instant.now();
    }

    public void salvarRascunho(String titulo, LocalDate inicio, LocalDate fim, String rascunho) {
        this.titulo = titulo;
        this.inicio = inicio;
        this.fim = fim;
        this.rascunho = rascunho;
        this.rascunhoAlteradoEm = Instant.now();
    }

    /** Publicou a versão {@code numero}: este passa a ser o plano vigente do aluno. */
    public void publicar(int numero, Instant quando) {
        this.versaoPublicada = numero;
        this.publicadoEm = quando;
        this.ativo = true;
    }

    /** Rascunho mudou depois da última publicação (o app mostra "Alterado desde a publicação"). */
    public boolean rascunhoAlteradoDepoisDePublicar() {
        return publicadoEm != null && rascunhoAlteradoEm.isAfter(publicadoEm);
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

    public String getTitulo() {
        return titulo;
    }

    public LocalDate getInicio() {
        return inicio;
    }

    public LocalDate getFim() {
        return fim;
    }

    public boolean isAtivo() {
        return ativo;
    }

    public String getRascunho() {
        return rascunho;
    }

    public Instant getRascunhoAlteradoEm() {
        return rascunhoAlteradoEm;
    }

    public int getVersaoPublicada() {
        return versaoPublicada;
    }

    public Instant getPublicadoEm() {
        return publicadoEm;
    }

    public Instant getCriadoEm() {
        return criadoEm;
    }

    public Long getVersao() {
        return versao;
    }
}
