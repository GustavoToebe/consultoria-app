package br.com.treinos.api.inscricoes;

import br.com.treinos.api.inscricoes.InscricaoDtos.AceitarRequest;
import br.com.treinos.api.inscricoes.InscricaoDtos.AceiteResponse;
import br.com.treinos.api.inscricoes.InscricaoDtos.AlterarInscricaoRequest;
import br.com.treinos.api.inscricoes.InscricaoDtos.ConfiguracaoRequest;
import br.com.treinos.api.inscricoes.InscricaoDtos.ConfiguracaoResponse;
import br.com.treinos.api.inscricoes.InscricaoDtos.InscricaoDetalhe;
import br.com.treinos.api.inscricoes.InscricaoDtos.NotaRequest;
import br.com.treinos.api.inscricoes.InscricaoDtos.NovoLinkRequest;
import br.com.treinos.api.inscricoes.InscricaoDtos.PaginaInscricoes;
import br.com.treinos.api.inscricoes.InscricaoDtos.VersaoRequest;
import br.com.treinos.api.security.UsuarioAutenticado;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * Fila de interessados e o link de inscrição da consultoria da sessão. Ler com {@code INSCRICAO_LER}; atender, recusar
 * e configurar o link com {@code INSCRICAO_ALTERAR}; aceitar cria um aluno e pede também {@code ALUNO_ALTERAR} (e o
 * convite, {@code ALUNO_CONVITE}, conferido no serviço antes de qualquer efeito).
 */
@RestController
@RequestMapping("/inscricoes")
public class InscricaoController {

    private final InscricaoService inscricoes;
    private final ConfiguracaoInscricaoService configuracao;

    public InscricaoController(InscricaoService inscricoes, ConfiguracaoInscricaoService configuracao) {
        this.inscricoes = inscricoes;
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
    @PostMapping("/configuracao/novo-link")
    public ConfiguracaoResponse novoLink(@RequestBody(required = false) NovoLinkRequest request) {
        return configuracao.novoLink(request);
    }

    @PreAuthorize("hasAuthority('PERM_INSCRICAO_LER')")
    @GetMapping
    public PaginaInscricoes listar(@AuthenticationPrincipal UsuarioAutenticado eu,
                                   @RequestParam(required = false) String situacao,
                                   @RequestParam(defaultValue = "false") boolean meus,
                                   @RequestParam(defaultValue = "0") int pagina,
                                   @RequestParam(defaultValue = "30") int tamanho) {
        return inscricoes.listar(situacao, meus ? eu.usuarioId() : null, pagina, tamanho);
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
    @PostMapping("/{id}/recusar")
    public InscricaoDetalhe recusar(@PathVariable UUID id, @RequestBody @Valid VersaoRequest request) {
        return inscricoes.recusar(id, request.versao());
    }

    @PreAuthorize("hasAuthority('PERM_INSCRICAO_ALTERAR') and hasAuthority('PERM_ALUNO_ALTERAR')")
    @PostMapping("/{id}/aceitar")
    public AceiteResponse aceitar(@AuthenticationPrincipal UsuarioAutenticado eu, @PathVariable UUID id,
                                  @RequestBody @Valid AceitarRequest request) {
        return inscricoes.aceitar(id, request, eu.usuarioId());
    }
}
