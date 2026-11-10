package br.com.treinos.api.comunidade;

import java.time.LocalDate;
import java.time.Period;
import java.util.List;
import java.util.Set;

/**
 * Regras puras do perfil na comunidade (decisões 2, 9 e 10 do plano {@code perfil-estilo-steam}). Sem estado e sem relógio:
 * quem chama passa o "hoje" de Brasília ({@code Fuso.BRASILIA}).
 */
public final class RegrasDoPerfil {

    /** Treinos concluídos por nível (a mesma base da pontuação do ranking). */
    public static final int TREINOS_POR_NIVEL = 10;
    public static final int MAIORIDADE = 18;
    /** Janela da atividade recente (decisão 8): os últimos 30 dias, contando hoje. */
    public static final int DIAS_DA_ATIVIDADE = 30;
    public static final int MAXIMO_DE_CONQUISTAS_RECENTES = 5;
    public static final int MAXIMO_DE_DESTAQUES = 4;
    public static final int MAXIMO_DE_RECORDES = 10;

    private RegrasDoPerfil() {
    }

    /** Começa no nível 1 e sobe a cada 10 treinos concluídos: {@code 1 + treinos / 10}. Número negativo conta como zero. */
    public static int nivel(long treinosConcluidos) {
        return 1 + (int) (Math.max(0, treinosConcluidos) / TREINOS_POR_NIVEL);
    }

    /**
     * Tem 18 anos completos em {@code hoje}. Sem data, ou com data depois de hoje, não é maior. Quem nasceu em 29/02 completa
     * os anos em 01/03 nos anos comuns (a leitura que erra para o lado de quem protege o menor).
     */
    public static boolean maiorDeIdade(LocalDate dataNascimento, LocalDate hoje) {
        return dataNascimento != null && Period.between(dataNascimento, hoje).getYears() >= MAIORIDADE;
    }

    /** Primeiro dia da atividade recente: {@code hoje} menos 29 dias (30 dias contando hoje). */
    public static LocalDate inicioDaAtividade(LocalDate hoje) {
        return hoje.minusDays(DIAS_DA_ATIVIDADE - 1L);
    }

    /** O dono vê o próprio perfil por inteiro; os colegas só veem o que não está reservado (decisão 3). */
    public static boolean mostraTudo(boolean ehVoce, boolean reservadoEfetivo) {
        return ehVoce || !reservadoEfetivo;
    }

    /**
     * Os destaques que o colega vê: na ordem escolhida, sem repetir, só tipos já ganhos e no máximo 4. Um destaque gravado com
     * tipo que o aluno não tem (ou que deixou de existir) é ignorado em vez de quebrar o perfil.
     */
    public static List<String> destaquesVisiveis(List<String> escolhidos, Set<String> ganhos) {
        return escolhidos.stream().filter(ganhos::contains).distinct().limit(MAXIMO_DE_DESTAQUES).toList();
    }

    /**
     * Se o perfil fica reservado (escondido dos colegas). A escolha explícita do aluno vale sempre; sem escolha, é reservado
     * quando o aluno é menor OU não tem data de nascimento, e visível só quando é maior de idade.
     */
    public static boolean reservadoEfetivo(Boolean escolhaExplicita, LocalDate dataNascimento, LocalDate hoje) {
        if (escolhaExplicita != null) {
            return escolhaExplicita;
        }
        return !maiorDeIdade(dataNascimento, hoje);
    }
}
