package br.com.treinos.api.integracao;

import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.conta.FonteDaConta;
import br.com.treinos.api.conta.MinhaContaDto;
import br.com.treinos.api.conta.PagamentoIndisponivelException;
import br.com.treinos.api.web.NaoEncontradoException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.net.URI;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Minha conta com os dados reais da Central (contrato 6.3): {@code GET /integracao/v1/produtos/{produto}/instancias/
 * {idExterno}/minha-conta}, assinado, corpo vazio. {@code idExterno} é o id da consultoria (o {@code tenantId} que o
 * provisionamento devolveu). 404 = conta inexistente; qualquer outra falha (rede, 5xx, 401/403, corpo ilegível) vira
 * {@code 502 CENTRAL_INDISPONIVEL}. Sem a integração ativa a fonte é a local ({@code FonteDaContaLocal}).
 */
@Component
@ConditionalOnProperty(name = "treinos.integracao.ativa", havingValue = "true")
public class FonteDaContaCentral implements FonteDaConta {

    private static final Logger LOG = LoggerFactory.getLogger(FonteDaContaCentral.class);

    private final CentralClient central;
    private final IntegracaoProperties propriedades;
    private final JsonMapper json;

    public FonteDaContaCentral(CentralClient central, IntegracaoProperties propriedades, JsonMapper json) {
        this.central = central;
        this.propriedades = propriedades;
        this.json = json;
    }

    @Override
    public Optional<MinhaContaDto> minhaConta(UUID consultoriaId) {
        String caminho = "/integracao/v1/produtos/" + propriedades.produto() + "/instancias/" + consultoriaId + "/minha-conta";
        CentralClient.Resposta resposta;
        try {
            resposta = central.get(caminho);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw IntegracaoException.centralIndisponivel();
        } catch (IOException e) {
            LOG.warn("Minha conta: a central não respondeu ({}).", e.getClass().getSimpleName());
            throw IntegracaoException.centralIndisponivel();
        }
        if (resposta.status() == 404) {
            return Optional.empty();
        }
        if (!resposta.sucesso()) {
            LOG.warn("Minha conta: a central respondeu {}.", resposta.status());
            throw IntegracaoException.centralIndisponivel();
        }
        try {
            return Optional.of(json.readValue(resposta.corpo(), MinhaContaDto.class));
        } catch (JacksonException e) {
            LOG.warn("Minha conta: resposta da central ilegível.");
            throw IntegracaoException.centralIndisponivel();
        }
    }

    /**
     * Contrato 6.4: a Central cria (ou reaproveita) o checkout do Mercado Pago da cobrança. A resposta só é aceita se a
     * URL for {@code https} do próprio Mercado Pago: o app abre esse endereço fora dele, e nada de outro domínio passa.
     */
    @Override
    public String linkDePagamento(UUID consultoriaId, UUID cobrancaId) {
        String caminho = "/integracao/v1/produtos/" + propriedades.produto() + "/instancias/" + consultoriaId + "/cobrancas/"
                + cobrancaId + "/link-de-pagamento";
        CentralClient.Resposta resposta;
        try {
            resposta = central.post(caminho);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw IntegracaoException.centralIndisponivel();
        } catch (IOException e) {
            LOG.warn("Link de pagamento: a central não respondeu ({}).", e.getClass().getSimpleName());
            throw IntegracaoException.centralIndisponivel();
        }
        switch (resposta.status()) {
            case 404 -> throw new NaoEncontradoException("Cobrança não encontrada.");
            case 409 -> throw new ConflictException("Esta cobrança não está em aberto.", "COBRANCA_NAO_ABERTA");
            case 503 -> throw new PagamentoIndisponivelException();
            default -> {
                if (!resposta.sucesso()) {
                    LOG.warn("Link de pagamento: a central respondeu {}.", resposta.status());
                    throw IntegracaoException.centralIndisponivel();
                }
            }
        }
        String url;
        try {
            url = json.readTree(resposta.corpo()).path("url").asString("");
        } catch (JacksonException e) {
            LOG.warn("Link de pagamento: resposta da central ilegível.");
            throw IntegracaoException.centralIndisponivel();
        }
        if (!urlDoMercadoPago(url)) {
            LOG.warn("Link de pagamento: a central devolveu um endereço fora do Mercado Pago.");
            throw IntegracaoException.centralIndisponivel();
        }
        return url;
    }

    static boolean urlDoMercadoPago(String url) {
        try {
            URI uri = URI.create(url);
            return "https".equals(uri.getScheme()) && uri.getUserInfo() == null
                    && Set.of("www.mercadopago.com.br", "www.mercadopago.com").contains(uri.getHost());
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    @Override
    public boolean previa() {
        return false;
    }
}
