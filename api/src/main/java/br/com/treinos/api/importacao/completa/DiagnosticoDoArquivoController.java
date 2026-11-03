package br.com.treinos.api.importacao.completa;

import br.com.treinos.api.auth.LimiteTentativas;
import br.com.treinos.api.importacao.completa.DiagnosticoDoArquivo.Diagnostico;
import br.com.treinos.api.migracao.ExigeMigracaoAssistida;
import br.com.treinos.api.security.UsuarioAutenticado;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

/**
 * Migração assistida, fase 1: {@code POST /importacoes/diagnostico} diz o que dá para importar do arquivo antes de importar.
 * Não grava nada (nem registro de importação) e não audita, como a prévia; a resposta leva só contagens, códigos de problema e
 * nomes de aba e coluna, nunca valor de célula. Mesmo leitor e mesmo limite por usuário da prévia; mesma permissão da planilha
 * completa. Controller próprio porque {@link ExigeMigracaoAssistida} vale para a classe inteira.
 */
@RestController
@RequestMapping("/importacoes")
@ExigeMigracaoAssistida
public class DiagnosticoDoArquivoController {

    private final DiagnosticoDoArquivoService service;
    private final LimiteTentativas limites;

    public DiagnosticoDoArquivoController(DiagnosticoDoArquivoService service, LimiteTentativas limites) {
        this.service = service;
        this.limites = limites;
    }

    @PostMapping(value = "/diagnostico", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAuthority('PERM_ALUNO_ALTERAR')")
    public Diagnostico diagnosticar(@AuthenticationPrincipal UsuarioAutenticado eu, @RequestPart("arquivo") MultipartFile arquivo)
            throws IOException {
        limites.previaDeImportacao(eu.usuarioId());
        return service.diagnosticar(eu.usuarioId(), arquivo.getOriginalFilename(), arquivo.getBytes());
    }
}
