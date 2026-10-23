package br.com.treinos.api.importacao;

import br.com.treinos.api.auth.LimiteTentativas;
import br.com.treinos.api.importacao.ImportacaoDtos.Colunas;
import br.com.treinos.api.importacao.ImportacaoDtos.Detalhe;
import br.com.treinos.api.importacao.ImportacaoDtos.Pagina;
import br.com.treinos.api.importacao.ImportacaoDtos.Previa;
import br.com.treinos.api.security.UsuarioAutenticado;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

@RestController
@RequestMapping("/importacoes")
public class ImportacaoController {

    private static final String PERMISSOES = """
            hasAuthority('PERM_ALUNO_ALTERAR') or hasAuthority('PERM_ALUNO_SENSIVEL_ALTERAR') \
            or hasAuthority('PERM_BIBLIOTECA_ALTERAR') or hasAuthority('PERM_ERGOGENICO_ALTERAR')
            """;

    private final ImportacaoService service;
    private final LimiteTentativas limites;

    public ImportacaoController(ImportacaoService service, LimiteTentativas limites) {
        this.service = service;
        this.limites = limites;
    }

    @GetMapping
    @PreAuthorize(PERMISSOES)
    public Pagina listar(@RequestParam(required = false) String destino, @RequestParam(required = false) String situacao,
                         @RequestParam(required = false) String busca, @RequestParam(defaultValue = "0") int pagina) {
        return service.listar(destino, situacao, busca, pagina);
    }

    @GetMapping("/{id}")
    @PreAuthorize(PERMISSOES)
    public Detalhe detalhe(@PathVariable UUID id) {
        return service.detalhe(id);
    }

    @GetMapping(value = "/{id}/erros.csv", produces = "text/csv")
    @PreAuthorize(PERMISSOES)
    public ResponseEntity<byte[]> erros(@PathVariable UUID id) {
        byte[] csv = service.errosCsv(id);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename("erros.csv", StandardCharsets.UTF_8).build().toString())
                .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                .body(csv);
    }

    @PostMapping(value = "/{destino}/colunas", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize(PERMISSOES)
    public Colunas colunas(@AuthenticationPrincipal UsuarioAutenticado eu, @PathVariable String destino,
                           @RequestPart("arquivo") MultipartFile arquivo, @RequestParam(defaultValue = "0") int aba,
                           @RequestParam(defaultValue = "true") boolean cabecalho) throws IOException {
        limites.previaDeImportacao(eu.usuarioId());
        return service.colunas(destino, arquivo.getOriginalFilename(), arquivo.getBytes(), aba, cabecalho);
    }

    @PostMapping(value = "/{destino}/previa", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize(PERMISSOES)
    public Previa previa(@AuthenticationPrincipal UsuarioAutenticado eu, @PathVariable String destino,
                         @RequestPart("arquivo") MultipartFile arquivo, @RequestPart("configuracao") String configuracao)
            throws IOException {
        limites.previaDeImportacao(eu.usuarioId());
        return service.previa(destino, arquivo.getOriginalFilename(), arquivo.getBytes(), configuracao);
    }

    @PostMapping(value = "/{destino}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize(PERMISSOES)
    public Detalhe confirmar(@AuthenticationPrincipal UsuarioAutenticado eu, @PathVariable String destino,
                             @RequestPart("arquivo") MultipartFile arquivo, @RequestPart("configuracao") String configuracao,
                             @RequestParam String hash) throws IOException {
        limites.confirmacaoDeImportacao(eu.usuarioId());
        return service.confirmar(eu, destino, arquivo.getOriginalFilename(), arquivo.getBytes(), configuracao, hash);
    }
}
