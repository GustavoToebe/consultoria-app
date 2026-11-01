package br.com.treinos.api.importacao.completa;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.TenantId;

import java.time.Instant;
import java.util.UUID;

/**
 * Uma resposta da importação da planilha completa guardada na consultoria (V051): o tipo da aba pelos títulos, o destino
 * de um nome de exercício ou alimento, ou a classificação de um nome de suplemento. Sem dado de aluno; ver
 * {@link GuardaDasRespostas}.
 */
@Entity
@Table(name = "importacao_resposta_salva")
public class RespostaSalva {

    public enum Tipo { ABA, EXERCICIO, ALIMENTO, SUPLEMENTO }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;

    @Column(nullable = false, length = 20, updatable = false)
    @jakarta.persistence.Enumerated(jakarta.persistence.EnumType.STRING)
    private Tipo tipo;

    @Column(nullable = false, length = 200, updatable = false)
    private String chave;

    @Column(nullable = false, length = 30)
    private String resposta;

    @Column(name = "item_id")
    private UUID itemId;

    @Column(name = "atualizada_em", nullable = false)
    private Instant atualizadaEm;

    protected RespostaSalva() {
    }

    public RespostaSalva(Tipo tipo, String chave, String resposta, UUID itemId) {
        this.tipo = tipo;
        this.chave = chave;
        this.resposta = resposta;
        this.itemId = itemId;
        this.atualizadaEm = Instant.now();
    }

    /** Troca a resposta (a mesma chave respondida de novo). */
    public void responder(String resposta, UUID itemId) {
        this.resposta = resposta;
        this.itemId = itemId;
        this.atualizadaEm = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public Tipo getTipo() {
        return tipo;
    }

    public String getChave() {
        return chave;
    }

    public String getResposta() {
        return resposta;
    }

    public UUID getItemId() {
        return itemId;
    }

    @Override
    public String toString() {
        return "RespostaSalva[tipo=" + tipo + "]"; // a chave pode ser nome de medicação
    }
}
