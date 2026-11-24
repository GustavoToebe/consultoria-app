package br.com.treinos.api.pagamentos;

import br.com.plataforma.comum.web.ApiError;
import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.pagamentos.PagamentosDtos.ContratarRequest;
import br.com.treinos.api.pagamentos.PagamentosDtos.ContratacaoResponse;
import br.com.treinos.api.pagamentos.PagamentosDtos.EntradaDoContrato;
import br.com.treinos.api.pagamentos.PagamentosDtos.LinhaDaPreviaDoContrato;
import br.com.treinos.api.pagamentos.PagamentosDtos.PagamentoDoSaldoRequest;
import br.com.treinos.api.pagamentos.PagamentosDtos.PagamentoDoSaldoResponse;
import br.com.treinos.api.pagamentos.PagamentosDtos.ParcelaDoContrato;
import br.com.treinos.api.pagamentos.PagamentosDtos.PreviaDoContrato;
import br.com.treinos.api.pagamentos.PagamentosDtos.PreviaDoContratoRequest;
import br.com.treinos.api.web.FaixaDeData;
import br.com.treinos.api.web.ValidacaoException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Contrato fechado (V098, {@code docs/planos/contrato-fechado.md}): conferir e gerar as cobranças de {@code PARCELADO_FIXO} e
 * {@code SALDO_ABERTO}, a prévia e o pagamento do saldo. A entrada é uma AVULSA "Entrada" ligada à contratação; as parcelas
 * nascem pelo caminho da renegociação (um {@link AcordoDeCobranca} do contrato e cobranças RENEGOCIACAO com "Parcela k/n"); cada
 * pagamento do saldo é uma AVULSA nova. O valor das parcelas e dos pagamentos vem do corpo (a 4ª e a 5ª exceção à regra "o valor da
 * cobrança é do servidor") e é conferido aqui: soma igual ao total, cada cobrança de 1 centavo a R$ 1.000.000,00 e nunca acima do
 * que falta. Descrição sempre texto fixo do servidor. 422 por campo, sem repetir o que a pessoa digitou.
 */
@Service
public class ContratoFechadoService {

    /** O teto de cada cobrança do contrato (D10), o mesmo da cobrança de saída. */
    static final long MAXIMO_POR_COBRANCA = CalculoDaSaida.VALOR_MAXIMO;
    static final String CODIGO = "CONTRATO_INVALIDO";
    static final String ROTULO_DA_ENTRADA = "Entrada";
    static final String ROTULO_DO_SALDO = "Pagamento do saldo";

    private final CobrancaAlunoRepository cobrancas;
    private final AcordoDeCobrancaRepository acordos;
    private final PlanoComercialRepository planos;
    private final Travas travas;
    private final BaixaManualDeUma baixaManual;
    private final Auditoria auditoria;

    ContratoFechadoService(CobrancaAlunoRepository cobrancas,
                           AcordoDeCobrancaRepository acordos, PlanoComercialRepository planos, Travas travas,
                           BaixaManualDeUma baixaManual, Auditoria auditoria) {
        this.cobrancas = cobrancas;
        this.acordos = acordos;
        this.planos = planos;
        this.travas = travas;
        this.baixaManual = baixaManual;
        this.auditoria = auditoria;
    }

    /** A entrada já conferida: valor zero = sem entrada. */
    record Entrada(long valorCentavos, LocalDate data, boolean paga, FormaDePagamento forma) {
        boolean existe() {
            return valorCentavos > 0;
        }
    }

    /** O contrato já conferido, pronto para gravar. {@code parcelas} só em {@code PARCELADO_FIXO}. */
    record Conferido(ModoDeCobranca modo, long totalCentavos, Entrada entrada, List<ParcelaDoContrato> parcelas) {
    }

    // ---- contratar ----

    /** O recorrente não leva nada do contrato: campo de outro modo é 422 (antes de qualquer efeito). */
    void exigirSemCamposDoContrato(ContratarRequest r) {
        List<ApiError.FieldError> erros = new ArrayList<>();
        if (r.valorTotalCentavos() != null) {
            erros.add(new ApiError.FieldError("valorTotalCentavos", "O valor total só vale no contrato fechado."));
        }
        if (r.entrada() != null) {
            erros.add(new ApiError.FieldError("entrada", "A entrada só vale no contrato fechado."));
        }
        if (r.parcelas() != null && !r.parcelas().isEmpty()) {
            erros.add(new ApiError.FieldError("parcelas", "As parcelas só valem no contrato com parcelas fixas."));
        }
        lancar(erros);
    }

    /** Confere o corpo do contratar nos modos fechados e devolve o que vai gravar. */
    Conferido conferir(ContratarRequest r, PlanoComercial plano, LocalDate hoje) {
        List<ApiError.FieldError> erros = new ArrayList<>();
        if (plano.isKiwifyAssinatura()) {
            erros.add(new ApiError.FieldError("modoCobranca", "O plano cobrado pela Kiwify não aceita contrato fechado."));
        }
        ModoDeCobranca modo = r.modo();
        Entrada entrada = conferirTotalEEntrada(erros, r.valorTotalCentavos(), r.entrada(), hoje);
        List<ParcelaDoContrato> parcelas = null;
        if (modo == ModoDeCobranca.PARCELADO_FIXO) {
            parcelas = ordenadas(r.parcelas());
            long somaDasParcelas = conferirParcelas(erros, parcelas, hoje);
            if (erros.isEmpty() && somaDasParcelas + entrada.valorCentavos() != r.valorTotalCentavos()) {
                erros.add(new ApiError.FieldError("parcelas", "A soma da entrada e das parcelas precisa ser igual ao valor total."));
            }
        } else if (r.parcelas() != null && !r.parcelas().isEmpty()) {
            erros.add(new ApiError.FieldError("parcelas", "As parcelas só valem no contrato com parcelas fixas."));
        }
        lancar(erros);
        return new Conferido(modo, r.valorTotalCentavos(), entrada, parcelas);
    }

    /**
     * Grava a entrada e, em {@code PARCELADO_FIXO}, o acordo e as parcelas, todos ligados à contratação já gravada. A entrada já
     * paga recebe a baixa manual na mesma transação (as travas aluno e contratação já são de quem chama).
     */
    @Transactional(propagation = Propagation.MANDATORY)
    void gerarCobrancas(ContratacaoAluno c, Conferido k, UUID usuarioId, LocalDate hoje) {
        UUID alunoId = c.getAlunoId();
        CobrancaAluno entrada = null;
        if (k.entrada().existe()) {
            entrada = cobrancas.saveAndFlush(CobrancaAluno.entradaDoContrato(alunoId, ROTULO_DA_ENTRADA,
                    k.entrada().valorCentavos(), k.entrada().data()).ligadaAoContrato(c.getId()));
        }
        if (k.modo() == ModoDeCobranca.PARCELADO_FIXO) {
            List<ParcelaDoContrato> parcelas = k.parcelas();
            long soma = 0;
            for (ParcelaDoContrato p : parcelas) {
                soma += p.valorCentavos();
            }
            AcordoDeCobranca acordo = acordos.saveAndFlush(AcordoDeCobranca.doContrato(alunoId, c.getId(), parcelas.size(), soma));
            for (int i = 0; i < parcelas.size(); i++) {
                ParcelaDoContrato p = parcelas.get(i);
                cobrancas.save(CobrancaAluno.renegociacao(acordo.getId(), alunoId, rotuloDaParcela(i + 1, parcelas.size()),
                        p.valorCentavos(), p.vencimento()).ligadaAoContrato(c.getId()));
            }
            cobrancas.flush();
        }
        if (entrada != null && k.entrada().paga()) {
            baixaManual.baixar(entrada.getId(), pagoEm(k.entrada().data(), hoje), k.entrada().forma(), null, null, usuarioId);
        }
    }

    // ---- prévia ----

    /**
     * Só leitura. Sem {@code parcelas}, divide (total − entrada) em {@code quantidade} parcelas pela conta da renegociação
     * ({@link ContaDaRenegociacao#parcelas}, sobra na última), trocando só o rótulo; com {@code parcelas}, só soma e confere. A soma
     * errada não é erro: volta {@code fecha = false} para a tela mostrar.
     */
    @Transactional(readOnly = true)
    public PreviaDoContrato previa(PreviaDoContratoRequest r) {
        LocalDate hoje = FaixaDeData.hoje();
        List<ApiError.FieldError> erros = new ArrayList<>();
        ModoDeCobranca modo = r.modoCobranca() == null ? ModoDeCobranca.RECORRENTE : r.modoCobranca();
        if (!modo.fechado()) {
            erros.add(new ApiError.FieldError("modoCobranca", "A prévia é só do contrato fechado."));
        }
        Entrada entrada = conferirTotalEEntrada(erros, r.valorTotalCentavos(), r.entrada(), hoje);
        List<LinhaDaPreviaDoContrato> linhas = new ArrayList<>();
        if (entrada.existe()) {
            linhas.add(new LinhaDaPreviaDoContrato(null, entrada.data(), entrada.valorCentavos(), ROTULO_DA_ENTRADA));
        }
        long soma = entrada.valorCentavos();
        if (modo == ModoDeCobranca.PARCELADO_FIXO) {
            List<ParcelaDoContrato> parcelas = ordenadas(r.parcelas());
            if (parcelas != null && !parcelas.isEmpty()) {
                soma += conferirParcelas(erros, parcelas, hoje);
                for (int i = 0; i < parcelas.size() && erros.isEmpty(); i++) {
                    ParcelaDoContrato p = parcelas.get(i);
                    linhas.add(new LinhaDaPreviaDoContrato(i + 1, p.vencimento(), p.valorCentavos(),
                            rotuloDaParcela(i + 1, parcelas.size())));
                }
            } else {
                for (var p : parcelasDivididas(erros, r, entrada, hoje)) {
                    linhas.add(new LinhaDaPreviaDoContrato(p.numero(), p.vencimento(), p.valorCentavos(), p.descricao()));
                    soma += p.valorCentavos();
                }
            }
        } else if (modo == ModoDeCobranca.SALDO_ABERTO && r.parcelas() != null && !r.parcelas().isEmpty()) {
            erros.add(new ApiError.FieldError("parcelas", "As parcelas só valem no contrato com parcelas fixas."));
        }
        lancar(erros);
        long diferenca = r.valorTotalCentavos() - soma;
        boolean fecha = modo == ModoDeCobranca.PARCELADO_FIXO ? diferenca == 0 : diferenca >= 0;
        return new PreviaDoContrato(linhas, soma, fecha, diferenca);
    }

    private List<PagamentosDtos.ParcelaDaPreviaDaRenegociacao> parcelasDivididas(List<ApiError.FieldError> erros,
            PreviaDoContratoRequest r, Entrada entrada, LocalDate hoje) {
        Integer n = r.quantidade();
        if (n == null || n < 1 || n > RenegociacaoService.MAXIMO_DE_PARCELAS) {
            erros.add(new ApiError.FieldError("quantidade", "Escolha de 1 a " + RenegociacaoService.MAXIMO_DE_PARCELAS + " parcelas."));
        }
        if (r.primeiroVencimento() == null) {
            erros.add(new ApiError.FieldError("primeiroVencimento", "Informe o primeiro vencimento."));
        } else {
            erros.addAll(FaixaDeData.problemas(hoje,
                    FaixaDeData.PLANEJAMENTO.campo("primeiroVencimento", "Primeiro vencimento", r.primeiroVencimento())));
        }
        if (!erros.isEmpty()) {
            return List.of();
        }
        long restante = r.valorTotalCentavos() - entrada.valorCentavos();
        if (restante < n) {
            erros.add(new ApiError.FieldError("valorTotalCentavos",
                    "O valor total precisa cobrir a entrada e ao menos 1 centavo por parcela."));
            return List.of();
        }
        var parcelas = ContaDaRenegociacao.parcelas(restante, n, r.primeiroVencimento()).stream()
                .map(p -> new PagamentosDtos.ParcelaDaPreviaDaRenegociacao(p.numero(), p.vencimento(), p.valorCentavos(),
                        rotuloDaParcela(p.numero(), n)))
                .toList();
        if (parcelas.get(parcelas.size() - 1).valorCentavos() > MAXIMO_POR_COBRANCA) {
            erros.add(new ApiError.FieldError("quantidade", "Cada parcela pode ir até R$ 1.000.000,00: use mais parcelas."));
            return List.of();
        }
        return parcelas;
    }

    // ---- pagamento do saldo ----

    /** {@code repetido}: o mesmo {@code pedidoId} já tinha criado o pagamento (200 em vez de 201). */
    public record Resultado(PagamentoDoSaldoResponse resposta, boolean repetido) { }

    /**
     * Um pagamento do saldo de um contrato {@code SALDO_ABERTO} ATIVO: AVULSA nova, ligada à contratação, aberta ou já paga. Ordem:
     * corpo (422), travas aluno e contratação (404 de outra consultoria), repetição pelo {@code pedidoId} (a segunda de duas chamadas
     * simultâneas espera a trava e a enxerga), estado do contrato (409) e o limite
     * ({@code total − PAGA − ABERTA − CONTESTADA}, 422 {@code SALDO_INVALIDO} em {@code valorCentavos}), com as cobranças do contrato
     * travadas em ordem fixa. Auditoria com o evento da avulsa, de resumo fixo.
     */
    @Transactional
    public Resultado pagarSaldo(UUID contratacaoId, PagamentoDoSaldoRequest r, UUID usuarioId) {
        LocalDate hoje = FaixaDeData.hoje();
        conferirPagamento(r, hoje);
        ContratacaoAluno c = travas.daContratacao(contratacaoId).contratacao();
        var existente = cobrancas.findFirstByPedidoId(r.pedidoId());
        if (existente.isPresent()) {
            if (!contratacaoId.equals(existente.get().getContratacaoId())) {
                throw new ConflictException("Este pedido já foi usado em outra cobrança.", "PEDIDO_JA_USADO");
            }
            conferirRepeticao(existente.get(), r);
            return new Resultado(resposta(c, existente.get().getId(), hoje), true);
        }
        if (c.getSituacao() == ContratacaoAluno.Situacao.ENCERRADA) {
            throw new ConflictException("Esta contratação já foi encerrada.", "CONTRATACAO_ENCERRADA");
        }
        if (c.getModoCobranca() != ModoDeCobranca.SALDO_ABERTO || c.getSituacao() != ContratacaoAluno.Situacao.ATIVA) {
            throw new ConflictException("Só um contrato de saldo livre ativo recebe pagamentos do saldo.",
                    "CONTRATO_NAO_ACEITA_SALDO");
        }
        var linhas = cobrancas.doContratoTravadas(contratacaoId).stream().map(ContaDoContrato.Linha::de).toList();
        long limite = ContaDoContrato.bloco(c.getModoCobranca(), c.getValorTotalCentavos(), linhas, hoje).limiteDeLancamentoCentavos();
        if (r.valorCentavos() > limite) {
            throw new ValidacaoException("Confira o valor do pagamento.", "SALDO_INVALIDO", List.of(new ApiError.FieldError(
                    "valorCentavos", "O valor passa do que falta pagar do contrato.")));
        }
        CobrancaAluno nova = cobrancas.saveAndFlush(CobrancaAluno.avulsa(r.pedidoId(), c.getAlunoId(), 1, ROTULO_DO_SALDO,
                r.valorCentavos(), r.vencimento()).ligadaAoContrato(contratacaoId));
        if (Boolean.TRUE.equals(r.jaPaga())) {
            baixaManual.baixar(nova.getId(), pagoEm(r.vencimento(), hoje), r.forma() == null ? FormaDePagamento.OUTRO : r.forma(),
                    null, null, usuarioId);
        }
        auditoria.registrarEvento("COBRANCAS_AVULSAS_GERADAS", "ALUNO", c.getAlunoId(), "Gerou cobranças avulsas para o aluno.");
        return new Resultado(resposta(c, nova.getId(), hoje), false);
    }

    /**
     * O mesmo {@code pedidoId} só repete o que já criou: valor, vencimento, "já recebi" ({@code jaPaga}) e forma têm de ser os da
     * cobrança que existe. Corpo diferente é outro pedido com o id de antes (409, mensagem fixa), nunca um 200 com a cobrança antiga.
     */
    private static void conferirRepeticao(CobrancaAluno existente, PagamentoDoSaldoRequest r) {
        boolean paga = Boolean.TRUE.equals(r.jaPaga());
        boolean igual = existente.getValorCentavos() == r.valorCentavos() && existente.getVencimento().equals(r.vencimento())
                && paga == (existente.getSituacao() == CobrancaAluno.Situacao.PAGA)
                && (!paga || (r.forma() == null ? FormaDePagamento.OUTRO : r.forma()) == existente.getForma());
        if (!igual) {
            throw new ConflictException("Este pedido já foi usado em outra cobrança.", "PEDIDO_JA_USADO");
        }
    }

    private PagamentoDoSaldoResponse resposta(ContratacaoAluno c, UUID cobrancaId, LocalDate hoje) {
        cobrancas.flush();
        String plano = planos.findById(c.getPlanoComercialId()).map(PlanoComercial::getNome).orElse(null);
        ContratacaoResponse contratacao = Respostas.contratacao(c, plano, cobrancas.contratoDe(c, hoje));
        return new PagamentoDoSaldoResponse(cobrancaId, contratacao);
    }

    private static void conferirPagamento(PagamentoDoSaldoRequest r, LocalDate hoje) {
        List<ApiError.FieldError> erros = new ArrayList<>();
        if (r.pedidoId() == null) {
            erros.add(new ApiError.FieldError("pedidoId", "Informe o identificador do pedido."));
        }
        if (r.valorCentavos() == null || r.valorCentavos() < 1 || r.valorCentavos() > MAXIMO_POR_COBRANCA) {
            erros.add(new ApiError.FieldError("valorCentavos", "Informe um valor maior que zero, até R$ 1.000.000,00."));
        }
        if (r.vencimento() == null) {
            erros.add(new ApiError.FieldError("vencimento", "Informe o vencimento."));
        } else {
            erros.addAll(FaixaDeData.problemas(hoje, FaixaDeData.PLANEJAMENTO.campo("vencimento", "Vencimento", r.vencimento())));
        }
        if (r.forma() != null && !r.forma().manual()) {
            erros.add(new ApiError.FieldError("forma", "Escolha dinheiro, Pix direto, transferência ou outro."));
        }
        lancar(erros);
    }

    // ---- conferências comuns ----

    /** Total de 1 centavo a R$ 10 milhões; entrada de 0 até o total e de no máximo R$ 1 milhão, com data na faixa quando há valor. */
    private static Entrada conferirTotalEEntrada(List<ApiError.FieldError> erros, Long total, EntradaDoContrato entrada,
                                                 LocalDate hoje) {
        boolean totalValido = total != null && total >= 1 && total <= PagamentosDtos.VALOR_MAXIMO;
        if (!totalValido) {
            erros.add(new ApiError.FieldError("valorTotalCentavos", "Informe o valor total, de R$ 0,01 a R$ 10.000.000,00."));
        }
        long valor = entrada == null || entrada.valorCentavos() == null ? 0 : entrada.valorCentavos();
        if (valor < 0 || valor > MAXIMO_POR_COBRANCA) {
            erros.add(new ApiError.FieldError("entrada.valorCentavos", "A entrada vai de R$ 0,00 a R$ 1.000.000,00."));
            return new Entrada(0, null, false, null);
        }
        if (totalValido && valor > total) {
            erros.add(new ApiError.FieldError("entrada.valorCentavos", "A entrada não pode passar do valor total."));
        }
        if (valor == 0) {
            return new Entrada(0, null, false, null);
        }
        if (entrada.data() == null) {
            erros.add(new ApiError.FieldError("entrada.data", "Informe a data da entrada."));
        } else {
            erros.addAll(FaixaDeData.problemas(hoje, FaixaDeData.PLANEJAMENTO.campo("entrada.data", "Data da entrada", entrada.data())));
        }
        boolean paga = Boolean.TRUE.equals(entrada.jaPaga());
        if (entrada.forma() != null && !entrada.forma().manual()) {
            erros.add(new ApiError.FieldError("entrada.forma", "Escolha dinheiro, Pix direto, transferência ou outro."));
        }
        return new Entrada(valor, entrada.data(), paga, entrada.forma() == null ? FormaDePagamento.OUTRO : entrada.forma());
    }

    /** 1 a 12 parcelas, cada uma com data na faixa e valor de 1 centavo a R$ 1 milhão; devolve a soma (só vale sem erro). */
    private static long conferirParcelas(List<ApiError.FieldError> erros, List<ParcelaDoContrato> parcelas, LocalDate hoje) {
        if (parcelas == null || parcelas.isEmpty() || parcelas.size() > RenegociacaoService.MAXIMO_DE_PARCELAS) {
            erros.add(new ApiError.FieldError("parcelas", "Escolha de 1 a " + RenegociacaoService.MAXIMO_DE_PARCELAS + " parcelas."));
            return 0;
        }
        long soma = 0;
        for (int i = 0; i < parcelas.size(); i++) {
            ParcelaDoContrato p = parcelas.get(i);
            if (p == null) {
                erros.add(new ApiError.FieldError("parcelas[" + i + "]", "Parcela inválida."));
                continue;
            }
            if (p.vencimento() == null) {
                erros.add(new ApiError.FieldError("parcelas[" + i + "].vencimento", "Informe o vencimento."));
            } else {
                erros.addAll(FaixaDeData.problemas(hoje, FaixaDeData.PLANEJAMENTO.campo("parcelas[" + i + "].vencimento",
                        "Vencimento", p.vencimento())));
            }
            if (p.valorCentavos() == null || p.valorCentavos() < 1 || p.valorCentavos() > MAXIMO_POR_COBRANCA) {
                erros.add(new ApiError.FieldError("parcelas[" + i + "].valorCentavos",
                        "Informe um valor maior que zero, até R$ 1.000.000,00."));
            } else {
                soma += p.valorCentavos();
            }
        }
        return soma;
    }

    /** Por vencimento (estável), antes de rotular "Parcela k/n": a 1 é a que vence primeiro, em qualquer ordem da lista. */
    private static List<ParcelaDoContrato> ordenadas(List<ParcelaDoContrato> parcelas) {
        if (parcelas == null || parcelas.stream().anyMatch(p -> p == null || p.vencimento() == null)) {
            return parcelas;
        }
        return parcelas.stream().sorted(java.util.Comparator.comparing(ParcelaDoContrato::vencimento)).toList();
    }

    /** Texto fixo do servidor: nunca o que o treinador digitou. */
    static String rotuloDaParcela(int k, int n) {
        return "Parcela " + k + "/" + n;
    }

    /** O dia do pagamento já feito: a data da cobrança, ou hoje se ela é futura (a baixa não aceita data futura). */
    private static LocalDate pagoEm(LocalDate data, LocalDate hoje) {
        return data.isAfter(hoje) ? hoje : data;
    }

    private static void lancar(List<ApiError.FieldError> erros) {
        if (!erros.isEmpty()) {
            throw new ValidacaoException("Confira os dados do contrato.", CODIGO, erros);
        }
    }
}
