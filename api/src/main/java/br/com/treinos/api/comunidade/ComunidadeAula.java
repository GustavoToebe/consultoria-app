package br.com.treinos.api.comunidade;

import jakarta.persistence.*;
import org.hibernate.annotations.DynamicUpdate;
import org.hibernate.annotations.TenantId;

import java.time.Instant;
import java.util.UUID;

/**
 * {@code @DynamicUpdate}: o UPDATE leva só as colunas que mudaram. Reordenar (trava a playlist) e editar o aulão (sem trava) leem a
 * linha em transações separadas; com o UPDATE de todas as colunas, quem comitasse depois regravaria o {@code publicada}, a
 * {@code ordem} ou o {@code playlist_id} lidos antes da outra transação mudá-los.
 */
@Entity
@DynamicUpdate
@Table(name = "comunidade_aula")
public class ComunidadeAula {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;

    @Column(nullable = false, length = 120)
    private String titulo;

    @Column(columnDefinition = "text")
    private String descricao;

    @Column(name = "video_url", nullable = false, length = 500)
    private String videoUrl;

    /** Nulo = sem playlist. A FK composta (V088) garante que é da mesma consultoria. */
    @Column(name = "playlist_id")
    private UUID playlistId;

    /** Posição dentro da playlist (V088); sem playlist vale 0 e a lista desempata pela data. */
    @Column(nullable = false)
    private int ordem;

    @Column(nullable = false)
    private boolean publicada = true;

    @Column(name = "criada_em", nullable = false, updatable = false)
    private Instant criadaEm = Instant.now();

    @Column(name = "atualizada_em", nullable = false)
    private Instant atualizadaEm = Instant.now();

    protected ComunidadeAula() {}

    public ComunidadeAula(String titulo, String descricao, String videoUrl,
                          UUID playlistId, int ordem, boolean publicada) {
        this.titulo = titulo;
        this.descricao = descricao;
        this.videoUrl = videoUrl;
        this.playlistId = playlistId;
        this.ordem = ordem;
        this.publicada = publicada;
    }

    public void atualizar(String titulo, String descricao, String videoUrl,
                          UUID playlistId, int ordem, boolean publicada) {
        this.titulo = titulo;
        this.descricao = descricao;
        this.videoUrl = videoUrl;
        this.playlistId = playlistId;
        this.ordem = ordem;
        this.publicada = publicada;
        this.atualizadaEm = Instant.now();
    }

    /** Muda só a posição (reordenar e lote). */
    public void posicionar(UUID playlistId, int ordem) {
        this.playlistId = playlistId;
        this.ordem = ordem;
        this.atualizadaEm = Instant.now();
    }

    public UUID getId() { return id; }
    public UUID getConsultoriaId() { return consultoriaId; }
    public String getTitulo() { return titulo; }
    public String getDescricao() { return descricao; }
    public String getVideoUrl() { return videoUrl; }
    public UUID getPlaylistId() { return playlistId; }
    public int getOrdem() { return ordem; }
    public boolean isPublicada() { return publicada; }
    public Instant getCriadaEm() { return criadaEm; }
    public Instant getAtualizadaEm() { return atualizadaEm; }
}
