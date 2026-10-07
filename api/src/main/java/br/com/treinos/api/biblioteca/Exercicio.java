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
import org.hibernate.annotations.TenantId;

import java.time.Instant;
import java.util.UUID;

/** Exercício da biblioteca da consultoria. Excluir = inativar: planos antigos continuam com a cópia do nome. */
@Entity
@Table(name = "exercicio")
public class Exercicio {

    public enum Modalidade { LIVRE, MAQUINA, ELASTICO, PESO_CORPORAL, CARDIO, OUTRO }

    public enum Origem { MANUAL, CATALOGO, IMPORTACAO }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;

    @Column(nullable = false)
    private String nome;

    @Column(name = "grupo_muscular")
    private String grupoMuscular;

    private String equipamento;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Modalidade modalidade;

    @Column(name = "video_url")
    private String videoUrl;

    private String observacoes;

    @Column(nullable = false)
    private boolean ativo = true;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, updatable = false)
    private Origem origem;

    @Column(name = "criado_em", insertable = false, updatable = false)
    private Instant criadoEm;

    @Version
    private Long versao;

    protected Exercicio() {
    }

    public Exercicio(String nome, String grupoMuscular, String equipamento, Modalidade modalidade, String videoUrl,
                     String observacoes, Origem origem) {
        this.nome = nome;
        this.grupoMuscular = grupoMuscular;
        this.equipamento = equipamento;
        this.modalidade = modalidade;
        this.videoUrl = videoUrl;
        this.observacoes = observacoes;
        this.origem = origem;
    }

    public void alterar(String nome, String grupoMuscular, String equipamento, Modalidade modalidade, String videoUrl,
                        String observacoes) {
        this.nome = nome;
        this.grupoMuscular = grupoMuscular;
        this.equipamento = equipamento;
        this.modalidade = modalidade;
        this.videoUrl = videoUrl;
        this.observacoes = observacoes;
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

    public String getGrupoMuscular() {
        return grupoMuscular;
    }

    public String getEquipamento() {
        return equipamento;
    }

    public Modalidade getModalidade() {
        return modalidade;
    }

    public String getVideoUrl() {
        return videoUrl;
    }

    public String getObservacoes() {
        return observacoes;
    }

    public boolean isAtivo() {
        return ativo;
    }

    public Origem getOrigem() {
        return origem;
    }

    public Instant getCriadoEm() {
        return criadoEm;
    }

    public Long getVersao() {
        return versao;
    }
}
