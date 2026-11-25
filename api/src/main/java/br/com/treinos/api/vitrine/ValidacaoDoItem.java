package br.com.treinos.api.vitrine;

import br.com.plataforma.comum.web.ApiError;
import br.com.treinos.api.vitrine.VitrineDtos.ItemRequest;
import br.com.treinos.api.web.CupomDeSuplemento;
import br.com.treinos.api.web.FaixaDeData;
import br.com.treinos.api.web.LinksExternos;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Regras do item da vitrine, sem banco (testável sem Docker). Espelho em {@code app/src/dominio/vitrine.ts}: mudou uma, mude a
 * outra. As mensagens nunca repetem o valor digitado.
 */
final class ValidacaoDoItem {

    static final int NOME_MAXIMO = 100;
    static final int DESCRICAO_MAXIMA = 300;
    /** R$ 10.000.000,00, o mesmo teto do app (`VALOR_MAXIMO_CENTAVOS`). */
    static final long PRECO_MAXIMO_CENTAVOS = 1_000_000_000L;
    static final Set<String> TIPOS = Set.of("DIGITAL", "FISICO");

    private ValidacaoDoItem() { }

    /** O que vai para a entidade: textos sem espaços nas pontas (vazio = nulo). */
    record Valido(String nome, String descricao, String tipo, Long precoCentavos, Long precoEspecialCentavos,
                  LocalDate especialAte, String cupom, String linkUrl, boolean ativo, boolean naPaginaPublica,
                  boolean noMarketplace, UUID categoriaId) { }

    /** Problemas por campo; lista vazia = válido. */
    static List<ApiError.FieldError> problemas(ItemRequest r, LocalDate hoje) {
        List<ApiError.FieldError> erros = new ArrayList<>();
        String nome = r.nome() == null ? "" : r.nome().strip();
        if (nome.isEmpty()) {
            erros.add(new ApiError.FieldError("nome", "Informe o nome do item."));
        } else if (nome.length() > NOME_MAXIMO) {
            erros.add(new ApiError.FieldError("nome", "Use no máximo " + NOME_MAXIMO + " caracteres."));
        }
        if (r.descricao() != null && r.descricao().strip().length() > DESCRICAO_MAXIMA) {
            erros.add(new ApiError.FieldError("descricao", "Use no máximo " + DESCRICAO_MAXIMA + " caracteres."));
        }
        if (r.tipo() == null || !TIPOS.contains(r.tipo())) {
            erros.add(new ApiError.FieldError("tipo", "Escolha digital ou físico."));
        }
        if (r.precoCentavos() != null && !precoValido(r.precoCentavos())) {
            erros.add(new ApiError.FieldError("precoCentavos", "Use um preço maior que zero e até R$ 10.000.000,00."));
        }
        if (r.precoEspecialCentavos() != null) {
            if (!precoValido(r.precoEspecialCentavos())) {
                erros.add(new ApiError.FieldError("precoEspecialCentavos", "Use um preço maior que zero e até R$ 10.000.000,00."));
            } else if (r.precoCentavos() == null) {
                erros.add(new ApiError.FieldError("precoEspecialCentavos", "Informe o preço normal para ter um preço especial."));
            } else if (precoValido(r.precoCentavos()) && r.precoEspecialCentavos() >= r.precoCentavos()) {
                erros.add(new ApiError.FieldError("precoEspecialCentavos", "O preço especial precisa ser menor que o preço normal."));
            }
        }
        if (r.especialAte() != null) {
            if (r.precoEspecialCentavos() == null) {
                erros.add(new ApiError.FieldError("especialAte", "Informe o preço especial para ter uma validade."));
            } else if (!FaixaDeData.PLANEJAMENTO.aceita(r.especialAte(), hoje)) {
                erros.add(new ApiError.FieldError("especialAte", FaixaDeData.PLANEJAMENTO.mensagem("Válido até", hoje)));
            }
        }
        if (!CupomDeSuplemento.valido(r.cupom())) {
            erros.add(new ApiError.FieldError("cupom", CupomDeSuplemento.MENSAGEM));
        }
        if (r.linkUrl() != null && !r.linkUrl().isBlank() && !LinksExternos.valido(r.linkUrl().strip())) {
            erros.add(new ApiError.FieldError("linkUrl", LinksExternos.MENSAGEM));
        }
        if (r.ativo() == null) {
            erros.add(new ApiError.FieldError("ativo", "Informe se o item está ativo."));
        }
        if (Boolean.TRUE.equals(r.naPaginaPublica()) && !"DIGITAL".equals(r.tipo())) {
            erros.add(new ApiError.FieldError("naPaginaPublica", "Só item digital pode aparecer na página pública."));
        }
        if (Boolean.TRUE.equals(r.noMarketplace()) && !"DIGITAL".equals(r.tipo())) {
            erros.add(new ApiError.FieldError("noMarketplace", "Só item digital pode ir ao marketplace."));
        }
        return erros;
    }

    /** Só depois de {@link #problemas} vazio. */
    static Valido normalizar(ItemRequest r) {
        return new Valido(r.nome().strip(), vazioViraNulo(r.descricao()), r.tipo(), r.precoCentavos(), r.precoEspecialCentavos(),
                r.especialAte(), CupomDeSuplemento.limpar(r.cupom()), vazioViraNulo(r.linkUrl()), r.ativo(),
                Boolean.TRUE.equals(r.naPaginaPublica()), Boolean.TRUE.equals(r.noMarketplace()), r.categoriaId());
    }

    private static boolean precoValido(long centavos) {
        return centavos >= 1 && centavos <= PRECO_MAXIMO_CENTAVOS;
    }

    private static String vazioViraNulo(String texto) {
        return texto == null || texto.isBlank() ? null : texto.strip();
    }
}
