package br.com.treinos.api.vitrine;

import br.com.treinos.api.inscricoes.CodigoDeInscricao;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.sql.Date;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Leituras públicas de {@code vitrine_configuracao} e {@code vitrine_item} fora de uma consultoria, em SQL nativo (permitido no
 * {@code ArquiteturaTest} por isso). Sem login e sem {@code TenantContext}: toda consulta filtra {@code consultoria_id} e as
 * condições de exposição de forma explícita, porque {@code @TenantId} não protege SQL nativo.
 * <ul>
 *   <li>{@link #consultoriaDaPaginaLigada}: o link da loja é público, então primeiro é preciso descobrir de qual consultoria ele é
 *       (pelo código, como {@code InscricaoBusca}); devolve só o id, com o código no formato; a leitura dos itens roda depois,
 *       dentro dela, com {@code @TenantId}.</li>
 *   <li>{@link #marketplace}: a lista entre consultorias (D15). Projeção fechada: marca (nome, cor, fonte, tema, logo por tipo e
 *       versão, nunca os bytes), código da loja e, por item, nome, descrição, tipo, preços e a data da foto (nunca os bytes). Nada
 *       de equipe, aluno, e-mail, telefone, cupom, link ou id de usuário. Só entra consultoria com opt-in, página ligada, <b>não
 *       suspensa</b> e com ao menos um item ativo, DIGITAL, na página pública e com opt-in; só entra o item que cumpre tudo isso.</li>
 * </ul>
 * Suspensa (D15, {@code direitos_locais}) = há linha com {@code acesso_liberado = false} ou {@code situacao} BLOQUEADA ou CANCELADA.
 * É mais estrito que o {@code AcessoPorDireitos} (que só olha {@code acesso_liberado} e a tolerância de 72 h do {@code confirmado_em},
 * que aqui <b>não</b> entra: consultoria com a confirmação vencida segue na lista); sem linha, não é suspensa. O filtro vale com o
 * bloqueio por direitos ligado ou não.
 */
@Component
class VitrinePublicaRepositorio {

    /** Um item do marketplace como o banco o tem; o preço vigente é decidido depois, pelo servidor ({@link PrecoDaVitrine}). */
    record ItemDoBanco(UUID id, String nome, String descricao, String tipo, Long precoCentavos, Long precoEspecialCentavos,
                       LocalDate especialAte, Instant fotoAtualizadaEm) { }

    /** Uma loja do marketplace como o banco a tem; {@code consultoriaId} só serve para montar a URL pública da logo. */
    record LojaDoBanco(UUID consultoriaId, String nome, String corPrimaria, String fonteTitulo, String temaPadrao, String logoTipo,
                       int logoVersao, String codigo, List<ItemDoBanco> itens) { }

    record PaginaDoBanco(List<LojaDoBanco> lojas, long total) { }

    private static String itemElegivel(String a) {
        return a + ".ativo and " + a + ".no_marketplace and " + a + ".na_pagina_publica and " + a + ".tipo = 'DIGITAL'";
    }

    /** Com {@code vc} = {@code vitrine_configuracao}: opt-in, página ligada, não suspensa e ao menos um item elegível. */
    private static final String LOJA_ELEGIVEL = "vc.no_marketplace and vc.pagina_ligada "
            + "and not exists (select 1 from direitos_locais d where d.consultoria_id = vc.consultoria_id "
            + "and (not d.acesso_liberado or d.situacao in ('BLOQUEADA', 'CANCELADA'))) "
            + "and exists (select 1 from vitrine_item ie where ie.consultoria_id = vc.consultoria_id and " + itemElegivel("ie") + ")";

    private final JdbcTemplate jdbc;

    VitrinePublicaRepositorio(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    Optional<UUID> consultoriaDaPaginaLigada(String codigo) {
        if (!CodigoDeInscricao.valido(codigo)) {
            return Optional.empty();
        }
        return jdbc.query("select consultoria_id from vitrine_configuracao where codigo_publico = ? and pagina_ligada",
                (rs, n) -> rs.getObject(1, UUID.class), codigo).stream().findFirst();
    }

    /**
     * A página {@code pagina} (base 0) de lojas elegíveis, por nome e id, cada uma com todos os seus itens elegíveis (no máximo 30, o
     * teto da vitrine), na ordem da vitrine. Página além do fim dá lista vazia com o {@code total} real. Os itens são lidos de novo
     * com as mesmas condições (não só pelo id da loja): quem for desligado entre as duas leituras some.
     */
    PaginaDoBanco marketplace(long pagina, int tamanho) {
        Long total = jdbc.queryForObject("select count(*) from vitrine_configuracao vc where " + LOJA_ELEGIVEL, Long.class);
        long offset = pagina * tamanho;
        if (total == null || offset >= total) {
            return new PaginaDoBanco(List.of(), total == null ? 0 : total);
        }
        Map<UUID, LojaDoBanco> lojas = new LinkedHashMap<>();
        jdbc.query("select vc.consultoria_id, co.nome, co.cor_primaria, co.fonte_titulo, co.tema_padrao, co.logo_tipo, "
                        + "co.logo_versao, vc.codigo_publico "
                        + "from vitrine_configuracao vc join consultoria co on co.id = vc.consultoria_id "
                        + "where " + LOJA_ELEGIVEL + " order by lower(co.nome), vc.consultoria_id limit ? offset ?",
                rs -> {
                    UUID id = rs.getObject(1, UUID.class);
                    lojas.put(id, new LojaDoBanco(id, rs.getString(2), rs.getString(3), rs.getString(4), rs.getString(5),
                            rs.getString(6), rs.getInt(7), rs.getString(8), new ArrayList<>()));
                }, tamanho, offset);
        if (lojas.isEmpty()) {
            return new PaginaDoBanco(List.of(), total);
        }
        String marcadores = String.join(", ", Collections.nCopies(lojas.size(), "?"));
        jdbc.query("select i.consultoria_id, i.id, i.nome, i.descricao, i.tipo, i.preco_centavos, i.preco_especial_centavos, "
                        + "i.especial_ate, f.atualizada_em "
                        + "from vitrine_configuracao vc join vitrine_item i on i.consultoria_id = vc.consultoria_id "
                        + "left join vitrine_item_foto f on f.item_id = i.id and f.consultoria_id = i.consultoria_id "
                        + "where vc.consultoria_id in (" + marcadores + ") and " + LOJA_ELEGIVEL + " and " + itemElegivel("i")
                        + " order by i.consultoria_id, i.ordem, i.nome, i.id",
                rs -> {
                    long preco = rs.getLong(6);
                    Long precoCentavos = rs.wasNull() ? null : preco;
                    long especial = rs.getLong(7);
                    Long precoEspecial = rs.wasNull() ? null : especial;
                    Date ate = rs.getDate(8);
                    Timestamp foto = rs.getTimestamp(9);
                    lojas.get(rs.getObject(1, UUID.class)).itens().add(new ItemDoBanco(rs.getObject(2, UUID.class), rs.getString(3),
                            rs.getString(4), rs.getString(5), precoCentavos, precoEspecial, ate == null ? null : ate.toLocalDate(),
                            foto == null ? null : foto.toInstant()));
                }, lojas.keySet().toArray());
        // A loja sem item elegível na segunda leitura (corrida) não vai à resposta.
        return new PaginaDoBanco(lojas.values().stream().filter(l -> !l.itens().isEmpty()).toList(), total);
    }
}
