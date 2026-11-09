package br.com.treinos.api.comunidade;

import jakarta.persistence.*;
import org.hibernate.annotations.TenantId;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "comunidade_aula_comentario")
public class ComunidadeAulaComentario {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;

    @Column(name = "aula_id", nullable = false)
    private UUID aulaId;

    @Column(name = "autor_id", nullable = false)
    private UUID autorId;

    @Column(name = "autor_nome", nullable = false, length = 120)
    private String autorNome;

    @Column(name = "autor_foto_url", length = 500)
    private String autorFotoUrl;

    @Column(nullable = false, length = 2000)
    private String texto;

    @Column(nullable = false)
    private boolean oculto;

    @Column(name = "criado_em", nullable = false, updatable = false)
    private Instant criadoEm = Instant.now();

    protected ComunidadeAulaComentario() {}

    public ComunidadeAulaComentario(UUID aulaId, UUID autorId, String autorNome, String autorFotoUrl, String texto) {
        this.aulaId = aulaId;
        this.autorId = autorId;
        this.autorNome = autorNome;
        this.autorFotoUrl = autorFotoUrl;
        this.texto = texto;
    }

    public void ocultar() {
        this.oculto = true;
    }

    public UUID getId() { return id; }
    public UUID getConsultoriaId() { return consultoriaId; }
    public UUID getAulaId() { return aulaId; }
    public UUID getAutorId() { return autorId; }
    public String getAutorNome() { return autorNome; }
    public String getAutorFotoUrl() { return autorFotoUrl; }
    public String getTexto() { return texto; }
    public boolean isOculto() { return oculto; }
    public Instant getCriadoEm() { return criadoEm; }
}
