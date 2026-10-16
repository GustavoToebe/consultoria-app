package br.com.treinos.api.fotos;

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
 * Metadados de uma foto de atualização (dado sensível, LGPD). O arquivo fica no bucket privado com o próprio {@code id} como
 * nome do objeto; aqui não há nome de arquivo, só quem enviou e quando. Nunca em log nem em {@code toString}.
 */
@Entity
@Table(name = "atualizacao_foto")
public class AtualizacaoFoto {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;
    @Column(name = "aluno_id", nullable = false, updatable = false)
    private UUID alunoId;
    @Column(name = "pasta_id", nullable = false, updatable = false)
    private UUID pastaId;
    /** Nulo = pendente: subiu, mas o envio da atualização ainda não a ligou à resposta. */
    @Column(name = "atualizacao_id")
    private UUID atualizacaoId;
    @Column(name = "pergunta_id")
    private String perguntaId;
    @Column(nullable = false, updatable = false)
    private int tamanho;
    @Column(name = "criada_em", nullable = false, updatable = false)
    private Instant criadaEm;
    @Column(name = "ligada_em")
    private Instant ligadaEm;
    @Column(name = "removida_em")
    private Instant removidaEm;

    protected AtualizacaoFoto() {
    }

    AtualizacaoFoto(UUID alunoId, UUID pastaId, int tamanho, Instant criadaEm) {
        this.alunoId = alunoId;
        this.pastaId = pastaId;
        this.tamanho = tamanho;
        this.criadaEm = criadaEm;
    }

    void remover(Instant quando) {
        this.removidaEm = quando;
    }

    public UUID getId() {
        return id;
    }

    public UUID getAlunoId() {
        return alunoId;
    }

    public UUID getPastaId() {
        return pastaId;
    }

    public UUID getAtualizacaoId() {
        return atualizacaoId;
    }

    public String getPerguntaId() {
        return perguntaId;
    }

    public Instant getCriadaEm() {
        return criadaEm;
    }

    public Instant getRemovidaEm() {
        return removidaEm;
    }

    public boolean isPendente() {
        return atualizacaoId == null && removidaEm == null;
    }

    @Override
    public String toString() {
        return "AtualizacaoFoto[" + id + "]";
    }
}
