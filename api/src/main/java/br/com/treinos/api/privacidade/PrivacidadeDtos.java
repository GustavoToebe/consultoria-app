package br.com.treinos.api.privacidade;

import br.com.treinos.api.fotos.FotoService;
import br.com.treinos.api.alunos.dto.AlunoDtos.AlunoDetalhe;
import br.com.treinos.api.dieta.ConteudoDieta;
import br.com.treinos.api.execucao.dto.ExecucaoDtos.DiaDeTreino;
import br.com.treinos.api.execucao.dto.ExecucaoDtos.PesoResponse;
import br.com.treinos.api.lesoes.LesaoDtos.LesaoResponse;
import br.com.treinos.api.mobilidade.MobilidadeRegistroDtos.RegistroMobilidadeFeito;
import br.com.treinos.api.planos.dto.PlanoDtos.PlanoPublicado;
import br.com.treinos.api.receitas.ConteudoMobilidade;
import br.com.treinos.api.treino.ConteudoTreino;
import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import tools.jackson.databind.JsonNode;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Contratos da exportação e da anonimização de dados do aluno (LGPD). */
public final class PrivacidadeDtos {

    private PrivacidadeDtos() { }

    /** Lista da exportação; {@code truncado} avisa que a lista passou do limite e não está completa. */
    public record Secao<T>(List<T> itens, boolean truncado) { }

    public record PastaExportada(UUID id, String titulo, LocalDate inicio, LocalDate fim, Instant concluidaEm,
                                 boolean arquivada, Instant criadoEm) { }

    public record AtualizacaoExportada(UUID id, UUID pastaId, LocalDate dataAtualizacao, String estado,
                                       UUID questionarioVersaoId, JsonNode respostas, Instant enviadaEm,
                                       LocalDate atrasoAte, String atrasoMotivo, String feedback, Instant feedbackEm,
                                       List<FotoService.FotoExportada> fotos) { }

    /**
     * Tudo o que a consultoria guarda do aluno e que quem exporta pode ler. Seção que a pessoa não pode ler fica fora
     * ({@code null}) e vem listada em {@code secoesOmitidas}; rascunhos de plano não entram.
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Exportacao(Instant geradoEm, List<String> secoesOmitidas, AlunoDetalhe cadastro,
                             Secao<PastaExportada> pastas,
                             Secao<PlanoPublicado<ConteudoTreino>> treinos,
                             Secao<PlanoPublicado<ConteudoDieta>> dietas,
                             Secao<PlanoPublicado<ConteudoMobilidade>> mobilidades,
                             Secao<DiaDeTreino> registros, Secao<RegistroMobilidadeFeito> mobilidadeRegistros,
                             Secao<br.com.treinos.api.sessoesconcluidas.SessaoConcluidaDtos.SessaoConcluidaLinha> sessoesConcluidas,
                             Secao<PesoResponse> pesos, Secao<LesaoResponse> lesoes,
                             Secao<AtualizacaoExportada> atualizacoes,
                             Secao<br.com.treinos.api.anamneses.AnamneseDtos.AnamneseExportada> anamneses,
                             Secao<br.com.treinos.api.inscricoes.InscricaoDtos.InscricaoExportada> inscricao,
                             br.com.treinos.api.pagamentos.PagamentosDtos.FinanceiroExportado financeiro,
                             FotoPerfilExportada fotoDePerfil,
                             br.com.treinos.api.ciclo.CicloDtos.CicloExportado cicloMenstrual,
                             Secao<br.com.treinos.api.agenda.AgendaDtos.CompromissoExportado> compromissos,
                             Secao<br.com.treinos.api.avaliacoes.AvaliacaoFisicaDtos.AvaliacaoResponse> avaliacoesFisicas) { }

    /** Só a data em que a foto de perfil foi trocada; a imagem não vai no arquivo. Sem foto: {@code null}. */
    public record FotoPerfilExportada(Instant atualizadaEm) { }

    /** O nome digitado é conferido de novo no servidor. */
    public record AnonimizarRequest(@NotBlank @Size(max = 200) String nomeConfirmado) { }

    /**
     * "Excluir minha conta" pelo próprio aluno: a senha dele e o texto fixo {@code EXCLUIR}, para um toque acidental não
     * apagar nada. Os dois são conferidos no servidor.
     */
    public record ExcluirContaRequest(@NotBlank @Size(max = 200) String senha, @NotBlank @Size(max = 20) String confirmacao) { }
}
