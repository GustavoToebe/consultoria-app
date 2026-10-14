package br.com.treinos.api.privacidade;

import br.com.treinos.api.alunos.dto.AlunoDtos.AlunoDetalhe;
import br.com.treinos.api.privacidade.PrivacidadeDtos.AnonimizarRequest;
import br.com.treinos.api.privacidade.PrivacidadeDtos.Exportacao;
import jakarta.validation.Valid;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/** Exportar e anonimizar os dados de um aluno (LGPD). Aluno de outra consultoria = 404. */
@RestController
@RequestMapping("/alunos/{alunoId}")
public class PrivacidadeController {

    private final ExportacaoService exportacao;
    private final AnonimizacaoService anonimizacao;

    public PrivacidadeController(ExportacaoService exportacao, AnonimizacaoService anonimizacao) {
        this.exportacao = exportacao;
        this.anonimizacao = anonimizacao;
    }

    /** Arquivo para baixar (nome sem dado pessoal) e nunca em cache. */
    @PreAuthorize("hasAuthority('PERM_ALUNO_EXPORTAR')")
    @GetMapping("/exportacao")
    public ResponseEntity<Exportacao> exportar(@PathVariable UUID alunoId) {
        Exportacao corpo = exportacao.exportar(alunoId);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename("dados-do-aluno.json").build().toString())
                .cacheControl(CacheControl.noStore())
                .body(corpo);
    }

    @PreAuthorize("hasAuthority('PERM_ALUNO_ANONIMIZAR')")
    @PostMapping("/anonimizar")
    public AlunoDetalhe anonimizar(@PathVariable UUID alunoId, @RequestBody @Valid AnonimizarRequest request) {
        return anonimizacao.anonimizar(alunoId, request);
    }
}
