package br.com.treinos.api.questionarios;

import br.com.treinos.api.alunos.dto.AlunoDtos.AlunoDetalhe;
import br.com.treinos.api.pastas.PastaDtos.PastaResumo;
import br.com.treinos.api.planos.ResultadoValidacao;
import br.com.treinos.api.questionarios.dto.QuestionarioDtos.*;
import br.com.treinos.api.security.UsuarioAutenticado;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/** Questionários (atualização e anamnese) do treinador. Publicar, duplicar, arquivar, excluir e padrão exigem ALTERAR. */
@RestController
public class QuestionarioController {

    private final QuestionarioService questionarios;

    public QuestionarioController(QuestionarioService questionarios) {
        this.questionarios = questionarios;
    }

    @PreAuthorize("hasAuthority('PERM_QUESTIONARIO_LER')")
    @GetMapping("/questionarios")
    public List<QuestionarioResumo> listar(@RequestParam(defaultValue = "false") boolean arquivados,
                                           @RequestParam(defaultValue = "ATUALIZACAO") Finalidade finalidade) {
        return questionarios.listar(arquivados, finalidade);
    }

    /**
     * Para os seletores do aluno e da pasta (atualização) e do "Enviar anamnese": quem os usa pode não ter permissão de
     * ler o módulo.
     */
    @PreAuthorize("hasAuthority('PERM_QUESTIONARIO_LER') or hasAuthority('PERM_ALUNO_ALTERAR') "
            + "or hasAuthority('PERM_PASTA_ALTERAR') or hasAuthority('PERM_ANAMNESE_ALTERAR')")
    @GetMapping("/questionarios/opcoes")
    public List<OpcaoQuestionario> opcoes(@RequestParam(defaultValue = "ATUALIZACAO") Finalidade finalidade) {
        return questionarios.opcoes(finalidade);
    }

    @PreAuthorize("hasAuthority('PERM_QUESTIONARIO_ALTERAR')")
    @PostMapping("/questionarios")
    public QuestionarioDetalhe criar(@RequestBody @Valid CriarRequest request) {
        return questionarios.criar(request);
    }

    @PreAuthorize("hasAuthority('PERM_QUESTIONARIO_LER')")
    @GetMapping("/questionarios/{id}")
    public QuestionarioDetalhe detalhe(@PathVariable UUID id) {
        return questionarios.detalhe(id);
    }

    @PreAuthorize("hasAuthority('PERM_QUESTIONARIO_ALTERAR')")
    @PutMapping("/questionarios/{id}")
    public QuestionarioDetalhe salvar(@PathVariable UUID id, @RequestBody @Valid SalvarRequest request) {
        return questionarios.salvar(id, request);
    }

    @PreAuthorize("hasAuthority('PERM_QUESTIONARIO_ALTERAR')")
    @PostMapping("/questionarios/{id}/validar")
    public ResultadoValidacao validar(@PathVariable UUID id) {
        return questionarios.validar(id);
    }

    @PreAuthorize("hasAuthority('PERM_QUESTIONARIO_ALTERAR')")
    @PostMapping("/questionarios/{id}/publicar")
    public QuestionarioDetalhe publicar(@PathVariable UUID id, @RequestBody @Valid PublicarRequest request,
                                        @AuthenticationPrincipal UsuarioAutenticado eu) {
        return questionarios.publicar(id, request, eu.usuarioId());
    }

    @PreAuthorize("hasAuthority('PERM_QUESTIONARIO_ALTERAR')")
    @PostMapping("/questionarios/{id}/duplicar")
    public QuestionarioDetalhe duplicar(@PathVariable UUID id) {
        return questionarios.duplicar(id);
    }

    @PreAuthorize("hasAuthority('PERM_QUESTIONARIO_ALTERAR')")
    @PostMapping("/questionarios/{id}/padrao")
    public QuestionarioDetalhe padrao(@PathVariable UUID id) {
        return questionarios.definirPadrao(id);
    }

    @PreAuthorize("hasAuthority('PERM_QUESTIONARIO_ALTERAR')")
    @PostMapping("/questionarios/{id}/arquivar")
    public QuestionarioDetalhe arquivar(@PathVariable UUID id) {
        return questionarios.arquivar(id);
    }

    @PreAuthorize("hasAuthority('PERM_QUESTIONARIO_ALTERAR')")
    @PostMapping("/questionarios/{id}/desarquivar")
    public QuestionarioDetalhe desarquivar(@PathVariable UUID id) {
        return questionarios.desarquivar(id);
    }

    @PreAuthorize("hasAuthority('PERM_QUESTIONARIO_ALTERAR')")
    @DeleteMapping("/questionarios/{id}")
    public ResponseEntity<Void> excluir(@PathVariable UUID id) {
        questionarios.excluir(id);
        return ResponseEntity.noContent().build();
    }

    @PreAuthorize("hasAuthority('PERM_ALUNO_ALTERAR')")
    @PutMapping("/alunos/{id}/questionario")
    public AlunoDetalhe escolherDoAluno(@PathVariable UUID id, @RequestBody @Valid EscolhaRequest request) {
        return questionarios.escolherDoAluno(id, request.questionarioId());
    }

    @PreAuthorize("hasAuthority('PERM_PASTA_ALTERAR')")
    @PutMapping("/pastas/{id}/questionario")
    public PastaResumo escolherDaPasta(@PathVariable UUID id, @RequestBody @Valid EscolhaRequest request) {
        return questionarios.escolherDaPasta(id, request.questionarioId());
    }
}
