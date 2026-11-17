package br.com.treinos.api.comunidade;

import br.com.treinos.api.alunos.VotanteDaComunidade;

import java.util.regex.Pattern;

/**
 * O único ponto que monta o nome de um aluno para OUTRO aluno (mural, comentários, votos, Colegas, perfil do colega). Só o servidor
 * monta: o nome completo nunca sai quando a escolha não é {@link ExibicaoDoNome#NOME_COMPLETO}. Função pura, sem banco.
 */
public final class NomeExibido {

    private static final String SEM_NOME = "Membro";
    private static final Pattern ESPACOS = Pattern.compile("[\\p{javaWhitespace}\\p{Zs}]+");

    private NomeExibido() {}

    /** Nome e apelido prontos para o visualizador; {@code apelido} é nulo para aluno (já entrou no nome) e para quem não tem. */
    public record Nome(String nome, String apelido) {}

    /**
     * Um aluno (qualquer situação) visto por quem pede. Equipe: {@code nomeParaEquipe} (o nome completo gravado) e o apelido, só de
     * aluno ativo. Aluno: o nome montado por {@link #paraColegas} a partir do aluno de hoje e apelido nulo; o inativo perde o
     * apelido (cai no primeiro nome) e o anonimizado mostra {@code nomeParaEquipe}, que já é o texto anonimizado.
     */
    public static Nome doAluno(boolean paraAluno, VotanteDaComunidade a, String nomeParaEquipe) {
        boolean anonimizado = a.anonimizadoEm() != null;
        String apelido = a.ativo() && !anonimizado ? a.apelido() : null;
        if (!paraAluno) {
            return new Nome(nomeParaEquipe, apelido);
        }
        return new Nome(anonimizado ? nomeParaEquipe : paraColegas(a.exibicaoDoNome(), a.nome(), apelido), null);
    }

    /**
     * {@code exibicao} nula = {@link ExibicaoDoNome#PADRAO}. {@code APELIDO} e {@code NOME_E_APELIDO} sem apelido caem no primeiro
     * nome. Primeiro nome = primeira palavra do nome sem espaços nas pontas, com a caixa que o aluno cadastrou.
     */
    public static String paraColegas(ExibicaoDoNome exibicao, String nomeCompleto, String apelido) {
        String completo = nomeCompleto == null ? "" : ESPACOS.matcher(nomeCompleto.strip()).replaceAll(" ");
        if (completo.isEmpty()) {
            return SEM_NOME;
        }
        String primeiro = completo.substring(0, completo.indexOf(' ') < 0 ? completo.length() : completo.indexOf(' '));
        boolean temApelido = apelido != null && !apelido.isBlank();
        return switch (exibicao == null ? ExibicaoDoNome.PADRAO : exibicao) {
            case NOME_COMPLETO -> completo;
            case APELIDO -> temApelido ? apelido : primeiro;
            case NOME_E_APELIDO -> temApelido ? primeiro + " (" + apelido + ")" : primeiro;
            case NOME -> primeiro;
        };
    }
}
