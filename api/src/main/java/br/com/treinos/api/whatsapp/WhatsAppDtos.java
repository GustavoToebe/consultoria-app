package br.com.treinos.api.whatsapp;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;

/**
 * Corpos e respostas do WhatsApp. O token de acesso só entra ({@link ConexaoRequest}): nenhuma resposta o devolve, e o
 * {@code toString} do pedido o esconde.
 */
public final class WhatsAppDtos {

    private WhatsAppDtos() {
    }

    /** {@code accessToken} em branco numa conexão que já existe mantém o gravado; na criação ele é obrigatório. */
    public record ConexaoRequest(@NotNull @Size(max = 40) String phoneNumberId, @NotNull @Size(max = 40) String wabaId,
                                 @Size(max = 1024) String accessToken, Long versao) {

        @Override
        public String toString() {
            return "ConexaoRequest[...]";
        }
    }

    /** {@code tokenGravadoEm} é o que a tela mostra no lugar do token. Sem conexão, só {@code configurada=false}. */
    public record ConexaoResponse(boolean habilitado, boolean configurada, String phoneNumberId, String wabaId,
                                  Instant tokenGravadoEm, Long versao) {
    }

    public record ModeloRequest(@NotNull @Size(max = 512) String nome, @NotNull @Size(max = 10) String idioma, Long versao) {
    }

    /**
     * Um tipo de aviso na tela. {@code configurado} falso = sem modelo (nada é enviado desse tipo). {@code situacao} é o que a
     * Meta diz agora do modelo ({@code APPROVED}, {@code PENDING}, {@code REJECTED}, ...), {@code NAO_ENCONTRADO} se ela não o
     * conhece com esse nome e idioma, {@code INDISPONIVEL} se não deu para perguntar (sem conexão, token recusado, Meta fora) e
     * nulo sem modelo configurado.
     */
    public record ModeloResponse(TipoDeAviso tipo, boolean configurado, String nome, String idioma, String situacao, Long versao,
                                 String textoSugerido, List<String> variaveis) {
    }

    public record ModelosResponse(List<ModeloResponse> modelos) {
    }

    public record AvisosDoAlunoRequest(@NotNull Boolean receber) {
    }

    /**
     * O que o aluno vê no interruptor: {@code receber} (a escolha dele), {@code disponivel} (a consultoria está conectada) e
     * {@code temTelefone} (sem telefone no cadastro o aviso não tem para onde ir).
     */
    public record AvisosDoAlunoResponse(boolean receber, boolean disponivel, boolean temTelefone) {
    }

    /** A seção {@code avisosPeloWhatsApp} da exportação do aluno: a escolha e o histórico, sem texto, telefone nem nome. */
    public record AvisosExportados(Instant autorizadoEm, List<EnvioExportado> envios) {
    }

    public record EnvioExportado(TipoDeAviso tipo, String situacao, Instant criadoEm, Instant enviadoEm, Instant entregueEm,
                                 Instant lidoEm) {
    }
}
