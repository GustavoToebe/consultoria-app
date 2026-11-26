package br.com.treinos.api.pagamentos;

import br.com.plataforma.comum.web.ApiError;
import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.pagamentos.OvertrainingPayDtos.CobrancaTesteResposta;
import br.com.treinos.api.pagamentos.OvertrainingPayDtos.Etapas;
import br.com.treinos.api.pagamentos.OvertrainingPayDtos.OvertrainingPayResposta;
import br.com.treinos.api.pagamentos.OvertrainingPayDtos.SalvarOvertrainingPayRequest;
import br.com.treinos.api.pagamentos.provedor.AsaasCliente;
import br.com.treinos.api.pagamentos.provedor.ProvedorAsaas;
import br.com.treinos.api.tenant.TenantContext;
import br.com.treinos.api.web.Fuso;
import br.com.treinos.api.web.NaoEncontradoException;
import br.com.treinos.api.web.ValidacaoException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

/**
 * Onboarding, homologação e gestão da subconta Asaas (Overtraining Pay).
 * <p>
 * Todas as chamadas HTTP ao {@link AsaasCliente} rodam <b>fora de transação</b>; o banco é acessado apenas em transações
 * curtas via {@link TransactionTemplate}. Segredos (API Key, token do webhook e CPF/CNPJ) são cifrados com
 * {@link CifraDePagamento} usando {@code consultoriaId} no AAD e nunca aparecem em logs, respostas ou auditoria.
 */
@Service
public class OvertrainingPayService {

    public static final long VALOR_COBRANCA_TESTE_CENTAVOS = 500L;
    static final Duration VALIDADE_TOKEN_ANTERIOR = Duration.ofHours(24);
    private static final String CAMINHO_WEBHOOK = "/publico/pagamentos/asaas/";

    private final SubcontaAsaasRepository subcontas;
    private final FormasDeRecebimentoRepository formas;
    private final CobrancaAlunoRepository cobrancas;
    private final CifraDePagamento cifra;
    private final AsaasCliente asaasCliente;
    private final AsaasProperties asaasProperties;
    private final InfinitePayProperties infinitePayProperties;
    private final Auditoria auditoria;
    private final TransactionTemplate escrita;
    private final TransactionTemplate leitura;
    private final SecureRandom aleatorio = new SecureRandom();

    public OvertrainingPayService(SubcontaAsaasRepository subcontas, FormasDeRecebimentoRepository formas,
                                  CobrancaAlunoRepository cobrancas, CifraDePagamento cifra,
                                  AsaasCliente asaasCliente, AsaasProperties asaasProperties,
                                  InfinitePayProperties infinitePayProperties, Auditoria auditoria,
                                  PlatformTransactionManager transacoes) {
        this.subcontas = subcontas;
        this.formas = formas;
        this.cobrancas = cobrancas;
        this.cifra = cifra;
        this.asaasCliente = asaasCliente;
        this.asaasProperties = asaasProperties;
        this.infinitePayProperties = infinitePayProperties;
        this.auditoria = auditoria;
        this.escrita = new TransactionTemplate(transacoes);
        this.leitura = new TransactionTemplate(transacoes);
        this.leitura.setReadOnly(true);
    }

    public OvertrainingPayResposta obter() {
        return leitura.execute(status -> montarResposta(subcontas.daConsultoria()));
    }

    /**
     * Cria a subconta no Asaas na primeira vez (e configura o webhook) ou atualiza dados e preferências de uma subconta
     * existente. Todas as chamadas HTTP ao Asaas acontecem fora de transação.
     */
    public OvertrainingPayResposta salvar(SalvarOvertrainingPayRequest r) {
        UUID consultoriaId = consultoriaAtual();
        Optional<SubcontaAsaas> snapshot = leitura.execute(st -> subcontas.daConsultoria());
        boolean criando = snapshot.isEmpty();
        if (criando ? r.versao() != null : r.versao() == null || !r.versao().equals(snapshot.get().getVersao())) {
            throw conflito();
        }
        DadosValidados dados = validar(r, criando);

        if (criando) {
            return criarSubconta(consultoriaId, dados);
        }
        return atualizarSubconta(consultoriaId, snapshot.get(), dados, Boolean.TRUE.equals(r.rotacionarWebhook()));
    }

    /** Consulta status/documentos no Asaas fora de transação e avança KYC quando aprovado. */
    public OvertrainingPayResposta sincronizarStatus() {
        UUID consultoriaId = consultoriaAtual();
        SubcontaSnapshot snap = leitura.execute(st -> {
            SubcontaAsaas s = subcontas.daConsultoria()
                    .orElseThrow(() -> new NaoEncontradoException("Overtraining Pay não configurado."));
            return new SubcontaSnapshot(s.getId(), s.getApiKeyCifrada(), s.getDocumentoCifrado(),
                    s.getWalletId(), s.getNomeTitular(), s.getEmailFinanceiro(), s.getSituacao());
        });
        String apiKey = cifra.decifrar(consultoriaId, snap.apiKeyCifrada());
        AsaasCliente.StatusContaAsaas statusAsaas = asaasCliente.consultarStatusConta(apiKey);

        return escrita.execute(st -> {
            SubcontaAsaas s = subcontas.daConsultoria()
                    .orElseThrow(() -> new NaoEncontradoException("Overtraining Pay não configurado."));
            Instant agora = Instant.now();
            if (s.getSituacao() != SubcontaAsaas.Situacao.ATIVA) {
                if (statusAsaas.aprovada()) {
                    s.atualizarStatusKyc(SubcontaAsaas.Situacao.PRONTA_PARA_TESTE, null, agora);
                } else if (statusAsaas.rejeitada()) {
                    s.atualizarStatusKyc(SubcontaAsaas.Situacao.REJEITADA, statusAsaas.onboardingUrl(), agora);
                } else {
                    s.atualizarStatusKyc(SubcontaAsaas.Situacao.DOCUMENTOS_PENDENTES, statusAsaas.onboardingUrl(), agora);
                }
                subcontas.saveAndFlush(s);
            }
            return montarResposta(Optional.of(s));
        });
    }

    /** Gera cobrança Pix real de R$ 5,00 (500 centavos) na subconta para homologação. */
    public CobrancaTesteResposta gerarCobrancaTeste() {
        UUID consultoriaId = consultoriaAtual();
        SubcontaSnapshot snap = leitura.execute(st -> {
            SubcontaAsaas s = subcontas.daConsultoria()
                    .orElseThrow(() -> new NaoEncontradoException("Overtraining Pay não configurado."));
            if (s.getSituacao() != SubcontaAsaas.Situacao.PRONTA_PARA_TESTE
                    && s.getSituacao() != SubcontaAsaas.Situacao.ATIVA) {
                throw new ConflictException("A subconta ainda não está pronta para a cobrança de teste.",
                        "SUBCONTA_NAO_PRONTA_PARA_TESTE");
            }
            return new SubcontaSnapshot(s.getId(), s.getApiKeyCifrada(), s.getDocumentoCifrado(),
                    s.getWalletId(), s.getNomeTitular(), s.getEmailFinanceiro(), s.getSituacao());
        });

        String apiKey = cifra.decifrar(consultoriaId, snap.apiKeyCifrada());
        String documento = cifra.decifrar(consultoriaId, snap.documentoCifrado());
        String customerId = asaasCliente.criarCliente(apiKey, snap.nomeTitular(), documento,
                snap.emailFinanceiro(), snap.id());
        String referencia = "TESTE:" + snap.id();
        AsaasCliente.CobrancaPixCriada criada = asaasCliente.criarCobrancaPix(apiKey, new AsaasCliente.PedidoPixAsaas(
                customerId, VALOR_COBRANCA_TESTE_CENTAVOS, LocalDate.now(Fuso.BRASILIA),
                "Homologação Overtraining Pay", referencia, snap.walletId(), List.of()));

        return escrita.execute(st -> {
            SubcontaAsaas s = subcontas.daConsultoria()
                    .orElseThrow(() -> new NaoEncontradoException("Overtraining Pay não configurado."));
            Instant agora = Instant.now();
            s.registrarCobrancaTeste(criada.paymentId(), criada.qrCodeBase64(), criada.pixCopiaECola(),
                    criada.expiraEm(), agora);
            subcontas.saveAndFlush(s);
            auditoria.registrarEvento("OVERTRAINING_PAY_TESTE_GERADO", "OVERTRAINING_PAY", s.getId(),
                    "Gerou cobrança de teste do Overtraining Pay.");
            return new CobrancaTesteResposta(s.getCobrancaTesteId(), s.getCobrancaTesteSituacao().name(),
                    VALOR_COBRANCA_TESTE_CENTAVOS, s.getCobrancaTesteQrBase64(), s.getCobrancaTesteCopiaCola(),
                    s.getCobrancaTesteExpiraEm());
        });
    }

    /** Consulta situação da cobrança de teste; se ainda CRIADA, pergunta ao Asaas fora de transação e homologa se paga. */
    public CobrancaTesteResposta consultarCobrancaTeste(String cobrancaTesteId) {
        UUID consultoriaId = consultoriaAtual();
        TesteSnapshot snap = leitura.execute(st -> {
            SubcontaAsaas s = subcontas.daConsultoria()
                    .orElseThrow(() -> new NaoEncontradoException("Cobrança de teste não encontrada."));
            if (s.getCobrancaTesteId() == null || !s.getCobrancaTesteId().equals(cobrancaTesteId)) {
                throw new NaoEncontradoException("Cobrança de teste não encontrada.");
            }
            return new TesteSnapshot(s.getApiKeyCifrada(), s.getCobrancaTesteSituacao(),
                    new CobrancaTesteResposta(s.getCobrancaTesteId(), s.getCobrancaTesteSituacao().name(),
                            VALOR_COBRANCA_TESTE_CENTAVOS, s.getCobrancaTesteQrBase64(),
                            s.getCobrancaTesteCopiaCola(), s.getCobrancaTesteExpiraEm()));
        });

        if (snap.situacao() == SubcontaAsaas.SituacaoCobrancaTeste.CRIADA && snap.apiKeyCifrada() != null) {
            String apiKey = cifra.decifrar(consultoriaId, snap.apiKeyCifrada());
            AsaasCliente.CobrancaConsultadaAsaas consultada = asaasCliente.consultarCobranca(apiKey, cobrancaTesteId);
            if (estaPagaNoAsaas(consultada.status())) {
                confirmarCobrancaTesteSeAplicavel(consultoriaId, cobrancaTesteId);
                return leitura.execute(st -> subcontas.daConsultoria()
                        .map(OvertrainingPayService::cobrancaTesteDe)
                        .orElseThrow(() -> new NaoEncontradoException("Cobrança de teste não encontrada.")));
            }
        }
        return snap.resposta();
    }

    /**
     * Chamado também pelo conciliador de avisos: quando a cobrança de teste da subconta é liquidada, promove a subconta
     * para {@code ATIVA} ({@code homologada_em = now()}) e registra auditoria {@code OVERTRAINING_PAY_HOMOLOGADO}.
     */
    public boolean confirmarCobrancaTesteSeAplicavel(UUID consultoriaId, String paymentId) {
        if (consultoriaId == null || paymentId == null || paymentId.isBlank()) {
            return false;
        }
        return TenantContext.executarComo(consultoriaId, () -> Boolean.TRUE.equals(escrita.execute(st -> {
            Optional<SubcontaAsaas> opt = subcontas.daConsultoria();
            if (opt.isEmpty()) {
                return false;
            }
            SubcontaAsaas s = opt.get();
            if (!paymentId.equals(s.getCobrancaTesteId())) {
                return false;
            }
            if (s.homologar(Instant.now())) {
                subcontas.saveAndFlush(s);
                auditoria.registrarEvento("OVERTRAINING_PAY_HOMOLOGADO", "OVERTRAINING_PAY", s.getId(),
                        "Homologou o Overtraining Pay.");
            }
            return true;
        })));
    }

    /** Desliga {@code overtraining_pay} nas formas de recebimento, remove as chaves cifradas locais e audita. */
    public void remover(Long versao) {
        escrita.executeWithoutResult(st -> subcontas.daConsultoria().ifPresent(s -> {
            if (versao != null && !versao.equals(s.getVersao())) {
                throw conflito();
            }
            formas.daConsultoria().ifPresent(f -> {
                if (f.desligarOvertrainingPay(Instant.now())) {
                    formas.saveAndFlush(f);
                }
            });
            UUID id = s.getId();
            subcontas.delete(s);
            subcontas.flush();
            cobrancas.esquecerCobrancaAsaasDasAbertas(CobrancaAluno.Situacao.ABERTA);
            auditoria.registrarEvento("OVERTRAINING_PAY_REMOVIDO", "OVERTRAINING_PAY", id,
                    "Removeu a configuração do Overtraining Pay.");
        }));
    }

    // ---- helpers privados ----

    private OvertrainingPayResposta criarSubconta(UUID consultoriaId, DadosValidados d) {
        String tokenCaminho = novoToken();
        String tokenWebhook = novoToken();
        String urlWebhook = asaasProperties.urlPublicaEfetiva(infinitePayProperties) + CAMINHO_WEBHOOK + tokenCaminho;

        AsaasCliente.SubcontaCriada criada = asaasCliente.criarSubconta(new AsaasCliente.DadosCriacaoSubconta(
                d.nomeTitular(), d.emailFinanceiro(), d.documentoLimpo(), d.telefoneLimpo(),
                d.rendaMensalCentavos(), d.cep(), d.endereco(), d.numeroEndereco(), d.bairro(),
                d.tipoEmpresa(), d.dataNascimento()));
        asaasCliente.configurarWebhook(criada.apiKey(), urlWebhook, tokenWebhook);
        AsaasCliente.StatusContaAsaas statusInicial = asaasCliente.consultarStatusConta(criada.apiKey());

        SubcontaAsaas.Situacao situacaoInicial = statusInicial.aprovada()
                ? SubcontaAsaas.Situacao.PRONTA_PARA_TESTE
                : statusInicial.rejeitada() ? SubcontaAsaas.Situacao.REJEITADA
                : SubcontaAsaas.Situacao.DOCUMENTOS_PENDENTES;

        return escrita.execute(st -> {
            Instant agora = Instant.now();
            SubcontaAsaas entidade = new SubcontaAsaas(
                    criada.contaId(), criada.walletId(),
                    cifra.cifrar(consultoriaId, criada.apiKey()),
                    tokenCaminho,
                    cifra.cifrar(consultoriaId, tokenWebhook),
                    d.tipoPessoa(),
                    cifra.cifrar(consultoriaId, d.documentoLimpo()),
                    mascararDocumento(d.tipoPessoa(), d.documentoLimpo()),
                    d.nomeTitular(), d.emailFinanceiro(),
                    mascararTelefone(d.telefoneLimpo()),
                    d.cep(), d.enderecoResumo(), d.rendaMensalCentavos(),
                    d.bancoCodigo(), d.bancoNome(),
                    mascararAgencia(d.agencia()), mascararConta(d.conta()),
                    d.tipoConta(), d.repasseAutomatico(), d.maxParcelas(), d.jurosParcelamento(),
                    situacaoInicial, statusInicial.onboardingUrl(), agora);
            SubcontaAsaas gravada;
            try {
                gravada = subcontas.saveAndFlush(entidade);
            } catch (DataIntegrityViolationException e) {
                throw conflito();
            }
            auditoria.registrarEvento("OVERTRAINING_PAY_CONFIGURADO", "OVERTRAINING_PAY", gravada.getId(),
                    "Configurou o Overtraining Pay.");
            return montarResposta(Optional.of(gravada));
        });
    }

    private OvertrainingPayResposta atualizarSubconta(UUID consultoriaId, SubcontaAsaas snapshot, DadosValidados d,
                                                      boolean rotacionarWebhook) {
        String novoTokenWebhook = null;
        if (rotacionarWebhook && snapshot.getApiKeyCifrada() != null) {
            novoTokenWebhook = novoToken();
            String urlWebhook = asaasProperties.urlPublicaEfetiva(infinitePayProperties)
                    + CAMINHO_WEBHOOK + snapshot.getTokenCaminho();
            String apiKey = cifra.decifrar(consultoriaId, snapshot.getApiKeyCifrada());
            asaasCliente.configurarWebhook(apiKey, urlWebhook, novoTokenWebhook);
        }
        String tokenParaSalvar = novoTokenWebhook;

        return escrita.execute(st -> {
            SubcontaAsaas s = subcontas.daConsultoria().orElseThrow(OvertrainingPayService::conflito);
            if (!snapshot.getVersao().equals(s.getVersao())) {
                throw conflito();
            }
            Instant agora = Instant.now();
            String docCifrado = d.documentoLimpo() != null ? cifra.cifrar(consultoriaId, d.documentoLimpo()) : null;
            String docMascarado = d.documentoLimpo() != null ? mascararDocumento(d.tipoPessoa(), d.documentoLimpo()) : null;
            s.atualizarDados(d.tipoPessoa(), docCifrado, docMascarado, d.nomeTitular(), d.emailFinanceiro(),
                    d.telefoneLimpo() != null ? mascararTelefone(d.telefoneLimpo()) : null,
                    d.cep(), d.enderecoResumo(), d.rendaMensalCentavos(),
                    d.bancoCodigo(), d.bancoNome(),
                    d.agencia() != null ? mascararAgencia(d.agencia()) : null,
                    d.conta() != null ? mascararConta(d.conta()) : null,
                    d.tipoConta(), d.repasseAutomatico(), d.maxParcelas(), d.jurosParcelamento(), agora);
            if (tokenParaSalvar != null) {
                s.rotacionarWebhook(cifra.cifrar(consultoriaId, tokenParaSalvar),
                        agora.plus(VALIDADE_TOKEN_ANTERIOR), agora);
            }
            SubcontaAsaas gravada = subcontas.saveAndFlush(s);
            auditoria.registrarEvento("OVERTRAINING_PAY_CONFIGURADO", "OVERTRAINING_PAY", gravada.getId(),
                    "Configurou o Overtraining Pay.");
            return montarResposta(Optional.of(gravada));
        });
    }

    private OvertrainingPayResposta montarResposta(Optional<SubcontaAsaas> opt) {
        if (opt.isEmpty()) {
            return new OvertrainingPayResposta(
                    SubcontaAsaas.Situacao.NAO_CONFIGURADA.name(),
                    new Etapas(false, false, false, false),
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, true, 12,
                    JurosDoParcelamento.ALUNO.name(), null, 0L, null, null, null);
        }
        SubcontaAsaas s = opt.get();
        boolean docsAprovados = s.getSituacao() == SubcontaAsaas.Situacao.PRONTA_PARA_TESTE
                || s.getSituacao() == SubcontaAsaas.Situacao.ATIVA;
        boolean homologada = s.getSituacao() == SubcontaAsaas.Situacao.ATIVA;
        long liquidadas = cobrancas.countByProvedorAndSituacao(ProvedorAsaas.CODIGO, CobrancaAluno.Situacao.PAGA);
        return new OvertrainingPayResposta(
                s.getSituacao().name(),
                new Etapas(true, docsAprovados, homologada, homologada),
                s.getTipoPessoa().name(), s.getDocumentoMascarado(), s.getNomeTitular(), s.getEmailFinanceiro(),
                s.getTelefoneMascarado(), s.getCep(), s.getEnderecoResumo(), s.getRendaMensalCentavos(),
                s.getBancoCodigo(), s.getBancoNome(), s.getAgenciaMascarada(), s.getContaMascarada(),
                s.getTipoConta().name(), s.isRepasseAutomatico(), s.getMaxParcelas(),
                s.getJurosParcelamento().name(), s.getOnboardingUrl(), liquidadas, s.getHomologadaEm(),
                cobrancaTesteDe(s), s.getVersao());
    }

    private static CobrancaTesteResposta cobrancaTesteDe(SubcontaAsaas s) {
        if (s.getCobrancaTesteId() == null || s.getCobrancaTesteSituacao() == null) {
            return null;
        }
        return new CobrancaTesteResposta(s.getCobrancaTesteId(), s.getCobrancaTesteSituacao().name(),
                VALOR_COBRANCA_TESTE_CENTAVOS, s.getCobrancaTesteQrBase64(), s.getCobrancaTesteCopiaCola(),
                s.getCobrancaTesteExpiraEm());
    }

    private static boolean estaPagaNoAsaas(String status) {
        if (status == null) {
            return false;
        }
        String s = status.toUpperCase(Locale.ROOT);
        return "RECEIVED".equals(s) || "CONFIRMED".equals(s) || "RECEIVED_IN_CASH".equals(s);
    }

    // ---- validação e mascaramento ----

    private record DadosValidados(SubcontaAsaas.TipoPessoa tipoPessoa, String documentoLimpo, String nomeTitular,
                                  String emailFinanceiro, String telefoneLimpo, String cep, String endereco,
                                  String numeroEndereco, String bairro, String enderecoResumo,
                                  Long rendaMensalCentavos, String tipoEmpresa, LocalDate dataNascimento,
                                  String bancoCodigo, String bancoNome, String agencia, String conta,
                                  SubcontaAsaas.TipoConta tipoConta, boolean repasseAutomatico,
                                  int maxParcelas, JurosDoParcelamento jurosParcelamento) {
    }

    private record SubcontaSnapshot(UUID id, String apiKeyCifrada, String documentoCifrado, String walletId,
                                    String nomeTitular, String emailFinanceiro, SubcontaAsaas.Situacao situacao) {
    }

    private record TesteSnapshot(String apiKeyCifrada, SubcontaAsaas.SituacaoCobrancaTeste situacao,
                                 CobrancaTesteResposta resposta) {
    }

    private static DadosValidados validar(SalvarOvertrainingPayRequest r, boolean criando) {
        List<ApiError.FieldError> erros = new ArrayList<>();
        SubcontaAsaas.TipoPessoa tipoPessoa = parseEnum(SubcontaAsaas.TipoPessoa.class, r.tipoPessoa());
        if (tipoPessoa == null) {
            erros.add(new ApiError.FieldError("tipoPessoa", "Escolha PF ou PJ."));
        }
        String docLimpo = null;
        if (r.documento() == null || r.documento().isBlank()) {
            if (criando) {
                erros.add(new ApiError.FieldError("documento", "Informe o CPF ou CNPJ."));
            }
        } else {
            String digitos = apenasDigitos(r.documento());
            if (tipoPessoa == SubcontaAsaas.TipoPessoa.PF && digitos.length() != 11) {
                erros.add(new ApiError.FieldError("documento", "Informe um CPF com 11 dígitos."));
            } else if (tipoPessoa == SubcontaAsaas.TipoPessoa.PJ && digitos.length() != 14) {
                erros.add(new ApiError.FieldError("documento", "Informe um CNPJ com 14 dígitos."));
            } else if (tipoPessoa != null) {
                docLimpo = digitos;
            }
        }

        String nome = textoLimpo(r.nomeTitular());
        if (nome == null || nome.length() > 120) {
            erros.add(new ApiError.FieldError("nomeTitular", "Informe o nome do titular (até 120 caracteres)."));
        }
        String email = textoLimpo(r.emailFinanceiro());
        if (email == null || email.length() > 160 || !email.contains("@")) {
            erros.add(new ApiError.FieldError("emailFinanceiro", "Informe um e-mail financeiro válido."));
        }
        String bancoCodigo = textoLimpo(r.bancoCodigo());
        if (bancoCodigo == null || bancoCodigo.length() > 10) {
            erros.add(new ApiError.FieldError("bancoCodigo", "Informe o código do banco."));
        }
        String bancoNome = textoLimpo(r.bancoNome());
        if (bancoNome == null || bancoNome.length() > 80) {
            erros.add(new ApiError.FieldError("bancoNome", "Informe o nome do banco."));
        }
        String agencia = textoLimpo(r.agencia());
        if (agencia == null && criando) {
            erros.add(new ApiError.FieldError("agencia", "Informe a agência."));
        }
        String conta = textoLimpo(r.conta());
        if (conta == null && criando) {
            erros.add(new ApiError.FieldError("conta", "Informe o número da conta."));
        }
        SubcontaAsaas.TipoConta tipoConta = parseEnum(SubcontaAsaas.TipoConta.class, r.tipoConta());
        if (tipoConta == null) {
            erros.add(new ApiError.FieldError("tipoConta", "Escolha CORRENTE, POUPANCA ou PAGAMENTO."));
        }
        int maxParcelas = r.maxParcelas() == null ? 12 : r.maxParcelas();
        if (maxParcelas < 1 || maxParcelas > 12) {
            erros.add(new ApiError.FieldError("maxParcelas", "Escolha entre 1 e 12 parcelas."));
        }
        JurosDoParcelamento juros = r.jurosParcelamento() == null
                ? JurosDoParcelamento.ALUNO
                : parseEnum(JurosDoParcelamento.class, r.jurosParcelamento());
        if (juros == null) {
            erros.add(new ApiError.FieldError("jurosParcelamento", "Escolha ALUNO ou TREINADOR."));
        }
        if (r.rendaMensalCentavos() != null && r.rendaMensalCentavos() < 0) {
            erros.add(new ApiError.FieldError("rendaMensalCentavos", "Informe um valor válido."));
        }
        if (!erros.isEmpty()) {
            throw new ValidacaoException("Confira os dados do Overtraining Pay.", "OVERTRAINING_PAY_INVALIDO", erros);
        }
        String telefoneLimpo = r.telefone() == null || r.telefone().isBlank() ? null : apenasDigitos(r.telefone());
        String cepLimpo = r.cep() == null || r.cep().isBlank() ? null : apenasDigitos(r.cep());
        if (cepLimpo != null && cepLimpo.length() > 10) {
            cepLimpo = cepLimpo.substring(0, 10);
        }
        String endereco = textoLimpo(r.endereco());
        String numero = textoLimpo(r.numeroEndereco());
        String bairro = textoLimpo(r.bairro());
        String enderecoResumoReq = textoLimpo(r.enderecoResumo());
        String resumo;
        if (endereco == null && enderecoResumoReq != null) {
            endereco = enderecoResumoReq;
            if (numero == null) {
                numero = "S/N";
            }
            if (bairro == null) {
                bairro = "Centro";
            }
            resumo = enderecoResumoReq.length() > 200 ? enderecoResumoReq.substring(0, 200) : enderecoResumoReq;
        } else {
            resumo = montarResumoEndereco(endereco, numero, bairro);
        }
        String tipoEmpresa = tipoPessoa == SubcontaAsaas.TipoPessoa.PJ
                ? (textoLimpo(r.tipoEmpresa()) != null ? textoLimpo(r.tipoEmpresa()) : "LIMITED")
                : null;
        LocalDate dataNascimento = r.dataNascimento();
        if (tipoPessoa == SubcontaAsaas.TipoPessoa.PF && dataNascimento == null) {
            dataNascimento = LocalDate.of(1990, 1, 1);
        }
        return new DadosValidados(tipoPessoa, docLimpo, nome, email, telefoneLimpo, cepLimpo,
                endereco, numero, bairro, resumo, r.rendaMensalCentavos(), tipoEmpresa, dataNascimento,
                bancoCodigo, bancoNome, agencia, conta, tipoConta,
                r.repasseAutomatico() == null || r.repasseAutomatico(), maxParcelas, juros);
    }

    static String mascararDocumento(SubcontaAsaas.TipoPessoa tipo, String digitos) {
        if (tipo == SubcontaAsaas.TipoPessoa.PF && digitos.length() == 11) {
            return "***." + digitos.substring(3, 6) + "." + digitos.substring(6, 9) + "-**";
        }
        if (tipo == SubcontaAsaas.TipoPessoa.PJ && digitos.length() == 14) {
            return "**.*" + digitos.substring(3, 5) + "." + digitos.substring(5, 8)
                    + "/" + digitos.substring(8, 12) + "-**";
        }
        return "****";
    }

    static String mascararAgencia(String agencia) {
        String limpa = agencia.strip();
        if (limpa.length() <= 2) {
            return "*".repeat(limpa.length());
        }
        return "*".repeat(Math.min(8, limpa.length() - 2)) + limpa.substring(limpa.length() - 2);
    }

    static String mascararConta(String conta) {
        String limpa = conta.strip();
        if (limpa.length() <= 3) {
            return "*".repeat(limpa.length());
        }
        return "*".repeat(Math.min(12, limpa.length() - 3)) + limpa.substring(limpa.length() - 3);
    }

    static String mascararTelefone(String digitos) {
        if (digitos == null || digitos.isEmpty()) {
            return null;
        }
        if (digitos.length() <= 4) {
            return "****";
        }
        return "*".repeat(Math.min(12, digitos.length() - 4)) + digitos.substring(digitos.length() - 4);
    }

    private static String montarResumoEndereco(String endereco, String numero, String bairro) {
        if (endereco == null) {
            return null;
        }
        StringBuilder sb = new StringBuilder(endereco);
        if (numero != null) {
            sb.append(", ").append(numero);
        }
        if (bairro != null) {
            sb.append(" - ").append(bairro);
        }
        String res = sb.toString();
        return res.length() > 200 ? res.substring(0, 200) : res;
    }

    private static String textoLimpo(String valor) {
        if (valor == null) {
            return null;
        }
        String limpo = valor.strip();
        return limpo.isEmpty() ? null : limpo;
    }

    private static String apenasDigitos(String valor) {
        return valor.replaceAll("\\D", "");
    }

    private static <E extends Enum<E>> E parseEnum(Class<E> tipo, String valor) {
        if (valor == null) {
            return null;
        }
        try {
            return Enum.valueOf(tipo, valor.strip().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private String novoToken() {
        byte[] bytes = new byte[32];
        aleatorio.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static UUID consultoriaAtual() {
        UUID consultoria = TenantContext.get();
        if (consultoria == null) {
            throw new IllegalStateException("Sem consultoria na requisição.");
        }
        return consultoria;
    }

    private static ConflictException conflito() {
        return new ConflictException("Outra pessoa ou aba alterou o Overtraining Pay. Recarregue para ver a versão atual.",
                "CONFLITO_EDICAO");
    }
}
