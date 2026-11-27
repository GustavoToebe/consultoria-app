package br.com.treinos.api.atencao;

import br.com.treinos.api.atencao.RegrasDeAtencaoDtos.RegrasDeAtencao;
import br.com.treinos.api.atencao.RegrasDeAtencaoDtos.SalvarRequest;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * Regras de atenção da consultoria. Ler = {@code ATUALIZACAO_LER} + {@code ALUNO_SENSIVEL_LER} (o mesmo de ler os pontos);
 * salvar = {@code REGRA_ATENCAO_ALTERAR} (que depende de {@code ATUALIZACAO_LER}). Desligado, 503 antes de tudo.
 */
@RestController
@ExigeRegrasAtencao
public class RegrasDeAtencaoController {

    private final RegrasDeAtencaoService regras;

    public RegrasDeAtencaoController(RegrasDeAtencaoService regras) {
        this.regras = regras;
    }

    @PreAuthorize("hasAuthority('PERM_ATUALIZACAO_LER') and hasAuthority('PERM_ALUNO_SENSIVEL_LER')")
    @GetMapping("/regras-de-atencao")
    public RegrasDeAtencao listar() {
        return regras.listar();
    }

    @PreAuthorize("hasAuthority('PERM_REGRA_ATENCAO_ALTERAR') and hasAuthority('PERM_ATUALIZACAO_LER') "
            + "and hasAuthority('PERM_ALUNO_SENSIVEL_LER')")
    @PutMapping("/regras-de-atencao")
    public RegrasDeAtencao salvar(@Valid @RequestBody SalvarRequest r) {
        return regras.salvar(r);
    }
}
