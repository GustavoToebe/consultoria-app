package br.com.treinos.api.pagamentos;

import br.com.plataforma.comum.web.ApiError;
import br.com.plataforma.comum.web.BadRequestException;
import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.alunos.Aluno;
import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.conta.ContaLocalRepositorio;
import br.com.treinos.api.conta.DireitosLocais;
import br.com.treinos.api.execucao.AlunoAppService;
import br.com.treinos.api.pagamentos.CalculadorDeSplitAsaas.ResultadoSplit;
import br.com.treinos.api.pagamentos.CheckoutTransparenteAsaasDtos.GerarPixAlunoRequest;
import br.com.treinos.api.pagamentos.CheckoutTransparenteAsaasDtos.PixAlunoResponse;
import br.com.treinos.api.pagamentos.CheckoutTransparenteAsaasDtos.SituacaoCobrancaAlunoResponse;
import br.com.treinos.api.pagamentos.PagamentosDtos.LinkDePagamento;
import br.com.treinos.api.pagamentos.provedor.AsaasCliente;
import br.com.treinos.api.pagamentos.provedor.ProvedorIndisponivelException;
import br.com.treinos.api.security.UsuarioAutenticado;
import br.com.treinos.api.tenant.TenantContext;
import br.com.treinos.api.web.Formatos;
import br.com.treinos.api.web.Fuso;
import br.com.treinos.api.web.ValidacaoException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.net.URI;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

/**
 * Checkout do aluno via Overtraining Pay (Asaas): Pix dentro do app, fatura do Asaas (cartão na página dele) e consulta de
 * situação. Cobrança no Asaas: uma só por {@code cobranca_aluno} (reaproveitada pelo Pix e pela fatura); split e valor
 * saem só do servidor. Nenhum dado de cartão passa por aqui.
 * <p>
 * Todas as chamadas HTTP ao {@link AsaasCliente} executam <b>fora de transação</b>. CPF, chaves e a URL da fatura nunca
 * vão a log nem a auditoria.
 */
@Service
public class CheckoutTransparenteAsaasService {

    private static final Logger log = LoggerFactory.getLogger(CheckoutTransparenteAsaasService.class);
    private static final Set<String> HOSTS_DA_FATURA = Set.of("www.asaas.com", "sandbox.asaas.com");
    // Cobranças que o Asaas ainda aceita pagar; o resto (paga, em análise, estornada, apagada) não é reaproveitado.
    private static final Set<String> REAPROVEITAVEIS = Set.of("PENDING", "OVERDUE");
    private static final Set<String> EM_CONFIRMACAO = Set.of("RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH",
            "AWAITING_RISK_ANALYSIS");

    private final CobrancaAlunoRepository cobrancas;
    private final SubcontaAsaasRepository subcontas;
    private final ClienteAsaasAlunoRepository clientesAsaas;
    private final ResponsavelFinanceiroRepository responsaveis;
    private final AlunoRepository alunos;
    private final FormasDeRecebimentoService formas;
    private final CobrancaAutomatica automatica;
    private final CifraDePagamento cifra;
    private final AsaasCliente asaasCliente;
    private final ContaLocalRepositorio contasLocais;
    private final CalculadorDeSplitAsaas calculadorDeSplit;
    private final TransactionTemplate leitura;
    private final TransactionTemplate escrita;

    public CheckoutTransparenteAsaasService(CobrancaAlunoRepository cobrancas, SubcontaAsaasRepository subcontas,
                                            ClienteAsaasAlunoRepository clientesAsaas,
                                            ResponsavelFinanceiroRepository responsaveis, AlunoRepository alunos,
                                            FormasDeRecebimentoService formas, CobrancaAutomatica automatica,
                                            CifraDePagamento cifra, AsaasCliente asaasCliente,
                                            ContaLocalRepositorio contasLocais, CalculadorDeSplitAsaas calculadorDeSplit,
                                            PlatformTransactionManager transacoes) {
        this.cobrancas = cobrancas;
        this.subcontas = subcontas;
        this.clientesAsaas = clientesAsaas;
        this.responsaveis = responsaveis;
        this.alunos = alunos;
        this.formas = formas;
        this.automatica = automatica;
        this.cifra = cifra;
        this.asaasCliente = asaasCliente;
        this.contasLocais = contasLocais;
        this.calculadorDeSplit = calculadorDeSplit;
        this.leitura = new TransactionTemplate(transacoes);
        this.leitura.setReadOnly(true);
        this.escrita = new TransactionTemplate(transacoes);
    }

    public PixAlunoResponse gerarPix(UsuarioAutenticado eu, UUID cobrancaId, GerarPixAlunoRequest req) {
        ContextoCheckout ctx = preparar(eu, cobrancaId, req);
        AsaasCliente.CobrancaPixCriada cobranca = garantirCobranca(ctx, cobrancaId);
        AsaasCliente.CobrancaPixCriada qr = cobranca.qrCodeBase64() != null ? cobranca
                : asaasCliente.consultarQrCodePix(ctx.apiKey(), cobranca.paymentId());
        return new PixAlunoResponse(cobrancaId, cobranca.paymentId(), ctx.valorCentavos(),
                qr.qrCodeBase64(), qr.pixCopiaECola(), qr.expiraEm());
    }

    /** Fatura do Asaas (Pix ou cartão na página dele): só a URL https do host do Asaas volta ao app. */
    public LinkDePagamento gerarFatura(UsuarioAutenticado eu, UUID cobrancaId, GerarPixAlunoRequest req) {
        ContextoCheckout ctx = preparar(eu, cobrancaId, req);
        AsaasCliente.CobrancaPixCriada cobranca = garantirCobranca(ctx, cobrancaId);
        if (!urlDaFatura(cobranca.invoiceUrl())) {
            log.warn("Overtraining Pay: o Asaas devolveu uma fatura fora dos endereços conhecidos.");
            throw new ProvedorIndisponivelException();
        }
        return new LinkDePagamento(cobranca.invoiceUrl());
    }

    public SituacaoCobrancaAlunoResponse consultarSituacao(UsuarioAutenticado eu, UUID cobrancaId) {
        UUID alunoId = AlunoAppService.alunoDaSessao(eu);
        return leitura.execute(st -> {
            CobrancaAluno c = cobrancas.findById(cobrancaId)
                    .filter(x -> alunoId.equals(x.getAlunoId()))
                    .orElseThrow(Travas::cobrancaNaoEncontrada);
            return new SituacaoCobrancaAlunoResponse(c.getId(), c.getSituacao().name(), c.getPagoEm());
        });
    }

    // ---- apoio interno ----

    private record ContextoCheckout(UUID consultoriaId, UUID alunoId, UUID subcontaId, String walletIdSubconta,
                                    String apiKey, String customerIdExistente, String asaasCobrancaId, String nomePagador,
                                    String cpfPagadorDigitos, String emailPagador, long valorCentavos,
                                    LocalDate vencimento, String descricao, ResultadoSplit split) {
        @Override
        public String toString() {
            return "[PROTEGIDO]";
        }
    }

    private ContextoCheckout preparar(UsuarioAutenticado eu, UUID cobrancaId, GerarPixAlunoRequest req) {
        UUID alunoId = AlunoAppService.alunoDaSessao(eu);
        UUID consultoriaId = consultoriaAtual();
        String cpfInformado = req == null ? null : req.cpfPagador();
        return leitura.execute(st -> {
            CobrancaAluno c = cobrancas.findById(cobrancaId)
                    .filter(x -> alunoId.equals(x.getAlunoId()))
                    .orElseThrow(Travas::cobrancaNaoEncontrada);
            automatica.exigirComum(c);
            if (c.getSituacao() != CobrancaAluno.Situacao.ABERTA) {
                throw new ConflictException("Esta cobrança não está em aberto.", "COBRANCA_NAO_ABERTA");
            }
            if (c.getTipo() == CobrancaAluno.Tipo.SAIDA) {
                throw new ConflictException("Cobrança de saída não está disponível no Overtraining Pay.",
                        "OVERTRAINING_PAY_INDISPONIVEL");
            }
            if (c.getValorCentavos() < AsaasCliente.VALOR_MINIMO_CENTAVOS) {
                throw new ValidacaoException("O valor mínimo para pagamento no Overtraining Pay é R$ 5,00.",
                        "VALOR_MINIMO_OVERTRAINING_PAY",
                        List.of(new ApiError.FieldError("valorCentavos", "Valor mínimo de R$ 5,00.")));
            }
            SubcontaAsaas subconta = subcontas.daConsultoria()
                    .filter(s -> s.getSituacao() == SubcontaAsaas.Situacao.ATIVA && s.getApiKeyCifrada() != null)
                    .orElseThrow(() -> new ConflictException("O Overtraining Pay não está ativo nesta consultoria.",
                            "OVERTRAINING_PAY_INDISPONIVEL"));
            if (!formas.overtrainingPayLigado()) {
                throw new ConflictException("O Overtraining Pay não está habilitado nas formas de recebimento.",
                        "OVERTRAINING_PAY_INDISPONIVEL");
            }

            String customerIdExistente = clientesAsaas.findByAlunoIdAndSubcontaId(alunoId, subconta.getId())
                    .map(ClienteAsaasAluno::getAsaasCustomerId)
                    .orElse(null);

            Aluno aluno = alunos.findById(alunoId).orElseThrow(Travas::cobrancaNaoEncontrada);
            ResponsavelFinanceiro responsavel = responsaveis.findByAlunoId(alunoId).orElse(null);

            String nomePagador = responsavel != null && textoOuNull(responsavel.getNome()) != null
                    ? responsavel.getNome().strip() : aluno.getNome();
            String emailPagador = responsavel != null && textoOuNull(responsavel.getEmail()) != null
                    ? responsavel.getEmail().strip() : textoOuNull(aluno.getEmail());

            String cpfDigitos = resolverCpfPagador(responsavel, aluno, cpfInformado, customerIdExistente != null);
            String apiKey = cifra.decifrar(consultoriaId, subconta.getApiKeyCifrada());

            DireitosLocais direitos = contasLocais.direitos(consultoriaId).orElse(null);
            ResultadoSplit split = calculadorDeSplit.calcular(c.getValorCentavos(), subconta.getWalletId(), direitos);

            String descricao = textoOuNull(c.getDescricao()) != null
                    ? c.getDescricao().strip()
                    : (c.getCompetencia() != null ? "Mensalidade " + c.getCompetencia() : "Cobrança Overtraining");

            return new ContextoCheckout(consultoriaId, alunoId, subconta.getId(), subconta.getWalletId(), apiKey,
                    customerIdExistente, c.getAsaasCobrancaId(), nomePagador, cpfDigitos, emailPagador,
                    c.getValorCentavos(),
                    c.getVencimento(), descricao, split);
        });
    }

    private String obterOuCriarCliente(ContextoCheckout ctx) {
        if (ctx.customerIdExistente() != null) {
            return ctx.customerIdExistente();
        }
        String customerId = asaasCliente.criarCliente(ctx.apiKey(), ctx.nomePagador(), ctx.cpfPagadorDigitos(),
                ctx.emailPagador(), ctx.alunoId());
        try {
            escrita.executeWithoutResult(st -> {
                if (clientesAsaas.findByAlunoIdAndSubcontaId(ctx.alunoId(), ctx.subcontaId()).isEmpty()) {
                    clientesAsaas.saveAndFlush(new ClienteAsaasAluno(ctx.alunoId(), ctx.subcontaId(), customerId,
                            Instant.now()));
                }
            });
            return customerId;
        } catch (DataIntegrityViolationException e) {
            return leitura.execute(st -> clientesAsaas.findByAlunoIdAndSubcontaId(ctx.alunoId(), ctx.subcontaId())
                    .map(ClienteAsaasAluno::getAsaasCustomerId)
                    .orElse(customerId));
        }
    }

    /** Reaproveita a cobrança já criada no Asaas; senão cria uma (UNDEFINED: Pix e cartão) com o split do servidor. */
    private AsaasCliente.CobrancaPixCriada garantirCobranca(ContextoCheckout ctx, UUID cobrancaId) {
        if (ctx.asaasCobrancaId() != null) {
            AsaasCliente.CobrancaConsultadaAsaas existente = asaasCliente.consultarCobranca(ctx.apiKey(),
                    ctx.asaasCobrancaId());
            String status = existente.status().toUpperCase(Locale.ROOT);
            if (EM_CONFIRMACAO.contains(status)) {
                throw new ConflictException("O pagamento desta cobrança já foi identificado e está sendo confirmado.",
                        "PAGAMENTO_EM_CONFIRMACAO");
            }
            if (REAPROVEITAVEIS.contains(status) && existente.valorCentavos() != null
                    && existente.valorCentavos() == ctx.valorCentavos()) {
                return new AsaasCliente.CobrancaPixCriada(existente.id(), existente.status(), existente.invoiceUrl(),
                        null, null, null);
            }
        }
        String customerId = obterOuCriarCliente(ctx);
        LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
        LocalDate vencimentoEfetivo = ctx.vencimento().isBefore(hoje) ? hoje : ctx.vencimento();
        AsaasCliente.CobrancaPixCriada criada = asaasCliente.criarCobrancaDoAluno(ctx.apiKey(),
                new AsaasCliente.PedidoPixAsaas(customerId, ctx.valorCentavos(), vencimentoEfetivo,
                        ctx.descricao(), cobrancaId.toString(), ctx.walletIdSubconta(), ctx.split().splits()));
        registrarIdAsaas(cobrancaId, criada.paymentId());
        return criada;
    }

    static boolean urlDaFatura(String url) {
        if (url == null) {
            return false;
        }
        try {
            URI uri = URI.create(url);
            return "https".equals(uri.getScheme()) && uri.getUserInfo() == null && uri.getPort() == -1
                    && HOSTS_DA_FATURA.contains(uri.getHost());
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    private void registrarIdAsaas(UUID cobrancaId, String paymentId) {
        escrita.executeWithoutResult(st -> cobrancas.findById(cobrancaId).ifPresent(c -> {
            c.registrarAsaasCobranca(paymentId);
            cobrancas.flush();
        }));
    }

    private static String resolverCpfPagador(ResponsavelFinanceiro responsavel, Aluno aluno, String cpfInformado,
                                             boolean clienteJaExiste) {
        if (responsavel != null && textoOuNull(responsavel.getCpf()) != null) {
            return apenasDigitos(responsavel.getCpf());
        }
        if (textoOuNull(aluno.getCpf()) != null) {
            return apenasDigitos(aluno.getCpf());
        }
        if (textoOuNull(cpfInformado) != null) {
            try {
                String validado = Formatos.cpf(cpfInformado);
                return apenasDigitos(validado);
            } catch (BadRequestException e) {
                throw new ValidacaoException("CPF do pagador inválido.", "CPF_INVALIDO",
                        List.of(new ApiError.FieldError("cpfPagador", "Informe um CPF válido.")));
            }
        }
        if (clienteJaExiste) {
            return null;
        }
        throw new ValidacaoException("Informe o CPF do pagador para continuar.", "CPF_OBRIGATORIO",
                List.of(new ApiError.FieldError("cpfPagador", "Informe o CPF do pagador.")));
    }

    static boolean estaPagaNoAsaas(String status) {
        if (status == null) {
            return false;
        }
        String s = status.toUpperCase(Locale.ROOT);
        return "RECEIVED".equals(s) || "CONFIRMED".equals(s) || "RECEIVED_IN_CASH".equals(s);
    }

    private static String textoOuNull(String valor) {
        if (valor == null) {
            return null;
        }
        String limpo = valor.strip();
        return limpo.isEmpty() ? null : limpo;
    }

    private static String apenasDigitos(String valor) {
        return valor == null ? "" : valor.replaceAll("\\D", "");
    }

    private static UUID consultoriaAtual() {
        UUID consultoria = TenantContext.get();
        if (consultoria == null) {
            throw new IllegalStateException("Sem consultoria na requisição.");
        }
        return consultoria;
    }
}
