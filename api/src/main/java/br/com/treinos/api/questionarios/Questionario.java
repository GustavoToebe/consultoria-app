package br.com.treinos.api.questionarios;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import org.hibernate.annotations.DynamicUpdate;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.OptimisticLock;
import org.hibernate.annotations.TenantId;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

/**
 * Questionário de uma consultoria, de atualização, de anamnese ou de inscrição ({@link Finalidade}, fixa desde a criação): o
 * rascunho é editável; publicar cria uma {@link QuestionarioVersao} imutável. Um por consultoria e finalidade é o padrão
 * (sempre publicado e ativo). O questionário de inscrição é também a única fonte do link público ({@code /inscricao/<código>}):
 * código (gerado só no servidor), abertura, responsável, texto de apresentação e campos fixos escondidos. Essas colunas
 * ficam fora da {@code versao} do rascunho ({@code @OptimisticLock(excluded)}) e têm a {@code linkVersao} própria;
 * {@code @DynamicUpdate} faz o UPDATE levar só o que mudou, para um salvar do editor (que leu o link antes) nunca regravar
 * o código velho por cima de um "gerar novo link".
 */
@DynamicUpdate
@Entity
@Table(name = "questionario")
public class Questionario {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;

    @Column(nullable = false)
    private String nome;

    private String descricao;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, updatable = false)
    private Finalidade finalidade = Finalidade.ATUALIZACAO;

    @Column(nullable = false)
    private boolean padrao;

    @Column(nullable = false)
    private boolean arquivado;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb", nullable = false)
    private String rascunho;

    @Column(name = "rascunho_alterado_em", nullable = false)
    private Instant rascunhoAlteradoEm = Instant.now();

    @Column(name = "versao_publicada", nullable = false)
    private int versaoPublicada;

    @Column(name = "publicado_em")
    private Instant publicadoEm;

    @Column(name = "criado_em", insertable = false, updatable = false)
    private Instant criadoEm;

    @OptimisticLock(excluded = true)
    @Column(name = "codigo_publico", unique = true)
    private String codigoPublico;

    @OptimisticLock(excluded = true)
    @Column(name = "publico_aberto", nullable = false)
    private boolean publicoAberto;

    @OptimisticLock(excluded = true)
    @Column(name = "responsavel_padrao_id")
    private UUID responsavelPadraoId;

    /** Texto de privacidade/consentimento do link (até 2000): com texto, a ciência é obrigatória. Nulo = sem texto. */
    @OptimisticLock(excluded = true)
    @Column(name = "texto_apresentacao")
    private String textoApresentacao;

    /** Campos fixos escondidos da página ({@code CampoDaInscricao}), separados por vírgula; vazio = todos visíveis. */
    @OptimisticLock(excluded = true)
    @Column(name = "campos_ocultos", nullable = false)
    private String camposOcultos = "";

    /** Lock otimista das ações do link; sobe à mão em cada uma. */
    @OptimisticLock(excluded = true)
    @Column(name = "link_versao", nullable = false)
    private long linkVersao;

    @Column(name = "proximo_questionario_id")
    private UUID proximoQuestionarioId;

    @Version
    private Long versao;

    protected Questionario() {
    }

    /** Questionário novo: só rascunho (sem versão publicada), nunca padrão. */
    public Questionario(String nome, String descricao, String rascunho) {
        this(nome, descricao, rascunho, Finalidade.ATUALIZACAO);
    }

    public Questionario(String nome, String descricao, String rascunho, Finalidade finalidade) {
        this.finalidade = finalidade;
        this.nome = nome;
        this.descricao = descricao;
        this.rascunho = rascunho;
    }

    /** Edita rascunho, nome e descrição; não mexe na versão publicada. */
    public void salvarRascunho(String nome, String descricao, String rascunho) {
        this.nome = nome;
        this.descricao = descricao;
        this.rascunho = rascunho;
        this.rascunhoAlteradoEm = Instant.now();
    }

    public void publicar(int numero, Instant quando) {
        this.versaoPublicada = numero;
        this.publicadoEm = quando;
    }

    public void definirPadrao(boolean padrao) { this.padrao = padrao; }

    /** Arquivar fecha o link: desarquivar não o recoloca no ar (abrir é ação própria). */
    public void arquivar() {
        this.arquivado = true;
        if (publicoAberto) {
            this.publicoAberto = false;
            subirLinkVersao();
        }
    }

    public void desarquivar() { this.arquivado = false; }

    /** Disponível para escolher: publicado ao menos uma vez e não arquivado. */
    public boolean isUsavel() { return versaoPublicada > 0 && !arquivado; }

    public UUID getId() { return id; }
    public UUID getConsultoriaId() { return consultoriaId; }
    public String getNome() { return nome; }
    public String getDescricao() { return descricao; }
    public Finalidade getFinalidade() { return finalidade; }
    public boolean isPadrao() { return padrao; }
    public boolean isArquivado() { return arquivado; }
    public String getRascunho() { return rascunho; }
    public Instant getRascunhoAlteradoEm() { return rascunhoAlteradoEm; }
    public int getVersaoPublicada() { return versaoPublicada; }
    public Instant getPublicadoEm() { return publicadoEm; }
    public Instant getCriadoEm() { return criadoEm; }
    public String getCodigoPublico() { return codigoPublico; }
    public void setCodigoPublico(String codigoPublico) { this.codigoPublico = codigoPublico; }
    public boolean isPublicoAberto() { return publicoAberto; }
    public void setPublicoAberto(boolean publicoAberto) { this.publicoAberto = publicoAberto; }
    public UUID getResponsavelPadraoId() { return responsavelPadraoId; }
    public void setResponsavelPadraoId(UUID responsavelPadraoId) { this.responsavelPadraoId = responsavelPadraoId; }
    public String getTextoApresentacao() { return textoApresentacao; }
    public void setTextoApresentacao(String textoApresentacao) { this.textoApresentacao = textoApresentacao; }
    public String getCamposOcultos() { return camposOcultos; }
    public void setCamposOcultos(String camposOcultos) { this.camposOcultos = camposOcultos; }
    public long getLinkVersao() { return linkVersao; }
    public void subirLinkVersao() { this.linkVersao++; }

    /** Link que recebe inscrição: só questionário de inscrição, aberto e não arquivado (a anamnese se responde logada). */
    public boolean isLinkPublicoAberto() {
        return finalidade == Finalidade.INSCRICAO && publicoAberto && !arquivado && codigoPublico != null;
    }
    public UUID getProximoQuestionarioId() { return proximoQuestionarioId; }
    public void setProximoQuestionarioId(UUID proximoQuestionarioId) { this.proximoQuestionarioId = proximoQuestionarioId; }

    public Long getVersao() { return versao; }
}
