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
                                  List<String> pendenciasIds, String estado, String erroCodigo,
                                  List<CandidatoAluno> candidatos) {
        @Override
        public String toString() {
            return "GrupoImportavel[id=" + id + ", destino=" + destino + ", estado=" + estado + "]";
        }

        public GrupoImportavel comDestino(String novoDestino, UUID novoAluno, String novoNome) {
            CadastroImportavel cad = cadastro == null ? null : new CadastroImportavel(novoNome, cadastro.email(),
                    cadastro.telefone(), cadastro.objetivo(), cadastro.observacoes(), cadastro.ativo());
            return new GrupoImportavel(id, identificadorOrigem, novoNome, novoDestino, novoAluno, arquivosOrigem, cad,
                    pesos, treino, dieta, pendenciasIds, estado, erroCodigo, candidatos);
        }

        public GrupoImportavel comErro(String codigo) {
            return new GrupoImportavel(id, identificadorOrigem, nomeDetectado, destino, alunoExistenteId, arquivosOrigem,
                    cadastro, pesos, treino, dieta, pendenciasIds, "ERRO", codigo, candidatos);
        }

        public GrupoImportavel comCandidatos(List<CandidatoAluno> novos) {
            return new GrupoImportavel(id, identificadorOrigem, nomeDetectado, destino, alunoExistenteId, arquivosOrigem,
                    cadastro, pesos, treino, dieta, pendenciasIds, estado, erroCodigo, novos);
        }

        public GrupoImportavel comTreinoEDieta(ConteudoTreino novoTreino, ConteudoDieta novaDieta) {
            return new GrupoImportavel(id, identificadorOrigem, nomeDetectado, destino, alunoExistenteId, arquivosOrigem,
                    cadastro, pesos, novoTreino, novaDieta, pendenciasIds, estado, erroCodigo, candidatos);
        }

        /**
         * Grupo já gravado (ou descartado): fica só o esqueleto, sem nome, arquivo, cadastro, peso, treino, dieta nem
         * candidatos. O dado pessoal não precisa mais da sessão depois de gravado (LGPD).
         */
        public GrupoImportavel limpo(String novoEstado, String novoDestino) {
            return new GrupoImportavel(id, "", "Importado", novoDestino, null, List.of(), null, List.of(), null, null,
                    List.of(), novoEstado, null, List.of());
        }

        /** Sem objetivo, observações e peso (dado sensível sem {@code ALUNO_SENSIVEL_LER}), treino e dieta sem as permissões de ler. */
        public GrupoImportavel paraLeitura(boolean sensivel, boolean treinoLer, boolean dietaLer) {
            CadastroImportavel cad = cadastro == null || sensivel ? cadastro : new CadastroImportavel(cadastro.nome(),
                    cadastro.email(), cadastro.telefone(), null, null, cadastro.ativo());
            return new GrupoImportavel(id, identificadorOrigem, nomeDetectado, destino, alunoExistenteId, arquivosOrigem,
                    cad, sensivel ? pesos : List.of(), treinoLer ? treino : null, dietaLer ? dieta : null,
                    pendenciasIds, estado, erroCodigo, candidatos);
        }
    }

    /**
     * Aluno que já existe e pode ser o mesmo da planilha ou do texto. O treinador escolhe: o servidor nunca vincula
     * sozinho por nome (só por e-mail, quando um único aluno ativo o tem).
     */
    public record CandidatoAluno(UUID alunoId, String nome, String motivo) {
        @Override
        public String toString() {
            return "CandidatoAluno[alunoId=" + alunoId + "]";
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

    /**
     * {@code situacao}: {@code CONCLUIDA}, {@code CONCLUIDA_COM_ERROS} (algum grupo ficou com {@code erroCodigo} e pode
     * ser tentado de novo) ou {@code FALHOU}. Peso sem data legível ou repetido na data não é gravado e entra em
     * {@code pesosIgnorados}.
     */
    public record ConfirmacaoResultado(UUID id, String situacao, int gruposImportados, int alunosCriados,
                                       int alunosVinculados, int treinosCriados, int dietasCriadas,
                                       int modelosCriados, int gruposComErro, int pesosGravados,
                                       int pesosIgnorados) {
    }

    public record ApelidoDto(UUID id, String tipo, String termoOriginal, String valorMapeado,
                             UUID referenciaId, Instant criadoEm) {
    }

    public record CriarApelidoRequisicao(String tipo, String termoOriginal, String valorMapeado, UUID referenciaId) {
    }
}
