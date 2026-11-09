package br.com.treinos.api.comunidade;

import jakarta.persistence.*;
import org.hibernate.annotations.TenantId;

import java.time.Instant;
import java.util.UUID;

@Entity
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

    @Column(name = "miniatura_url", length = 500)
    private String miniaturaUrl;

    @Column(length = 60)
    private String categoria;

    @Column(nullable = false)
    private int ordem;

    @Column(nullable = false)
    private boolean publicada = true;

    @Column(name = "criada_em", nullable = false, updatable = false)
    private Instant criadaEm = Instant.now();

    @Column(name = "atualizada_em", nullable = false)
    private Instant atualizadaEm = Instant.now();

    protected ComunidadeAula() {}

    public ComunidadeAula(String titulo, String descricao, String videoUrl, String miniaturaUrl,
                          String categoria, int ordem, boolean publicada) {
        this.titulo = titulo;
        this.descricao = descricao;
        this.videoUrl = videoUrl;
        this.miniaturaUrl = miniaturaUrl;
        this.categoria = categoria;
        this.ordem = ordem;
        this.publicada = publicada;
    }

    public void atualizar(String titulo, String descricao, String videoUrl, String miniaturaUrl,
                          String categoria, int ordem, boolean publicada) {
        this.titulo = titulo;
        this.descricao = descricao;
        this.videoUrl = videoUrl;
        this.miniaturaUrl = miniaturaUrl;
        this.categoria = categoria;
        this.ordem = ordem;
        this.publicada = publicada;
        this.atualizadaEm = Instant.now();
    }

    public UUID getId() { return id; }
    public UUID getConsultoriaId() { return consultoriaId; }
    public String getTitulo() { return titulo; }
    public String getDescricao() { return descricao; }
    public String getVideoUrl() { return videoUrl; }
    public String getMiniaturaUrl() { return miniaturaUrl; }
    public String getCategoria() { return categoria; }
    public int getOrdem() { return ordem; }
    public boolean isPublicada() { return publicada; }
    public Instant getCriadaEm() { return criadaEm; }
    public Instant getAtualizadaEm() { return atualizadaEm; }
}
