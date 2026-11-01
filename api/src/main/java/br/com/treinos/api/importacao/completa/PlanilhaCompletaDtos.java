package br.com.treinos.api.importacao.completa;

import java.util.List;
import java.util.Map;
import java.util.UUID;

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
     * ficaram fora); {@code problemasPorTipo} conta todos. {@code respostasSalvas} = quantas respostas de importações
     * anteriores a consultoria tem guardadas (as que valem aqui voltam marcadas nas abas e nas perguntas).
     */
    public record Analise(List<Aba> abas, List<Ligacao> ligacoes, Resumo resumo, List<Problema> problemas,
                          int problemasAlem, Map<String, Integer> problemasPorTipo, List<Pergunta> exercicios,
                          List<Pergunta> alimentos, List<PerguntaDeSuplemento> suplementos, int respostasSalvas) {
    }

    /**
     * Nome da aba de suplementos e para onde vai sem resposta: {@code sugestao} {@code SUPLEMENTO} ou {@code SENSIVEL}
     * pela biblioteca; nula = nenhuma biblioteca reconhece (sem resposta vai para Medicação e ergogênicos). Só aparece a
     * quem pode gravar a dieta. {@code destinoSalvo} = o destino que o treinador deu a este nome numa importação
     * anterior (nulo sem resposta salva).
     */
    public record PerguntaDeSuplemento(String nome, String sugestao, int ocorrencias, String destinoSalvo) {
    }

    /**
     * {@code linhaDoCabecalho} = número da linha no arquivo (0 = sem cabeçalho); {@code campos} = campo → coluna (0 = A).
     * {@code formato}: {@code TABELA} (liga por coluna), {@code UM_ALUNO} (a aba é de um aluno, pelo nome dela) ou
     * {@code BLOCOS} (vários alunos, cada um com o nome em cima da tabela); {@code blocos} = as tabelas da aba de um aluno
     * ou em blocos (vazio na tabela). {@code tipoSalvo} = o tipo que o treinador deu a esta aba (pelos títulos das
     * colunas) numa importação anterior, nulo sem resposta salva.
     */
    public record Aba(int indice, String nome, String tipo, int linhaDoCabecalho, int linhas, Map<String, Integer> campos,
                      List<Aviso> avisos, String formato, List<BlocoDaAba> blocos, String tipoSalvo) {
    }

    /**
     * Uma tabela da aba de um aluno ou em blocos: a linha do cabeçalho, o tipo, o aluno como está na planilha (o nome da
     * aba ou o título do bloco; nulo = nenhum), a {@code situacao} dele ({@code PLANILHA} = está na aba de alunos,
     * {@code EXISTENTE} = já é aluno da consultoria, {@code NOVO} = entra só com o nome, {@code AMBIGUO} = há mais de um
     * aluno com o nome e o bloco não entra, {@code SEM_ALUNO}), o título da tabela (divisão ou refeição) e as linhas.
     * Só volta ao próprio treinador, na análise; nada disso é guardado.
     */
    public record BlocoDaAba(int linha, String tipo, String aluno, String situacao, String titulo, int linhas) {
        @Override
        public String toString() {
            return "BlocoDaAba[linha=" + linha + "]"; // nunca o nome do aluno
        }
    }

    public record Aviso(String codigo, int linha, int coluna) {
    }

    /** {@code pendentes}: até 200 linhas ambíguas da filha, cada uma com as linhas da mãe que ela pode ser. */
    public record Ligacao(int abaFilha, int colunaFilha, int abaMae, int colunaMae, String por, int ligadas,
                          int naoLigadas, int ambiguas, List<LinhaAmbigua> pendentes) {
    }

    /** Linha (no arquivo) da aba filha e as linhas (no arquivo) da aba mãe com o mesmo nome. */
    public record LinhaAmbigua(int linha, List<Integer> candidatas) {
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
     * sugestão ({@code BIBLIOTECA} ou {@code PLANILHA}); nula sem sugestão. {@code respostaSalva} e {@code idSalvo} = a
     * resposta dada a este nome numa importação anterior ({@code ACEITAR} só volta com sugestão; {@code BIBLIOTECA} só
     * com o item ainda ativo), nulas sem resposta salva.
     */
    public record Pergunta(String nome, String nivel, String sugestao, String origem, double nota, int ocorrencias,
                           String respostaSalva, UUID idSalvo) {
    }

    // ------------------------------------------------------------------------------------- prévia e confirmação

    /**
     * Prévia da gravação: nada foi gravado. {@code hash} vai de volta na confirmação (arquivo + respostas); {@code criacao}
     * só conta; {@code partesPuladas} são as partes que o perfil não pode gravar; {@code pendencias} o que ainda pede
     * resposta (sem resposta vale a regra fixa); {@code validacaoDosTreinos} = erros e avisos que a publicação apontaria
     * nos treinos montados (só contados: o treino entra em rascunho de qualquer forma).
     */
    public record Previa(String hash, Criacao criacao, List<PartePulada> partesPuladas, Pendencias pendencias,
                         Validacao validacaoDosTreinos, List<Problema> problemas, int problemasAlem,
                         Map<String, Integer> problemasPorTipo) {
    }

    /**
     * O que vai ser (ou foi) criado. {@code pastas} = uma por aluno com treino ou dieta; treinos e dietas sempre em
     * rascunho. {@code itensLigados} = itens de dieta ligados a um alimento da biblioteca (o resto fica com o nome e os
     * valores da planilha). {@code ergogenicosPulados} = linhas de medicação e ergogênicos que ficaram fora por falta de
     * ERGOGENICO_ALTERAR.
     */
    public record Criacao(int alunosNovos, int alunosNovosInativos, int alunosReaproveitados, int pesos, int pesosIniciais,
                          int pesosJaRegistrados, int exercicios, int pastas, int treinos, int sessoes,
                          int exerciciosNosTreinos, int exerciciosLigados, int series, int dietas, int refeicoes, int itens,
                          int itensLigados, int suplementos, int ergogenicos, int ergogenicosPulados,
                          int faixasRecuperadasDeData) {
    }

    /** Parte que não entra por falta de permissão: {@code parte} (PESOS, EXERCICIOS, TREINO, DIETA...) e a que falta. */
    public record PartePulada(String parte, String permissao) {
    }

    public record Pendencias(int exerciciosProvaveis, int alimentosProvaveis, int ligacoesAmbiguas,
                             int suplementosSemClassificacao) {
    }

    public record Validacao(int erros, int avisos) {
    }

    /** Resultado da confirmação: a importação gravada (o histórico e o "Desfazer" usam o {@code importacaoId}). */
    public record Confirmacao(UUID importacaoId, String situacao, Criacao criados, List<PartePulada> partesPuladas,
                              Validacao validacaoDosTreinos, int problemas, Map<String, Integer> problemasPorTipo) {
    }

    // ------------------------------------------------------------------------------------------------- desfazer

    /**
     * {@code partes}: por tipo ({@code PLANO_TREINO}, {@code PLANO_DIETA}, {@code PASTA}, {@code PESO},
     * {@code EXERCICIO}, {@code ALUNO}), quantos foram apagados agora e quantos ficaram, com os motivos contados.
     * {@code ficaram} lista os que ficaram (tipo, id e motivo, até {@link DesfazerDaPlanilha#ITENS_QUE_FICARAM}): só ids,
     * nunca nome. Repetir o desfazer não apaga de novo e devolve o que ainda ficou.
     */
    public record Desfeita(UUID importacaoId, List<ParteDesfeita> partes, List<Ficou> ficaram, int ficaramAlem) {
    }

    public record ParteDesfeita(String tipo, int apagados, int ficaram, Map<String, Integer> motivos) {
    }

    /**
     * {@code motivo}: {@code PUBLICADO} (plano já publicado), {@code COM_PLANOS} (pasta com plano que ficou),
     * {@code EM_USO} (o item é usado por algo criado depois: plano publicado, modelo, outro rascunho, registro,
     * compromisso...), {@code COM_ACESSO} (aluno que já tem acesso ao app), {@code COM_REGISTROS} (aluno com treino
     * registrado) ou {@code SEM_PERMISSAO} (o perfil de quem desfaz não pode apagar este tipo).
     */
    public record Ficou(String tipo, UUID id, String motivo) {
    }
}
