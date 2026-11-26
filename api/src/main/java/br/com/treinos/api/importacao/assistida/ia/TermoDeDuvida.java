package br.com.treinos.api.importacao.assistida.ia;

/**
 * Dúvida da importação assistida sem termo para o treinador conferir: em branco, ou só pontuação, símbolo e asterisco ({@code **},
 * {@code -}, {@code —}), como a IA às vezes devolve. Sem letra nem dígito não há o que reconhecer, então a dúvida é descartada
 * antes de entrar na sessão (e da contagem de dúvidas abertas). Trecho em branco com termo válido não descarta: a tela o esconde.
 */
public final class TermoDeDuvida {

    private TermoDeDuvida() {
    }

    public static boolean semConteudo(String termo) {
        return termo == null || termo.codePoints().noneMatch(Character::isLetterOrDigit);
    }
}
