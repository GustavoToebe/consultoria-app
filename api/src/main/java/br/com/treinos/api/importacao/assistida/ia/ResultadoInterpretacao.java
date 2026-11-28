package br.com.treinos.api.importacao.assistida.ia;

import br.com.treinos.api.dieta.ConteudoDieta;
import br.com.treinos.api.importacao.assistida.PistaDeIdentidade;
import br.com.treinos.api.treino.ConteudoTreino;
import br.com.treinos.api.web.Buscas;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Estrutura proposta pela interpretação (IA ou Regras) contendo os grupos de alunos/documentos
 * e as dúvidas identificadas a serem resolvidas pelo treinador. {@code uso} é o que o provedor gastou (nulo nas regras):
 * só serve ao registro de uso do roteador.
 */
public record ResultadoInterpretacao(List<PropostaGrupo> grupos, List<PropostaDuvida> duvidas, Uso uso) {

    public ResultadoInterpretacao(List<PropostaGrupo> grupos, List<PropostaDuvida> duvidas) {
        this(grupos, duvidas, null);
    }

    public ResultadoInterpretacao comUso(Uso outro) {
        return new ResultadoInterpretacao(grupos, duvidas, outro);
    }

    /** Uma chamada ao provedor: modelo, motivo da parada e tokens. Nada do conteúdo. */
    public record Uso(String modelo, String parada, long tokensEntrada, long tokensSaida, long cacheLido,
                      long cacheGravado) {
    }

    /**
     * De onde veio o nome do aluno. Só {@link #CONTEUDO} traz {@code nomeAluno}: nos outros ele é nulo e o substituto
     * para a tela ("Aluno N", o nome do arquivo) é do serviço, que tem {@code identificadorOrigem}.
     */
    public enum OrigemDoNome {
        /** Escrito no documento: o cabeçalho nas regras ou o {@code nomeAluno} da IA. Só este junta sozinho. */
        CONTEUDO,
        /** Só o nome do arquivo (ou o título digitado no texto colado) parece um nome. */
        NOME_DO_ARQUIVO,
        /** Texto colado com o título padrão ("Texto livre..."): repete entre textos de alunos diferentes. */
        TITULO_DO_TEXTO,
        /** Nada que pareça nome. */
        AUSENTE,
        /**
         * O treinador escreveu o nome na revisão ({@code PUT} do grupo) de um grupo sem nome lido. Nunca vem dos
         * interpretadores; destrava a gravação, mas não junta sozinho nem entra na trava por nome.
         */
        DIGITADO;

        /** O documento não trouxe nome: o que sobra do nome do arquivo (ou do título do texto colado). */
        public static OrigemDoNome semNomeNoConteudo(String nomeArquivo, String formato) {
            if ("TEXTO_LIVRE".equals(formato) && Buscas.semAcento(nomeArquivo).startsWith("texto livre")) {
                return TITULO_DO_TEXTO;
            }
            return PistaDeIdentidade.extrairDoNomeDoArquivo(nomeArquivo).isEmpty() ? AUSENTE : NOME_DO_ARQUIVO;
        }
    }

    public record PropostaGrupo(String identificadorOrigem, String nomeAluno, String email,
                                String telefone, String objetivo, String observacoes,
                                List<PropostaPeso> pesos, ConteudoTreino treino,
                                ConteudoDieta dieta, List<String> avisos, OrigemDoNome origemDoNome) {
        public PropostaGrupo {
            avisos = avisos == null ? List.of() : List.copyOf(avisos);
            if (origemDoNome == null) {
                origemDoNome = nomeAluno == null || nomeAluno.isBlank() ? OrigemDoNome.AUSENTE : OrigemDoNome.CONTEUDO;
            }
        }

        /**
         * Origem deduzida do nome (nulo = {@link OrigemDoNome#AUSENTE}): para quem copia um grupo sem repassar a origem.
         * Quem copia deve preferir o canônico, senão {@code NOME_DO_ARQUIVO} e {@code TITULO_DO_TEXTO} viram {@code AUSENTE}.
         */
        public PropostaGrupo(String identificadorOrigem, String nomeAluno, String email, String telefone,
                             String objetivo, String observacoes, List<PropostaPeso> pesos, ConteudoTreino treino,
                             ConteudoDieta dieta, List<String> avisos) {
            this(identificadorOrigem, nomeAluno, email, telefone, objetivo, observacoes, pesos, treino, dieta, avisos, null);
        }

        /** Sem avisos de corte e com a origem deduzida do nome (testes). */
        public PropostaGrupo(String identificadorOrigem, String nomeAluno, String email, String telefone,
                             String objetivo, String observacoes, List<PropostaPeso> pesos, ConteudoTreino treino,
                             ConteudoDieta dieta) {
            this(identificadorOrigem, nomeAluno, email, telefone, objetivo, observacoes, pesos, treino, dieta, List.of(), null);
        }

        @Override
        public String toString() {
            return "PropostaGrupo[origem=" + identificadorOrigem + "]";
        }
    }

    public record PropostaPeso(LocalDate data, BigDecimal kg, String observacao) {
        @Override
        public String toString() {
            return "PropostaPeso";
        }
    }

    public record PropostaDuvida(String tipo, String termoOriginal, String trechoOriginal,
                                 String arquivoOrigem, List<PropostaSugestao> sugestoes,
                                 List<String> ocorrenciaIds) {
        public PropostaDuvida {
            ocorrenciaIds = ocorrenciaIds == null ? List.of() : ocorrenciaIds;
        }

        public PropostaDuvida(String tipo, String termoOriginal, String trechoOriginal,
                              String arquivoOrigem, List<PropostaSugestao> sugestoes) {
            this(tipo, termoOriginal, trechoOriginal, arquivoOrigem, sugestoes, List.of());
        }

        @Override
        public String toString() {
            return "PropostaDuvida[tipo=" + tipo + "]";
        }
    }

    public record PropostaSugestao(String termo, UUID referenciaId, Double nota) {
        public PropostaSugestao(String termo, Double nota) {
            this(termo, null, nota);
        }
    }

    @Override
    public String toString() {
        return "ResultadoInterpretacao[grupos=" + (grupos == null ? 0 : grupos.size())
                + ", duvidas=" + (duvidas == null ? 0 : duvidas.size()) + "]";
    }
}
