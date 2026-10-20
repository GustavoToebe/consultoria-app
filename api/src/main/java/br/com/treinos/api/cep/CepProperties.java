package br.com.treinos.api.cep;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.net.URI;
import java.net.URISyntaxException;

/**
 * Busca de CEP ({@code TREINOS_CEP_*}): a API consulta um serviço público de CEP para o app preencher rua, bairro, cidade e
 * UF (o app só fala com a própria API). Os endereços levam {@code {cep}} (8 dígitos, já conferidos) e vêm só da
 * configuração. Só o CEP sai daqui: nunca nome, CPF nem telefone. Desligada ({@code habilitado=false}), a rota responde 503.
 *
 * <p>Na subida, cada endereço precisa ser https e levar {@code {cep}} (loopback pode ser http, para os testes com servidor de
 * mentira); senão a API não sobe. O erro diz qual propriedade está errada, nunca o valor.
 *
 * @param habilitado liga a consulta (padrão ligada)
 * @param urlPrincipal ViaCEP por padrão
 * @param urlReserva BrasilAPI por padrão, usada quando a principal não responde
 */
@ConfigurationProperties("treinos.cep")
public record CepProperties(boolean habilitado, String urlPrincipal, String urlReserva) {

    static final String URL_PRINCIPAL_PADRAO = "https://viacep.com.br/ws/{cep}/json/";
    static final String URL_RESERVA_PADRAO = "https://brasilapi.com.br/api/cep/v1/{cep}";

    public CepProperties {
        urlPrincipal = vazio(urlPrincipal) ? URL_PRINCIPAL_PADRAO : urlPrincipal.trim();
        urlReserva = vazio(urlReserva) ? URL_RESERVA_PADRAO : urlReserva.trim();
        conferir(urlPrincipal, "treinos.cep.url-principal");
        conferir(urlReserva, "treinos.cep.url-reserva");
    }

    private static void conferir(String url, String propriedade) {
        URI uri;
        try {
            uri = new URI(url.replace("{cep}", "00000000"));
        } catch (URISyntaxException e) {
            throw new IllegalStateException(propriedade + " não é um endereço válido.");
        }
        String esquema = uri.getScheme();
        String host = uri.getHost();
        boolean loopback = "127.0.0.1".equals(host) || "localhost".equals(host);
        if (host == null || !("https".equalsIgnoreCase(esquema) || (loopback && "http".equalsIgnoreCase(esquema)))) {
            throw new IllegalStateException(propriedade + " precisa ser um endereço https.");
        }
        if (!url.contains("{cep}")) {
            throw new IllegalStateException(propriedade + " precisa conter {cep}.");
        }
    }

    private static boolean vazio(String s) {
        return s == null || s.isBlank();
    }
}
