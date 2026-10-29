package br.com.treinos.api.pagamentos;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Contratos HTTP do financeiro do aluno ao treinador. Dinheiro sempre em centavos (inteiro). Nenhuma resposta do aluno
 * leva observação, motivo ou quem deu a baixa. Corpo com campo que não existe aqui (por exemplo o valor de uma cobrança)
 * é ignorado: o valor sempre vem do servidor.
 */
public final class PagamentosDtos {

    /** R$ 10 milhões em centavos: teto de sanidade para valor digitado. */
    public static final long VALOR_MAXIMO = 1_000_000_000L;

    private PagamentosDtos() { }

    // ---- Plano comercial ----

    public record PlanoRequest(
            @NotBlank @Size(max = 80) String nome,
            @NotNull @Positive @Max(VALOR_MAXIMO) Long valorCentavos,
            @NotNull PeriodoDoPlano periodicidade,
            Long versao) { }

    public record PlanoResponse(UUID id, String nome, long valorCentavos, PeriodoDoPlano periodicidade, boolean arquivado,
                                Instant criadoEm, Long versao) { }

    public record VersaoRequest(@NotNull Long versao) { }

    // ---- Recebimento online ----

    /**
     * {@code apiKey} ausente mantém a que existe; {@code removerApiKey} a apaga. {@code versao} é a da credencial e só falta
     * ao criar. A chave nunca volta em resposta nenhuma. {@code jurosDoParcelamento} ({@code ALUNO} ou {@code TREINADOR}):
     * ausente = {@code ALUNO} ao criar e "não muda" ao alterar; {@code TREINADOR} exige API Key (conferido no serviço).
     */
    /**
     * A chave não leva {@code @Size}: o erro do Bean Validation carrega o valor recusado, e ela nunca pode aparecer em erro
     * nem log. O limite (10 a 200) é conferido no serviço, que não repete o valor.
     */
    public record RecebimentoOnlineRequest(
            @NotBlank @Size(max = 100) String infiniteTag,
            String apiKey,
            Boolean removerApiKey,
            Long versao,
            @Size(max = 20) String jurosDoParcelamento) {

        @Override
        public String toString() {
            return "RecebimentoOnlineRequest[apiKey=" + (apiKey == null ? "ausente" : "***") + "]";
        }
    }

    /** {@code jurosDoParcelamento} é nulo quando não há credencial. */
    public record RecebimentoOnlineResponse(boolean habilitado, boolean configurado, String infiniteTag,
                                            boolean apiKeyConfigurada, Long versao, String jurosDoParcelamento) { }

    /**
     * O que o app lê da URL de volta da InfinitePay (order_nsu, transaction_nsu, slug, capture_method). Vale só como "consulte
     * de novo": nenhum campo vira dado de pagamento, e quem confirma é a consulta ao provedor. Os formatos são os do webhook;
     * {@code receipt_url} não entra aqui nem em lugar nenhum.
     */
    public record RetornoDoPagamentoRequest(
            @NotBlank @Pattern(regexp = "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$") String orderNsu,
            @NotBlank @Pattern(regexp = "^[A-Za-z0-9._-]{1,100}$") String transactionNsu,
            @Pattern(regexp = "^[A-Za-z0-9._-]{1,100}$") String slug,
            @Pattern(regexp = "^[A-Za-z0-9_-]{1,20}$") String captureMethod) { }

    // ---- Contratação ----

    /** {@code valorCentavos} nulo = o valor do plano; valor diferente do plano exige {@code motivoValor}. */
    public record ContratarRequest(
            @NotNull UUID planoComercialId,
            @Positive @Max(VALOR_MAXIMO) Long valorCentavos,
            @Size(max = 200) String motivoValor,
            @NotNull LocalDate inicio,
            @NotNull @Min(1) @Max(31) Integer diaVencimento) { }

    public record AlterarContratacaoRequest(
            @NotNull @Positive @Max(VALOR_MAXIMO) Long valorCentavos,
            @Size(max = 200) String motivoValor,
            @NotNull @Min(1) @Max(31) Integer diaVencimento,
            @NotNull Long versao) { }

    public record ContratacaoResponse(UUID id, UUID alunoId, UUID planoComercialId, String planoNome,
                                      PeriodoDoPlano periodicidade, long valorCentavos, String motivoValor, LocalDate inicio,
                                      int diaVencimento, ContratacaoAluno.Situacao situacao, Instant encerradaEm,
                                      Instant criadoEm, Long versao) { }

    // ---- Cobrança ----

    public record BaixaManualRequest(
            @NotNull LocalDate data,
            @NotNull FormaDePagamento forma,
            @Size(max = 300) String observacao,
            @NotNull Long versao) { }

    /** Desfazer a baixa e cancelar a cobrança: motivo obrigatório, versão conferida. */
    public record MotivoRequest(@NotBlank @Size(max = 300) String motivo, @NotNull Long versao) { }

    /** {@code vencida} é calculada pela API (ABERTA com vencimento anterior a hoje em Brasília). */
    public record CobrancaResponse(UUID id, UUID contratacaoId, UUID alunoId, String alunoNome, String planoNome,
                                   LocalDate competencia, LocalDate vencimento, long valorCentavos,
                                   CobrancaAluno.Situacao situacao, boolean vencida, Long diasDeAtraso,
                                   FormaDePagamento forma, String provedor, LocalDate pagoEm, UUID baixaPor,
                                   String baixaPorNome, String observacao, String motivo, Long versao) { }

    public record PaginaCobrancas(List<CobrancaResponse> itens, long total, int pagina) { }

    // ---- Lançamentos avulsos ----

    public record LancamentoRequest(
            @NotNull LocalDate data,
            @NotBlank @Size(max = 120) String descricao,
            @NotNull @Positive @Max(VALOR_MAXIMO) Long valorCentavos,
            @NotNull TipoDeLancamento tipo,
            @Size(max = 60) String categoria,
            Long versao) { }

    public record LancamentoResponse(UUID id, LocalDate data, String descricao, long valorCentavos, TipoDeLancamento tipo,
                                     String categoria, Instant criadoEm, Long versao) { }

    public record PaginaLancamentos(List<LancamentoResponse> itens, long total, int pagina) { }

    // ---- Números e painel ----

    /** {@code null} = sem dado, nunca zero inventado. */
    public record MesRecebido(String mes, boolean parcial, Long recebidoCentavos) { }

    /**
     * Números do financeiro. {@code previstoCentavos}: abertas com vencimento de hoje em diante. {@code inadimplencia}:
     * entre as cobranças não canceladas que já venceram dentro da janela, a fração (0 a 100, uma casa) das que seguem
     * abertas, contada por cobrança. {@code receitaRecorrenteMensalCentavos}: contratações ativas, sem parcela única,
     * valor dividido pelos meses da periodicidade.
     */
    public record Numeros(List<MesRecebido> meses, Long previstoCentavos, BigDecimal inadimplenciaPercentual,
                          Long receitaRecorrenteMensalCentavos) { }

    public record Periodo(LocalDate de, LocalDate ate) { }

    public record ValorEQuantidade(Long valorCentavos, long cobrancas) { }

    public record Cartoes(Long recebidoCentavos, Long aReceberCentavos, ValorEQuantidade emAtraso,
                          Long receitaRecorrenteMensalCentavos, Long alunosPagantes, Long valorMedioPorAlunoCentavos) { }

    /** Um mês da série. {@code previstoCentavos} só de hoje em diante; as avulsas são nulas com o filtro "meus". */
    public record MesDoPainel(String mes, boolean parcial, Long recebidoCentavos, Long previstoCentavos,
                              Long entradasAvulsasCentavos, Long saidasAvulsasCentavos, Long resultadoCentavos) { }

    public record Inadimplencia(BigDecimal percentual, Long vencidoCentavos, Long cobradoCentavos) { }

    public record PorForma(FormaDePagamento forma, long cobrancas, long valorCentavos) { }

    public record PorPlano(UUID planoId, String nome, long cobrancas, long valorCentavos) { }

    public record MovimentoDeAlunos(String mes, Long contratacoesNovas, Long contratacoesEncerradas) { }

    public record ProximosRecebimentos(String fonte, ValorEQuantidade em7Dias, ValorEQuantidade em30Dias) { }

    /** Rótulo fixo: não é lucro, só o que foi registrado. Nulo com o filtro "meus" (as avulsas não têm aluno). */
    public record ResultadoDoMes(String rotulo, String mes, Long recebidoCentavos, Long entradasAvulsasCentavos,
                                 Long saidasAvulsasCentavos, Long resultadoCentavos) { }

    /** Na Fase 1 não há taxa conhecida: o líquido é sempre indisponível e nada é descontado. */
    public record Liquido(boolean disponivel, String motivo, Long brutoCentavos) { }

    public record Painel(Periodo periodo, boolean somenteMeus, Cartoes cartoes, List<MesDoPainel> serie,
                         Inadimplencia inadimplencia, List<PorForma> porForma, List<PorPlano> porPlano,
                         List<MovimentoDeAlunos> movimentoDeAlunos, ProximosRecebimentos proximosRecebimentos,
                         ResultadoDoMes resultadoDoMes, Liquido liquido) { }

    public record Inadimplente(UUID cobrancaId, UUID alunoId, String alunoNome, long valorCentavos, LocalDate vencimento,
                               long diasDeAtraso) { }

    public record PaginaInadimplentes(List<Inadimplente> itens, long total, Long valorTotalCentavos, int pagina) { }

    // ---- Aluno ----

    /** O que o aluno vê do próprio plano: sem observação interna, motivo nem quem deu a baixa. */
    public record PlanoDoAluno(UUID contratacaoId, String planoNome, long valorCentavos, PeriodoDoPlano periodicidade,
                               ContratacaoAluno.Situacao situacao, LocalDate proximoVencimento) { }

    public record CobrancaDoAluno(UUID id, LocalDate competencia, LocalDate vencimento, long valorCentavos,
                                  CobrancaAluno.Situacao situacao, boolean vencida, FormaDePagamento forma,
                                  LocalDate pagoEm) { }

    /** {@code pagamentoOnline}: o aluno pode pedir o link de pagamento (módulo, InfinitePay e credencial do treinador). A Tag nunca vem. */
    public record FinanceiroDoAluno(PlanoDoAluno plano, List<CobrancaDoAluno> abertas, List<CobrancaDoAluno> historico,
                                    boolean pagamentoOnline) { }

    /** O link de pagamento de uma cobrança aberta. */
    public record LinkDePagamento(String url) { }

    // ---- Pagamentos para conferir ----

    /**
     * Um pagamento online confirmado que não se aplicou sozinho. Cobrança, competência, valores e aluno vêm nulos quando a
     * cobrança não existe nesta consultoria. {@code valorPagoCentavos} é o valor que o provedor confirmou (o do link).
     */
    public record ConferenciaDePagamento(UUID id, UUID alunoId, String alunoNome, UUID cobrancaId, LocalDate competencia,
                                         Long valorCobrancaCentavos, Long valorPagoCentavos, String motivo,
                                         Instant recebidoEm) { }

    public record Conferencias(List<ConferenciaDePagamento> itens) { }

    // ---- Exportação do aluno (LGPD) ----

    public record ContratacaoExportada(UUID id, String planoNome, PeriodoDoPlano periodicidade, long valorCentavos,
                                       String motivoValor, LocalDate inicio, int diaVencimento,
                                       ContratacaoAluno.Situacao situacao, Instant encerradaEm, Instant criadoEm) { }

    public record CobrancaExportada(UUID id, UUID contratacaoId, LocalDate competencia, LocalDate vencimento,
                                    long valorCentavos, CobrancaAluno.Situacao situacao, FormaDePagamento forma,
                                    String provedor, LocalDate pagoEm, String observacao, String motivo) { }

    /** Lembrete de cobrança na exportação: tipo, situação e datas (a linha não guarda endereço nem texto). */
    public record LembreteExportado(UUID cobrancaId, TipoDeLembrete tipo, LembreteDeCobranca.Situacao situacao,
                                    LocalDate dataPrevista, Instant enviadoEm) { }

    /** A escolha do próprio aluno sobre os lembretes de cobrança: {@code desligadoEm} nulo = recebe. */
    public record EscolhaDeLembretesExportada(boolean receber, Instant desligadoEm) { }

    public record FinanceiroExportado(List<ContratacaoExportada> contratacoes, List<CobrancaExportada> cobrancas,
                                      List<LembreteExportado> lembretes, EscolhaDeLembretesExportada escolhaDeLembretes) { }

    // ---- Lembretes de cobrança por e-mail ----

    /**
     * Configuração dos lembretes. {@code versao} nula só na criação; o intervalo dos dias é conferido no serviço (422
     * {@code LEMBRETES_INVALIDOS} com o campo), não aqui, para a mensagem sair igual à das outras telas do financeiro.
     */
    public record LembretesRequest(@NotNull Boolean ligado, @NotNull Integer diasAntes, @NotNull Boolean noDia,
                                   @NotNull Integer diasDepois, Long versao) { }

    /** {@code emailDisponivel}: o e-mail do app está ligado (sem ele nenhum lembrete sai, mesmo ligado aqui). */
    public record LembretesResponse(boolean ligado, int diasAntes, boolean noDia, int diasDepois, Long versao,
                                    boolean emailDisponivel) { }

    /** Um lembrete da cobrança, para a folha dela. {@code motivo} só no cancelado. */
    public record LembreteResponse(UUID id, TipoDeLembrete tipo, LembreteDeCobranca.Situacao situacao, String motivo,
                                   LocalDate dataPrevista, Instant enviadoEm, Instant atualizadoEm) { }

    /**
     * A mensagem pronta para o treinador mandar à mão pelo WhatsApp (o mesmo texto do e-mail, para hoje). Só na cobrança em
     * aberto de aluno ativo; {@code telefone} nulo = o aluno não tem telefone (o app explica e não oferece o botão).
     */
    public record WhatsAppDaCobranca(String telefone, String mensagem) { }

    /**
     * {@code alunoDesligou}: o aluno desligou os lembretes por e-mail só para ele (o job não manda mais). Só informa o
     * treinador: o botão do WhatsApp manual não muda.
     */
    public record LembretesDaCobranca(List<LembreteResponse> itens, WhatsAppDaCobranca whatsapp, boolean alunoDesligou) { }

    /** O pedido do aluno para receber ou não os lembretes de cobrança por e-mail; sempre vale para o aluno da sessão. */
    public record LembretesDoAlunoRequest(@NotNull Boolean receber) { }

    public record LembretesDoAlunoResponse(boolean receber) { }
}
