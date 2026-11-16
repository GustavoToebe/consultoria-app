package br.com.treinos.api.vitrine;

import br.com.plataforma.comum.web.ApiError;
import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.consultoria.ConsultoriaRepository;
import br.com.treinos.api.inscricoes.CodigoDeInscricao;
import br.com.treinos.api.tenant.TenantContext;
import br.com.treinos.api.vitrine.VitrineDtos.NovoLinkRequest;
import br.com.treinos.api.vitrine.VitrineDtos.PaginaRequest;
import br.com.treinos.api.vitrine.VitrineDtos.PaginaResponse;
import br.com.treinos.api.web.NaoEncontradoException;
import br.com.treinos.api.web.ValidacaoException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * Página pública da loja, pela equipe (F2a). A linha nasce na primeira gravação (ligar a página ou pedir o link) com a {@code versao}
 * ausente; depois toda gravação leva a {@code versao} que a tela leu (409 {@code CONFLITO_EDICAO}). Gravar trava a consultoria
 * (duas primeiras gravações não perdem a corrida). O código é gerado aqui, nunca vem do cliente; trocar o link invalida o antigo. A
 * auditoria leva um resumo fixo: nunca o código. Ligar ao mesmo valor não grava nem audita; entrar ou sair do
 * marketplace (opt-in da consultoria, F3) grava (a versão sobe, como em qualquer gravação) e audita {@code VITRINE_MARKETPLACE_ALTERADO}, também com resumo fixo.
 */
@Service
public class VitrinePaginaService {

    private final VitrinePaginaRepository paginas;
    private final ConsultoriaRepository consultorias;
    private final Auditoria auditoria;

    public VitrinePaginaService(VitrinePaginaRepository paginas, ConsultoriaRepository consultorias, Auditoria auditoria) {
        this.paginas = paginas;
        this.consultorias = consultorias;
        this.auditoria = auditoria;
    }

    @Transactional(readOnly = true)
    public PaginaResponse ler() {
        return resposta(paginas.daConsultoria());
    }

    @Transactional
    public PaginaResponse alterar(PaginaRequest r) {
        if (r.paginaLigada() == null) {
            throw new ValidacaoException("Confira os dados da página.", "VITRINE_PAGINA_INVALIDA",
                    List.of(new ApiError.FieldError("paginaLigada", "Informe se a página fica ligada.")));
        }
        VitrinePagina pagina = obterParaAlterar(r.versao());
        boolean noMarketplace = Boolean.TRUE.equals(r.noMarketplace());
        boolean mudouPagina = pagina.isPaginaLigada() != r.paginaLigada();
        boolean mudouMarketplace = pagina.isNoMarketplace() != noMarketplace;
        if (mudouPagina) {
            pagina.ligar(r.paginaLigada());
        }
        if (mudouMarketplace) {
            pagina.entrarNoMarketplace(noMarketplace);
        }
        if (mudouPagina || mudouMarketplace) {
            paginas.saveAndFlush(pagina);
        }
        if (mudouPagina) {
            auditoria.registrarEvento("VITRINE_PAGINA_ALTERADA", "VITRINE_PAGINA", null,
                    r.paginaLigada() ? "Ligou a página pública da loja." : "Desligou a página pública da loja.");
        }
        if (mudouMarketplace) {
            auditoria.registrarEvento("VITRINE_MARKETPLACE_ALTERADO", "VITRINE_PAGINA", null,
                    noMarketplace ? "Entrou na Vitrine de consultorias." : "Saiu da Vitrine de consultorias.");
        }
        return resposta(Optional.of(pagina));
    }

    @Transactional
    public PaginaResponse novoLink(NovoLinkRequest r) {
        VitrinePagina pagina = obterParaAlterar(r.versao());
        pagina.novoCodigo(CodigoDeInscricao.novo());
        paginas.saveAndFlush(pagina);
        auditoria.registrarEvento("VITRINE_LINK_RENOVADO", "VITRINE_PAGINA", null, "Gerou um novo link da página pública da loja.");
        return resposta(Optional.of(pagina));
    }

    /** Sem linha, só a versão ausente cria (página desligada, código novo); com linha, a versão tem de ser a da tela. */
    private VitrinePagina obterParaAlterar(Long versao) {
        if (consultorias.travar(TenantContext.get()).isEmpty()) {
            throw new NaoEncontradoException("Consultoria não encontrada.");
        }
        Optional<VitrinePagina> existente = paginas.daConsultoria();
        if (existente.isEmpty() ? versao != null : !existente.get().getVersao().equals(versao)) {
            throw new ConflictException("Outra pessoa ou aba alterou a página. Recarregue para ver a versão atual.",
                    "CONFLITO_EDICAO");
        }
        return existente.orElseGet(() -> paginas.saveAndFlush(new VitrinePagina(CodigoDeInscricao.novo())));
    }

    private static PaginaResponse resposta(Optional<VitrinePagina> pagina) {
        return pagina.map(p -> new PaginaResponse(p.isPaginaLigada(), p.getCodigoPublico(), p.isNoMarketplace(), p.getVersao()))
                .orElse(new PaginaResponse(false, null, false, null));
    }
}
