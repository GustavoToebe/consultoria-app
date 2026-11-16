package br.com.treinos.api.vitrine;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Contrato da vitrine. O corpo não usa Bean Validation (daria 400): a regra está em {@link ValidacaoDoItem} e a recusa é 422
 * {@code VITRINE_ITEM_INVALIDO} com {@code fieldErrors}, sem repetir o valor. Dinheiro em centavos.
 */
public final class VitrineDtos {

    private VitrineDtos() { }

    /**
     * Corpo do {@code POST} e do {@code PUT}. {@code tipo} é {@code DIGITAL} ou {@code FISICO}; {@code ativo} é obrigatório;
     * {@code versao} só vale no {@code PUT} (a que a tela leu). A ordem não vem aqui: muda por {@code PUT .../ordem}.
     */
    public record ItemRequest(String nome, String descricao, String tipo, Long precoCentavos, Long precoEspecialCentavos,
                              LocalDate especialAte, String cupom, String linkUrl, Boolean ativo, Long versao) { }

    /** Todos os ids da vitrine, na nova ordem (nem a mais, nem a menos, sem repetir). */
    public record OrdemRequest(List<UUID> ids) { }

    /**
     * Item para a equipe. {@code precoVigenteCentavos} é o que vale hoje (Brasília), calculado no servidor; {@code temFoto} diz se
     * há foto e {@code fotoAtualizadaEm} (nulo sem foto) serve de chave para o app não reusar a foto antiga depois de uma troca.
     */
    public record ItemResponse(UUID id, String nome, String descricao, String tipo, Long precoCentavos, Long precoEspecialCentavos,
                               LocalDate especialAte, Long precoVigenteCentavos, String cupom, String linkUrl, boolean ativo,
                               int ordem, Long versao, boolean temFoto, Instant fotoAtualizadaEm) { }

    /**
     * Item para o aluno (só os ativos, sem ordem nem versão). {@code especialAte} só vem quando o preço especial está vigente
     * (e é nulo se ele não tem fim); com o especial vigente, {@code precoVigenteCentavos} é menor que {@code precoCentavos}.
     */
    public record ItemDoAlunoResponse(UUID id, String nome, String descricao, String tipo, Long precoCentavos,
                                      Long precoVigenteCentavos, LocalDate especialAte, String cupom, String linkUrl,
                                      boolean temFoto, Instant fotoAtualizadaEm) { }
}
