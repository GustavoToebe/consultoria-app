package br.com.treinos.api.comunidade;

import jakarta.persistence.*;
import org.hibernate.annotations.TenantId;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "comunidade_mural_post")
public class ComunidadeMuralPost {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;

    @Column(name = "autor_id", nullable = false)
    private UUID autorId;

    @Column(name = "autor_nome", nullable = false, length = 120)
    private String autorNome;

    @Column(name = "autor_foto_url", length = 500)
    private String autorFotoUrl;

    @Column(nullable = false, length = 2000)
    private String texto;

    @Column(nullable = false, length = 20)
    private String tipo;

    @Column(name = "video_url", length = 500)
    private String videoUrl;

    /** Texto sem acento para a busca ({@code Buscas.semAcento}); quem grava é o serviço. */
    @Column(name = "texto_busca", nullable = false, length = 2000)
    private String textoBusca;

    @Column(nullable = false)
    private boolean fixado;

    @Column(nullable = false)
    private boolean oculto;

    @Column(name = "criado_em", nullable = false, updatable = false)
    private Instant criadoEm = Instant.now();

    protected ComunidadeMuralPost() {}

    /** O aviso nasce fixado (C3). */
    public ComunidadeMuralPost(UUID autorId, String autorNome, String autorFotoUrl, String texto, TipoDePost tipo,
                               String videoUrl, String textoBusca) {
        this.autorId = autorId;
        this.autorNome = autorNome;
        this.autorFotoUrl = autorFotoUrl;
        this.texto = texto;
        this.tipo = tipo.name();
        this.videoUrl = videoUrl;
        this.textoBusca = cortarBusca(textoBusca);
        this.fixado = tipo == TipoDePost.AVISO;
    }

    /** A forma decomposta (NFD) pode passar do texto (sílaba coreana vira 2 a 3 letras): corta na coluna, sem partir par substituto. */
    static String cortarBusca(String busca) {
        if (busca.length() <= 2000) {
            return busca;
        }
        return busca.substring(0, Character.isHighSurrogate(busca.charAt(1999)) ? 1999 : 2000);
    }

    public void ocultar() { this.oculto = true; }
    public void alternarFixado() { this.fixado = !this.fixado; }

    public UUID getId() { return id; }
    public UUID getConsultoriaId() { return consultoriaId; }
    public UUID getAutorId() { return autorId; }
    public String getAutorNome() { return autorNome; }
    public String getAutorFotoUrl() { return autorFotoUrl; }
    public String getTexto() { return texto; }
    public String getTipo() { return tipo; }
    public String getVideoUrl() { return videoUrl; }
    public boolean isFixado() { return fixado; }
    public boolean isOculto() { return oculto; }
    public Instant getCriadoEm() { return criadoEm; }
}
