package br.com.treinos.api.importacao.assistida;

import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.ApelidoDto;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.ArquivoResumo;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.AtualizarGrupoRequisicao;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.ConfirmacaoResultado;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.ConfirmarSessaoRequisicao;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.CriarSessaoRequisicao;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.AdicionarTextoRequisicao;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.RespostaDuvidaRequisicao;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.SessaoDetalhe;
import br.com.treinos.api.auth.LimiteTentativas;
import br.com.treinos.api.migracao.ExigeMigracaoAssistida;
import br.com.treinos.api.security.UsuarioAutenticado;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

/**
 * Controller REST para a importação assistida por IA (lote misto PDF, DOCX, planilhas e texto). Atrás da chave da
 * migração assistida ({@link ExigeMigracaoAssistida}); toda rota que grava ou processa passa pelo limite de tentativas
 * (fora da transação, a recusa também conta). As permissões finas (sensível, treino, dieta, pasta, modelo) são do serviço.
 */
@ExigeMigracaoAssistida
@RestController
@RequestMapping("/importacoes/assistidas")
public class ImportacaoAssistidaController {

    private final ImportacaoAssistidaService service;
    private final ConfirmacaoDaImportacaoAssistida confirmacao;
    private final LimiteTentativas limites;

    public ImportacaoAssistidaController(ImportacaoAssistidaService service, ConfirmacaoDaImportacaoAssistida confirmacao,
                                         LimiteTentativas limites) {
        this.service = service;
        this.confirmacao = confirmacao;
        this.limites = limites;
    }

    @PostMapping("/sessoes")
    @PreAuthorize("hasAuthority('PERM_ALUNO_ALTERAR')")
    public SessaoDetalhe criarSessao(@AuthenticationPrincipal UsuarioAutenticado eu,
                                     @RequestBody(required = false) CriarSessaoRequisicao req) {
        limites.importacaoAssistida(eu.usuarioId());
        String objetivo = req != null ? req.objetivo() : null;
        return service.criarSessao(eu.usuarioId(), objetivo);
    }

    @PostMapping(value = "/sessoes/{id}/arquivos", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAuthority('PERM_ALUNO_ALTERAR')")
    public ArquivoResumo adicionarArquivo(@AuthenticationPrincipal UsuarioAutenticado eu, @PathVariable UUID id,
                                          @RequestPart("arquivo") MultipartFile arquivo) throws IOException {
        limites.importacaoAssistida(eu.usuarioId());
        return service.adicionarArquivo(id, arquivo);
    }

    @PostMapping("/sessoes/{id}/textos")
    @PreAuthorize("hasAuthority('PERM_ALUNO_ALTERAR')")
    public ArquivoResumo adicionarTexto(@AuthenticationPrincipal UsuarioAutenticado eu, @PathVariable UUID id,
                                        @RequestBody AdicionarTextoRequisicao req) {
        limites.importacaoAssistida(eu.usuarioId());
        return service.adicionarTexto(id, req.titulo(), req.conteudo());
    }

    @PostMapping("/sessoes/{id}/processar")
    @PreAuthorize("hasAuthority('PERM_ALUNO_ALTERAR')")
    public SessaoDetalhe processar(@AuthenticationPrincipal UsuarioAutenticado eu, @PathVariable UUID id) {
        limites.importacaoAssistida(eu.usuarioId());
        return service.processar(id);
    }

    @GetMapping("/sessoes/{id}")
    @PreAuthorize("hasAuthority('PERM_ALUNO_LER')")
    public SessaoDetalhe obterSessao(@PathVariable UUID id) {
        return service.obterSessao(id);
    }

    @PostMapping("/sessoes/{id}/respostas")
    @PreAuthorize("hasAuthority('PERM_ALUNO_ALTERAR')")
    public SessaoDetalhe responderDuvida(@AuthenticationPrincipal UsuarioAutenticado eu, @PathVariable UUID id,
                                         @RequestBody RespostaDuvidaRequisicao req) {
        limites.importacaoAssistida(eu.usuarioId());
        return service.responderDuvida(id, req);
    }

    @PutMapping("/sessoes/{id}/grupos/{grupoId}")
    @PreAuthorize("hasAuthority('PERM_ALUNO_ALTERAR')")
    public SessaoDetalhe atualizarGrupo(@AuthenticationPrincipal UsuarioAutenticado eu, @PathVariable UUID id,
                                        @PathVariable String grupoId,
                                        @RequestBody AtualizarGrupoRequisicao req) {
        limites.importacaoAssistida(eu.usuarioId());
        return service.atualizarGrupo(id, grupoId, req);
    }

    @PostMapping("/sessoes/{id}/confirmar")
    @PreAuthorize("hasAuthority('PERM_ALUNO_ALTERAR')")
    public ConfirmacaoResultado confirmar(@AuthenticationPrincipal UsuarioAutenticado eu,
                                          @PathVariable UUID id,
                                          @RequestBody ConfirmarSessaoRequisicao req) {
        limites.importacaoAssistida(eu.usuarioId());
        return confirmacao.confirmar(id, eu.usuarioId(), req);
    }

    @GetMapping("/apelidos")
    @PreAuthorize("hasAuthority('PERM_ALUNO_LER')")
    public List<ApelidoDto> listarApelidos() {
        return service.listarApelidos();
    }

    @DeleteMapping("/apelidos/{id}")
    @PreAuthorize("hasAuthority('PERM_ALUNO_ALTERAR')")
    public void removerApelido(@AuthenticationPrincipal UsuarioAutenticado eu, @PathVariable UUID id) {
        limites.importacaoAssistida(eu.usuarioId());
        service.removerApelido(id);
    }
}
