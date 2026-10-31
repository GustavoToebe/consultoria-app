package br.com.treinos.api.importacao.completa;

import java.util.List;
import java.util.Map;

/**
 * Resposta da análise da planilha completa. Só contagens, tipos, números de coluna e de linha, nomes das abas e, nas
 * perguntas, nomes de exercício e de alimento (que não são dado pessoal). Nunca nome, telefone, e-mail, peso, dieta nem
 * observação de aluno. Nada disso é guardado.
 */
public final class PlanilhaCompletaDtos {

    private PlanilhaCompletaDtos() {
    }

    /**
     * {@code problemas} traz até {@link AnaliseDaPlanilha#PROBLEMAS_NA_RESPOSTA} itens ({@code problemasAlem} = os que
     * ficaram fora); {@code problemasPorTipo} conta todos.
     */
    public record Analise(List<Aba> abas, List<Ligacao> ligacoes, Resumo resumo, List<Problema> problemas,
                          int problemasAlem, Map<String, Integer> problemasPorTipo, List<Pergunta> exercicios,
                          List<Pergunta> alimentos) {
    }

    /** {@code linhaDoCabecalho} = número da linha no arquivo (0 = sem cabeçalho); {@code campos} = campo → coluna (0 = A). */
    public record Aba(int indice, String nome, String tipo, int linhaDoCabecalho, int linhas, Map<String, Integer> campos,
                      List<Aviso> avisos) {
    }

    public record Aviso(String codigo, int linha, int coluna) {
    }

    public record Ligacao(int abaFilha, int colunaFilha, int abaMae, int colunaMae, String por, int ligadas,
                          int naoLigadas, int ambiguas) {
    }

    /**
     * {@code alunosInativos} = alunos com status diferente de ativo (só contados); {@code pesos} = linhas do histórico
     * aproveitáveis; {@code pesosIniciais} = pesos iniciais do cadastro que o histórico não tem (contam como peso) e
     * {@code pesosIniciaisNoHistorico} = os que ele já tem.
     */
    public record Resumo(int alunos, int alunosInativos, int pesos, int pesosIniciais, int pesosIniciaisNoHistorico,
                         int treinos, int exercicios, int refeicoes, int itensDeDieta,
                         int suplementos, int exerciciosNaLista, Contagem nomesDeExercicio, Contagem nomesDeAlimento,
                         int prescricoes, int prescricoesNaoEntendidas, int prescricoesComSobra, int faixasRecuperadasDeData) {
    }

    /** Nomes distintos (pela chave do {@link CasamentoDeNomes}) em cada nível. */
    public record Contagem(int certo, int provavel, int nenhum) {
    }

    public record Problema(String aba, int linha, String campo, String tipo) {
    }

    /**
     * Nome que pede confirmação: {@code PROVAVEL} (com a sugestão) ou {@code NENHUM}. {@code origem} = de onde veio a
     * sugestão ({@code BIBLIOTECA} ou {@code PLANILHA}); nula sem sugestão.
     */
    public record Pergunta(String nome, String nivel, String sugestao, String origem, double nota, int ocorrencias) {
    }
}
