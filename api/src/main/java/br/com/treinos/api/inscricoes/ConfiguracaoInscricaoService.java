package br.com.treinos.api.inscricoes;

import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.auditoria.Auditar;
import br.com.treinos.api.inscricoes.InscricaoDtos.CamposOcultosRequest;
import br.com.treinos.api.inscricoes.InscricaoDtos.ConfiguracaoRequest;
import br.com.treinos.api.inscricoes.InscricaoDtos.ConfiguracaoResponse;
import br.com.treinos.api.inscricoes.InscricaoDtos.NovoLinkRequest;
import br.com.treinos.api.questionarios.Finalidade;
import br.com.treinos.api.questionarios.Questionario;
import br.com.treinos.api.questionarios.QuestionarioRepository;
import br.com.treinos.api.web.Buscas;
import br.com.treinos.api.web.NaoEncontradoException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.EnumSet;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/**
 * Link público do formulário de inscrição: a ÚNICA fonte é o próprio {@link Questionario} (código, aberto/fechado,
 * responsável, texto de apresentação e campos fixos escondidos). O código nasce sempre aqui, no servidor
 * ({@link CodigoDeInscricao#novo()}, 144 bits), nunca vem do cliente; "Gerar novo link" e fechar agem na mesma coluna que o
 * resolvedor público lê, então o código antigo dá 404 na hora. Só questionário de INSCRICAO tem link (a anamnese se
 * responde logada). Lock otimista pelo {@code linkVersao}, separado da {@code versao} do editor.
 */
@Service
public class ConfiguracaoInscricaoService {

    private final QuestionarioRepository questionarios;
    private final ResponsaveisDaInscricao responsaveis;
    private final String appUrl;

    public ConfiguracaoInscricaoService(QuestionarioRepository questionarios, ResponsaveisDaInscricao responsaveis,
                                        @Value("${treinos.app-url}") String appUrl) {
        this.questionarios = questionarios;
        this.responsaveis = responsaveis;
        this.appUrl = appUrl.endsWith("/") ? appUrl.substring(0, appUrl.length() - 1) : appUrl;
    }

    /** O formulário de inscrição padrão da consultoria da sessão (o que o cartão "Link" do Interessados controla). */
    @Transactional(readOnly = true)
    public UUID idDoPadrao() {
        return questionarios.findByPadraoTrueAndFinalidade(Finalidade.INSCRICAO).map(Questionario::getId)
                .orElseThrow(() -> new NaoEncontradoException("Formulário de inscrição não encontrado."));
    }

    @Transactional(readOnly = true)
    public ConfiguracaoResponse ler(UUID questionarioId) {
        return resposta(questionarios.findById(questionarioId)
                .orElseThrow(() -> new NaoEncontradoException("Questionário não encontrado.")));
    }

    @Transactional
    @Auditar(acao = "INSCRICAO_CONFIGURACAO_ALTERADA", entidade = "QUESTIONARIO", resumo = "Alterou o link de inscrição.")
    public ConfiguracaoResponse alterar(UUID questionarioId, ConfiguracaoRequest r) {
        Questionario q = paraAlterar(questionarioId, r.versao());
        if (r.aberta() && q.isArquivado()) {
            throw new ConflictException("Questionário arquivado não recebe inscrição. Desarquive antes de abrir o link.",
                    "QUESTIONARIO_ARQUIVADO");
        }
        q.setPublicoAberto(r.aberta());
        q.setResponsavelPadraoId(responsaveis.exigirValido(r.responsavelId()));
        q.setTextoApresentacao(Buscas.opcional(r.texto()));
        if (r.aberta() && q.getCodigoPublico() == null) {
            q.setCodigoPublico(CodigoDeInscricao.novo());
        }
        q.subirLinkVersao();
        return resposta(gravar(q));
    }

    /**
     * Esconde da página os campos fixos da lista (sempre a lista inteira; vazia = todos visíveis). Nome, WhatsApp e a
     * ciência do texto não estão no {@link CampoDaInscricao} e nunca se escondem.
     */
    @Transactional
    @Auditar(acao = "INSCRICAO_CONFIGURACAO_ALTERADA", entidade = "QUESTIONARIO",
            resumo = "Alterou os campos da página de inscrição.")
    public ConfiguracaoResponse esconderCampos(UUID questionarioId, CamposOcultosRequest r) {
        Questionario q = paraAlterar(questionarioId, r.versao());
        q.setCamposOcultos(CampoDaInscricao.escrever(
                r.camposOcultos().isEmpty() ? EnumSet.noneOf(CampoDaInscricao.class) : EnumSet.copyOf(r.camposOcultos())));
        q.subirLinkVersao();
        return resposta(gravar(q));
    }

    @Transactional
    @Auditar(acao = "INSCRICAO_LINK_RENOVADO", entidade = "QUESTIONARIO",
            resumo = "Gerou um novo link de inscrição; o anterior parou de valer.")
    public ConfiguracaoResponse novoLink(UUID questionarioId, NovoLinkRequest r) {
        Questionario q = paraAlterar(questionarioId, r == null ? null : r.versao());
        q.setCodigoPublico(CodigoDeInscricao.novo());
        q.subirLinkVersao();
        return resposta(gravar(q));
    }

    /** Trava a linha, exige formulário de inscrição (404 de outra consultoria pelo filtro de tenant) e confere a versão. */
    private Questionario paraAlterar(UUID id, Long versao) {
        Questionario q = questionarios.buscarParaAlterar(id)
                .orElseThrow(() -> new NaoEncontradoException("Questionário não encontrado."));
        if (q.getFinalidade() != Finalidade.INSCRICAO) {
            throw new ConflictException("Só o formulário de inscrição tem link público.", "LINK_SO_DA_INSCRICAO");
        }
        if (!Objects.equals(versao, q.getLinkVersao())) {
            throw conflito();
        }
        return q;
    }

    private Questionario gravar(Questionario q) {
        try {
            return questionarios.saveAndFlush(q);
        } catch (DataIntegrityViolationException colisao) {
            // Código já usado (chave única global, praticamente impossível com 144 bits) ou CHECK do link.
            throw conflito();
        }
    }

    private ConfiguracaoResponse resposta(Questionario q) {
        boolean inscricao = q.getFinalidade() == Finalidade.INSCRICAO;
        String codigo = inscricao ? q.getCodigoPublico() : null;
        return new ConfiguracaoResponse(q.isLinkPublicoAberto(), codigo, codigo == null ? null : appUrl + "/inscricao/" + codigo,
                q.getResponsavelPadraoId(), q.getTextoApresentacao(), List.copyOf(CampoDaInscricao.ler(q.getCamposOcultos())),
                q.getLinkVersao());
    }

    private static ConflictException conflito() {
        return new ConflictException("Outra pessoa ou aba alterou o link de inscrição. Recarregue para ver a versão atual.",
                "CONFLITO_EDICAO");
    }
}
