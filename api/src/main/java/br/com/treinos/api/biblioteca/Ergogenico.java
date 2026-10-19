package br.com.treinos.api.biblioteca;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import org.hibernate.annotations.TenantId;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.UUID;

/**
 * Item da biblioteca de medicação e ergogênicos: nome, princípio ativo, concentração e apresentação, como no rótulo.
 * Não tem dose, ciclo nem indicação. Excluir = inativar: dietas já publicadas guardam a cópia.
 */
@Entity
@Table(name = "ergogenico")
public class Ergogenico {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;

    /** Texto livre do treinador (V009), opcional; o filtro mostra as que existem. */
    private String categoria;

    @Column(nullable = false)
    private String nome;

    @Column(name = "nome_busca", nullable = false)
    private String nomeBusca;

    @Column(name = "principio_ativo")
    private String principioAtivo;

    @Column(name = "principio_busca", nullable = false)
    private String principioBusca = "";

    private String concentracao;

    private String apresentacao;

    private String observacao;

    @Column(nullable = false)
    private boolean ativo = true;

    @Column(name = "criado_em", insertable = false, updatable = false)
    private Instant criadoEm;

    @UpdateTimestamp
    @Column(name = "atualizado_em")
    private Instant atualizadoEm;

    @Version
    private Long versao;

    protected Ergogenico() {
    }

    public Ergogenico(Valores valores) {
        aplicar(valores);
    }

    public void alterar(Valores valores) {
        aplicar(valores);
    }

    private void aplicar(Valores v) {
        this.categoria = v.categoria();
        this.nome = v.nome();
        this.nomeBusca = v.nomeBusca();
        this.principioAtivo = v.principioAtivo();
        this.principioBusca = v.principioBusca();
        this.concentracao = v.concentracao();
        this.apresentacao = v.apresentacao();
        this.observacao = v.observacao();
    }

    public void inativar() {
        this.ativo = false;
    }

    public UUID getId() {
        return id;
    }

    public String getCategoria() {
        return categoria;
    }

    public String getNome() {
        return nome;
    }

    public String getPrincipioAtivo() {
        return principioAtivo;
    }

    public String getConcentracao() {
        return concentracao;
    }

    public String getApresentacao() {
        return apresentacao;
    }

    public String getObservacao() {
        return observacao;
    }

    public boolean isAtivo() {
        return ativo;
    }

    /** Valores editáveis, já validados e normalizados pelo service. */
    public record Valores(String categoria, String nome, String nomeBusca, String principioAtivo,
                          String principioBusca, String concentracao, String apresentacao, String observacao) {
    }
}
