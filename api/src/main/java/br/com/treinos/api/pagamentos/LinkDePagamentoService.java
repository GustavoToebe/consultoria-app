package br.com.treinos.api.pagamentos;

import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.pagamentos.provedor.CobrancaGerada;
import br.com.treinos.api.pagamentos.provedor.CredencialDoProvedor;
import br.com.treinos.api.pagamentos.provedor.PedidoDeCobranca;
import br.com.treinos.api.pagamentos.provedor.ProvedoresDePagamento;
import br.com.treinos.api.tenant.TenantContext;
import br.com.treinos.api.web.Fuso;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/**
 * O link de pagamento de uma cobrança aberta, pedido pela equipe ou pelo próprio aluno. Três passos, e o método principal
 * NÃO é transacional: a chamada à InfinitePay fica fora de qualquer transação (não prende conexão do banco enquanto a rede
 * responde). (1) lê e confere, numa transação curta; (2) chama o provedor; (3) regrava com as travas (aluno, contratação,
 * cobrança) confirmando que nada mudou. O valor é sempre o da cobrança no servidor. O link só é reaproveitado se foi
 * gerado com o valor atual e ainda não venceu ({@code link_valido_ate} nulo = o link sem chave, que não vence). A API Key é
 * decifrada só em memória, para a chamada; nada dela (nem a Tag nem a URL do link) vai a log ou auditoria.
 */
@Service
public class LinkDePagamentoService {

    /** Dias de validade do link com chave, contados do dia em que a cobrança vence (ou de hoje, se já venceu). */
    static final int DIAS_DE_VALIDADE = 30;
    /** O provedor aceita até 1 ano; ficar 1 dia abaixo deixa folga para o relógio dele. */
    static final int TETO_DE_VALIDADE_EM_DIAS = 364;

    private static final DateTimeFormatter MES = DateTimeFormatter.ofPattern("MM/yyyy");
    private static final int MAXIMO_DO_NOME_DO_PLANO = 100;
    private static final String CAMINHO_DO_AVISO = "/publico/pagamentos/infinitepay/";

    /** O que o passo 1 leu: o link a reaproveitar ou tudo o que o passo 2 precisa, mais o estado para conferir no passo 3. */
    private record Leitura(String urlExistente, long valorCentavos, Instant linkGeradoEm, CredencialDoProvedor credencial,
                           String tokenAviso, String descricao, LocalDate vencimento, JurosDoParcelamento juros) {

        @Override
        public String toString() {
            return "Leitura[...]";
        }
    }

    private final CobrancaAlunoRepository cobrancas;
    private final ContratacaoAlunoRepository contratacoes;
    private final PlanoComercialRepository planos;
    private final CredencialPagamentoRepository credenciais;
    private final CifraDePagamento cifra;
    private final InfinitePayProperties infinitePay;
    private final ProvedoresDePagamento provedores;
    private final Travas travas;
    private final Auditoria auditoria;
    private final String appUrl;
    private final TransactionTemplate leitura;
    private final TransactionTemplate gravacao;

    public LinkDePagamentoService(CobrancaAlunoRepository cobrancas, ContratacaoAlunoRepository contratacoes,
                                  PlanoComercialRepository planos, CredencialPagamentoRepository credenciais,
                                  CifraDePagamento cifra, InfinitePayProperties infinitePay,
                                  ProvedoresDePagamento provedores, Travas travas, Auditoria auditoria,
                                  PlatformTransactionManager transacoes, @Value("${treinos.app-url}") String appUrl) {
        this.cobrancas = cobrancas;
        this.contratacoes = contratacoes;
        this.planos = planos;
        this.credenciais = credenciais;
        this.cifra = cifra;
        this.infinitePay = infinitePay;
        this.provedores = provedores;
        this.travas = travas;
        this.auditoria = auditoria;
        this.appUrl = appUrl.endsWith("/") ? appUrl.substring(0, appUrl.length() - 1) : appUrl;
        this.leitura = new TransactionTemplate(transacoes);
        this.leitura.setReadOnly(true);
        this.gravacao = new TransactionTemplate(transacoes);
    }

    /** Pela equipe: qualquer cobrança aberta da consultoria. */
    public String gerar(UUID cobrancaId) {
        return gerar(cobrancaId, null);
    }

    /** Pelo aluno: só a cobrança dele ({@code alunoId} é o da sessão); de outro aluno é 404. */
    public String gerarDoAluno(UUID cobrancaId, UUID alunoId) {
        return gerar(cobrancaId, Objects.requireNonNull(alunoId));
    }

    private String gerar(UUID cobrancaId, UUID alunoId) {
        Leitura lida = leitura.execute(status -> ler(cobrancaId, alunoId));
        if (lida.urlExistente() != null) {
            return lida.urlExistente();
        }
        boolean comChave = lida.credencial().segredo() != null;
        Instant agora = Instant.now().truncatedTo(ChronoUnit.MICROS);
        // Sem chave o link não vence e não leva opção nenhuma; a validade guardada é exatamente a que foi enviada.
        Instant validade = comChave ? validadeDoLink(lida.vencimento(), agora) : null;
        String retorno = appUrl + "/aluno/conta";
        var pedido = new PedidoDeCobranca(cobrancaId, lida.valorCentavos(), lida.vencimento(), lida.descricao(),
                Set.of(FormaDePagamento.PIX, FormaDePagamento.CARTAO), 1,
                retorno.startsWith("https://") ? retorno : null,
                infinitePay.urlPublica() + CAMINHO_DO_AVISO + lida.tokenAviso(), validade,
                comChave ? lida.juros().parcelasSemJuros() : 0);
        CobrancaGerada gerada = provedores.buscar(RecebimentoOnlineService.PROVEDOR)
                .orElseThrow(() -> new IllegalStateException("Provedor de pagamento não registrado."))
                .gerarCobranca(lida.credencial(), pedido);
        return gravacao.execute(status -> gravar(cobrancaId, lida, gerada, agora, validade));
    }

    /**
     * Até quando o link com chave vale: 30 dias contados do maior entre o vencimento da cobrança e hoje (Brasília), até o
     * fim desse dia (23:59:59 de Brasília). Sempre no futuro (a base nunca é anterior a hoje) e, por segurança, no máximo
     * {@link #TETO_DE_VALIDADE_EM_DIAS} dias adiante, já que o provedor recusa mais de 1 ano. Em segundos inteiros.
     */
    static Instant validadeDoLink(LocalDate vencimento, Instant agora) {
        LocalDate hoje = LocalDate.ofInstant(agora, Fuso.BRASILIA);
        LocalDate base = vencimento.isAfter(hoje) ? vencimento : hoje;
        Instant fimDoDia = base.plusDays(DIAS_DE_VALIDADE).atTime(23, 59, 59).atZone(Fuso.BRASILIA).toInstant();
        Instant teto = agora.plus(TETO_DE_VALIDADE_EM_DIAS, ChronoUnit.DAYS).truncatedTo(ChronoUnit.SECONDS);
        return fimDoDia.isAfter(teto) ? teto : fimDoDia;
    }

    /** Passo 1: lê e confere. Fora da consultoria, de outro aluno ou inexistente é 404; só cobrança aberta recebe link. */
    private Leitura ler(UUID cobrancaId, UUID alunoId) {
        CobrancaAluno cobranca = cobrancas.findById(cobrancaId).orElseThrow(Travas::cobrancaNaoEncontrada);
        if (alunoId != null && !alunoId.equals(cobranca.getAlunoId())) {
            throw Travas.cobrancaNaoEncontrada();
        }
        if (cobranca.getSituacao() != CobrancaAluno.Situacao.ABERTA) {
            throw naoAberta();
        }
        CredencialPagamento credencial = credenciais.findByProvedor(RecebimentoOnlineService.PROVEDOR)
                .orElseThrow(() -> new ConflictException("O treinador ainda não configurou o recebimento online.",
                        "RECEBIMENTO_ONLINE_NAO_CONFIGURADO"));
        long valor = cobranca.getValorCentavos();
        if (cobranca.getLinkUrl() != null && Objects.equals(cobranca.getLinkValorCentavos(), valor)
                && (cobranca.getLinkValidoAte() == null || cobranca.getLinkValidoAte().isAfter(Instant.now()))) {
            return new Leitura(cobranca.getLinkUrl(), valor, cobranca.getLinkGeradoEm(), null, null, null, null, null);
        }
        UUID consultoria = Objects.requireNonNull(TenantContext.get());
        String segredo = credencial.getSegredoCifrado() == null ? null
                : cifra.decifrar(consultoria, credencial.getSegredoCifrado());
        return new Leitura(null, valor, cobranca.getLinkGeradoEm(),
                new CredencialDoProvedor(consultoria, credencial.getConta(), segredo), credencial.getTokenAviso(),
                descricao(cobranca), cobranca.getVencimento(), credencial.getJurosDoParcelamento());
    }

    /** "Mensalidade: Plano (MM/aaaa)": nunca o nome do aluno. */
    private String descricao(CobrancaAluno cobranca) {
        String plano = contratacoes.findById(cobranca.getContratacaoId())
                .flatMap(c -> planos.findById(c.getPlanoComercialId())).map(PlanoComercial::getNome).orElse(null);
        String nome = plano == null ? "" : plano.strip();
        if (nome.length() > MAXIMO_DO_NOME_DO_PLANO) {
            nome = nome.substring(0, MAXIMO_DO_NOME_DO_PLANO);
        }
        String competencia = " (" + MES.format(cobranca.getCompetencia()) + ")";
        return nome.isEmpty() ? "Mensalidade" + competencia : "Mensalidade: " + nome + competencia;
    }

    /**
     * Passo 3, com as travas na ordem aluno, contratação, cobrança. A cobrança que deixou de ser aberta, ou mudou de valor
     * enquanto a InfinitePay respondia, não recebe o link (o link órfão é inofensivo: a baixa confere o valor). Se outro
     * pedido gravou um link no meio, fica o primeiro.
     */
    private String gravar(UUID cobrancaId, Leitura lida, CobrancaGerada gerada, Instant agora, Instant validade) {
        CobrancaAluno cobranca = travas.daCobranca(cobrancaId).cobranca();
        if (cobranca.getSituacao() != CobrancaAluno.Situacao.ABERTA) {
            throw naoAberta();
        }
        if (cobranca.getValorCentavos() != lida.valorCentavos()) {
            throw new ConflictException("O valor da cobrança mudou. Tente de novo.", "CONFLITO_EDICAO");
        }
        if (cobranca.getLinkUrl() != null && !Objects.equals(cobranca.getLinkGeradoEm(), lida.linkGeradoEm())
                && Objects.equals(cobranca.getLinkValorCentavos(), lida.valorCentavos())) {
            return cobranca.getLinkUrl();
        }
        cobranca.registrarLink(gerada.link(), gerada.slug(), lida.valorCentavos(), agora, validade);
        auditoria.registrarEvento("LINK_DE_PAGAMENTO_GERADO", "COBRANCA", cobrancaId,
                "Gerou o link de pagamento de uma cobrança.");
        return gerada.link();
    }

    private static ConflictException naoAberta() {
        return new ConflictException("Só uma cobrança em aberto recebe link de pagamento.", "COBRANCA_NAO_ABERTA");
    }
}
