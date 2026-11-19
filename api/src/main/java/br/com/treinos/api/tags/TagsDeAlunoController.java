package br.com.treinos.api.tags;

import br.com.treinos.api.tags.TagsDeAlunoDtos.TagDaConsultoria;
import br.com.treinos.api.tags.TagsDeAlunoDtos.TagRequest;
import br.com.treinos.api.tags.TagsDeAlunoDtos.TagResumo;
import br.com.treinos.api.tags.TagsDeAlunoDtos.TagsDoAlunoRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * Tags de aluno (D5 de {@code docs/planos/tags-de-aluno.md}): ler com {@code ALUNO_LER}; criar, renomear, trocar a cor, apagar e
 * gravar no aluno com {@code ALUNO_ALTERAR}. Só a equipe: o aluno nunca vê as tags. O nome da tag nunca vai a log nem a mensagem de erro.
 */
@RestController
public class TagsDeAlunoController {

    private final TagsDeAlunoService tags;

    public TagsDeAlunoController(TagsDeAlunoService tags) {
        this.tags = tags;
    }

    @PreAuthorize("hasAuthority('PERM_ALUNO_LER')")
    @GetMapping("/tags-de-alunos")
    public List<TagDaConsultoria> listar() {
        return tags.listar();
    }

    @PreAuthorize("hasAuthority('PERM_ALUNO_ALTERAR')")
    @PostMapping("/tags-de-alunos")
    public TagDaConsultoria criar(@RequestBody TagRequest request) {
        return tags.criar(request);
    }

    @PreAuthorize("hasAuthority('PERM_ALUNO_ALTERAR')")
    @PutMapping("/tags-de-alunos/{id}")
    public TagDaConsultoria alterar(@PathVariable UUID id, @RequestBody TagRequest request) {
        return tags.alterar(id, request);
    }

    @PreAuthorize("hasAuthority('PERM_ALUNO_ALTERAR')")
    @DeleteMapping("/tags-de-alunos/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void apagar(@PathVariable UUID id, @RequestParam(required = false) Long versao) {
        tags.apagar(id, versao);
    }

    @PreAuthorize("hasAuthority('PERM_ALUNO_ALTERAR')")
    @PutMapping("/alunos/{id}/tags")
    public List<TagResumo> definirDoAluno(@PathVariable UUID id, @RequestBody @Valid TagsDoAlunoRequest request) {
        return tags.definirDoAluno(id, request);
    }
}
