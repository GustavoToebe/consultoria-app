package br.com.treinos.api.pagamentos;

import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.auditoria.Auditar;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.plataforma.comum.web.ApiError;
import br.com.treinos.api.pagamentos.PagamentosDtos.PlanoRequest;
import br.com.treinos.api.pagamentos.PagamentosDtos.PlanoResponse;
import br.com.treinos.api.web.Buscas;
import br.com.treinos.api.web.LinksExternos;
import br.com.treinos.api.web.NaoEncontradoException;
import br.com.treinos.api.web.ValidacaoException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Os planos comerciais da consultoria (o que o treinador vende). Editar um plano não muda quem já contratou: a contratação
 * guarda o próprio valor e a própria periodicidade. Plano não se exclui, arquiva-se (some da lista de escolha, e o nome
 * volta a poder ser usado).
 */
@Service
public class PlanoComercialService {

    private static final int REGRA_MAXIMA = 500;
    private static final Pattern PRODUTO_DA_KIWIFY = Pattern.compile("^[A-Za-z0-9_-]{1,100}$");

    /** O que fica gravado de Kiwify no plano depois das regras (D17). */
    private record DaKiwify(boolean assinatura, String produtoId) {
    }

    private final PlanoComercialRepository planos;
    private final Auditoria auditoria;
    private final KiwifyProperties kiwify;

    public PlanoComercialService(PlanoComercialRepository planos, Auditoria auditoria, KiwifyProperties kiwify) {
        this.planos = planos;
        this.auditoria = auditoria;
        this.kiwify = kiwify;
    }

    @Transactional(readOnly = true)
    public List<PlanoResponse> listar(boolean incluirArquivados) {
        return planos.listar(incluirArquivados).stream().map(Respostas::plano).toList();
    }

    @Transactional
    @Auditar(acao = "PLANO_COMERCIAL_CRIADO", entidade = "PLANO_COMERCIAL", resumo = "Criou um plano comercial.")
    public PlanoResponse criar(PlanoRequest r) {
        String nome = r.nome().trim();
        exigirIncluiAlgo(r);
        exigirNomeLivre(nome, null);
        PlanoComercial plano = new PlanoComercial(nome, r.valorCentavos(), r.periodicidade(), minimo(r),
                Buscas.opcional(r.regraDeSaida()), link(r), r.incluiTreinoOuPadrao(), r.incluiDietaOuPadrao());
        DaKiwify daKiwify = daKiwify(r, null, null);
        plano.definirKiwify(daKiwify.assinatura(), daKiwify.produtoId());
        return Respostas.plano(gravar(plano));
    }

    @Transactional
    @Auditar(acao = "PLANO_COMERCIAL_ALTERADO", entidade = "PLANO_COMERCIAL", resumo = "Editou um plano comercial.")
    public PlanoResponse alterar(UUID id, PlanoRequest r) {
        PlanoComercial plano = buscar(id);
        if (plano.isArquivado()) {
            throw new ConflictException("Plano arquivado não é editado.", "PLANO_COMERCIAL_ARQUIVADO");
        }
        conferirVersao(plano, r.versao());
        String nome = r.nome().trim();
        exigirIncluiAlgo(r);
        exigirNomeLivre(nome, id);
        plano.alterar(nome, r.valorCentavos(), r.periodicidade(), minimo(r), Buscas.opcional(r.regraDeSaida()),
                link(r), r.incluiTreinoOuPadrao(), r.incluiDietaOuPadrao());
        DaKiwify daKiwify = daKiwify(r, id, plano);
        plano.definirKiwify(daKiwify.assinatura(), daKiwify.produtoId());
        return Respostas.plano(gravar(plano));
    }

    /** Arquivar plano já arquivado devolve o plano como está (sem nova auditoria). */
    @Transactional
    public PlanoResponse arquivar(UUID id, Long versao) {
        PlanoComercial plano = buscar(id);
        if (plano.isArquivado()) {
            return Respostas.plano(plano);
        }
        conferirVersao(plano, versao);
        plano.arquivar(Instant.now());
        PlanoComercial gravado = gravar(plano);
        auditoria.registrarEvento("PLANO_COMERCIAL_ARQUIVADO", "PLANO_COMERCIAL", id, "Arquivou um plano comercial.");
        return Respostas.plano(gravado);
    }

    /**
     * O tempo mínimo só existe em plano mensal (1 a 60 meses) e a regra de saída cabe em 500 caracteres: 422 no campo, sem
     * repetir o valor. Vale ao criar e ao alterar, inclusive ao trocar a periodicidade de um plano que já tinha mínimo.
     */
    private static Short minimo(PlanoRequest r) {
        if (r.regraDeSaida() != null && r.regraDeSaida().trim().length() > REGRA_MAXIMA) {
            throw invalido("regraDeSaida", "A regra de saída pode ter até " + REGRA_MAXIMA + " caracteres.");
        }
        Integer meses = r.tempoMinimoMeses();
        if (meses == null) {
            return null;
        }
        if (r.periodicidade() != PeriodoDoPlano.MENSAL) {
            throw invalido("tempoMinimoMeses", "O tempo mínimo só vale em plano mensal.");
        }
        if (meses < 1 || meses > 60) {
            throw invalido("tempoMinimoMeses", "O tempo mínimo vai de 1 a 60 meses.");
        }
        return meses.shortValue();
    }

    /** O plano vende treino, dieta ou os dois (D1 de planos-ativos-do-aluno): nenhum dos dois é 422 no campo {@code incluiTreino}. */
    private static void exigirIncluiAlgo(PlanoRequest r) {
        if (!r.incluiTreinoOuPadrao() && !r.incluiDietaOuPadrao()) {
            throw invalido("incluiTreino", "Marque pelo menos um: treino ou dieta.");
        }
    }

    /**
     * "Assinatura cobrada pela Kiwify" e o produto dela (D17). Com a chave desligada a API ignora os dois campos do corpo e
     * mantém o gravado (a tela reenvia o que leu, porque o PUT substitui inteiro); só um plano que deixa de ser mensal os perde,
     * porque o banco só aceita assinatura em plano mensal. Com a chave ligada: só plano MENSAL (422 em
     * {@code kiwifyAssinatura}); ligada, o produto é obrigatório (1 a 100 caracteres: letras, números, hífen e sublinhado) e não
     * pode estar em outro plano NÃO arquivado (422 em {@code kiwifyProdutoId}); desligada, o produto é apagado. Nenhuma
     * mensagem repete o valor.
     */
    private DaKiwify daKiwify(PlanoRequest r, UUID id, PlanoComercial atual) {
        boolean mensal = r.periodicidade() == PeriodoDoPlano.MENSAL;
        if (!kiwify.habilitado()) {
            return atual != null && atual.isKiwifyAssinatura() && mensal
                    ? new DaKiwify(true, atual.getKiwifyProdutoId()) : new DaKiwify(false, null);
        }
        if (!Boolean.TRUE.equals(r.kiwifyAssinatura())) {
            return new DaKiwify(false, null);
        }
        if (!mensal) {
            throw invalido("kiwifyAssinatura", "A assinatura pela Kiwify só vale em plano mensal.");
        }
        String produto = Buscas.opcional(r.kiwifyProdutoId());
        if (produto == null) {
            throw invalido("kiwifyProdutoId", "Informe o ID do produto na Kiwify.");
        }
        if (!PRODUTO_DA_KIWIFY.matcher(produto).matches()) {
            throw invalido("kiwifyProdutoId", "Use de 1 a 100 caracteres: letras, números, hífen e sublinhado.");
        }
        if (planos.produtoDaKiwifyEmUso(produto, id)) {
            throw produtoEmUso();
        }
        return new DaKiwify(true, produto);
    }

    private static ValidacaoException produtoEmUso() {
        return invalido("kiwifyProdutoId", "Este produto da Kiwify já está em outro plano.");
    }

    /** Link próprio de pagamento: opcional, https pelo {@link LinksExternos}; vazio apaga; inválido é 422 no campo, sem repetir o valor. */
    private static String link(PlanoRequest r) {
        String link = Buscas.opcional(r.linkDePagamento());
        if (link != null && !LinksExternos.valido(link)) {
            throw invalido("linkDePagamento", LinksExternos.MENSAGEM);
        }
        return link;
    }

    private static ValidacaoException invalido(String campo, String mensagem) {
        return new ValidacaoException("Confira os dados do plano.", "PLANO_INVALIDO",
                List.of(new ApiError.FieldError(campo, mensagem)));
    }

    private PlanoComercial buscar(UUID id) {
        return planos.findById(id).orElseThrow(() -> new NaoEncontradoException("Plano comercial não encontrado."));
    }

    private void exigirNomeLivre(String nome, UUID ignorar) {
        if (planos.nomeEmUso(nome, ignorar)) {
            throw nomeEmUso();
        }
    }

    private static ConflictException nomeEmUso() {
        return new ConflictException("Já existe um plano comercial com este nome.", "PLANO_COMERCIAL_NOME_EM_USO");
    }

    /** A checagem prévia não pega duas gravações ao mesmo tempo: o índice parcial pega, e vira o mesmo 409. */
    private PlanoComercial gravar(PlanoComercial plano) {
        try {
            return planos.saveAndFlush(plano);
        } catch (DataIntegrityViolationException e) {
            for (Throwable t = e; t != null; t = t.getCause()) {
                if (t instanceof org.hibernate.exception.ConstraintViolationException c
                        && "ux_plano_comercial_nome".equals(c.getConstraintName())) {
                    throw nomeEmUso();
                }
                if (t instanceof org.hibernate.exception.ConstraintViolationException c
                        && "ux_plano_kiwify_produto".equals(c.getConstraintName())) {
                    throw produtoEmUso();
                }
            }
            throw e;
        }
    }

    private static void conferirVersao(PlanoComercial plano, Long versao) {
        if (versao == null || !versao.equals(plano.getVersao())) {
            throw new ConflictException("Outra pessoa ou aba alterou este plano. Recarregue para ver a versão atual.",
                    "CONFLITO_EDICAO");
        }
    }
}
