package br.com.treinos.api.planos;

import jakarta.persistence.Column;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.MappedSuperclass;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.TenantId;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Versão publicada de um plano: cópia do rascunho no momento da publicação, nunca alterada depois. O registro do aluno
 * aponta para a versão que ele executou.
 */
@MappedSuperclass
public abstract class VersaoBase {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;

    @Column(name = "plano_id", nullable = false, updatable = false)
    private UUID planoId;

    @Column(nullable = false, updatable = false)
    private int numero;

    @Column(nullable = false, updatable = false)
    private String titulo;

    @Column(updatable = false)
    private LocalDate inicio;

    @Column(updatable = false)
    private LocalDate fim;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, updatable = false)
    private String conteudo;

    @Column(name = "publicado_em", nullable = false, updatable = false)
    private Instant publicadoEm;

    @Column(name = "publicado_por", nullable = false, updatable = false)
    private UUID publicadoPor;

    protected VersaoBase() {
    }

    protected VersaoBase(PlanoBase plano, int numero, String conteudo, UUID publicadoPor, Instant quando) {
        this.planoId = plano.getId();
        this.numero = numero;
        this.titulo = plano.getTitulo();
        this.inicio = plano.getInicio();
        this.fim = plano.getFim();
        this.conteudo = conteudo;
        this.publicadoPor = publicadoPor;
        this.publicadoEm = quando;
    }

    public UUID getId() {
        return id;
    }

    public UUID getConsultoriaId() {
        return consultoriaId;
    }

    public UUID getPlanoId() {
        return planoId;
    }

    public int getNumero() {
        return numero;
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

    public String getConteudo() {
        return conteudo;
    }

    public Instant getPublicadoEm() {
        return publicadoEm;
    }

    public UUID getPublicadoPor() {
        return publicadoPor;
    }
}
