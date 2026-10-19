package br.com.treinos.api.inscricoes;

import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.auditoria.Auditar;
import br.com.treinos.api.inscricoes.InscricaoDtos.ConfiguracaoRequest;
import br.com.treinos.api.inscricoes.InscricaoDtos.ConfiguracaoResponse;
import br.com.treinos.api.inscricoes.InscricaoDtos.NovoLinkRequest;
import br.com.treinos.api.web.Buscas;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Objects;

/**
 * Link de inscrição da consultoria da sessão: ligar/desligar, responsável padrão, texto de apresentação e privacidade e
 * "Gerar novo link" (troca o código; o antigo para de valer na hora). A linha nasce no primeiro salvar ou gerar link;
 * antes disso a leitura devolve tudo desligado e sem código. Lock otimista pela {@code versao}.
 */
@Service
public class ConfiguracaoInscricaoService {

    private final InscricaoConfiguracaoRepository configuracoes;
    private final ResponsaveisDaInscricao responsaveis;
    private final String appUrl;

    public ConfiguracaoInscricaoService(InscricaoConfiguracaoRepository configuracoes,
                                        ResponsaveisDaInscricao responsaveis,
                                        @Value("${treinos.app-url}") String appUrl) {
        this.configuracoes = configuracoes;
        this.responsaveis = responsaveis;
        this.appUrl = appUrl.endsWith("/") ? appUrl.substring(0, appUrl.length() - 1) : appUrl;
    }

    @Transactional(readOnly = true)
    public ConfiguracaoResponse ler() {
        return configuracoes.atual().map(this::resposta)
                .orElseGet(() -> new ConfiguracaoResponse(false, null, null, null, null, null));
    }

    @Transactional
    @Auditar(acao = "INSCRICAO_CONFIGURACAO_ALTERADA", entidade = "INSCRICAO_CONFIGURACAO",
            resumo = "Alterou o link de inscrição.")
    public ConfiguracaoResponse alterar(ConfiguracaoRequest r) {
        InscricaoConfiguracao c = paraAlterar(r.versao());
        c.alterar(r.aberta(), responsaveis.exigirValido(r.responsavelId()), Buscas.opcional(r.texto()));
        return resposta(gravar(c));
    }

    @Transactional
    @Auditar(acao = "INSCRICAO_LINK_RENOVADO", entidade = "INSCRICAO_CONFIGURACAO",
            resumo = "Gerou um novo link de inscrição; o anterior parou de valer.")
    public ConfiguracaoResponse novoLink(NovoLinkRequest r) {
        InscricaoConfiguracao c = paraAlterar(r == null ? null : r.versao());
        c.trocarCodigo(CodigoDeInscricao.novo());
        return resposta(gravar(c));
    }

    /** Existente: trava e confere a versão. Nova: nasce desligada e já com código. */
    private InscricaoConfiguracao paraAlterar(Long versao) {
        var existente = configuracoes.atualParaAlterar();
        if (existente.isEmpty()) {
            return new InscricaoConfiguracao(CodigoDeInscricao.novo());
        }
        InscricaoConfiguracao c = existente.get();
        if (!Objects.equals(versao, c.getVersao())) {
            throw conflito();
        }
        return c;
    }

    private InscricaoConfiguracao gravar(InscricaoConfiguracao c) {
        try {
            return configuracoes.saveAndFlush(c);
        } catch (DataIntegrityViolationException corrida) {
            // Duas abas criando a primeira configuração ao mesmo tempo (consultoria única na tabela).
            throw conflito();
        }
    }

    private ConfiguracaoResponse resposta(InscricaoConfiguracao c) {
        return new ConfiguracaoResponse(c.isAberta(), c.getCodigo(), appUrl + "/inscricao/" + c.getCodigo(),
                c.getResponsavelId(), c.getTexto(), c.getVersao());
    }

    private static ConflictException conflito() {
        return new ConflictException("Outra pessoa ou aba alterou o link de inscrição. Recarregue para ver a versão atual.",
                "CONFLITO_EDICAO");
    }
}
