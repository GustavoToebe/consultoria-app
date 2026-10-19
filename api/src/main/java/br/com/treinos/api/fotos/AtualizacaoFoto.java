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
 * Metadados de uma foto de atualização ou de anamnese (dado sensível, LGPD). A pendente pertence a uma pasta
 * (atualização) ou a uma anamnese; o envio a liga à pergunta. O arquivo fica no bucket privado em
 * {@code consultorias/<consultoriaId>/fotos/<id>.jpg} ({@link ChaveDeFoto}); aqui não há nome de arquivo, só quem enviou e quando. Nunca em log nem em {@code toString}.
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
    /** Destino da foto de atualização (nulo na de anamnese). */
    @Column(name = "pasta_id", updatable = false)
    private UUID pastaId;
    /** Destino da foto de anamnese (nulo na de atualização). */
    @Column(name = "anamnese_id", updatable = false)
    private UUID anamneseId;
    /** Atualização enviada a que a foto pertence (só fotos de pasta, depois do envio). */
    @Column(name = "atualizacao_id")
    private UUID atualizacaoId;
    /** Nulo = pendente: subiu, mas o envio ainda não a ligou a uma pergunta. */
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

    AtualizacaoFoto(UUID alunoId, UUID pastaId, UUID anamneseId, int tamanho, Instant criadaEm) {
        this.alunoId = alunoId;
        this.pastaId = pastaId;
        this.anamneseId = anamneseId;
        this.tamanho = tamanho;
        this.criadaEm = criadaEm;
    }

    void remover(Instant quando) {
        this.removidaEm = quando;
    }

    public UUID getId() {
        return id;
    }

    public UUID getConsultoriaId() {
        return consultoriaId;
    }

    public UUID getAlunoId() {
        return alunoId;
    }

    public UUID getPastaId() {
        return pastaId;
    }

    public UUID getAnamneseId() {
        return anamneseId;
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
        return perguntaId == null && removidaEm == null;
    }

    @Override
    public String toString() {
        return "AtualizacaoFoto[" + id + "]";
    }
}
