package br.com.treinos.api.execucao;

import br.com.treinos.api.execucao.dto.ExecucaoDtos.ChaveDaTroca;
import br.com.treinos.api.execucao.dto.ExecucaoDtos.TrocasDeExercicio;
import br.com.treinos.api.execucao.dto.ExecucaoDtos.TrocasPendentes;
import br.com.treinos.api.execucao.dto.ExecucaoDtos.VistoDaTroca;
import br.com.treinos.api.security.UsuarioAutenticado;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Trocas de exercício vistas pelo treinador (planos {@code trocar-exercicio.md} e {@code alertas-de-troca.md}): a lista do
 * aluno, as pendências do escopo e o "Visto" ({@code REGISTRO_REAGIR}, sem texto, não auditado, como o do treino
 * concluído). Aluno ou troca de outra consultoria = 404.
 */
@RestController
public class TrocasDeExercicioController {

    private final TrocasDeExercicioService trocas;

    public TrocasDeExercicioController(TrocasDeExercicioService trocas) {
        this.trocas = trocas;
    }

    /** Exercícios que o aluno trocou só naquele dia (últimos 7 dias, até 31), lidos das séries concluídas, com o {@code vistoEm}. */
    @PreAuthorize("hasAuthority('PERM_REGISTRO_LER')")
    @GetMapping("/alunos/{alunoId}/trocas-de-exercicio")
    public TrocasDeExercicio doAluno(@PathVariable UUID alunoId,
                                     @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate de,
                                     @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate ate) {
        return trocas.doAluno(alunoId, de, ate);
    }

    /** Trocas dos últimos 7 dias ainda sem "Visto", de alunos ativos; {@code meus=true} só os do responsável autenticado. */
    @PreAuthorize("hasAuthority('PERM_REGISTRO_LER')")
    @GetMapping("/trocas-de-exercicio/pendentes")
    public TrocasPendentes pendentes(@AuthenticationPrincipal UsuarioAutenticado eu,
                                     @RequestParam(defaultValue = "false") boolean meus) {
        return trocas.pendentes(meus ? eu.usuarioId() : null);
    }

    /** Marca "Visto" na troca da chave do corpo (idempotente). */
    @PreAuthorize("hasAuthority('PERM_REGISTRO_REAGIR')")
    @PutMapping("/alunos/{alunoId}/trocas-de-exercicio/visto")
    public VistoDaTroca marcarVisto(@AuthenticationPrincipal UsuarioAutenticado eu, @PathVariable UUID alunoId,
                                    @RequestBody @Valid ChaveDaTroca chave) {
        return trocas.marcarVisto(alunoId, chave, eu.usuarioId());
    }

    /** Desfaz o "Visto" (idempotente). */
    @PreAuthorize("hasAuthority('PERM_REGISTRO_REAGIR')")
    @DeleteMapping("/alunos/{alunoId}/trocas-de-exercicio/visto")
    public ResponseEntity<Void> desmarcarVisto(@PathVariable UUID alunoId, @RequestBody @Valid ChaveDaTroca chave) {
        trocas.desmarcarVisto(alunoId, chave);
        return ResponseEntity.noContent().build();
    }
}
