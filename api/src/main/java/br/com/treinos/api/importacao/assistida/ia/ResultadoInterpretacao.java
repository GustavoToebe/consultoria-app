package br.com.treinos.api.importacao.assistida.ia;

import br.com.treinos.api.dieta.ConteudoDieta;
import br.com.treinos.api.treino.ConteudoTreino;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Estrutura proposta pela interpretação (IA ou Regras) contendo os grupos de alunos/documentos
 * e as dúvidas identificadas a serem resolvidas pelo treinador.
 */
public record ResultadoInterpretacao(List<PropostaGrupo> grupos, List<PropostaDuvida> duvidas) {

    public record PropostaGrupo(String identificadorOrigem, String nomeAluno, String email,
                                String telefone, String objetivo, String observacoes,
                                List<PropostaPeso> pesos, ConteudoTreino treino,
                                ConteudoDieta dieta) {
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
                                 String arquivoOrigem, List<PropostaSugestao> sugestoes) {
        @Override
        public String toString() {
            return "PropostaDuvida[tipo=" + tipo + "]";
        }
    }

    public record PropostaSugestao(String termo, double nota) {
    }

    @Override
    public String toString() {
        return "ResultadoInterpretacao[grupos=" + (grupos == null ? 0 : grupos.size())
                + ", duvidas=" + (duvidas == null ? 0 : duvidas.size()) + "]";
    }
}
