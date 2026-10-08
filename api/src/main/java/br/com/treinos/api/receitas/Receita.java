package br.com.treinos.api.receitas;

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
 * Ponto de partida editável (como as receitas de layout do Servirea): séries de um exercício, semana de treino ou
 * estrutura de dieta. Aplicar copia o conteúdo com uids novos; a receita não muda o plano depois.
 */
@Entity
@Table(name = "receita")
public class Receita {

    public enum Tipo { SERIES, PLANO_TREINO, PLANO_DIETA, METODOLOGIA, SESSAO_TREINO, REFEICAO, PASTA_PLANO, MOBILIDADE }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, updatable = false)
    private Tipo tipo;

    @Column(nullable = false)
    private String nome;

    private String descricao;

    @Column(name = "pasta_id")
    private UUID pastaId;

    public UUID getPastaId() { return pastaId; }
    public void definirPasta(UUID id) { this.pastaId = id; }

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false)
    private String conteudo;

    @Column(nullable = false)
    private int ordem;

    @Column(name = "criado_em", insertable = false, updatable = false)
    private Instant criadoEm;

    @Version
    private Long versao;

    protected Receita() {
    }

    public Receita(Tipo tipo, String nome, String descricao, String conteudo, int ordem) {
        this.tipo = tipo;
        this.nome = nome;
        this.descricao = descricao;
        this.conteudo = conteudo;
        this.ordem = ordem;
    }

    public void alterar(String nome, String descricao, String conteudo) {
        this.nome = nome;
        this.descricao = descricao;
        this.conteudo = conteudo;
    }

    public UUID getId() {
        return id;
    }

    public UUID getConsultoriaId() {
        return consultoriaId;
    }

    public Tipo getTipo() {
        return tipo;
    }

    public String getNome() {
        return nome;
    }

    public String getDescricao() {
        return descricao;
    }

    public String getConteudo() {
        return conteudo;
    }

    public int getOrdem() {
        return ordem;
    }

    public Instant getCriadoEm() {
        return criadoEm;
    }

    public Long getVersao() {
        return versao;
    }
}
