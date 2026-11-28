package br.com.treinos.api.importacao.assistida;

import br.com.treinos.api.auth.LimiteTentativas;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.AdicionarTextoRequisicao;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.ApelidoDto;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.ArquivoResumo;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.AtualizarGrupoRequisicao;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.ConfirmacaoResultado;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.ConfirmarSessaoRequisicao;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.JuntarGruposRequisicao;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.ResponderDuvidaRequisicao;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.AceitarSugestoesRequisicao;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.RevogarDecisaoRequisicao;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.SessaoDetalhe;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.SessaoListaItem;
import br.com.treinos.api.migracao.ExigeMigracaoAssistida;
import br.com.treinos.api.security.UsuarioAutenticado;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
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
    private final ProcessamentoAssincronoImportacao processamento;
    private final LimiteTentativas limites;

    public ImportacaoAssistidaController(ImportacaoAssistidaService service,
                                         ConfirmacaoDaImportacaoAssistida confirmacao,
                                         ProcessamentoAssincronoImportacao processamento,
                                         LimiteTentativas limites) {
        this.service = service;
        this.confirmacao = confirmacao;
        this.processamento = processamento;
        this.limites = limites;
    }

    @GetMapping("/sessoes")
    @PreAuthorize("hasAuthority('PERM_ALUNO_LER')")
    public List<SessaoListaItem> listarSessoes() {
        return service.listarSessoes();
    }

    /** Sem corpo: um corpo enviado (o antigo {@code objetivo}) é ignorado. */
    @PostMapping("/sessoes")
    @PreAuthorize("hasAuthority('PERM_ALUNO_ALTERAR')")
    public SessaoDetalhe criarSessao(@AuthenticationPrincipal UsuarioAutenticado eu) {
        limites.importacaoAssistida(eu.usuarioId());
        return service.criarSessao(eu.usuarioId());
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
    public ResponseEntity<SessaoDetalhe> processar(@AuthenticationPrincipal UsuarioAutenticado eu,
                                                   @PathVariable UUID id) {
        limites.importacaoAssistida(eu.usuarioId());
        return ResponseEntity.accepted().body(processamento.iniciar(id, eu.usuarioId()));
    }

    @GetMapping("/sessoes/{id}")
    @PreAuthorize("hasAuthority('PERM_ALUNO_LER')")
    public SessaoDetalhe obterSessao(@PathVariable UUID id) {
        return service.obterSessao(id);
    }

    @GetMapping("/sessoes/{id}/arquivos/{arquivoId}/conteudo")
    @PreAuthorize("hasAuthority('PERM_ALUNO_LER')")
    public ResponseEntity<byte[]> obterConteudoArquivo(@PathVariable UUID id, @PathVariable UUID arquivoId) {
        ImportacaoAssistidaService.ConteudoArquivo conteudo = service.obterConteudoArquivo(id, arquivoId);
        String nomeSeguro = conteudo.nomeOriginal().replaceAll("[^A-Za-z0-9._-]", "_");
        if (nomeSeguro.isBlank()) {
            nomeSeguro = "arquivo";
        }
        MediaType mediaType = switch (conteudo.formato()) {
            case "PDF" -> MediaType.APPLICATION_PDF;
            case "TEXTO_LIVRE", "CSV" -> new MediaType("text", "plain", java.nio.charset.StandardCharsets.UTF_8);
            default -> MediaType.APPLICATION_OCTET_STREAM;
        };
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .header("X-Content-Type-Options", "nosniff")
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + nomeSeguro + "\"")
                .contentType(mediaType)
                .body(conteudo.bytes());
    }

    @PostMapping("/sessoes/{id}/cancelar")
    @PreAuthorize("hasAuthority('PERM_ALUNO_ALTERAR')")
    public SessaoDetalhe cancelarSessao(@AuthenticationPrincipal UsuarioAutenticado eu, @PathVariable UUID id) {
        limites.importacaoAssistida(eu.usuarioId());
        return service.cancelarSessao(id);
    }

    @PostMapping("/sessoes/{id}/respostas")
    @PreAuthorize("hasAuthority('PERM_ALUNO_ALTERAR')")
    public SessaoDetalhe responderDuvida(@AuthenticationPrincipal UsuarioAutenticado eu, @PathVariable UUID id,
                                         @RequestBody ResponderDuvidaRequisicao req) {
        limites.importacaoAssistida(eu.usuarioId());
        return service.responderDuvida(id, req);
    }

    @PostMapping("/sessoes/{id}/respostas/sugestoes")
    @PreAuthorize("hasAuthority('PERM_ALUNO_ALTERAR')")
    public SessaoDetalhe aceitarSugestoes(@AuthenticationPrincipal UsuarioAutenticado eu, @PathVariable UUID id,
                                          @RequestBody AceitarSugestoesRequisicao req) {
        limites.importacaoAssistida(eu.usuarioId());
        return service.aceitarSugestoes(id, req.revisaoEsperada());
    }

    @PostMapping("/sessoes/{id}/respostas/{decisaoId}/revogar")
    @PreAuthorize("hasAuthority('PERM_ALUNO_ALTERAR')")
    public SessaoDetalhe revogarDecisao(@AuthenticationPrincipal UsuarioAutenticado eu, @PathVariable UUID id,
                                        @PathVariable String decisaoId, @RequestBody RevogarDecisaoRequisicao req) {
        limites.importacaoAssistida(eu.usuarioId());
        return service.revogarDecisao(id, decisaoId, req.revisaoEsperada());
    }

    @PutMapping("/sessoes/{id}/grupos/{grupoId}")
    @PreAuthorize("hasAuthority('PERM_ALUNO_ALTERAR')")
    public SessaoDetalhe atualizarGrupo(@AuthenticationPrincipal UsuarioAutenticado eu, @PathVariable UUID id,
                                        @PathVariable String grupoId,
                                        @RequestBody AtualizarGrupoRequisicao req) {
        limites.importacaoAssistida(eu.usuarioId());
        return service.atualizarGrupo(id, grupoId, req);
    }

    @PostMapping("/sessoes/{id}/grupos/{grupoId}/juntar")
    @PreAuthorize("hasAuthority('PERM_ALUNO_ALTERAR')")
    public SessaoDetalhe juntarGrupos(@AuthenticationPrincipal UsuarioAutenticado eu, @PathVariable UUID id,
                                      @PathVariable String grupoId, @RequestBody JuntarGruposRequisicao req) {
        limites.importacaoAssistida(eu.usuarioId());
        return service.juntarGrupos(id, grupoId, req.outros());
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
