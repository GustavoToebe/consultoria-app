package br.com.treinos.api.contratos;

import br.com.treinos.api.contratos.ContratoAluno.Origem;
import br.com.treinos.api.contratos.ContratoAluno.Signatario;
import br.com.treinos.api.contratos.ContratoAluno.Situacao;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Contratos HTTP do contrato digital. Texto, CPF, IP e nome do assinante são dado pessoal: o {@code toString} dos records que os
 * levam os esconde. A validação dos corpos é do serviço (422 com {@code fieldErrors}), não de anotação.
 */
public final class ContratoDtos {

    private ContratoDtos() { }

    // ---- modelos ----

    public record ModeloRequest(String nome, String texto, Long versao) {
        @Override
        public String toString() {
            return "ModeloRequest[...]";
        }
    }

    public record ArquivarModeloRequest(Long versao) { }

    public record ModeloResponse(UUID id, String nome, String texto, Instant arquivadoEm, Long versao, Instant atualizadoEm) {
        @Override
        public String toString() {
            return "ModeloResponse[" + id + "]";
        }
    }

    /** O modelo com dados fictícios, só para o treinador ver como fica. */
    public record PreviaDoModelo(String titulo, String texto) {
        @Override
        public String toString() {
            return "PreviaDoModelo[...]";
        }
    }

    // ---- gerar ----

    /** {@code signatario}: {@code ALUNO} (padrão); {@code RESPONSAVEL} só no passo do link. */
    public record GerarContratoRequest(UUID pedidoId, UUID modeloId, UUID contratacaoId, String titulo, String signatario) {
        @Override
        public String toString() {
            return "GerarContratoRequest[...]";
        }
    }

    /** O que falta para gerar: o código do campo do modelo e a frase fixa para a tela. */
    public record Falta(String campo, String mensagem) { }

    public record PreviaDoContrato(String titulo, String texto, List<Falta> faltas, boolean podeGerar) {
        @Override
        public String toString() {
            return "PreviaDoContrato[...]";
        }
    }

    // ---- equipe ----

    public record CancelarRequest(String motivo, Long versao) {
        @Override
        public String toString() {
            return "CancelarRequest[...]";
        }
    }

    public record ProrrogarRequest(Integer dias, Long versao) { }

    public record ContratoResumo(UUID id, UUID alunoId, String titulo, Origem origem, Signatario signatario, Situacao situacao,
                                 Instant prazoAte, boolean vencido, UUID contratacaoId, Instant geradoEm, Instant assinadoEm,
                                 Instant canceladoEm, Long versao) { }

    /** As evidências do aceite (D2); a equipe com {@code CONTRATO_LER} as lê. O CPF só existe no responsável. */
    public record Assinatura(Instant assinadoEm, String nome, String cpf, String ip, String agente) {
        @Override
        public String toString() {
            return "Assinatura[...]";
        }
    }

    public record ContratoDetalhe(UUID id, UUID alunoId, String titulo, Origem origem, Signatario signatario, Situacao situacao,
                                  Instant prazoAte, boolean vencido, UUID contratacaoId, Instant geradoEm, Instant canceladoEm,
                                  String motivoCancelamento, String texto, String sha256, String geradoPorNome,
                                  Assinatura assinatura, Long versao) {
        @Override
        public String toString() {
            return "ContratoDetalhe[" + id + "]";
        }
    }

    // ---- aluno ----

    public record AssinarRequest(String sha256, String nome, Boolean aceite) {
        @Override
        public String toString() {
            return "AssinarRequest[...]";
        }
    }

    public record ContratoDoAlunoResumo(UUID id, String titulo, Origem origem, Signatario signatario, Situacao situacao,
                                        Instant prazoAte, boolean vencido, Instant geradoEm, Instant assinadoEm) { }

    /** O que o aluno vê da própria assinatura: quando e o nome que digitou. Nunca IP nem aparelho. */
    public record AssinaturaDoAluno(Instant assinadoEm, String nome) {
        @Override
        public String toString() {
            return "AssinaturaDoAluno[...]";
        }
    }

    public record ContratoDoAlunoDetalhe(UUID id, String titulo, Origem origem, Signatario signatario, Situacao situacao,
                                         Instant prazoAte, boolean vencido, Instant geradoEm, String texto, String sha256,
                                         AssinaturaDoAluno assinatura) {
        @Override
        public String toString() {
            return "ContratoDoAlunoDetalhe[" + id + "]";
        }
    }

    // ---- exportação (LGPD) ----

    /** O que a consultoria guarda do contrato do aluno; o PDF só como metadado (a seção não leva os bytes). */
    public record ContratoExportado(UUID id, String titulo, Origem origem, Signatario signatario, Situacao situacao,
                                    Instant prazoAte, Instant geradoEm, Instant canceladoEm, String motivoCancelamento,
                                    String texto, String sha256, Assinatura assinatura) {
        @Override
        public String toString() {
            return "ContratoExportado[" + id + "]";
        }
    }
}
