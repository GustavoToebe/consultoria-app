package br.com.treinos.api.alunos;

import br.com.treinos.api.alunos.dto.AlunoDtos.Endereco;
import jakarta.persistence.Column;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.TenantId;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

/**
 * Aluno de uma consultoria. "Ativo" é decisão do treinador e base da futura cobrança; não depende de login.
 * {@code observacoes} e {@code objetivo} podem ter dado de saúde, e {@code cpf} e o endereço são dado pessoal: nunca em log.
 * O telefone fica em {@code Usuario} (o aluno só o tem depois de criar o acesso).
 */
@Entity
@Table(name = "aluno")
public class Aluno {

    public static final String NOME_ANONIMIZADO = "Aluno anonimizado";

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;

    @Column(nullable = false)
    private String nome;

    private String email;

    private String objetivo;

    private String observacoes;

    /** CPF formatado ({@code 123.456.789-09}), único por consultoria quando preenchido. Dado pessoal: nunca em log. */
    private String cpf;

    /** Endereço em sete colunas, todas opcionais e independentes. Dado pessoal: nunca em log. */
    private String cep;
    private String logradouro;
    private String numero;
    private String complemento;
    private String bairro;
    private String cidade;
    private String uf;

    @Column(name = "dias_atualizacao")
    private Integer diasAtualizacao;

    @Column(name="responsavel_id") private UUID responsavelId;

    /** Questionário de atualização do aluno; nulo = o padrão da consultoria. */
    @Column(name = "questionario_id") private UUID questionarioId;
    public UUID getQuestionarioId() { return questionarioId; }
    public void alterarQuestionario(UUID id) { questionarioId=id; atualizadoEm=Instant.now(); }

    @Column(nullable = false)
    private boolean ativo = true;

    @Column(name = "inativado_em")
    private Instant inativadoEm;

    /** Preenchido quando os dados pessoais foram apagados; o cadastro não volta a ser editado nem reativado. */
    @Column(name = "anonimizado_em")
    private Instant anonimizadoEm;

    /** Quando o aluno autorizou o uso das fotos de evolução para divulgação. Nulo = não autorizado. */
    @Column(name = "uso_de_imagem_autorizado_em")
    private Instant usoDeImagemAutorizadoEm;

    /** Nulo = não informado. Dado pessoal: nunca em log. */
    @Enumerated(EnumType.STRING)
    private Sexo sexo;

    @Column(name = "ciclo_ativado_em")
    private Instant cicloAtivadoEm;

    @Column(name = "ciclo_consentimento_versao")
    private Integer cicloConsentimentoVersao;

    @Column(name = "ciclo_duracao_habitual")
    private Integer cicloDuracaoHabitual;

    @Column(name = "ciclo_mostrar_fases", nullable = false)
    private boolean cicloMostrarFases = true;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "convite_hash", length = 64)
    private String conviteHash;

    @Column(name = "convite_expira_em")
    private Instant conviteExpiraEm;

    @Column(name = "usuario_id")
    private UUID usuarioId;

    @Column(name = "criado_em", insertable = false, updatable = false)
    private Instant criadoEm;

    @Column(name = "atualizado_em", nullable = false)
    private Instant atualizadoEm = Instant.now();

    @Version
    private Long versao;

    protected Aluno() {
    }

    public Aluno(String nome, String email, String objetivo, String observacoes) {
        this(nome, email, objetivo, observacoes, null);
    }

    public Aluno(String nome, String email, String objetivo, String observacoes, Integer diasAtualizacao) {
        this.nome = nome;
        this.email = email;
        this.objetivo = objetivo;
        this.observacoes = observacoes;
        this.diasAtualizacao = diasAtualizacao;
    }

    public UUID getResponsavelId() { return responsavelId; }
    public void alterarResponsavel(UUID id) { responsavelId=id; atualizadoEm=Instant.now(); }

    public Integer getDiasAtualizacao() {
        return diasAtualizacao;
    }

    public UUID getId() {
        return id;
    }

    public UUID getConsultoriaId() {
        return consultoriaId;
    }

    public String getNome() {
        return nome;
    }

    public String getEmail() {
        return email;
    }

    public String getObjetivo() {
        return objetivo;
    }

    public String getObservacoes() {
        return observacoes;
    }

    public boolean isAtivo() {
        return ativo;
    }

    public Instant getInativadoEm() {
        return inativadoEm;
    }

    public String getConviteHash() {
        return conviteHash;
    }

    public Instant getConviteExpiraEm() {
        return conviteExpiraEm;
    }

    public UUID getUsuarioId() {
        return usuarioId;
    }

    public Instant getCriadoEm() {
        return criadoEm;
    }

    public Instant getAtualizadoEm() {
        return atualizadoEm;
    }

    public Long getVersao() {
        return versao;
    }

    public void alterarDados(String nome, String email, String objetivo, String observacoes, Integer diasAtualizacao) {
        this.nome = nome;
        this.email = email;
        this.objetivo = objetivo;
        this.observacoes = observacoes;
        this.diasAtualizacao = diasAtualizacao;
        this.atualizadoEm = Instant.now();
    }

    /** Objetivo vindo da anamnese (fase C): só ele muda; nome e e-mail nunca saem de uma resposta. */
    public void alterarObjetivo(String objetivo) {
        this.objetivo = objetivo;
        this.atualizadoEm = Instant.now();
    }

    public String getCpf() {
        return cpf;
    }

    /** CPF já validado e formatado por {@code Formatos.cpf} (ou nulo para apagar). */
    public void alterarCpf(String cpf) {
        this.cpf = cpf;
        this.atualizadoEm = Instant.now();
    }

    /** O endereço de hoje, ou nulo se os sete campos estão vazios. */
    public Endereco endereco() {
        Endereco e = new Endereco(cep, logradouro, numero, complemento, bairro, cidade, uf);
        return e.vazio() ? null : e;
    }

    /** Substitui os sete campos (já normalizados); nulo apaga todos. */
    public void alterarEndereco(Endereco e) {
        Endereco novo = e == null ? new Endereco(null, null, null, null, null, null, null) : e;
        this.cep = novo.cep();
        this.logradouro = novo.logradouro();
        this.numero = novo.numero();
        this.complemento = novo.complemento();
        this.bairro = novo.bairro();
        this.cidade = novo.cidade();
        this.uf = novo.uf();
        this.atualizadoEm = Instant.now();
    }

    public void alterarSituacao(boolean ativo, Instant quando) {
        this.ativo = ativo;
        this.inativadoEm = ativo ? null : quando;
        this.atualizadoEm = quando;
    }

    public boolean isAnonimizado() {
        return anonimizadoEm != null;
    }

    /** Troca o nome e apaga o que identifica a pessoa; a situação fica inativa. Contagens (pastas, treinos) seguem. */
    public void anonimizar(Instant quando) {
        this.nome = NOME_ANONIMIZADO;
        this.email = null;
        this.objetivo = null;
        this.observacoes = null;
        this.cpf = null;
        this.cep = null;
        this.logradouro = null;
        this.numero = null;
        this.complemento = null;
        this.bairro = null;
        this.cidade = null;
        this.uf = null;
        this.conviteHash = null;
        this.conviteExpiraEm = null;
        this.ativo = false;
        if (this.inativadoEm == null) this.inativadoEm = quando;
        this.anonimizadoEm = quando;
        this.usoDeImagemAutorizadoEm = null;
        this.sexo = null;
        this.cicloAtivadoEm = null;
        this.cicloConsentimentoVersao = null;
        this.cicloDuracaoHabitual = null;
        this.cicloMostrarFases = true;
        this.atualizadoEm = quando;
    }

    public Sexo getSexo() {
        return sexo;
    }

    /** Nulo apaga. A troca que sai de feminino desliga o ciclo no serviço, na mesma transação. */
    public void alterarSexo(Sexo sexo) {
        this.sexo = sexo;
        this.atualizadoEm = Instant.now();
    }

    public Instant getCicloAtivadoEm() {
        return cicloAtivadoEm;
    }

    public Integer getCicloConsentimentoVersao() {
        return cicloConsentimentoVersao;
    }

    public Integer getCicloDuracaoHabitual() {
        return cicloDuracaoHabitual;
    }

    public boolean isCicloMostrarFases() {
        return cicloMostrarFases;
    }

    public void ativarCiclo(Instant quando, int versaoConsentimento, Integer duracaoHabitual) {
        this.cicloAtivadoEm = quando;
        this.cicloConsentimentoVersao = versaoConsentimento;
        this.cicloDuracaoHabitual = duracaoHabitual;
        this.atualizadoEm = quando;
    }

    public void desligarCiclo() {
        this.cicloAtivadoEm = null;
        this.atualizadoEm = Instant.now();
    }

    public void configurarCiclo(Integer duracaoHabitual, boolean mostrarFases) {
        this.cicloDuracaoHabitual = duracaoHabitual;
        this.cicloMostrarFases = mostrarFases;
        this.atualizadoEm = Instant.now();
    }

    public Instant getUsoDeImagemAutorizadoEm() {
        return usoDeImagemAutorizadoEm;
    }

    /** Grava o instante da autorização, ou nulo quando o aluno desliga. */
    public void definirUsoDeImagem(Instant quando) {
        this.usoDeImagemAutorizadoEm = quando;
    }

    public void novoConvite(String hash, Instant expiraEm) {
        this.conviteHash = hash;
        this.conviteExpiraEm = expiraEm;
    }

    /** Convite aceito: liga o usuário e consome o código (não serve de novo). */
    public void ligarUsuario(UUID usuarioId) {
        this.usuarioId = usuarioId;
        this.conviteHash = null;
        this.conviteExpiraEm = null;
        this.atualizadoEm = Instant.now();
    }
}
