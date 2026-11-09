package br.com.treinos.api.inscricoes;

import br.com.treinos.api.inscricoes.InscricaoDtos.CamposOcultosRequest;
import br.com.treinos.api.inscricoes.InscricaoDtos.ConfiguracaoRequest;
import br.com.treinos.api.inscricoes.InscricaoDtos.ConfiguracaoResponse;
import br.com.treinos.api.inscricoes.InscricaoDtos.NovoLinkRequest;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * Link público de um formulário de inscrição (abrir, fechar, responsável, texto, campos escondidos, novo código). É ação
 * de {@code INSCRICAO_ALTERAR} (como era o cartão "Link" do Interessados), não de {@code QUESTIONARIO_ALTERAR}: o
 * Assistente abre e fecha o link sem poder editar perguntas. O conteúdo do formulário continua em {@code /questionarios}.
 */
@RestController
public class LinkDoFormularioController {

    private final ConfiguracaoInscricaoService link;

    public LinkDoFormularioController(ConfiguracaoInscricaoService link) {
        this.link = link;
    }

    @PreAuthorize("hasAuthority('PERM_INSCRICAO_LER')")
    @GetMapping("/questionarios/{id}/link")
    public ConfiguracaoResponse ler(@PathVariable UUID id) {
        return link.ler(id);
    }

    @PreAuthorize("hasAuthority('PERM_INSCRICAO_ALTERAR')")
    @PutMapping("/questionarios/{id}/link")
    public ConfiguracaoResponse alterar(@PathVariable UUID id, @RequestBody @Valid ConfiguracaoRequest request) {
        return link.alterar(id, request);
    }

    @PreAuthorize("hasAuthority('PERM_INSCRICAO_ALTERAR')")
    @PutMapping("/questionarios/{id}/link/campos-ocultos")
    public ConfiguracaoResponse esconderCampos(@PathVariable UUID id, @RequestBody @Valid CamposOcultosRequest request) {
        return link.esconderCampos(id, request);
    }

    @PreAuthorize("hasAuthority('PERM_INSCRICAO_ALTERAR')")
    @PostMapping("/questionarios/{id}/link/novo-link")
    public ConfiguracaoResponse novoLink(@PathVariable UUID id, @RequestBody(required = false) NovoLinkRequest request) {
        return link.novoLink(id, request);
    }
}
