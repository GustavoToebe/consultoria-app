package br.com.treinos.api.inscricoes;

import br.com.treinos.api.inscricoes.InscricaoDtos.AceitarRequest;
import br.com.treinos.api.inscricoes.InscricaoDtos.AceiteResponse;
import br.com.treinos.api.inscricoes.InscricaoDtos.AlterarInscricaoRequest;
import br.com.treinos.api.inscricoes.InscricaoDtos.ConfiguracaoRequest;
import br.com.treinos.api.inscricoes.InscricaoDtos.ConfiguracaoResponse;
import br.com.treinos.api.inscricoes.InscricaoDtos.Contagens;
import br.com.treinos.api.inscricoes.InscricaoDtos.EncerrarRequest;
import br.com.treinos.api.inscricoes.InscricaoDtos.EtapaRequest;
import br.com.treinos.api.inscricoes.InscricaoDtos.Indicadores;
import br.com.treinos.api.inscricoes.InscricaoDtos.InscricaoDetalhe;
import br.com.treinos.api.inscricoes.InscricaoDtos.MensagemRequest;
import br.com.treinos.api.inscricoes.InscricaoDtos.NotaRequest;
import br.com.treinos.api.inscricoes.InscricaoDtos.NovoLinkRequest;
import br.com.treinos.api.inscricoes.InscricaoDtos.OrigemRequest;
import br.com.treinos.api.inscricoes.InscricaoDtos.PaginaInscricoes;
import br.com.treinos.api.inscricoes.InscricaoDtos.PlanoDeReferencia;
import br.com.treinos.api.inscricoes.InscricaoDtos.PropostaRequest;
import br.com.treinos.api.inscricoes.InscricaoDtos.ReabrirRequest;
import br.com.treinos.api.inscricoes.InscricaoDtos.RelacaoRequest;
import br.com.treinos.api.inscricoes.InscricaoDtos.Semelhantes;
import br.com.treinos.api.inscricoes.FilaDeInscricoesService.Filtro;
import br.com.treinos.api.security.UsuarioAutenticado;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Fila de interessados (o CRM) e o link de inscrição da consultoria da sessão. Ler (fila, contagens, detalhe,
 * semelhantes, indicadores) com {@code INSCRICAO_LER}; atender (andamento, etapa, encerrar, reabrir, notas, proposta,
 * origem, mesma pessoa, mensagem preparada) e configurar o link com {@code INSCRICAO_ALTERAR}; aceitar cria um aluno e
 * pede também {@code ALUNO_ALTERAR} (e o convite, {@code ALUNO_CONVITE}, conferido no serviço antes de qualquer efeito).
 * Retornos e respostas prontas têm controller próprio.
 */
@RestController
@RequestMapping("/inscricoes")
public class InscricaoController {

    private final InscricaoService inscricoes;
    private final FilaDeInscricoesService fila;
    private final AtendimentoService atendimento;
    private final IndicadoresDeInscricoes indicadores;
    private final ConfiguracaoInscricaoService configuracao;

    public InscricaoController(InscricaoService inscricoes, FilaDeInscricoesService fila, AtendimentoService atendimento,
                               IndicadoresDeInscricoes indicadores, ConfiguracaoInscricaoService configuracao) {
        this.inscricoes = inscricoes;
        this.fila = fila;
        this.atendimento = atendimento;
        this.indicadores = indicadores;
        this.configuracao = configuracao;
    }

    @PreAuthorize("hasAuthority('PERM_INSCRICAO_LER')")
    @GetMapping("/configuracao")
    public ConfiguracaoResponse configuracao() {
        return configuracao.ler();
    }

    @PreAuthorize("hasAuthority('PERM_INSCRICAO_ALTERAR')")
    @PutMapping("/configuracao")
    public ConfiguracaoResponse alterarConfiguracao(@RequestBody @Valid ConfiguracaoRequest request) {
        return configuracao.alterar(request);
    }

    @PreAuthorize("hasAuthority('PERM_INSCRICAO_ALTERAR')")
    @PutMapping("/configuracao/campos-ocultos")
    public ConfiguracaoResponse esconderCampos(@RequestBody @Valid InscricaoDtos.CamposOcultosRequest request) {
        return configuracao.esconderCampos(request);
    }

    @PreAuthorize("hasAuthority('PERM_INSCRICAO_ALTERAR')")
    @PostMapping("/configuracao/novo-link")
    public ConfiguracaoResponse novoLink(@RequestBody(required = false) NovoLinkRequest request) {
        return configuracao.novoLink(request);
    }

    /**
     * Fila filtrada (todos opcionais, combinados com E; {@link FiltrosDaFila}): {@code responsavel} e {@code origem}
     * repetíveis ({@code nenhum} e {@code NAO_INFORMADA} valem; {@code meus} junto de {@code responsavel} = 400), período
     * de entrada ({@code de}/{@code ate}) e de última atividade ({@code atividadeDe}/{@code atividadeAte}). As contagens
     * aceitam os mesmos filtros (sem a situação), para o número de cada situação bater com a lista e o Kanban.
     */
    @PreAuthorize("hasAuthority('PERM_INSCRICAO_LER')")
    @GetMapping
    public PaginaInscricoes listar(@AuthenticationPrincipal UsuarioAutenticado eu,
                                   @RequestParam(required = false) String situacao,
                                   @RequestParam(defaultValue = "false") boolean meus,
                                   @RequestParam(required = false) List<String> responsavel,
                                   @RequestParam(required = false) List<String> origem,
                                   @RequestParam(required = false) String busca,
                                   @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate de,
                                   @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate ate,
                                   @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate atividadeDe,
                                   @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate atividadeAte,
                                   @RequestParam(defaultValue = "0") int pagina,
                                   @RequestParam(defaultValue = "30") int tamanho) {
        return fila.listar(new Filtro(situacao, meus ? eu.usuarioId() : null, responsavel, origem, busca, de, ate,
                atividadeDe, atividadeAte), pagina, tamanho);
    }

    @PreAuthorize("hasAuthority('PERM_INSCRICAO_LER')")
    @GetMapping("/contagens")
    public Contagens contagens(@AuthenticationPrincipal UsuarioAutenticado eu,
                               @RequestParam(defaultValue = "false") boolean meus,
                               @RequestParam(required = false) List<String> responsavel,
                               @RequestParam(required = false) List<String> origem,
                               @RequestParam(required = false) String busca,
                               @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate de,
                               @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate ate,
                               @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate atividadeDe,
                               @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate atividadeAte) {
        return fila.contar(new Filtro(null, meus ? eu.usuarioId() : null, responsavel, origem, busca, de, ate, atividadeDe,
                atividadeAte));
    }

    /** Período em dias de Brasília ({@code de}/{@code ate}, até 366 dias; sem eles, os últimos 30). */
    @PreAuthorize("hasAuthority('PERM_INSCRICAO_LER')")
    @GetMapping("/indicadores")
    public Indicadores indicadores(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate de,
                                   @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate ate) {
        return indicadores.calcular(de, ate);
    }

    /** Planos do Financeiro como referência da proposta (vazio com o Financeiro desligado). */
    @PreAuthorize("hasAuthority('PERM_INSCRICAO_ALTERAR')")
    @GetMapping("/planos-de-referencia")
    public List<PlanoDeReferencia> planosDeReferencia() {
        return atendimento.planosDeReferencia();
    }

    @PreAuthorize("hasAuthority('PERM_INSCRICAO_LER')")
    @GetMapping("/{id}")
    public InscricaoDetalhe detalhe(@PathVariable UUID id) {
        return inscricoes.detalhe(id);
    }

    @PreAuthorize("hasAuthority('PERM_INSCRICAO_ALTERAR')")
    @PutMapping("/{id}")
    public InscricaoDetalhe alterar(@AuthenticationPrincipal UsuarioAutenticado eu, @PathVariable UUID id,
                                    @RequestBody @Valid AlterarInscricaoRequest request) {
        return inscricoes.alterar(id, request, eu.usuarioId());
    }

    @PreAuthorize("hasAuthority('PERM_INSCRICAO_ALTERAR')")
    @PostMapping("/{id}/notas")
    public InscricaoDetalhe nota(@AuthenticationPrincipal UsuarioAutenticado eu, @PathVariable UUID id,
                                 @RequestBody @Valid NotaRequest request) {
        return inscricoes.acrescentarNota(id, request, eu.usuarioId());
    }

    @PreAuthorize("hasAuthority('PERM_INSCRICAO_ALTERAR')")
    @PutMapping("/{id}/etapa")
    public InscricaoDetalhe etapa(@AuthenticationPrincipal UsuarioAutenticado eu, @PathVariable UUID id,
                                  @RequestBody @Valid EtapaRequest request) {
        return inscricoes.mudarEtapa(id, request, eu.usuarioId());
    }

    @PreAuthorize("hasAuthority('PERM_INSCRICAO_ALTERAR')")
    @PostMapping("/{id}/encerrar")
    public InscricaoDetalhe encerrar(@AuthenticationPrincipal UsuarioAutenticado eu, @PathVariable UUID id,
                                     @RequestBody @Valid EncerrarRequest request) {
        return inscricoes.encerrar(id, request, eu.usuarioId());
    }

    @PreAuthorize("hasAuthority('PERM_INSCRICAO_ALTERAR')")
    @PostMapping("/{id}/reabrir")
    public InscricaoDetalhe reabrir(@AuthenticationPrincipal UsuarioAutenticado eu, @PathVariable UUID id,
                                    @RequestBody @Valid ReabrirRequest request) {
        return inscricoes.reabrir(id, request, eu.usuarioId());
    }

    @PreAuthorize("hasAuthority('PERM_INSCRICAO_ALTERAR')")
    @PutMapping("/{id}/proposta")
    public InscricaoDetalhe proposta(@AuthenticationPrincipal UsuarioAutenticado eu, @PathVariable UUID id,
                                     @RequestBody @Valid PropostaRequest request) {
        return atendimento.definirProposta(id, request, eu.usuarioId());
    }

    @PreAuthorize("hasAuthority('PERM_INSCRICAO_ALTERAR')")
    @PutMapping("/{id}/origem")
    public InscricaoDetalhe origem(@AuthenticationPrincipal UsuarioAutenticado eu, @PathVariable UUID id,
                                   @RequestBody @Valid OrigemRequest request) {
        return atendimento.alterarOrigem(id, request, eu.usuarioId());
    }

    @PreAuthorize("hasAuthority('PERM_INSCRICAO_LER')")
    @GetMapping("/{id}/semelhantes")
    public Semelhantes semelhantes(@PathVariable UUID id) {
        return atendimento.semelhantes(id);
    }

    @PreAuthorize("hasAuthority('PERM_INSCRICAO_ALTERAR')")
    @PutMapping("/{id}/relacao")
    public InscricaoDetalhe relacionar(@AuthenticationPrincipal UsuarioAutenticado eu, @PathVariable UUID id,
                                       @RequestBody @Valid RelacaoRequest request) {
        return atendimento.relacionar(id, request, eu.usuarioId());
    }

    @PreAuthorize("hasAuthority('PERM_INSCRICAO_ALTERAR')")
    @DeleteMapping("/{id}/relacao")
    public InscricaoDetalhe desfazerRelacao(@AuthenticationPrincipal UsuarioAutenticado eu, @PathVariable UUID id,
                                            @RequestParam long versao) {
        return atendimento.desfazerRelacao(id, versao, eu.usuarioId());
    }

    /** Registra que a mensagem foi preparada (o texto não vem); 204. */
    @PreAuthorize("hasAuthority('PERM_INSCRICAO_ALTERAR')")
    @PostMapping("/{id}/mensagens")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void mensagem(@AuthenticationPrincipal UsuarioAutenticado eu, @PathVariable UUID id,
                         @RequestBody @Valid MensagemRequest request) {
        atendimento.mensagemPreparada(id, request, eu.usuarioId());
    }

    @PreAuthorize("hasAuthority('PERM_INSCRICAO_ALTERAR') and hasAuthority('PERM_ALUNO_ALTERAR')")
    @PostMapping("/{id}/aceitar")
    public AceiteResponse aceitar(@AuthenticationPrincipal UsuarioAutenticado eu, @PathVariable UUID id,
                                  @RequestBody @Valid AceitarRequest request) {
        return inscricoes.aceitar(id, request, eu.usuarioId());
    }
}
