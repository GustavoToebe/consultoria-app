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

    @Column(name = "imagem_url", length = 500)
    private String imagemUrl;

    @Column(nullable = false)
    private boolean fixado;

    @Column(nullable = false)
    private boolean oculto;

    @Column(name = "criado_em", nullable = false, updatable = false)
    private Instant criadoEm = Instant.now();

    protected ComunidadeMuralPost() {}

    public ComunidadeMuralPost(UUID autorId, String autorNome, String autorFotoUrl, String texto, String imagemUrl) {
        this.autorId = autorId;
        this.autorNome = autorNome;
        this.autorFotoUrl = autorFotoUrl;
        this.texto = texto;
        this.imagemUrl = imagemUrl;
    }

    public void ocultar() { this.oculto = true; }
    public void alternarFixado() { this.fixado = !this.fixado; }

    public UUID getId() { return id; }
    public UUID getConsultoriaId() { return consultoriaId; }
    public UUID getAutorId() { return autorId; }
    public String getAutorNome() { return autorNome; }
    public String getAutorFotoUrl() { return autorFotoUrl; }
    public String getTexto() { return texto; }
    public String getImagemUrl() { return imagemUrl; }
    public boolean isFixado() { return fixado; }
    public boolean isOculto() { return oculto; }
    public Instant getCriadoEm() { return criadoEm; }
}
