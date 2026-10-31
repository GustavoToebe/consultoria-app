package br.com.treinos.api.importacao.completa;

import br.com.treinos.api.auth.LimiteTentativas;
import br.com.treinos.api.importacao.completa.PlanilhaCompletaDtos.Analise;
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
 * Planilha completa (várias abas ligadas entre si). Por enquanto só a análise: nada é gravado. Usa o mesmo limite por
 * usuário da prévia da importação de uma aba e o mesmo leitor (tamanho, zip, linhas, colunas e texto).
 */
@RestController
@RequestMapping("/importacoes/planilha-completa")
public class PlanilhaCompletaController {

    private final PlanilhaCompletaService service;
    private final LimiteTentativas limites;

    public PlanilhaCompletaController(PlanilhaCompletaService service, LimiteTentativas limites) {
        this.service = service;
        this.limites = limites;
    }

    @PostMapping(value = "/analisar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAuthority('PERM_ALUNO_ALTERAR')")
    public Analise analisar(@AuthenticationPrincipal UsuarioAutenticado eu, @RequestPart("arquivo") MultipartFile arquivo)
            throws IOException {
        limites.previaDeImportacao(eu.usuarioId());
        return service.analisar(arquivo.getOriginalFilename(), arquivo.getBytes());
    }
}
