package br.com.treinos.api.pagamentos;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Set;

/**
 * Na subida, confere que as chaves de cifra configuradas ainda cobrem o que já está gravado: com API Key cifrada no banco e
 * a chave dela fora de {@code TREINOS_PAGAMENTOS_CHAVES} (variável apagada ou chave antiga removida cedo demais), a API não
 * sobe, em vez de subir e responder 503 só na hora de cobrar. SQL nativo sem tenant, de propósito: vê todas as consultorias
 * de uma vez e devolve só os ids de chave (o prefixo {@code v1:<id>:}), nunca o segredo cifrado.
 * <p>
 * Só vale com a InfinitePay ligada ({@code TREINOS_PAGAMENTOS_INFINITEPAY_HABILITADO}). Desligada, nada usa a API Key (as
 * rotas dão 503) e a subida não pode exigir variável nenhuma: o treinador que ligou, configurou e depois desligou a
 * InfinitePay (ou subiu sem as chaves) não pode derrubar a API por causa de uma credencial parada no banco. Quem liga de novo
 * passa pela conferência na subida seguinte.
 */
@Component
class VerificacaoDasCredenciais implements ApplicationRunner {

    private final JdbcTemplate jdbc;
    private final CifraDePagamento cifra;
    private final InfinitePayProperties infinitePay;

    VerificacaoDasCredenciais(JdbcTemplate jdbc, CifraDePagamento cifra, InfinitePayProperties infinitePay) {
        this.jdbc = jdbc;
        this.cifra = cifra;
        this.infinitePay = infinitePay;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (!infinitePay.habilitado()) {
            return;
        }
        List<String> ids = jdbc.queryForList(
                "select distinct split_part(segredo_cifrado, ':', 2) from credencial_pagamento where segredo_cifrado is not null",
                String.class);
        conferir(ids, cifra.idsDasChaves());
    }

    static void conferir(List<String> idsGravados, Set<String> idsConfigurados) {
        if (idsGravados.stream().anyMatch(id -> !idsConfigurados.contains(id))) {
            throw new IllegalStateException("Há API Key de recebimento online cifrada com uma chave que não está em "
                    + "TREINOS_PAGAMENTOS_CHAVES. Mantenha a chave antiga na lista até recifrar o que existe.");
        }
    }
}
