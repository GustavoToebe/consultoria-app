package br.com.treinos.api.comunidade;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.TenantId;

import java.time.Instant;
import java.util.UUID;

/** Playlist de aulões (V088; "Coleção" na tela). O nome é texto livre da equipe: nunca vai a log nem à auditoria. */
@Entity
@Table(name = "comunidade_playlist")
public class ComunidadePlaylist {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;

    @Column(nullable = false, length = 60)
    private String nome;

    @Column(nullable = false)
    private int ordem;

    @Column(name = "criada_em", nullable = false, updatable = false)
    private Instant criadaEm = Instant.now();

    @Column(name = "atualizada_em", nullable = false)
    private Instant atualizadaEm = Instant.now();

    protected ComunidadePlaylist() {}

    public ComunidadePlaylist(String nome, int ordem) {
        this.nome = nome;
        this.ordem = ordem;
    }

    public void renomear(String nome) {
        this.nome = nome;
        this.atualizadaEm = Instant.now();
    }

    public void definirOrdem(int ordem) {
        this.ordem = ordem;
    }

    public UUID getId() { return id; }
    public UUID getConsultoriaId() { return consultoriaId; }
    public String getNome() { return nome; }
    public int getOrdem() { return ordem; }
}
