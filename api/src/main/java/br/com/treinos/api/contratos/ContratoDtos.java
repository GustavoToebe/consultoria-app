package br.com.treinos.api.contratos;

import br.com.treinos.api.consultoria.MarcaPublica;
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

    /** {@code signatario}: {@code ALUNO} (padrão) ou {@code RESPONSAVEL} (pelo link); menor de idade segue a regra do servidor (S2). */
    public record GerarContratoRequest(UUID pedidoId, UUID modeloId, UUID contratacaoId, String titulo, String signatario) {
        @Override
        public String toString() {
            return "GerarContratoRequest[...]";
        }
    }

    /** A parte {@code dados} do contrato de PDF próprio (passo 3): o PDF vem na parte {@code arquivo}; não há modelo nem texto. */
    public record GerarContratoPdfRequest(UUID pedidoId, UUID contratacaoId, String titulo, String signatario) {
        @Override
        public String toString() {
            return "GerarContratoPdfRequest[...]";
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

    /** {@code grupoId} liga o par aluno + responsável (16 a 17 anos); {@code linkExpiraEm} só no responsável pendente com link. */
    public record ContratoResumo(UUID id, UUID alunoId, UUID grupoId, String titulo, Origem origem, Signatario signatario,
                                 Situacao situacao, Instant prazoAte, boolean vencido, UUID contratacaoId, Instant geradoEm,
                                 Instant assinadoEm, Instant canceladoEm, Instant linkExpiraEm, Long versao) { }

    /**
     * O link do responsável (D11). {@code codigo} (144 bits) só vem na resposta que o criou: o gerar (201) e o renovar; nas leituras e no
     * reenvio do mesmo {@code pedidoId} vem nulo e o treinador renova. No par, o corpo é o contrato do aluno e {@code contratoId} é o do
     * responsável. O código é segredo: o {@code toString} o esconde.
     */
    public record LinkDoContrato(UUID contratoId, String codigo, Instant expiraEm) {
        @Override
        public String toString() {
            return "LinkDoContrato[" + contratoId + "]";
        }
    }

    /** As evidências do aceite (D2); a equipe com {@code CONTRATO_LER} as lê. O CPF só existe no responsável. */
    public record Assinatura(Instant assinadoEm, String nome, String cpf, String ip, String agente, Boolean declarouResponsavel) {
        @Override
        public String toString() {
            return "Assinatura[...]";
        }
    }

    public record ContratoDetalhe(UUID id, UUID alunoId, UUID grupoId, String titulo, Origem origem, Signatario signatario, Situacao situacao,
                                  Instant prazoAte, boolean vencido, UUID contratacaoId, Instant geradoEm, Instant canceladoEm,
                                  String motivoCancelamento, String texto, String sha256, String geradoPorNome,
                                  Assinatura assinatura, LinkDoContrato link, Long versao) {
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

    // ---- página pública do responsável (código no corpo, nunca no caminho) ----

    public record ConsultarContratoPublicoRequest(String codigo) {
        @Override
        public String toString() {
            return "ConsultarContratoPublicoRequest[...]";
        }
    }

    /** Abrir e baixar o arquivo só respondem com o CPF do responsável conferido. */
    public record AbrirContratoPublicoRequest(String codigo, String cpf) {
        @Override
        public String toString() {
            return "AbrirContratoPublicoRequest[...]";
        }
    }

    public record AssinarContratoPublicoRequest(String codigo, String cpf, String sha256, String nome, Boolean aceite,
                                                Boolean declaroResponsavelLegal) {
        @Override
        public String toString() {
            return "AssinarContratoPublicoRequest[...]";
        }
    }

    /** Só a marca e o título: o link sozinho não mostra texto nem dado do aluno (S3). */
    public record ContratoPublicoConsulta(MarcaPublica consultoria, String titulo) {
        @Override
        public String toString() {
            return "ContratoPublicoConsulta[...]";
        }
    }

    /** O contrato depois do CPF conferido: {@code texto} no modelo, nulo no PDF ({@code temArquivo}). */
    public record ContratoPublicoAberto(String titulo, Origem origem, String texto, boolean temArquivo, String sha256) {
        @Override
        public String toString() {
            return "ContratoPublicoAberto[...]";
        }
    }

    public record ContratoPublicoAssinado(String titulo, String texto, String sha256, Instant assinadoEm, String assinanteNome) {
        @Override
        public String toString() {
            return "ContratoPublicoAssinado[...]";
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
