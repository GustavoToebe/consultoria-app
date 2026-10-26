package br.com.treinos.api.inscricoes;

import br.com.treinos.api.alunos.dto.AlunoDtos.ConviteResponse;
import br.com.treinos.api.consultoria.MarcaPublica;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Contratos HTTP da inscrição por link (pública) e da fila de interessados (equipe). */
public final class InscricaoDtos {

    private InscricaoDtos() { }

    // ---- Público ----

    /** O que a página pública mostra: a marca (com a URL pública da logo, se houver) e o texto da consultoria. */
    public record InscricaoPublica(MarcaPublica consultoria, String texto, boolean aberta) {
    }

    /**
     * Corpo da inscrição. A consultoria e o responsável saem do código do link, nunca daqui. {@code cienciaPrivacidade}
     * é obrigatória (true) quando a consultoria tem texto.
     */
    public record InscricaoPublicaRequest(
            @NotBlank @Size(max = 120) String nome,
            @NotBlank @Size(max = 30) String whatsapp,
            @Email @Size(max = 254) String email,
            @Size(max = 500) String objetivo,
            @Size(max = 1000) String observacao,
            Boolean cienciaPrivacidade,
            /** Token do Turnstile (uso único); só é exigido com a verificação humana ligada. */
            @Size(max = 2048) String turnstileToken,
            @Size(max = 10) String sexo) {
    }

    /** Resposta neutra: não diz nada sobre a fila nem sobre outras inscrições. */
    public record InscricaoRecebida(String mensagem) {
    }

    // ---- Configuração do link ----

    /** {@code codigo} e {@code link} nulos até o link ser gerado pela primeira vez. */
    public record ConfiguracaoResponse(boolean aberta, String codigo, String link, UUID responsavelId, String texto,
                                       Long versao) {
    }

    /** {@code versao} nula só quando ainda não há configuração; {@code responsavelId} nulo = sem responsável. */
    public record ConfiguracaoRequest(@NotNull Boolean aberta, UUID responsavelId, @Size(max = 2000) String texto,
                                      Long versao) {
    }

    public record NovoLinkRequest(Long versao) {
    }

    // ---- Fila ----

    /**
     * Possível duplicidade, só como aviso: aluno da consultoria com o mesmo e-mail ({@code alunoId} só para quem pode ver
     * alunos) e outras inscrições ainda em atendimento com o mesmo e-mail ou WhatsApp. Nada é fundido sozinho.
     */
    public record Duplicidade(boolean alunoExistente, UUID alunoId, int outrasInscricoesAbertas) {
        public static final Duplicidade NENHUMA = new Duplicidade(false, null, 0);
    }

    public record InscricaoResumo(UUID id, String nome, String objetivo, String whatsapp, String email,
                                  SituacaoInscricao situacao, PagamentoInscricao pagamento, UUID responsavelId,
                                  String responsavelNome, UUID alunoId, Instant criadaEm, Duplicidade duplicidade) {
    }

    public record PaginaInscricoes(List<InscricaoResumo> itens, long total) {
    }

    public record Nota(UUID id, String texto, UUID autorId, String autorNome, Instant criadaEm) {
    }

    public record InscricaoDetalhe(UUID id, String nome, String whatsapp, String email, String objetivo,
                                   String observacao, Instant cienciaEm, String cienciaTexto,
                                   SituacaoInscricao situacao, PagamentoInscricao pagamento,
                                   String pagamentoConfirmadoPorNome, Instant pagamentoConfirmadoEm,
                                   UUID responsavelId, String responsavelNome, UUID alunoId, Instant criadaEm,
                                   Instant atualizadaEm, Long versao, Duplicidade duplicidade, List<Nota> notas,
                                   String sexo) {
    }

    /**
     * Andamento: situação (não aceita {@code ACEITA} nem {@code RECUSADA}, que têm rota própria), pagamento e
     * responsável ({@code null} = sem responsável). Sempre os três, com a {@code versao} lida.
     */
    public record AlterarInscricaoRequest(@NotNull SituacaoInscricao situacao, @NotNull PagamentoInscricao pagamento,
                                          UUID responsavelId, @NotNull Long versao) {
    }

    public record NotaRequest(@NotBlank @Size(max = 2000) String texto) {
    }

    public record VersaoRequest(@NotNull Long versao) {
    }

    /** {@code convidar}: gera o convite de acesso ao app do aluno criado (o link sai só nesta resposta). */
    public record AceitarRequest(@NotNull Boolean convidar, @NotNull Long versao) {
    }

    // ---- Privacidade ----

    /**
     * Exportação do titular (LGPD): a inscrição pelo link que virou o aluno, com o que a pessoa escreveu, a ciência e as
     * notas da equipe sobre ela (sem o autor, que é dado da equipe).
     */
    public record InscricaoExportada(Instant criadaEm, String nome, String whatsapp, String email, String objetivo,
                                     String observacao, Instant cienciaEm, String cienciaTexto,
                                     List<NotaExportada> notas, String sexo) {
    }

    public record NotaExportada(Instant criadaEm, String texto) {
    }

    /** {@code id} = a inscrição (a auditoria lê o id daqui); {@code convite} nulo sem convite. */
    public record AceiteResponse(UUID id, UUID alunoId, ConviteResponse convite) {
    }
}
