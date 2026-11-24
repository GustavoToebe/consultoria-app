package br.com.treinos.api.pagamentos;

import jakarta.validation.Valid;
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

    /**
     * {@code tempoMinimoMeses} (1 a 60) só em plano mensal e {@code regraDeSaida} (até 500) são conferidos no serviço, que
     * responde 422 {@code PLANO_INVALIDO} sem repetir o valor (o erro do Bean Validation o carregaria). A regra é texto do
     * treinador: nunca em log, auditoria nem {@code toString}. {@code kiwifyAssinatura} e {@code kiwifyProdutoId} (D17) só valem
     * com {@code TREINOS_PAGAMENTOS_KIWIFY_HABILITADO} ligada (desligada, a API os ignora e mantém o gravado); a regra é do serviço.
     */
    public record PlanoRequest(
            @NotBlank @Size(max = 80) String nome,
            @NotNull @Positive @Max(VALOR_MAXIMO) Long valorCentavos,
            @NotNull PeriodoDoPlano periodicidade,
            Integer tempoMinimoMeses,
            String regraDeSaida,
            String linkDePagamento,
            Long versao,
            Boolean incluiTreino,
            Boolean incluiDieta,
            Boolean kiwifyAssinatura,
            String kiwifyProdutoId) {

        /** Ausente = incluído (corpo antigo, sem os campos, segue valendo); os dois desligados é 422 no serviço. */
        boolean incluiTreinoOuPadrao() {
            return incluiTreino == null || incluiTreino;
        }

        boolean incluiDietaOuPadrao() {
            return incluiDieta == null || incluiDieta;
        }

        @Override
        public String toString() {
            return "PlanoRequest[nome=" + nome + "]";
        }
    }

    public record PlanoResponse(UUID id, String nome, long valorCentavos, PeriodoDoPlano periodicidade, boolean arquivado,
                                Instant criadoEm, Long versao, Short tempoMinimoMeses, String regraDeSaida,
                                String linkDePagamento, boolean incluiTreino, boolean incluiDieta,
                                boolean kiwifyAssinatura, String kiwifyProdutoId) {

        @Override
        public String toString() {
            return "PlanoResponse[id=" + id + "]";
        }
    }

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

    /**
     * {@code valorCentavos} nulo = o valor do plano; valor diferente do plano exige {@code motivoValor}.
     * {@code gerarMesesAnteriores} (D10): ausente ou {@code false} grava o início como digitado, mas as cobranças começam na
     * competência do mês corrente; {@code true} gera também as dos meses anteriores, desde o início.
     */
    public record ContratarRequest(
            @NotNull UUID planoComercialId,
            @Positive @Max(VALOR_MAXIMO) Long valorCentavos,
            @Size(max = 200) String motivoValor,
            @NotNull LocalDate inicio,
            @NotNull @Min(1) @Max(31) Integer diaVencimento,
            Boolean primeiroPeriodoPago,
            Boolean gerarMesesAnteriores) {

        boolean comMesesAnteriores() {
            return Boolean.TRUE.equals(gerarMesesAnteriores);
        }
    }

    /** O mesmo corpo do contratar, mais o aluno (a rota não o tem no caminho). Só leitura. */
    public record PreviaDeGeracaoRequest(
            @NotNull UUID alunoId,
            @NotNull UUID planoComercialId,
            @Positive @Max(VALOR_MAXIMO) Long valorCentavos,
            @NotNull LocalDate inicio,
            @NotNull @Min(1) @Max(31) Integer diaVencimento,
            Boolean primeiroPeriodoPago,
            Boolean gerarMesesAnteriores) {

        ContratarRequest paraContratar() {
            return new ContratarRequest(planoComercialId, valorCentavos, null, inicio, diaVencimento, primeiroPeriodoPago,
                    gerarMesesAnteriores);
        }
    }

    /**
     * O que contratar geraria em aberto agora: quantidade, soma e as competências ({@code AAAA-MM}, nulas se nada nasce
     * aberto). O app só mostra; nunca calcula.
     */
    public record PreviaDeGeracao(int quantidade, long totalCentavos, String primeiraCompetencia, String ultimaCompetencia) { }

    public record AlterarContratacaoRequest(
            @NotNull @Positive @Max(VALOR_MAXIMO) Long valorCentavos,
            @Size(max = 200) String motivoValor,
            @NotNull @Min(1) @Max(31) Integer diaVencimento,
            LocalDate minimoAte,
            @NotNull Long versao) { }

    public record ContratacaoResponse(UUID id, UUID alunoId, UUID planoComercialId, String planoNome,
                                      PeriodoDoPlano periodicidade, long valorCentavos, String motivoValor, LocalDate inicio,
                                      int diaVencimento, ContratacaoAluno.Situacao situacao, Instant encerradaEm,
                                      Instant criadoEm, Long versao,
                                      LocalDate terminoVigencia, Long diasRestantesVigencia, String alertaRenovacao,
                                      LocalDate minimoAte) { }

    // ---- Encerrar com cobrança de saída ----

    /**
     * Só {@code opcao} é obrigatória. {@code valorCentavos} é obrigatório em {@code FALTAM}, {@code VIGENTE} e {@code OUTRO}
     * (nas duas primeiras o servidor confere com a conta dele) e é a única vez que o corpo traz valor de cobrança.
     * {@code cobrancasACancelar} são os ids que a tela mostrou (só {@code FALTAM}); {@code vencimento} nulo = hoje. Os limites
     * (valor, vencimento) são conferidos no serviço, que responde 422 sem repetir o valor.
     */
    public record SaidaRequest(@NotNull OpcaoDeSaida opcao, Long valorCentavos, LocalDate vencimento,
                               List<UUID> cobrancasACancelar) { }

    /** {@code saida} ausente (ou {@code NAO_COBRAR}) encerra como sempre: as cobranças abertas ficam. */
    public record EncerrarRequest(@NotNull Long versao, @Valid SaidaRequest saida) { }

    public record GrupoDeAbertas(int quantidade, long valorCentavos) { }

    /** {@code motivo} (texto fixo) só quando indisponível; {@code valorCentavos} só nas opções que têm valor calculado. */
    public record OpcaoDaPrevia(OpcaoDeSaida opcao, boolean disponivel, Long valorCentavos, String motivo) { }

    /**
     * O que acontece se o plano for encerrado agora. {@code vencidas} ficam em aberto; {@code aVencerNoMinimo} são canceladas
     * pela opção {@code FALTAM} (ids em {@code cobrancasACancelar}, {@code comLinkVivo} delas têm link de pagamento que ainda vale:
     * pagar depois do cancelamento cai em "para conferir"). {@code mesesQueFaltam} = a vencer dentro do mínimo + meses ainda
     * não gerados. {@code aVencerQueFicam} são as mensalidades abertas a vencer que continuam abertas (competência a partir do
     * {@code minimoAte} ou, sem mínimo, todas as a vencer): nenhuma opção as cancela. {@code regraDeSaida} é o lembrete do contrato (texto do treinador): fora do {@code toString}. A tela só
     * desenha estes números.
     */
    public record PreviaDoEncerramento(UUID contratacaoId, PeriodoDoPlano periodicidade, ContratacaoAluno.Situacao situacao,
                                       LocalDate minimoAte, int mesesQueFaltam, String regraDeSaida,
                                       GrupoDeAbertas vencidas, GrupoDeAbertas aVencerNoMinimo,
                                       GrupoDeAbertas aVencerQueFicam, List<UUID> cobrancasACancelar, int comLinkVivo, int mesesNaoGerados,
                                       long valorDosNaoGeradosCentavos, List<OpcaoDaPrevia> opcoes) {

        @Override
        public String toString() {
            return "PreviaDoEncerramento[contratacaoId=" + contratacaoId + "]";
        }
    }

    /**
     * O que inativar o aluno faz com o financeiro (todas as contratações, inclusive encerradas): {@code aCancelar} são as
     * mensalidades abertas que ainda não venceram; {@code emAberto} fica (vencidas e cobrança de saída).
     * {@code mesesQueFaltam} > 0 avisa que o mínimo se perde: sem cobrança de saída, inativar não cobra o que falta.
     */
    public record ResumoDaSaidaDoAluno(GrupoDeAbertas aCancelar, GrupoDeAbertas emAberto, LocalDate minimoAte,
                                       int mesesQueFaltam) { }

    // ---- Cobrança ----

    public record BaixaManualRequest(
            @NotNull LocalDate data,
            @NotNull FormaDePagamento forma,
            @Size(max = 300) String observacao,
            @NotNull Long versao) { }

    /** Desfazer a baixa e cancelar a cobrança: motivo obrigatório, versão conferida. */
    public record MotivoRequest(@NotBlank @Size(max = 300) String motivo, @NotNull Long versao) { }

    /**
     * {@code vencida} é calculada pela API (ABERTA com vencimento anterior a hoje em Brasília). {@code criadoEm} é o instante
     * em que a linha da cobrança foi gerada (a "Emissão" da tela: a API não emite documento fiscal nem boleto) e
     * {@code idExterno} a transação do provedor (nulo na baixa manual). {@code alunoCpf} só vem com
     * {@code ALUNO_SENSIVEL_LER} (senão nulo) e nunca vai a log, auditoria nem {@code toString}. Na cobrança AVULSA
     * {@code contratacaoId}, {@code planoNome} e {@code competencia} vêm nulos e {@code descricao} traz o texto do treinador
     * (nulo nas outras). {@code acordoId} (D14) vem nas originais RENEGOCIADA e nas parcelas RENEGOCIACAO, nulo nas demais e nas
     * originais reabertas ao desfazer; a parcela tem {@code descricao} fixa do servidor e o {@code motivo} da renegociação fica nas
     * originais (só a equipe vê). {@code cobrancaAutomatica} (D18) é {@code KIWIFY} na mensalidade de plano com assinatura pela
     * Kiwify, calculada na leitura e só com a chave ligada e a credencial configurada (senão nulo).
     */
    public record CobrancaResponse(UUID id, UUID contratacaoId, UUID alunoId, String alunoNome, String planoNome,
                                   LocalDate competencia, LocalDate vencimento, long valorCentavos,
                                   CobrancaAluno.Situacao situacao, boolean vencida, Long diasDeAtraso,
                                   FormaDePagamento forma, String provedor, LocalDate pagoEm, UUID baixaPor,
                                   String baixaPorNome, String observacao, String motivo, Long versao,
                                   Instant criadoEm, String idExterno, String alunoCpf, CobrancaAluno.Tipo tipo,
                                   String descricao, UUID acordoId, String cobrancaAutomatica) {

        @Override
        public String toString() {
            return "CobrancaResponse[id=" + id + "]";
        }
    }

    // ---- Baixa em lote ----

    /**
     * Os mesmos dados da baixa manual individual, valendo para todas as cobranças do lote (1 a 100, sem repetir). Sem valor: o
     * servidor decide o de cada cobrança. {@code versao} é a que a tela leu de cada uma.
     */
    public record BaixaEmLoteRequest(
            @NotNull @Size(min = 1, max = BaixaEmLote.MAXIMO_DE_ITENS) List<@NotNull @Valid ItemDoLote> itens,
            @NotNull LocalDate data,
            @NotNull FormaDePagamento forma,
            @Size(max = 300) String observacao) { }

    public record ItemDoLote(@NotNull UUID cobrancaId, @NotNull Long versao) { }

    /** {@code codigo} nulo quando deu certo; senão o código estável da recusa (o mesmo da baixa individual). */
    public record ResultadoDoItem(UUID cobrancaId, boolean ok, String codigo) { }

    public record ResultadoDoLote(List<ResultadoDoItem> resultados) { }

    /**
     * Os totais do filtro inteiro (todas as páginas): cancelada e estornada ficam fora de tudo; {@code pagoCentavos} é só PAGA;
     * {@code emAbertoCentavos} inclui a vencida; {@code vencidoCentavos} é a aberta com vencimento antes de hoje (Brasília).
     */
    public record Totais(long totalCentavos, long pagoCentavos, long emAbertoCentavos, long vencidoCentavos) { }

    public record PaginaCobrancas(List<CobrancaResponse> itens, long total, int pagina, Totais totais) { }

    // ---- Cobrança avulsa ----

    /**
     * Sem validação de Bean Validation de propósito: o erro dela carregaria o valor recusado e não traria o código; tudo é
     * conferido em {@link CobrancaAvulsaService}, que responde 422 {@code COBRANCA_AVULSA_INVALIDA} por campo sem repetir o
     * valor. {@code descricao} é texto do treinador: fora do {@code toString}.
     */
    public record CobrancaAvulsaRequest(UUID pedidoId, List<UUID> alunoIds, String descricao, Long valorCentavos,
                                        LocalDate primeiroVencimento, Integer parcelas) {

        @Override
        public String toString() {
            return "CobrancaAvulsaRequest[]";
        }
    }

    /** Contagens do que foi gerado: {@code alunos} e {@code cobrancas} (alunos x parcelas). */
    public record CobrancasAvulsasGeradas(int alunos, int cobrancas) { }

    // ---- Renegociar (D14) ----

    /** Uma original e a versão que a tela viu. Sem Bean Validation: tudo é conferido em {@link RenegociacaoService} (422 por campo). */
    public record ItemDaRenegociacao(UUID cobrancaId, Long versao) { }

    /**
     * O que a prévia confere e calcula: 1 a 100 itens do mesmo aluno, acréscimo e desconto de 0 a {@link #VALOR_MAXIMO}, 1 a 12 parcelas
     * e o primeiro vencimento (faixa PLANEJAMENTO). Sem Bean Validation de propósito: o erro dela carregaria o valor recusado e não traria
     * o código {@code RENEGOCIACAO_INVALIDA}.
     */
    public record PreviaDaRenegociacaoRequest(List<ItemDaRenegociacao> itens, Long acrescimoCentavos, Long descontoCentavos,
                                              Integer parcelas, LocalDate primeiroVencimento) { }

    /**
     * O confirmar: o corpo da prévia mais o {@code pedidoId} (idempotência) e o {@code motivo}, texto do treinador que só a equipe
     * vê: fora do {@code toString}, nunca em log, auditoria, aluno nem provedor.
     */
    public record RenegociarRequest(List<ItemDaRenegociacao> itens, Long acrescimoCentavos, Long descontoCentavos, Integer parcelas,
                                    LocalDate primeiroVencimento, UUID pedidoId, String motivo) {

        PreviaDaRenegociacaoRequest previa() {
            return new PreviaDaRenegociacaoRequest(itens, acrescimoCentavos, descontoCentavos, parcelas, primeiroVencimento);
        }

        @Override
        public String toString() {
            return "RenegociarRequest[]";
        }
    }

    /** Uma parcela como o servidor vai gravar: valor com a sobra dos centavos na última e o vencimento já preso ao fim do mês. */
    public record ParcelaDaPreviaDaRenegociacao(int numero, LocalDate vencimento, long valorCentavos, String descricao) { }

    /** A prévia, toda do servidor: a soma das originais lida no banco, o ajuste, o total (soma + acréscimo − desconto) e as parcelas. */
    public record PreviaDaRenegociacao(UUID alunoId, int quantidadeDeOriginais, long somaDosOriginaisCentavos,
                                       long acrescimoCentavos, long descontoCentavos, long totalCentavos,
                                       List<ParcelaDaPreviaDaRenegociacao> parcelas) { }

    /** 201 (200 na repetição do mesmo pedido): só contagens e o total gravado. */
    public record RenegociacaoResponse(UUID acordoId, int renegociadas, int parcelas, long totalCentavos) { }

    /** O motivo (obrigatório, até 300 depois do strip) vai às parcelas canceladas; texto do treinador, fora do {@code toString}. */
    public record DesfazerAcordoRequest(String motivo) {

        @Override
        public String toString() {
            return "DesfazerAcordoRequest[]";
        }
    }

    /** {@code reabertas} = originais que voltaram a ABERTA; {@code canceladas} = parcelas abertas que este desfazer cancelou. */
    public record AcordoDesfeito(UUID acordoId, int reabertas, int canceladas) { }

    // ---- Lote: cancelar, link e exportar as selecionadas ----

    public static final int MAXIMO_DO_LOTE = 100;

    /** {@code motivo} opcional (até 300): vale para todos os itens. */
    public record CancelarEmLoteRequest(
            @NotNull @Size(min = 1, max = MAXIMO_DO_LOTE) List<@NotNull @Valid ItemDoLote> itens,
            @Size(max = 300) String motivo) { }

    public record LinkEmLoteRequest(@NotNull @Size(min = 1, max = MAXIMO_DO_LOTE) List<@NotNull UUID> cobrancaIds) { }

    /** {@code url} só no item que deu certo (nunca vai a log). */
    public record ResultadoDoLink(UUID cobrancaId, boolean ok, String codigo, String url) {

        @Override
        public String toString() {
            return "ResultadoDoLink[cobrancaId=" + cobrancaId + ", ok=" + ok + "]";
        }
    }

    public record ResultadoDoLoteDeLinks(List<ResultadoDoLink> resultados) { }

    public record SelecionadasRequest(@NotNull @Size(min = 1, max = MAXIMO_DO_LOTE) List<@NotNull UUID> cobrancaIds) { }

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

    /** 0 = o mês já ocorreu (até o corrente) e não teve pagamento registrado; {@code null} = sem dado. */
    public record MesRecebido(String mes, boolean parcial, Long recebidoCentavos) { }

    /**
     * Números do financeiro. {@code previstoCentavos}: abertas com vencimento de hoje em diante. {@code inadimplencia}:
     * entre as cobranças não canceladas que já venceram dentro da janela, a fração (0 a 100, uma casa) das que seguem
     * abertas, contada por cobrança. {@code receitaRecorrenteMensalCentavos}: contratações ativas, sem parcela única,
     * valor dividido pelos meses da periodicidade. {@code historicoFinanceiroParcial}: só informativo (a consultoria teve
     * parte do histórico removida numa limpeza); não altera valor nem declara período completo.
     */
    public record Numeros(List<MesRecebido> meses, Long previstoCentavos, BigDecimal inadimplenciaPercentual,
                          Long receitaRecorrenteMensalCentavos, boolean historicoFinanceiroParcial) { }

    public record Periodo(LocalDate de, LocalDate ate) { }

    public record ValorEQuantidade(Long valorCentavos, long cobrancas) { }

    public record Cartoes(Long recebidoCentavos, Long aReceberCentavos, ValorEQuantidade emAtraso,
                          Long receitaRecorrenteMensalCentavos, Long alunosPagantes, Long valorMedioPorAlunoCentavos) { }

    /**
     * Um mês da série. {@code previstoCentavos} só do mês corrente em diante (0 sem aberta; mês encerrado é nulo); as avulsas
     * são nulas com o filtro "meus"; {@code resultadoCentavos} é nulo se faltar recebido, entradas ou saídas.
     */
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

    /** {@code historicoFinanceiroParcial}: só informativo, não muda nenhum valor nem declara período completo. */
    public record Painel(Periodo periodo, boolean somenteMeus, Cartoes cartoes, List<MesDoPainel> serie,
                         Inadimplencia inadimplencia, List<PorForma> porForma, List<PorPlano> porPlano,
                         List<MovimentoDeAlunos> movimentoDeAlunos, ProximosRecebimentos proximosRecebimentos,
                         ResultadoDoMes resultadoDoMes, Liquido liquido, boolean historicoFinanceiroParcial) { }

    public record Inadimplente(UUID cobrancaId, UUID alunoId, String alunoNome, long valorCentavos, LocalDate vencimento,
                               long diasDeAtraso) { }

    public record PaginaInadimplentes(List<Inadimplente> itens, long total, Long valorTotalCentavos, int pagina) { }

    /**
     * {@code encerraramSemRenovar}: grupo à parte das renovações (nunca somado a elas): parcela única ATIVA cujo término
     * passou há até 30 dias, a mais recente primeiro, até 50 itens; {@code encerraramSemRenovarCount} é o total (pode passar
     * da lista). Pausada ou encerrada à mão não entra. {@code alunoNome} é nome de pessoa: só vai a quem tem
     * {@code FINANCEIRO_LER} (que depende de {@code ALUNO_LER}).
     */
    public record VisaoGeralResponse(
            int renovacoesProximasCount,
            long renovacoesProximasCentavos,
            long projecaoAnualCentavos,
            int encerraramSemRenovarCount,
            List<EncerradoSemRenovar> encerraramSemRenovar) { }

    public record EncerradoSemRenovar(UUID contratacaoId, UUID alunoId, String alunoNome, LocalDate terminoVigencia,
                                      long valorCentavos) { }

    // ---- Aluno ----

    /** O que o aluno vê do próprio plano: sem observação interna, motivo nem quem deu a baixa. */
    public record PlanoDoAluno(UUID contratacaoId, String planoNome, long valorCentavos, PeriodoDoPlano periodicidade,
                               ContratacaoAluno.Situacao situacao, LocalDate proximoVencimento,
                               String linkDePagamento) { }

    /**
     * {@code competencia} é nula na AVULSA, que traz {@code descricao}. {@code cobrancaAutomatica} é {@code KIWIFY} na mensalidade
     * de plano com assinatura pela Kiwify (só com a chave ligada e a credencial configurada; senão nulo): o aluno não a paga por
     * aqui (sem "Pagar", link, Pix nem forma).
     */
    public record CobrancaDoAluno(UUID id, LocalDate competencia, LocalDate vencimento, long valorCentavos,
                                  CobrancaAluno.Situacao situacao, boolean vencida, FormaDePagamento forma,
                                  LocalDate pagoEm, CobrancaAluno.Tipo tipo, String descricao, String cobrancaAutomatica) { }

    /** {@code pagamentoOnline}: o aluno pode pedir o link de pagamento (módulo, InfinitePay e credencial do treinador). A Tag nunca vem. */
    public record FinanceiroDoAluno(PlanoDoAluno plano, List<CobrancaDoAluno> abertas, List<CobrancaDoAluno> historico,
                                    boolean pagamentoOnline, List<FormasDePagamentoDoAluno.Forma> formasDePagamento) { }

    /** O link de pagamento de uma cobrança aberta. */
    public record LinkDePagamento(String url) { }

    // ---- Pagamentos para conferir ----

    /**
     * Um pagamento online confirmado que não se aplicou sozinho. Cobrança, competência, valores e aluno vêm nulos quando a
     * cobrança não existe nesta consultoria. {@code valorPagoCentavos} é o valor que o provedor confirmou (o do link).
     * {@code provedor} é {@code INFINITEPAY} ou {@code KIWIFY} e {@code idExterno} a venda nele (o {@code order_id} da Kiwify, o
     * {@code transaction_nsu} da InfinitePay), para achá-la no painel do provedor; nunca o e-mail do comprador.
     */
    public record ConferenciaDePagamento(UUID id, UUID alunoId, String alunoNome, UUID cobrancaId, LocalDate competencia,
                                         Long valorCobrancaCentavos, Long valorPagoCentavos, String motivo,
                                         Instant recebidoEm, String provedor, String idExterno) { }

    public record Conferencias(List<ConferenciaDePagamento> itens) { }

    // ---- Exportação do aluno (LGPD) ----

    public record ContratacaoExportada(UUID id, String planoNome, PeriodoDoPlano periodicidade, long valorCentavos,
                                       String motivoValor, LocalDate inicio, int diaVencimento,
                                       ContratacaoAluno.Situacao situacao, Instant encerradaEm, Instant criadoEm,
                                       LocalDate minimoAte) { }

    public record CobrancaExportada(UUID id, UUID contratacaoId, LocalDate competencia, LocalDate vencimento,
                                    long valorCentavos, CobrancaAluno.Situacao situacao, FormaDePagamento forma,
                                    String provedor, LocalDate pagoEm, String observacao, String motivo,
                                    CobrancaAluno.Tipo tipo, String descricao, UUID acordoId) { }

    /** Lembrete de cobrança na exportação: tipo, situação e datas (a linha não guarda endereço nem texto). */
    public record LembreteExportado(UUID cobrancaId, TipoDeLembrete tipo, LembreteDeCobranca.Situacao situacao,
                                    LocalDate dataPrevista, Instant enviadoEm) { }

    /** A escolha do próprio aluno sobre os lembretes de cobrança: {@code desligadoEm} nulo = recebe. */
    public record EscolhaDeLembretesExportada(boolean receber, Instant desligadoEm) { }

    /** Um acordo de renegociação (D14): só ids, datas, contagens e total; o motivo vai no {@code motivo} das cobranças originais. */
    public record AcordoExportado(UUID id, Instant criadoEm, Instant desfeitoEm, int renegociadas, int parcelas, long totalCentavos) { }

    /**
     * {@code responsavelFinanceiro} (D15) é nulo quando o aluno não tem; o CPF dele só sai com {@code ALUNO_SENSIVEL_LER}.
     * {@code acordos} (D14) traz também os desfeitos ({@code desfeitoEm}), de que as originais reabertas já não guardam o id.
     */
    public record FinanceiroExportado(List<ContratacaoExportada> contratacoes, List<CobrancaExportada> cobrancas,
                                      List<LembreteExportado> lembretes, EscolhaDeLembretesExportada escolhaDeLembretes,
                                      ResponsavelFinanceiroDtos.ResponsavelExportado responsavelFinanceiro,
                                      List<AcordoExportado> acordos) { }

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
     * aberto (de aluno ativo; de inativo só a vencida ou a de saída); {@code telefone} nulo = o aluno não tem telefone (o app
     * explica e não oferece o botão). Telefone e mensagem nunca vão a log nem {@code toString}. Com responsável financeiro que
     * tem telefone (D15), é o dele (o texto não muda e não leva o nome dele).
     */
    public record WhatsAppDaCobranca(String telefone, String mensagem) {

        @Override
        public String toString() {
            return "WhatsAppDaCobranca[]";
        }
    }

    /**
     * {@code alunoDesligou}: o aluno desligou os lembretes por e-mail só para ele (o job não manda mais). Só informa o
     * treinador: o botão do WhatsApp manual não muda. {@code motivoSemWhatsapp} (código fixo) diz por que {@code whatsapp} veio
     * nulo, para o botão aparecer desabilitado com o porquê; nulo quando há mensagem. {@code paraResponsavel} (D15): o aluno
     * tem responsável financeiro com e-mail e/ou telefone, que recebe no lugar dele o canal que informou (sem nome).
     */
    public record LembretesDaCobranca(List<LembreteResponse> itens, WhatsAppDaCobranca whatsapp, boolean alunoDesligou,
                                      String motivoSemWhatsapp, boolean paraResponsavel) { }

    /** O pedido do aluno para receber ou não os lembretes de cobrança por e-mail; sempre vale para o aluno da sessão. */
    public record LembretesDoAlunoRequest(@NotNull Boolean receber) { }

    public record LembretesDoAlunoResponse(boolean receber) { }
}
