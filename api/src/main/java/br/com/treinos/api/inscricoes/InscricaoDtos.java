package br.com.treinos.api.inscricoes;

import br.com.treinos.api.alunos.dto.AlunoDtos.ConviteResponse;
import br.com.treinos.api.consultoria.MarcaPublica;
import br.com.treinos.api.inscricoes.Crm.AcaoDaMensagem;
import br.com.treinos.api.inscricoes.Crm.Interesse;
import br.com.treinos.api.inscricoes.Crm.Modalidade;
import br.com.treinos.api.inscricoes.Crm.ModalidadeDesejada;
import br.com.treinos.api.inscricoes.Crm.MotivoEncerramento;
import br.com.treinos.api.inscricoes.Crm.Origem;
import br.com.treinos.api.inscricoes.Crm.OrigemInformada;
import br.com.treinos.api.inscricoes.Crm.Periodicidade;
import br.com.treinos.api.inscricoes.Crm.PrevisaoInicio;
import br.com.treinos.api.inscricoes.Crm.TipoEvento;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import br.com.treinos.api.questionarios.ConteudoQuestionario;
import tools.jackson.databind.JsonNode;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Contratos HTTP da inscrição por link (pública) e da fila de interessados (equipe). */
public final class InscricaoDtos {

    private InscricaoDtos() { }

    // ---- Público ----

    /**
     * O que a página pública mostra: a marca (com a URL pública da logo, se houver) e o texto da consultoria.
     * {@code textoVersao} identifica o texto mostrado (sha256): o envio devolve o mesmo valor, e o servidor recusa a
     * ciência de um texto que mudou enquanto a pessoa preenchia. Nulo sem texto. {@code campos}: os campos fixos que o
     * treinador não escondeu (nome, WhatsApp e ciência sempre aparecem e não estão na lista). {@code perguntas}: as do
     * padrão de inscrição publicado, nulo sem padrão.
     */
    public record InscricaoPublica(MarcaPublica consultoria, String texto, String textoVersao, boolean aberta,
                                   List<CampoDaInscricao> campos, PerguntasDaInscricao perguntas) {
    }

    /**
     * Perguntas do treinador na página pública: só o necessário para responder (sem nome do questionário, resumo do
     * treinador, imagem nem destino no cadastro). {@code versaoId} volta no envio: pergunta trocada no meio do
     * preenchimento é 409 {@code PERGUNTAS_ALTERADAS}.
     */
    public record PerguntasDaInscricao(UUID versaoId, ConteudoQuestionario conteudo) {
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
            Boolean cienciaPrivacidade,
            /** {@code textoVersao} recebido na página: confere que a ciência é do texto atual. */
            @Size(max = 64) String textoVersao,
            /** Token do Turnstile (uso único); só é exigido com a verificação humana ligada. */
            @Size(max = 2048) String turnstileToken,
            @Size(max = 10) String sexo,
            /** Qualificação e "como conheceu", todas opcionais. */
            Interesse interesse,
            ModalidadeDesejada modalidade,
            PrevisaoInicio previsaoInicio,
            OrigemInformada origem,
            /** Parâmetro {@code ?origem=} do link; fora de {@code [a-z0-9_-]{1,40}} é ignorado (não recusa a inscrição). */
            @Size(max = 200) String origemLink,
            /** {@code perguntas.versaoId} recebido na página; nulo quando a página não tinha perguntas. */
            UUID questionarioVersaoId,
            /** Respostas às perguntas do treinador, por id da pergunta (as mesmas regras da atualização e da anamnese). */
            JsonNode respostas) {
    }

    /** Resposta neutra: não diz nada sobre a fila nem sobre outras inscrições. */
    public record InscricaoRecebida(String mensagem) {
    }

    // ---- Configuração do link ----

    /**
     * {@code codigo} e {@code link} nulos até o link ser gerado pela primeira vez. {@code camposOcultos}: os campos fixos
     * escondidos da página.
     */
    public record ConfiguracaoResponse(boolean aberta, String codigo, String link, UUID responsavelId, String texto,
                                       List<CampoDaInscricao> camposOcultos, Long versao) {
    }

    /** Campos fixos escondidos da página, sempre a lista inteira; {@code versao} nula só quando ainda não há configuração. */
    public record CamposOcultosRequest(@NotNull @Size(max = 7) List<@NotNull CampoDaInscricao> camposOcultos, Long versao) {
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
    public record Duplicidade(boolean alunoExistente, UUID alunoId, int outrasInscricoesAbertas,
                              int outrasInscricoesAnteriores) {
        public static final Duplicidade NENHUMA = new Duplicidade(false, null, 0, 0);
    }

    /** Próximo retorno pendente; {@code atrasado} = data antes de hoje (Brasília). */
    public record ProximoRetorno(UUID id, LocalDate data, String descricao, boolean atrasado) {
    }

    public record InscricaoResumo(UUID id, String nome, String objetivo, String whatsapp, String email,
                                  SituacaoInscricao situacao, PagamentoInscricao pagamento, UUID responsavelId,
                                  String responsavelNome, UUID alunoId, Instant criadaEm, Instant ultimaAtividadeEm,
                                  int ciclo, Origem origem, String propostaPlanoNome, ProximoRetorno proximoRetorno,
                                  Long versao, Duplicidade duplicidade) {
    }

    /** Contagens no escopo dos filtros (sem a situação). */
    public record Contagens(Map<SituacaoInscricao, Long> porSituacao, long abertas, long todas, long retornosAtrasados,
                            long retornosHoje) {
    }

    public record PaginaInscricoes(List<InscricaoResumo> itens, long total) {
    }

    public record Nota(UUID id, String texto, UUID autorId, String autorNome, Instant criadaEm) {
    }

    public record Retorno(UUID id, String descricao, LocalDate data, UUID responsavelId, String responsavelNome,
                          Instant concluidoEm, String concluidoPorNome, Instant criadoEm, Long versao) {
    }

    /** Retorno pendente de uma inscrição em atendimento (lista "Retornos"). */
    public record RetornoPendente(UUID id, String descricao, LocalDate data, UUID responsavelId, String responsavelNome,
                                  Instant concluidoEm, String concluidoPorNome, Instant criadoEm, Long versao,
                                  UUID inscricaoId, String inscricaoNome, SituacaoInscricao situacao, boolean atrasado) {
    }

    public record Evento(UUID id, TipoEvento tipo, int ciclo, String de, String para, MotivoEncerramento motivo,
                         String detalhe, String autorNome, Instant criadoEm) {
    }

    /** Proposta negociada (cópia dos termos; valores em centavos). Tudo nulo = sem proposta. */
    public record Proposta(UUID planoId, String planoNome, Modalidade modalidade, Periodicidade periodicidade,
                           Long valorReferenciaCentavos, Long valorCentavos, String condicoes, Instant atualizadaEm,
                           String atualizadaPorNome) {
    }

    public record Relacionada(UUID id, String nome, SituacaoInscricao situacao, Instant criadaEm) {
    }

    public record InscricaoDetalhe(UUID id, String nome, String whatsapp, String email, String objetivo,
                                   String observacao, String sexo, Interesse interesse,
                                   ModalidadeDesejada modalidadeDesejada, PrevisaoInicio previsaoInicio,
                                   OrigemInformada origemInformada, String origemLink, Origem origem,
                                   Instant cienciaEm, String cienciaTexto, SituacaoInscricao situacao, int ciclo,
                                   MotivoEncerramento motivoEncerramento, String motivoDetalhe, Instant encerradaEm,
                                   String encerradaPorNome, PagamentoInscricao pagamento,
                                   String pagamentoConfirmadoPorNome, Instant pagamentoConfirmadoEm,
                                   UUID responsavelId, String responsavelNome, UUID alunoId, Instant aceitaEm,
                                   Relacionada relacionadaA, Proposta proposta, Instant criadaEm, Instant atualizadaEm,
                                   Instant ultimaAtividadeEm, Long versao, Duplicidade duplicidade, List<Nota> notas,
                                   List<Retorno> retornos, List<Evento> eventos, RespostasDaInscricao respostas) {
    }

    /**
     * Respostas às perguntas do treinador com a versão respondida (o modelo, para mostrar o rótulo de cada pergunta).
     * Nulo sem respostas; na inscrição aceita, só para quem tem {@code ALUNO_SENSIVEL_LER} (como o objetivo).
     */
    public record RespostasDaInscricao(UUID questionarioVersaoId, int questionarioVersaoNumero, JsonNode modelo,
                                       JsonNode respostas) {
    }

    /**
     * Andamento: situação, pagamento e responsável ({@code null} = sem responsável), sempre os três, com a
     * {@code versao} lida. Em atendimento, a situação só vai para outra etapa aberta (encerrar, aceitar e reabrir têm
     * rota própria); encerrada ou aceita, a situação vem igual à atual.
     */
    public record AlterarInscricaoRequest(@NotNull SituacaoInscricao situacao, @NotNull PagamentoInscricao pagamento,
                                          UUID responsavelId, @NotNull Long versao) {
    }

    public record NotaRequest(@NotBlank @Size(max = 2000) String texto) {
    }

    public record VersaoRequest(@NotNull Long versao) {
    }

    /** Só entre etapas abertas (Kanban). */
    public record EtapaRequest(@NotNull SituacaoInscricao situacao, @NotNull Long versao) {
    }

    /** Recusar ou "desistiu", sempre com motivo; detalhe opcional. */
    public record EncerrarRequest(@NotNull SituacaoInscricao situacao, @NotNull MotivoEncerramento motivo,
                                  @Size(max = 300) String detalhe, @NotNull Long versao) {
    }

    public record ReabrirRequest(@NotBlank @Size(max = 200) String motivo, @NotNull Long versao) {
    }

    public record OrigemRequest(Origem origem, @NotNull Long versao) {
    }

    /**
     * Proposta. Com {@code planoId} (plano do Financeiro, só com ele ligado) a API copia nome, periodicidade e valor de
     * referência do plano e ignora os do corpo. Tudo nulo apaga a proposta.
     */
    public record PropostaRequest(UUID planoId, @Size(max = 120) String planoNome, Modalidade modalidade,
                                  Periodicidade periodicidade,
                                  @Min(0) @Max(100_000_000) Long valorReferenciaCentavos,
                                  @Min(0) @Max(100_000_000) Long valorCentavos,
                                  @Size(max = 500) String condicoes, @NotNull Long versao) {
    }

    public record PlanoDeReferencia(UUID id, String nome, long valorCentavos, String periodicidade) {
    }

    /** {@code versao} só ao reagendar (PUT). */
    public record RetornoRequest(@NotBlank @Size(max = 200) String descricao, @NotNull LocalDate data,
                                 UUID responsavelId, Long versao) {
    }

    public record RelacaoRequest(@NotNull UUID outraId, @NotNull Long versao) {
    }

    public record MensagemRequest(UUID modeloId, @NotNull AcaoDaMensagem acao) {
    }

    public record Semelhante(UUID id, String nome, SituacaoInscricao situacao, Instant criadaEm, List<String> coincide,
                             boolean relacionada) {
    }

    /** {@code aluno}: aluno com o mesmo e-mail ({@code id} só para quem vê alunos); nulo sem nenhum. */
    public record Semelhantes(List<Semelhante> inscricoes, AlunoSemelhante aluno) {
    }

    public record AlunoSemelhante(UUID id, String nome) {
    }

    public record ModeloResponse(UUID id, String nome, String texto, int ordem, Long versao) {
    }

    /** {@code versao} nula só ao criar. */
    public record ModeloRequest(@NotBlank @Size(max = 60) String nome, @NotBlank @Size(max = 1000) String texto,
                                @Min(0) @Max(999) int ordem, Long versao) {
    }

    public record DiasAteAceite(Double mediana, Double media) {
    }

    public record PorMotivo(MotivoEncerramento motivo, long quantidade) {
    }

    public record PorOrigem(Origem origem, long entradas, long aceites) {
    }

    /** Indicadores do período (Brasília). {@code conversao} nula sem entradas; tempos nulos sem aceites. */
    public record Indicadores(LocalDate de, LocalDate ate, long entradas, long pessoas, long aceites, long recusadas,
                              long desistencias, long reaberturas, long aceitesDasEntradas, Double conversao,
                              DiasAteAceite diasAteAceite, List<PorMotivo> porMotivo, List<PorOrigem> porOrigem) {
    }

    /**
     * {@code convidar}: gera o convite de acesso ao app do aluno criado (o link sai só nesta resposta).
     * {@code anamneseQuestionarioId}: opcional; com ele, o aluno criado já recebe a anamnese desse questionário
     * (publicado, de anamnese e não arquivado), na versão publicada daquele momento. Nulo = não envia anamnese.
     */
    public record AceitarRequest(@NotNull Boolean convidar, @NotNull Long versao, UUID anamneseQuestionarioId) {
    }

    // ---- Privacidade ----

    /**
     * Exportação do titular (LGPD): a inscrição pelo link que virou o aluno, com o que a pessoa escreveu, a ciência e as
     * notas da equipe sobre ela (sem o autor, que é dado da equipe).
     */
    public record InscricaoExportada(Instant criadaEm, String nome, String whatsapp, String email, String objetivo,
                                     String observacao, Instant cienciaEm, String cienciaTexto,
                                     List<NotaExportada> notas, String sexo, Interesse interesse,
                                     ModalidadeDesejada modalidadeDesejada, PrevisaoInicio previsaoInicio,
                                     OrigemInformada origemInformada, PropostaExportada proposta,
                                     UUID questionarioVersaoId, JsonNode respostas) {
    }

    /** Os termos que a consultoria propôs à pessoa (nulo sem proposta). */
    public record PropostaExportada(String planoNome, Modalidade modalidade, Periodicidade periodicidade,
                                    Long valorCentavos, String condicoes) {
    }

    public record NotaExportada(Instant criadaEm, String texto) {
    }

    /**
     * {@code id} = a inscrição (a auditoria lê o id daqui); {@code convite} nulo sem convite; {@code anamneseId} = a
     * anamnese pendente enviada ao aluno, nulo quando o aceite não pediu anamnese.
     */
    public record AceiteResponse(UUID id, UUID alunoId, ConviteResponse convite, UUID anamneseId) {
    }
}
