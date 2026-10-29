package br.com.treinos.api.inscricoes;

import br.com.treinos.api.inscricoes.Crm.TipoEvento;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.Immutable;
import org.hibernate.annotations.TenantId;

import java.time.Instant;
import java.util.UUID;

/**
 * Evento do histórico da inscrição (V045): quem, quando e o que mudou. Só se acrescenta; sai junto com a inscrição.
 * {@code de}/{@code para} são códigos (situação, pagamento, origem, ação da mensagem, id da inscrição relacionada);
 * {@code detalhe} é texto curto da equipe (motivo da reabertura, detalhe do encerramento) ou um resumo fixo montado pela
 * API. Nunca o texto de uma mensagem preparada.
 */
@Entity
@Immutable
@Table(name = "inscricao_evento")
public class InscricaoEvento {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;

    @Column(name = "inscricao_id", nullable = false)
    private UUID inscricaoId;

    @Column(nullable = false)
    private int ciclo;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TipoEvento tipo;

    private String de;

    private String para;

    private String motivo;

    private String detalhe;

    @Column(name = "autor_id")
    private UUID autorId;

    @Column(name = "criado_em", nullable = false)
    private Instant criadoEm = Instant.now();

    protected InscricaoEvento() {
    }

    InscricaoEvento(Inscricao i, TipoEvento tipo, String de, String para, String motivo, String detalhe, UUID autorId) {
        this.inscricaoId = i.getId();
        this.ciclo = i.getCiclo();
        this.tipo = tipo;
        this.de = de;
        this.para = para;
        this.motivo = motivo;
        this.detalhe = detalhe;
        this.autorId = autorId;
    }

    public UUID getId() { return id; }
    public UUID getInscricaoId() { return inscricaoId; }
    public int getCiclo() { return ciclo; }
    public TipoEvento getTipo() { return tipo; }
    public String getDe() { return de; }
    public String getPara() { return para; }
    public String getMotivo() { return motivo; }
    public String getDetalhe() { return detalhe; }
    public UUID getAutorId() { return autorId; }
    public Instant getCriadoEm() { return criadoEm; }
}
