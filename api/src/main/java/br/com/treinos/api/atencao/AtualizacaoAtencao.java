package br.com.treinos.api.atencao;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.TenantId;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * Fato congelado no envio (V190): tipo, pergunta e limite vigentes naquele envio. Mudar ou apagar a regra depois não o reescreve.
 * Dado derivado de saúde: nunca em log nem auditoria. Imutável.
 */
@Entity
@Table(name = "atualizacao_atencao")
public class AtualizacaoAtencao {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;
    @Column(name = "atualizacao_id", nullable = false, updatable = false)
    private UUID atualizacaoId;
    @Column(nullable = false, length = 14, updatable = false)
    private String tipo;
    @Column(name = "pergunta_id", length = 100, updatable = false)
    private String perguntaId;
    @Column(name = "limite_vigente", precision = 4, scale = 1, updatable = false)
    private BigDecimal limiteVigente;
    @Column(name = "valor_observado", precision = 8, scale = 1, updatable = false)
    private BigDecimal valorObservado;
    @Column(name = "criado_em", nullable = false, updatable = false)
    private Instant criadoEm;

    protected AtualizacaoAtencao() {
    }

    AtualizacaoAtencao(UUID atualizacaoId, AvaliadorDeAtencao.Fato f, Instant agora) {
        this.atualizacaoId = atualizacaoId;
        this.tipo = f.tipo();
        this.perguntaId = f.perguntaId();
        this.limiteVigente = f.limiteVigente();
        this.valorObservado = f.valorObservado();
        this.criadoEm = agora;
    }

    AvaliadorDeAtencao.Fato fato() {
        return new AvaliadorDeAtencao.Fato(tipo, perguntaId, limiteVigente, valorObservado);
    }

    UUID getAtualizacaoId() { return atualizacaoId; }
}
