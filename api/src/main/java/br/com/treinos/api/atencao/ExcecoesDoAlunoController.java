package br.com.treinos.api.atencao;

import br.com.treinos.api.atencao.ExcecoesDoAlunoDtos.ExcecaoRequest;
import br.com.treinos.api.atencao.ExcecoesDoAlunoDtos.RegrasDoAluno;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * Exceção por aluno (etapa 2, C8). Ler = {@code ATUALIZACAO_LER} + {@code ALUNO_SENSIVEL_LER} (o mesmo das regras e dos pontos);
 * gravar = {@code REGRA_ATENCAO_ALTERAR} + {@code ALUNO_ALTERAR} (R6) e as duas de ler (o PUT devolve a leitura). Desligado, 503.
 */
@RestController
@ExigeRegrasAtencao
public class ExcecoesDoAlunoController {

    private static final String LER = "hasAuthority('PERM_ATUALIZACAO_LER') and hasAuthority('PERM_ALUNO_SENSIVEL_LER')";
    private static final String GRAVAR = LER + " and hasAuthority('PERM_REGRA_ATENCAO_ALTERAR') and hasAuthority('PERM_ALUNO_ALTERAR')";

    private final ExcecoesDoAlunoService excecoes;

    public ExcecoesDoAlunoController(ExcecoesDoAlunoService excecoes) {
        this.excecoes = excecoes;
    }

    @PreAuthorize(LER)
    @GetMapping("/alunos/{alunoId}/regras-de-atencao")
    public RegrasDoAluno listar(@PathVariable UUID alunoId) {
        return excecoes.listar(alunoId);
    }

    @PreAuthorize(GRAVAR)
    @PutMapping("/alunos/{alunoId}/regras-de-atencao/{regraId}")
    public RegrasDoAluno definir(@PathVariable UUID alunoId, @PathVariable UUID regraId, @Valid @RequestBody ExcecaoRequest r) {
        return excecoes.definir(alunoId, regraId, r);
    }

    @PreAuthorize(GRAVAR)
    @DeleteMapping("/alunos/{alunoId}/regras-de-atencao/{regraId}")
    public ResponseEntity<Void> voltarAGeral(@PathVariable UUID alunoId, @PathVariable UUID regraId) {
        excecoes.voltarAGeral(alunoId, regraId);
        return ResponseEntity.noContent().build();
    }
}
