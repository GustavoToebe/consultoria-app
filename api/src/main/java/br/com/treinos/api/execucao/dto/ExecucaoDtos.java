package br.com.treinos.api.execucao.dto;

import br.com.treinos.api.consultoria.MarcaPublica;
import br.com.treinos.api.dieta.ConteudoDieta;
import br.com.treinos.api.planos.dto.PlanoDtos.VersaoDetalhe;
import br.com.treinos.api.treino.ConteudoTreino;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Contratos HTTP de registros, histórico, peso e das rotas do aluno (seções 9.3 e 9.4). */
public final class ExecucaoDtos {

    private ExecucaoDtos() { }

    // ---- Lote do aluno ----

    /**
     * Um registro feito no aparelho. Sem Bean Validation por campo de propósito: registro ruim vira {@code RECUSADO}
     * com motivo, sem derrubar o lote inteiro.
     */
    public record RegistroExecucao(UUID id, UUID planoVersaoId, UUID sessaoUid, UUID exercicioUid, UUID serieUid,
                                   LocalDate data, BigDecimal carga, Integer repeticoes, Boolean concluida,
                                   String observacao, Instant alteradoNoAparelhoEm) {
    }

    public record LoteRequest(@NotNull @Size(max = 300) List<@NotNull RegistroExecucao> registros) {
    }

    public enum Situacao { ACEITO, IGNORADO_ANTIGO, RECUSADO }

    public record ResultadoRegistro(UUID id, Situacao situacao, String motivo) {
    }

    public record LoteResponse(List<ResultadoRegistro> resultados) {
    }

    // ---- Histórico (treinador e aluno) ----

    public record SerieFeita(UUID id, UUID serieUid, String tipo, boolean trabalho, BigDecimal carga, String unidade,
                             Integer repeticoes, boolean concluida, String observacao) {
    }

    public record ExercicioFeito(UUID exercicioUid, UUID exercicioId, String nome, List<SerieFeita> series) {
    }

    public record SessaoFeita(UUID sessaoUid, String sessao, UUID planoVersaoId, List<ExercicioFeito> exercicios) {
    }

    public record DiaDeTreino(LocalDate data, List<SessaoFeita> sessoes) {
    }

    public record ProgressoPonto(LocalDate data, BigDecimal maiorCargaTrabalho, Integer repeticoes) {
    }

    // ---- Peso ----

    public record PesoRequest(
            @NotNull LocalDate data,
            @NotNull @DecimalMin(value = "0", inclusive = false) @DecimalMax(value = "500", inclusive = false)
            @Digits(integer = 3, fraction = 2) BigDecimal pesoKg,
            @Size(max = 300) String observacao) {
    }

    /** {@code variacao}: diferença para o registro anterior (por data); nulo no primeiro. */
    public record PesoResponse(UUID id, LocalDate data, BigDecimal pesoKg, BigDecimal variacao, String observacao) {
    }

    // ---- Pacote do aluno (offline) ----

    public record UltimaCarga(BigDecimal carga, Integer repeticoes, LocalDate data) {
    }

    public record TreinoAtual(UUID planoId, UUID versaoId, int numero, String titulo, LocalDate inicio, LocalDate fim,
                              Instant publicadoEm, ConteudoTreino conteudo) {
    }

    public record ConfiguracaoAluno(BigDecimal arredondamentoKg, String tipoTrabalho, String instrucoesTreino) {
    }

    public record AlunoNome(String nome) {
    }

    /** Tudo o que o app guarda para funcionar sem internet (seção 11). {@code treino} nulo = sem plano publicado. */
    public record PainelAluno(MarcaPublica marca, AlunoNome aluno, TreinoAtual treino,
                              Map<UUID, UltimaCarga> ultimasCargas, ConfiguracaoAluno configuracao, Instant geradoEm,
                              br.com.treinos.api.atualizacoes.AtualizacaoService.Detalhe atualizacao) {
    }

    /**
     * Pasta do aluno com ao menos um plano publicado. {@code concluidaEm} nulo = ativa; {@code atual} = a pasta do
     * plano vigente (o que o pacote offline traz).
     */
    public record PastaDoAluno(UUID id, String titulo, LocalDate inicio, LocalDate fim, Instant concluidaEm,
                               boolean atual, boolean temTreino, boolean temDieta) {
    }

    /** Planos publicados de uma pasta; cada um é nulo quando a pasta não tem aquele tipo publicado. */
    public record PlanosDaPasta(UUID pastaId, TreinoAtual treino, VersaoDetalhe<ConteudoDieta> dieta) {
    }

    /** {@code dieta} nula = sem plano de dieta publicado. */
    public record DietaAtual(VersaoDetalhe<ConteudoDieta> dieta) {
    }
}
