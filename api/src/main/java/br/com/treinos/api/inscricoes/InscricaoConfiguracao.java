package br.com.treinos.api.inscricoes;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import org.hibernate.annotations.TenantId;

import java.time.Instant;
import java.util.UUID;

/**
 * Link de inscrição da consultoria (uma linha por consultoria, criada no primeiro "ligar" ou "gerar link"). O código vai
 * no endereço público: não é segredo, mas é aleatório ({@link CodigoDeInscricao}) e trocar o código revoga o anterior.
 * O texto de apresentação/privacidade é da consultoria; com texto, o interessado precisa marcar a ciência.
 */
@Entity
@Table(name = "inscricao_configuracao")
public class InscricaoConfiguracao {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;

    @Column(nullable = false)
    private boolean aberta;

    @Column(nullable = false)
    private String codigo;

    @Column(name = "responsavel_id")
    private UUID responsavelId;

    private String texto;

    @Column(name = "atualizada_em", nullable = false)
    private Instant atualizadaEm = Instant.now();

    @Version
    private Long versao;

    protected InscricaoConfiguracao() {
    }

    InscricaoConfiguracao(String codigo) {
        this.codigo = codigo;
    }

    public UUID getId() { return id; }
    public UUID getConsultoriaId() { return consultoriaId; }
    public boolean isAberta() { return aberta; }
    public String getCodigo() { return codigo; }
    public UUID getResponsavelId() { return responsavelId; }
    public String getTexto() { return texto; }
    public Instant getAtualizadaEm() { return atualizadaEm; }
    public Long getVersao() { return versao; }

    void alterar(boolean aberta, UUID responsavelId, String texto) {
        this.aberta = aberta;
        this.responsavelId = responsavelId;
        this.texto = texto;
        this.atualizadaEm = Instant.now();
    }

    void trocarCodigo(String codigo) {
        this.codigo = codigo;
        this.atualizadaEm = Instant.now();
    }
}
