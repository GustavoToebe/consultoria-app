package br.com.treinos.api.ciclo;

import br.com.treinos.api.security.UsuarioAutenticado;
import br.com.plataforma.comum.web.ForbiddenException;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.UUID;

import static org.springframework.http.HttpStatus.NO_CONTENT;

/** Ciclo da aluna da sessão. Nada é gravado pelo treinador. */
@RestController
@ExigeCiclo
public class CicloAlunoController {

    private final CicloMenstrualService ciclo;

    public CicloAlunoController(CicloMenstrualService ciclo) {
        this.ciclo = ciclo;
    }

    @PreAuthorize("hasRole('ALUNO')")
    @GetMapping("/aluno/ciclo")
    public CicloDtos.CicloDaAluna ler(@AuthenticationPrincipal UsuarioAutenticado eu) {
        return ciclo.daAluna(aluno(eu));
    }

    @PreAuthorize("hasRole('ALUNO')")
    @PostMapping("/aluno/ciclo/ativar")
    public CicloDtos.CicloDaAluna ativar(@AuthenticationPrincipal UsuarioAutenticado eu, @RequestBody @Valid CicloDtos.AtivarCiclo pedido) {
        return ciclo.ativar(aluno(eu), pedido);
    }

    @PreAuthorize("hasRole('ALUNO')")
    @PostMapping("/aluno/ciclo/desativar")
    public CicloDtos.CicloDaAluna desativar(@AuthenticationPrincipal UsuarioAutenticado eu) {
        return ciclo.desativar(aluno(eu));
    }

    @PreAuthorize("hasRole('ALUNO')")
    @PutMapping("/aluno/ciclo/configuracao")
    public CicloDtos.CicloDaAluna configurar(@AuthenticationPrincipal UsuarioAutenticado eu, @RequestBody @Valid CicloDtos.ConfiguracaoCiclo pedido) {
        return ciclo.configurar(aluno(eu), pedido);
    }

    @PreAuthorize("hasRole('ALUNO')")
    @PostMapping("/aluno/ciclo/registros")
    public CicloDtos.RegistroCiclo gravar(@AuthenticationPrincipal UsuarioAutenticado eu, @RequestBody @Valid CicloDtos.RegistroRequest pedido) {
        return ciclo.gravarRegistro(aluno(eu), pedido);
    }

    @PreAuthorize("hasRole('ALUNO')")
    @PutMapping("/aluno/ciclo/registros/{id}")
    public CicloDtos.RegistroCiclo alterar(@AuthenticationPrincipal UsuarioAutenticado eu, @PathVariable UUID id,
                                          @RequestBody @Valid CicloDtos.RegistroRequest pedido) {
        return ciclo.alterarRegistro(aluno(eu), id, pedido);
    }

    @PreAuthorize("hasRole('ALUNO')")
    @DeleteMapping("/aluno/ciclo/registros/{id}")
    @ResponseStatus(NO_CONTENT)
    public void apagarRegistro(@AuthenticationPrincipal UsuarioAutenticado eu, @PathVariable UUID id) {
        ciclo.apagarRegistro(aluno(eu), id);
    }

    @PreAuthorize("hasRole('ALUNO')")
    @DeleteMapping("/aluno/ciclo")
    @ResponseStatus(NO_CONTENT)
    public void apagarTudo(@AuthenticationPrincipal UsuarioAutenticado eu) {
        ciclo.apagarTudo(aluno(eu));
    }

    @PreAuthorize("hasRole('ALUNO')")
    @PutMapping("/aluno/ciclo/dias/{data}")
    public CicloDtos.DiaCiclo gravarDia(@AuthenticationPrincipal UsuarioAutenticado eu, @PathVariable LocalDate data,
                                       @RequestBody @Valid CicloDtos.DiaRequest pedido) {
        return ciclo.gravarDia(aluno(eu), data, pedido);
    }

    @PreAuthorize("hasRole('ALUNO')")
    @DeleteMapping("/aluno/ciclo/dias/{data}")
    @ResponseStatus(NO_CONTENT)
    public void apagarDia(@AuthenticationPrincipal UsuarioAutenticado eu, @PathVariable LocalDate data) {
        ciclo.apagarDia(aluno(eu), data);
    }

    private static UUID aluno(UsuarioAutenticado eu) {
        if (eu.alunoId() == null) {
            throw new ForbiddenException("Acesso negado.");
        }
        return eu.alunoId();
    }
}
