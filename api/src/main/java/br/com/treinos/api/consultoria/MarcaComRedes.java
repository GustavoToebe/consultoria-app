package br.com.treinos.api.consultoria;

import br.com.treinos.api.consultoria.MarcaService.RedesSociaisDto;
import tools.jackson.databind.JsonNode;

import java.util.UUID;

/**
 * A marca da página pública da inscrição: os mesmos campos de {@link MarcaPublica} mais as redes sociais da consultoria (link
 * https já normalizado ou nulo, uma chave por rede). Só as redes: WhatsApp, e-mail e telefone da consultoria são contato
 * interno e nunca saem por aqui.
 */
public record MarcaComRedes(UUID id, String nome, String corPrimaria, String fonteTitulo, String temaPadrao, String logoUrl,
                            String temaPdf, JsonNode opcoesPdf, RedesSociaisDto redes) {

    static MarcaComRedes de(Consultoria c) {
        MarcaPublica m = MarcaPublica.de(c);
        return new MarcaComRedes(m.id(), m.nome(), m.corPrimaria(), m.fonteTitulo(), m.temaPadrao(), m.logoUrl(), m.temaPdf(),
                m.opcoesPdf(), RedesSociaisDto.de(c.redesSociais()));
    }
}
