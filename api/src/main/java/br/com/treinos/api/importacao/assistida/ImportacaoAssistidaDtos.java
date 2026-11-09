package br.com.treinos.api.importacao.assistida;

import br.com.treinos.api.dieta.ConteudoDieta;
import br.com.treinos.api.treino.ConteudoTreino;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * DTOs para a importação assistida por IA e resolução interativa de pendências.
 * Nenhum dado pessoal é exposto no toString() para resguardar a LGPD em logs.
 */
public final class ImportacaoAssistidaDtos {

    private ImportacaoAssistidaDtos() {
    }

    public record CriarSessaoRequisicao(String objetivo) {
    }

    public record AdicionarTextoRequisicao(String titulo, String conteudo) {
        @Override
        public String toString() {
            return "AdicionarTextoRequisicao[titulo=" + titulo + "]";
        }
    }

    public record RespostaDuvidaRequisicao(String duvidaId, String respostaEscolhida, boolean salvarNoDicionario,
                                          String tipo, String termoOriginal, UUID referenciaId) {
        @Override
        public String toString() {
            return "RespostaDuvidaRequisicao[duvidaId=" + duvidaId + ", salvarNoDicionario=" + salvarNoDicionario + "]";
        }
    }

    public record AtualizarGrupoRequisicao(String destino, UUID alunoExistenteId, String nome) {
        @Override
        public String toString() {
            return "AtualizarGrupoRequisicao[destino=" + destino + "]";
        }
    }

    public record ConfirmarSessaoRequisicao(List<String> gruposIds, int revisaoEsperada) {
    }

    public record SessaoDetalhe(UUID id, String objetivo, String estado, int revisao,
                                List<ArquivoResumo> arquivos, List<GrupoImportavel> grupos,
                                List<DuvidaImportacao> duvidas, Instant criadoEm, Instant expiraEm) {
        @Override
        public String toString() {
            return "SessaoDetalhe[id=" + id + ", estado=" + estado + ", revisao=" + revisao + "]";
        }
    }

    public record ArquivoResumo(UUID id, String nomeOriginal, String formato, long tamanhoBytes,
                                String estado, String erroCodigo, Instant criadoEm) {
        @Override
        public String toString() {
            return "ArquivoResumo[id=" + id + ", formato=" + formato + ", estado=" + estado + "]";
        }
    }

    public record GrupoImportavel(String id, String identificadorOrigem, String nomeDetectado, String destino,
                                  UUID alunoExistenteId, List<String> arquivosOrigem, CadastroImportavel cadastro,
                                  List<PesoImportavel> pesos, ConteudoTreino treino, ConteudoDieta dieta,
                                  List<String> pendenciasIds, String estado) {
        @Override
        public String toString() {
            return "GrupoImportavel[id=" + id + ", destino=" + destino + ", estado=" + estado + "]";
        }
    }

    public record CadastroImportavel(String nome, String email, String telefone, String objetivo,
                                    String observacoes, Boolean ativo) {
        @Override
        public String toString() {
            return "CadastroImportavel";
        }
    }

    public record PesoImportavel(LocalDate data, BigDecimal kg, String observacao) {
        @Override
        public String toString() {
            return "PesoImportavel";
        }
    }

    public record DuvidaImportacao(String id, String tipo, String termoOriginal, String trechoOriginal,
                                   String arquivoOrigem, int ocorrencias, List<SugestaoDuvida> sugestoes,
                                   boolean resolvida, String respostaEscolhida) {
        @Override
        public String toString() {
            return "DuvidaImportacao[id=" + id + ", tipo=" + tipo + ", resolvida=" + resolvida + "]";
        }
    }

    public record SugestaoDuvida(String termo, UUID referenciaId, String origem, double nota) {
    }

    public record ConfirmacaoResultado(UUID id, String situacao, int gruposImportados, int alunosCriados,
                                       int alunosVinculados, int treinosCriados, int dietasCriadas,
                                       int modelosCriados) {
    }

    public record ApelidoDto(UUID id, String tipo, String termoOriginal, String valorMapeado,
                             UUID referenciaId, Instant criadoEm) {
    }

    public record CriarApelidoRequisicao(String tipo, String termoOriginal, String valorMapeado, UUID referenciaId) {
    }
}
