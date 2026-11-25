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
     * {@code naPaginaPublica} e {@code noMarketplace} (ausentes = falso) só valem em item {@code DIGITAL} (senão 422 no campo); o
     * item só aparece no marketplace se também estiver na página pública e a consultoria tiver entrado (opt-in duplo).
     * {@code categoriaId} é opcional (nulo = sem categoria; o PUT grava o estado inteiro, então quem quer manter a categoria a
     * reenvia); de outra consultoria ou inexistente = 404.
     */
    public record ItemRequest(String nome, String descricao, String tipo, Long precoCentavos, Long precoEspecialCentavos,
                              LocalDate especialAte, String cupom, String linkUrl, Boolean ativo, Boolean naPaginaPublica,
                              Boolean noMarketplace, UUID categoriaId, Long versao) { }

    /**
     * Corpo do {@code POST} e do {@code PUT} da categoria. O nome é texto do treinador: sem {@code toString}, nunca em log nem em
     * mensagem de erro.
     */
    public record CategoriaRequest(String nome) {
        @Override
        public String toString() {
            return "CategoriaRequest[...]";
        }
    }

    /** Categoria para a equipe; {@code quantidade} = itens dela (ativos e inativos). Lista por {@code ordem}. */
    public record CategoriaResponse(UUID id, String nome, int ordem, long quantidade) { }

    /** Todos os ids das categorias, na nova ordem (nem a mais, nem a menos, sem repetir). */
    public record OrdemDeCategoriasRequest(List<UUID> ids) { }

    /** A categoria do item na vitrine do aluno ({@code ordem} = a da categoria, para a tela agrupar). */
    public record CategoriaDoAluno(UUID id, String nome, int ordem) { }

    /** Todos os ids da vitrine, na nova ordem (nem a mais, nem a menos, sem repetir). */
    public record OrdemRequest(List<UUID> ids) { }

    /**
     * Item para a equipe. {@code precoVigenteCentavos} é o que vale hoje (Brasília), calculado no servidor; {@code temFoto} diz se
     * há foto e {@code fotoAtualizadaEm} (nulo sem foto) serve de chave para o app não reusar a foto antiga depois de uma troca.
     */
    public record ItemResponse(UUID id, String nome, String descricao, String tipo, Long precoCentavos, Long precoEspecialCentavos,
                               LocalDate especialAte, Long precoVigenteCentavos, String cupom, String linkUrl, boolean ativo,
                               boolean naPaginaPublica, boolean noMarketplace, int ordem, Long versao, boolean temFoto, Instant fotoAtualizadaEm,
                               UUID categoriaId, String categoriaNome) { }

    /**
     * Item para o aluno (só os ativos, sem ordem nem versão). {@code especialAte} só vem quando o preço especial está vigente
     * (e é nulo se ele não tem fim); com o especial vigente, {@code precoVigenteCentavos} é menor que {@code precoCentavos}.
     * {@code categoria} nula = sem categoria; a lista vem ordenada (categorias na ordem, sem categoria por último, depois a ordem do item).
     */
    public record ItemDoAlunoResponse(UUID id, String nome, String descricao, String tipo, Long precoCentavos,
                                      Long precoVigenteCentavos, LocalDate especialAte, String cupom, String linkUrl,
                                      boolean temFoto, Instant fotoAtualizadaEm, CategoriaDoAluno categoria) { }

    /**
     * Página pública da loja, para a equipe. {@code codigo} e {@code versao} são nulos enquanto a linha não existe (a página nunca
     * foi ligada nem teve link); a primeira gravação a cria com a {@code versao} ausente, e as seguintes a levam (senão 409
     * {@code CONFLITO_EDICAO}).
     */
    public record PaginaResponse(boolean paginaLigada, String codigo, boolean noMarketplace, Long versao) { }

    /**
     * {@code paginaLigada} é obrigatório (422 {@code VITRINE_PAGINA_INVALIDA} no campo). {@code noMarketplace} (ausente = falso) é o
     * opt-in da consultoria na lista pública de lojas; o PUT grava o estado inteiro, então quem quer manter o opt-in o reenvia.
     */
    public record PaginaRequest(Boolean paginaLigada, Boolean noMarketplace, Long versao) { }

    public record NovoLinkRequest(Long versao) { }

    /** Marca da loja: o que já é público na consultoria. O {@code logoUrl} leva o id da consultoria (rota pública da logo); não há campo de id à parte. */
    public record MarcaDaLoja(String nome, String corPrimaria, String fonteTitulo, String temaPadrao, String logoUrl) { }

    /**
     * Item da página pública (só ativo, DIGITAL e marcado). {@code especialAte} só vem com o preço especial vigente. Nada da equipe:
     * sem ordem, versão, tipo nem id de consultoria.
     */
    public record ItemPublicoResponse(UUID id, String nome, String descricao, Long precoCentavos, Long precoVigenteCentavos,
                                      LocalDate especialAte, String cupom, String linkUrl, boolean temFoto,
                                      Instant fotoAtualizadaEm) { }

    public record LojaPublicaResponse(MarcaDaLoja marca, List<ItemPublicoResponse> itens) { }

    /**
     * Item no marketplace: só o que é público e fechado (D15). Sem cupom, link, preço normal, ordem nem versão, e sem id de consultoria (a única aparição dele é o caminho da {@code logoUrl} da marca); o
     * {@code id} e o {@code codigo} da loja servem à foto pública (F2a). O preço vigente é decidido no servidor.
     */
    public record ItemDoMarketplace(UUID id, String nome, String descricao, String tipo, Long precoVigenteCentavos, boolean temFoto,
                                    Instant fotoAtualizadaEm) { }

    /** Uma loja do marketplace: a marca pública da consultoria, o código da página dela ({@code /loja/{codigo}}) e os itens que ela expôs. */
    public record LojaDoMarketplace(MarcaDaLoja marca, String codigo, List<ItemDoMarketplace> itens) { }

    /** Página de lojas (base 0); {@code total} é o de lojas elegíveis, não o de itens. */
    public record MarketplaceResponse(List<LojaDoMarketplace> lojas, long total, int pagina, int tamanho) { }
}
