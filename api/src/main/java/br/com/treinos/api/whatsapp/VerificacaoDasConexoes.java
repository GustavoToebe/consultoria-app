package br.com.treinos.api.whatsapp;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Set;

/**
 * Na subida, só com o WhatsApp ligado, confere que as chaves de cifra configuradas ainda cobrem os tokens já gravados: com token
 * cifrado por uma chave que não está em {@code TREINOS_WHATSAPP_CHAVES} (variável apagada ou chave antiga removida cedo demais),
 * a API não sobe, em vez de subir e responder 503 só na hora de enviar. SQL nativo sem tenant, de propósito: vê todas as
 * consultorias de uma vez e devolve só os ids de chave (o prefixo {@code v1:<id>:}), nunca o token cifrado.
 * <p>
 * Desligado, a subida não exige variável nenhuma, mesmo com conexão parada no banco (o mesmo desenho de
 * {@code VerificacaoDasCredenciais}).
 */
@Component
class VerificacaoDasConexoes implements ApplicationRunner {

    private final JdbcTemplate jdbc;
    private final CifraDoWhatsApp cifra;
    private final WhatsAppProperties propriedades;

    VerificacaoDasConexoes(JdbcTemplate jdbc, CifraDoWhatsApp cifra, WhatsAppProperties propriedades) {
        this.jdbc = jdbc;
        this.cifra = cifra;
        this.propriedades = propriedades;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (!propriedades.habilitado()) {
            return;
        }
        List<String> ids = jdbc.queryForList("select distinct split_part(token_cifrado, ':', 2) from whatsapp_conexao", String.class);
        conferir(ids, cifra.idsDasChaves());
    }

    static void conferir(List<String> idsGravados, Set<String> idsConfigurados) {
        if (idsGravados.stream().anyMatch(id -> !idsConfigurados.contains(id))) {
            throw new IllegalStateException("Há token do WhatsApp cifrado com uma chave que não está em "
                    + "TREINOS_WHATSAPP_CHAVES. Mantenha a chave antiga na lista até recifrar o que existe.");
        }
    }
}
