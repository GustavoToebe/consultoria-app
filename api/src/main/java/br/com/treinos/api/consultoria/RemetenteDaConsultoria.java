package br.com.treinos.api.consultoria;

import br.com.plataforma.comum.auth.EmailsDeAcesso;
import br.com.plataforma.comum.auth.EnviadorDeEmail;

/**
 * O único ponto que decide como o e-mail da consultoria (lembrete de cobrança, convite de equipe) se apresenta: nome de quem
 * envia, para onde a resposta vai e, no futuro (domínio próprio, nível 2), o endereço. As regras de nome e de endereço são
 * as da biblioteca ({@link EnviadorDeEmail.Mensagem}), para um valor que a Marca aceita nunca estourar no envio.
 * Quem chama já leu a {@link Consultoria} (dentro do tenant ou, para o job, pelo id): nada aqui toca o banco.
 */
public final class RemetenteDaConsultoria {

    /** Os três opcionais da {@link EnviadorDeEmail.Mensagem}; nulo = sem. {@code toString} não mostra nada. */
    public record Remetente(String nomeRemetente, String responderPara, String remetente) {

        @Override
        public String toString() {
            return "Remetente[***]";
        }
    }

    private RemetenteDaConsultoria() {
    }

    /** Nome escolhido na Marca; sem ele, o nome da consultoria saneado (nulo se nada sobrar). {@code remetente} é sempre nulo no nível 1. */
    public static Remetente de(Consultoria c) {
        String nome = c.getEmailRemetenteNome() != null && !c.getEmailRemetenteNome().isBlank() ? c.getEmailRemetenteNome()
                : sanear(c.getNome());
        return new Remetente(nome, c.getEmailResponderPara(), null);
    }

    /** A regra de nome é só a da biblioteca: não vazio, até {@value EnviadorDeEmail#NOME_REMETENTE_MAXIMO} caracteres e sem o que ela recusa. */
    public static boolean nomeValido(String nome) {
        return EnviadorDeEmail.nomeValido(nome);
    }

    /** A regra de endereço é só a da biblioteca (inclui o limite de 254 caracteres). */
    public static boolean enderecoValido(String endereco) {
        return EmailsDeAcesso.enderecoValido(endereco);
    }

    /** Tira o que a biblioteca recusa e corta no máximo; nulo se sobrar vazio. */
    static String sanear(String nome) {
        if (nome == null) {
            return null;
        }
        String limpo = nome.codePoints().filter(c -> !EnviadorDeEmail.proibidoNoNomeDoRemetente(c)).collect(StringBuilder::new,
                StringBuilder::appendCodePoint, StringBuilder::append).toString().strip();
        if (limpo.codePointCount(0, limpo.length()) > EnviadorDeEmail.NOME_REMETENTE_MAXIMO) {
            limpo = limpo.substring(0, limpo.offsetByCodePoints(0, EnviadorDeEmail.NOME_REMETENTE_MAXIMO)).strip();
        }
        return limpo.isEmpty() ? null : limpo;
    }
}
