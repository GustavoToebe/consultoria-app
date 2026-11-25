package br.com.treinos.api.pagamentos;

import br.com.plataforma.comum.web.ApiError;
import br.com.plataforma.comum.web.BadRequestException;
import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.alunos.Aluno;
import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.conta.ContaLocalRepositorio;
import br.com.treinos.api.conta.DireitosLocais;
import br.com.treinos.api.execucao.AlunoAppService;
import br.com.treinos.api.integracao.AbatimentoSplitCentralService;
import br.com.treinos.api.pagamentos.BaixaDeCobranca.Baixa;
import br.com.treinos.api.pagamentos.CalculadorDeSplitAsaas.ResultadoSplit;
import br.com.treinos.api.pagamentos.CheckoutTransparenteAsaasDtos.CartaoAlunoResponse;
import br.com.treinos.api.pagamentos.CheckoutTransparenteAsaasDtos.GerarPixAlunoRequest;
import br.com.treinos.api.pagamentos.CheckoutTransparenteAsaasDtos.PagarCartaoAlunoRequest;
import br.com.treinos.api.pagamentos.CheckoutTransparenteAsaasDtos.PixAlunoResponse;
import br.com.treinos.api.pagamentos.CheckoutTransparenteAsaasDtos.SituacaoCobrancaAlunoResponse;
import br.com.treinos.api.pagamentos.provedor.AsaasCliente;
import br.com.treinos.api.pagamentos.provedor.ProvedorAsaas;
import br.com.treinos.api.security.UsuarioAutenticado;
import br.com.treinos.api.tenant.TenantContext;
import br.com.treinos.api.web.Formatos;
import br.com.treinos.api.web.Fuso;
import br.com.treinos.api.web.ValidacaoException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/**
 * Checkout Transparente do aluno via Overtraining Pay (Asaas): Pix, Cartão (1..12x) e consulta de situação.
 * <p>
 * Todas as chamadas HTTP ao {@link AsaasCliente} e ao {@link AbatimentoSplitCentralService} executam <b>fora de
 * transação</b>. PAN, CVV, CPF e chaves nunca são persistidos em claro em logs ou auditoria.
 */
@Service
public class CheckoutTransparenteAsaasService {

    private static final String EMAIL_FALLBACK = "pagador@overtraining.app";
    private static final String RESUMO_CONFIRMADO = "Baixa automática de um pagamento online confirmado pelo Overtraining Pay.";

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
    private final BaixaDeCobranca baixa;
    private final Auditoria auditoria;
    private final AbatimentoSplitCentralService abatimentoCentral;
    private final TransactionTemplate leitura;
    private final TransactionTemplate escrita;

    public CheckoutTransparenteAsaasService(CobrancaAlunoRepository cobrancas, SubcontaAsaasRepository subcontas,
                                            ClienteAsaasAlunoRepository clientesAsaas,
                                            ResponsavelFinanceiroRepository responsaveis, AlunoRepository alunos,
                                            FormasDeRecebimentoService formas, CobrancaAutomatica automatica,
                                            CifraDePagamento cifra, AsaasCliente asaasCliente,
                                            ContaLocalRepositorio contasLocais, CalculadorDeSplitAsaas calculadorDeSplit,
                                            BaixaDeCobranca baixa, Auditoria auditoria,
                                            AbatimentoSplitCentralService abatimentoCentral,
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
        this.baixa = baixa;
        this.auditoria = auditoria;
        this.abatimentoCentral = abatimentoCentral;
        this.leitura = new TransactionTemplate(transacoes);
        this.leitura.setReadOnly(true);
        this.escrita = new TransactionTemplate(transacoes);
    }

    public PixAlunoResponse gerarPix(UsuarioAutenticado eu, UUID cobrancaId, GerarPixAlunoRequest req) {
        UUID alunoId = AlunoAppService.alunoDaSessao(eu);
        UUID consultoriaId = consultoriaAtual();
        String cpfInformado = req == null ? null : req.cpfPagador();

        ContextoCheckout ctx = preparar(consultoriaId, alunoId, cobrancaId, cpfInformado, null);
        String customerId = obterOuCriarCliente(ctx);

        LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
        LocalDate vencimentoEfetivo = ctx.vencimento().isBefore(hoje) ? hoje : ctx.vencimento();
        AsaasCliente.CobrancaPixCriada criada = asaasCliente.criarCobrancaPix(ctx.apiKey(),
                new AsaasCliente.PedidoPixAsaas(customerId, ctx.valorCentavos(), vencimentoEfetivo,
                        ctx.descricao(), cobrancaId.toString(), ctx.walletIdSubconta(), ctx.split().splits()));

        registrarIdAsaas(cobrancaId, criada.paymentId());
        return new PixAlunoResponse(cobrancaId, criada.paymentId(), ctx.valorCentavos(),
                criada.qrCodeBase64(), criada.pixCopiaECola(), criada.expiraEm());
    }

    public CartaoAlunoResponse pagarCartao(UsuarioAutenticado eu, UUID cobrancaId, PagarCartaoAlunoRequest req,
                                           String remoteIp) {
        UUID alunoId = AlunoAppService.alunoDaSessao(eu);
        UUID consultoriaId = consultoriaAtual();

        ContextoCheckout ctx = preparar(consultoriaId, alunoId, cobrancaId, req.cpfPagador(), req.parcelas());
        String customerId = obterOuCriarCliente(ctx);

        String emailTitular = textoOuNull(req.titular().email());
        if (emailTitular == null) {
            emailTitular = ctx.emailPagador() != null ? ctx.emailPagador() : EMAIL_FALLBACK;
        }
        String numeroEndereco = textoOuNull(req.titular().numeroEndereco());
        if (numeroEndereco == null) {
            numeroEndereco = "S/N";
        }
        String cpfCnpjTitular = apenasDigitos(req.titular().cpfCnpj());
        if (cpfCnpjTitular.length() != 11 && cpfCnpjTitular.length() != 14) {
            throw new ValidacaoException("Informe um CPF ou CNPJ válido para o titular.", "TITULAR_INVALIDO",
                    List.of(new ApiError.FieldError("titular.cpfCnpj", "Informe um CPF ou CNPJ válido.")));
        }
        String cepTitular = apenasDigitos(req.titular().cep());
        if (cepTitular.length() != 8) {
            throw new ValidacaoException("Informe um CEP válido para o titular.", "TITULAR_INVALIDO",
                    List.of(new ApiError.FieldError("titular.cep", "Informe um CEP com 8 dígitos.")));
        }
        String telefoneTitular = req.titular().telefone() == null ? null : apenasDigitos(req.titular().telefone());
        if (telefoneTitular != null && telefoneTitular.isEmpty()) {
            telefoneTitular = null;
        }

        AsaasCliente.DadosCartao cartao = new AsaasCliente.DadosCartao(
                req.cartao().nomeImpresso().strip(),
                apenasDigitos(req.cartao().numero()),
                req.cartao().mesValidade().strip(),
                req.cartao().anoValidade().strip(),
                req.cartao().cvv().strip());
        AsaasCliente.TitularCartao titular = new AsaasCliente.TitularCartao(
                req.titular().nome().strip(),
                emailTitular,
                cpfCnpjTitular,
                cepTitular,
                numeroEndereco,
                telefoneTitular);

        LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
        LocalDate vencimentoEfetivo = ctx.vencimento().isBefore(hoje) ? hoje : ctx.vencimento();
        AsaasCliente.CobrancaCartaoCriada criada = asaasCliente.criarCobrancaCartao(ctx.apiKey(),
                new AsaasCliente.PedidoCartaoAsaas(customerId, ctx.valorCentavos(), vencimentoEfetivo,
                        ctx.descricao(), cobrancaId.toString(), req.parcelas(), cartao, titular, remoteIp,
                        ctx.walletIdSubconta(), ctx.split().splits()));

        registrarIdAsaas(cobrancaId, criada.paymentId());

        if (estaPagaNoAsaas(criada.status())) {
            AsaasCliente.CobrancaConsultadaAsaas consultada = asaasCliente.consultarCobranca(ctx.apiKey(),
                    criada.paymentId());
            if (estaPagaNoAsaas(consultada.status())
                    && consultada.valorCentavos() != null
                    && consultada.valorCentavos() == ctx.valorCentavos()) {
                LocalDate pagoEm = consultada.pagoEm() != null ? consultada.pagoEm() : hoje;
                Long valorLiquido = consultada.valorLiquidoCentavos() != null
                        ? consultada.valorLiquidoCentavos() : criada.valorLiquidoCentavos();
                boolean baixouAgora = Boolean.TRUE.equals(escrita.execute(st -> {
                    BaixaDeCobranca.Resultado res = baixa.baixarDoProvedor(cobrancaId, new Baixa(
                            ProvedorAsaas.CODIGO, FormaDePagamento.CARTAO, pagoEm, null, null, null,
                            criada.paymentId()));
                    res.cobranca().registrarAsaasCobranca(criada.paymentId());
                    if (valorLiquido != null) {
                        res.cobranca().registrarValorLiquido(valorLiquido);
                    }
                    cobrancas.flush();
                    if (res.mudou()) {
                        auditoria.registrarDoSistema(consultoriaId, "PAGAMENTO_ONLINE_CONFIRMADO", "COBRANCA",
                                cobrancaId, RESUMO_CONFIRMADO);
                    }
                    return res.mudou();
                }));
                if (baixouAgora && ctx.split().valorAbatidoCentavos() > 0) {
                    abatimentoCentral.registrarAbatimento(consultoriaId, criada.paymentId(), cobrancaId,
                            ctx.split().valorAbatidoCentavos(), Instant.now());
                }
                return new CartaoAlunoResponse(cobrancaId, criada.paymentId(), "PAGA", pagoEm);
            }
        }
        return new CartaoAlunoResponse(cobrancaId, criada.paymentId(), "EM_PROCESSAMENTO", null);
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
                                    String apiKey, String customerIdExistente, String nomePagador,
                                    String cpfPagadorDigitos, String emailPagador, long valorCentavos,
                                    LocalDate vencimento, String descricao, ResultadoSplit split) {
        @Override
        public String toString() {
            return "[PROTEGIDO]";
        }
    }

    private ContextoCheckout preparar(UUID consultoriaId, UUID alunoId, UUID cobrancaId, String cpfInformado,
                                      Integer parcelas) {
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
            if (parcelas != null && (parcelas < 1 || parcelas > subconta.getMaxParcelas())) {
                throw new ValidacaoException("Número de parcelas fora do permitido.", "PARCELAS_INVALIDAS",
                        List.of(new ApiError.FieldError("parcelas",
                                "Escolha entre 1 e " + subconta.getMaxParcelas() + " parcelas.")));
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
                    customerIdExistente, nomePagador, cpfDigitos, emailPagador, c.getValorCentavos(),
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
