package br.com.treinos.api.importacao.assistida.ia;

import br.com.treinos.api.dieta.ConteudoDieta;
import br.com.treinos.api.treino.ConteudoTreino;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Estrutura proposta pela interpretação (IA ou Regras) contendo os grupos de alunos/documentos
 * e as dúvidas identificadas a serem resolvidas pelo treinador.
 */
public record ResultadoInterpretacao(List<PropostaGrupo> grupos, List<PropostaDuvida> duvidas) {

    public record PropostaGrupo(String identificadorOrigem, String nomeAluno, String email,
                                String telefone, String objetivo, String observacoes,
                                List<PropostaPeso> pesos, ConteudoTreino treino,
                                ConteudoDieta dieta, List<String> avisos) {
        public PropostaGrupo {
            avisos = avisos == null ? List.of() : List.copyOf(avisos);
        }

        /** Sem avisos de corte (regras locais e testes). */
        public PropostaGrupo(String identificadorOrigem, String nomeAluno, String email, String telefone,
                             String objetivo, String observacoes, List<PropostaPeso> pesos, ConteudoTreino treino,
                             ConteudoDieta dieta) {
            this(identificadorOrigem, nomeAluno, email, telefone, objetivo, observacoes, pesos, treino, dieta, List.of());
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
