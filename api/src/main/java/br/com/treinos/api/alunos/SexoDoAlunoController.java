package br.com.treinos.api.alunos;

import br.com.treinos.api.security.UsuarioAutenticado;
import br.com.plataforma.comum.web.ForbiddenException;
import jakarta.validation.constraints.Size;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import static org.springframework.http.HttpStatus.NO_CONTENT;

/** A aluna informa o próprio sexo. Nulo apaga. */
@RestController
public class SexoDoAlunoController {

    public record SexoRequest(@Size(max = 10) String sexo) { }

    private final AlunoService alunos;

    public SexoDoAlunoController(AlunoService alunos) {
        this.alunos = alunos;
    }

    @PreAuthorize("hasRole('ALUNO')")
    @PutMapping("/aluno/sexo")
    @ResponseStatus(NO_CONTENT)
    public void definir(@AuthenticationPrincipal UsuarioAutenticado eu, @RequestBody SexoRequest pedido) {
        if (eu.alunoId() == null) {
            throw new ForbiddenException("Acesso negado.");
        }
        alunos.definirSexo(eu.alunoId(), pedido.sexo());
    }
}
