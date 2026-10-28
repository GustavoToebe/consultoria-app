package br.com.treinos.api.biblioteca;

/**
 * Grupo do alimento da biblioteca ("Carnes e derivados", "Leite e derivados"...), texto livre do treinador, opcional. Só
 * serve para agrupar a lista de compras do aluno (pedido do Gustavo em 28/10, como a lista de um concorrente): a
 * publicação da dieta copia o grupo do momento para o item da versão imutável, como os fatores
 * ({@code PlanoDietaService.paraPublicar}). Nulo = sem grupo ("Outros itens" na lista). O alimento importado do catálogo
 * público nasce com o grupo de lá (V038 para os que já existiam).
 */
public final class GrupoDoAlimento {

    /** Tamanho da coluna {@code alimento.grupo} e do campo no app. */
    public static final int MAXIMO = 60;

    private GrupoDoAlimento() {
    }

    /**
     * Texto como é gravado: caractere de controle vira espaço, espaços seguidos viram um só, sem espaço nas pontas; vazio
     * vira nulo. Não corta: o tamanho é conferido por quem chama ({@link #longoDemais}).
     */
    public static String normalizar(String texto) {
        if (texto == null) {
            return null;
        }
        StringBuilder limpo = new StringBuilder(texto.length());
        texto.codePoints().forEach(c -> limpo.appendCodePoint(Character.isISOControl(c) ? ' ' : c));
        String resultado = limpo.toString().replaceAll("\\s+", " ").strip();
        return resultado.isEmpty() ? null : resultado;
    }

    /** O grupo já normalizado passa do tamanho da coluna. */
    public static boolean longoDemais(String normalizado) {
        return normalizado != null && normalizado.codePointCount(0, normalizado.length()) > MAXIMO;
    }

    /**
     * Grupo de um item do catálogo público para o alimento importado: normalizado e, por garantia, cortado no tamanho
     * da coluna (a do catálogo é maior; hoje nenhum grupo dele passa de 40 caracteres).
     */
    public static String doCatalogo(String grupoDoCatalogo) {
        String grupo = normalizar(grupoDoCatalogo);
        if (!longoDemais(grupo)) {
            return grupo;
        }
        return grupo.substring(0, grupo.offsetByCodePoints(0, MAXIMO)).strip();
    }
}
