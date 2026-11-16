package br.com.treinos.api.vitrine;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import org.hibernate.annotations.TenantId;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Item da vitrine da consultoria (V075): o que o treinador mostra ao aluno, com preço, preço especial (com validade) e cupom.
 * Dinheiro em centavos. Sem dado de pessoa. O preço que vale hoje não mora aqui: é calculado por {@link PrecoDaVitrine}.
 */
@Entity
@Table(name = "vitrine_item")
public class VitrineItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;

    @Column(nullable = false)
    private String nome;

    private String descricao;

    @Column(nullable = false)
    private String tipo;

    @Column(name = "preco_centavos")
    private Long precoCentavos;

    @Column(name = "preco_especial_centavos")
    private Long precoEspecialCentavos;

    @Column(name = "especial_ate")
    private LocalDate especialAte;

    private String cupom;

    @Column(name = "link_url")
    private String linkUrl;

    @Column(nullable = false)
    private boolean ativo;

    @Column(nullable = false)
    private int ordem;

    @Column(name = "criado_em", nullable = false, updatable = false)
    private Instant criadoEm = Instant.now();

    @Column(name = "atualizado_em", nullable = false)
    private Instant atualizadoEm = criadoEm;

    @Version
    private Long versao;

    protected VitrineItem() {
    }

    VitrineItem(ValidacaoDoItem.Valido v, int ordem) {
        alterar(v);
        this.ordem = ordem;
    }

    public UUID getId() { return id; }
    public String getNome() { return nome; }
    public String getDescricao() { return descricao; }
    public String getTipo() { return tipo; }
    public Long getPrecoCentavos() { return precoCentavos; }
    public Long getPrecoEspecialCentavos() { return precoEspecialCentavos; }
    public LocalDate getEspecialAte() { return especialAte; }
    public String getCupom() { return cupom; }
    public String getLinkUrl() { return linkUrl; }
    public boolean isAtivo() { return ativo; }
    public int getOrdem() { return ordem; }
    public Long getVersao() { return versao; }

    void alterar(ValidacaoDoItem.Valido v) {
        this.nome = v.nome();
        this.descricao = v.descricao();
        this.tipo = v.tipo();
        this.precoCentavos = v.precoCentavos();
        this.precoEspecialCentavos = v.precoEspecialCentavos();
        this.especialAte = v.especialAte();
        this.cupom = v.cupom();
        this.linkUrl = v.linkUrl();
        this.ativo = v.ativo();
        this.atualizadoEm = Instant.now();
    }

    void ordenarEm(int ordem) {
        this.ordem = ordem;
        this.atualizadoEm = Instant.now();
    }

    @Override
    public String toString() {
        return "VitrineItem[" + id + "]";
    }
}
