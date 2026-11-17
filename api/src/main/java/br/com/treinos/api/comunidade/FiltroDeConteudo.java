package br.com.treinos.api.comunidade;

import br.com.plataforma.comum.web.ApiError;
import br.com.treinos.api.web.Buscas;

import java.text.Normalizer;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Filtro de conteúdo do aluno na comunidade (post e comentário; a equipe não passa por aqui). Lista fixa e curta de termos
 * sexuais explícitos, comparados sem acento e sem diferença de maiúsculas, só como PALAVRA INTEIRA (separador = qualquer coisa que
 * não seja letra: o dígito separa, então "buceta1" vale como "buceta"). Nenhum termo de anatomia ou de treino, nem palavra com
 * uso figurado comum ("uma orgia de doces", "que putaria esse preço" ficam de fora): falso positivo é o
 * risco principal, então na dúvida o termo fica de fora. A recusa nunca repete o texto nem o termo.
 * <p>shortcut: só a forma escrita certa (sem "l33t", letra repetida ou espaço entre as letras) e sem lista por consultoria;
 * trocar por lista configurável se o treinador pedir.
 */
final class FiltroDeConteudo {

    static final String MENSAGEM = "Sua publicação tem uma palavra não permitida.";
    static final ApiError.FieldError ERRO = new ApiError.FieldError("texto", MENSAGEM);

    // Nenhum termo tem dígito: separar por tudo que não é letra pega "buceta1" sem liberar palavra maior ("bucetaria").
    private static final Pattern SEPARADOR = Pattern.compile("[^\\p{L}]+");
    // Formatação (Cf) e os preenchimentos Hangul, que parecem espaço mas não são Cf (mesma lista do ApelidoDoAlunoService).
    private static final Pattern INVISIVEL = Pattern.compile("[\\p{Cf}\\u115F\\u1160\\u3164\\uFFA0]");

    /** Já normalizados (sem acento, minúsculos). */
    private static final Set<String> TERMOS = Set.of(
            "buceta", "bucetas", "bucetinha", "xoxota", "xoxotas", "xoxotinha", "xereca", "xerecas",
            "piroca", "pirocas", "punheta", "punhetas", "punheteiro", "siririca", "boquete", "boquetes",
            "porno", "pornos", "nudes");

    private FiltroDeConteudo() {
    }

    /** {@code true} se o texto tem algum termo da lista como palavra inteira. Nulo e vazio não bloqueiam. */
    static boolean bloqueia(String texto) {
        if (texto == null || texto.isBlank()) {
            return false;
        }
        // NFKC junta as formas largas ("ｂｕｃ…") e o caractere invisível entre letras não separa a palavra.
        String limpo = Buscas.semAcento(INVISIVEL.matcher(Normalizer.normalize(texto, Normalizer.Form.NFKC)).replaceAll(""));
        for (String palavra : SEPARADOR.split(limpo)) {
            if (TERMOS.contains(palavra)) {
                return true;
            }
        }
        return false;
    }
}
