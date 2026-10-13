package br.com.treinos.api.integracao;

import br.com.treinos.api.conta.FonteDaConta;
import br.com.treinos.api.conta.MinhaContaDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.util.Optional;
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

    @Override
    public boolean previa() {
        return false;
    }
}
