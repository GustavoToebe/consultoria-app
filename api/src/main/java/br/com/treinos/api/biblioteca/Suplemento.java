package br.com.treinos.api.biblioteca;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.TenantId;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

/**
 * Suplemento da biblioteca: nome, marca, categoria, porção, sabores e link do produto. Não tem valor nutricional nem
 * dose. Excluir = inativar: dietas já publicadas guardam a cópia do nome e do link.
 */
@Entity
@Table(name = "suplemento")
public class Suplemento {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;

    @Column(nullable = false)
    private String nome;

    @Column(name = "nome_busca", nullable = false)
    private String nomeBusca;

    private String marca;

    private String categoria;

    private String porcao;

    @Column(name = "porcoes_por_embalagem")
    private String porcoesPorEmbalagem;

    /** Lista de textos em JSON ({@code ["Maracujá","Morango"]}). */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb", nullable = false)
    private String sabores = "[]";

    private String link;

    @Column(nullable = false)
    private boolean ativo = true;

    @Column(name = "criado_em", insertable = false, updatable = false)
    private Instant criadoEm;

    @UpdateTimestamp
    @Column(name = "atualizado_em")
    private Instant atualizadoEm;

    @Version
    private Long versao;

    protected Suplemento() {
    }

    public Suplemento(Valores valores) {
        aplicar(valores);
    }

    public void alterar(Valores valores) {
        aplicar(valores);
    }

    private void aplicar(Valores v) {
        this.nome = v.nome();
        this.nomeBusca = v.nomeBusca();
        this.marca = v.marca();
        this.categoria = v.categoria();
        this.porcao = v.porcao();
        this.porcoesPorEmbalagem = v.porcoesPorEmbalagem();
        this.sabores = v.saboresJson();
        this.link = v.link();
    }

    public void inativar() {
        this.ativo = false;
    }

    public UUID getId() {
        return id;
    }

    public String getNome() {
        return nome;
    }

    public String getMarca() {
        return marca;
    }

    public String getCategoria() {
        return categoria;
    }

    public String getPorcao() {
        return porcao;
    }

    public String getPorcoesPorEmbalagem() {
        return porcoesPorEmbalagem;
    }

    public String getSabores() {
        return sabores;
    }

    public String getLink() {
        return link;
    }

    public boolean isAtivo() {
        return ativo;
    }

    /** Valores editáveis, já validados e normalizados pelo service. */
    public record Valores(String nome, String nomeBusca, String marca, String categoria, String porcao,
                          String porcoesPorEmbalagem, String saboresJson, String link) {
    }
}
