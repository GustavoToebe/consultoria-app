package br.com.treinos.api.whatsapp;

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

/** O modelo (template) da Meta que a consultoria cadastrou para um tipo de aviso: só o nome e o idioma. */
@Entity
@Table(name = "whatsapp_modelo")
public class WhatsAppModelo {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, updatable = false)
    private TipoDeAviso tipo;
    @Column(nullable = false)
    private String nome;
    @Column(nullable = false)
    private String idioma;
    @Column(name = "criado_em", nullable = false, updatable = false)
    private Instant criadoEm;
    @Column(name = "atualizado_em", nullable = false)
    private Instant atualizadoEm;
    @Version
    private Long versao;

    protected WhatsAppModelo() {
    }

    WhatsAppModelo(TipoDeAviso tipo, String nome, String idioma, Instant agora) {
        this.tipo = tipo;
        this.nome = nome;
        this.idioma = idioma;
        this.criadoEm = agora;
        this.atualizadoEm = agora;
    }

    /** Devolve se mudou algo. */
    boolean alterar(String nome, String idioma, Instant agora) {
        if (this.nome.equals(nome) && this.idioma.equals(idioma)) {
            return false;
        }
        this.nome = nome;
        this.idioma = idioma;
        this.atualizadoEm = agora;
        return true;
    }

    public UUID getId() { return id; }
    public TipoDeAviso getTipo() { return tipo; }
    public String getNome() { return nome; }
    public String getIdioma() { return idioma; }
    public Long getVersao() { return versao; }
}
