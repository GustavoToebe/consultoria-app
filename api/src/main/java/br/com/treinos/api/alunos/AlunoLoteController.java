package br.com.treinos.api.alunos;

import br.com.treinos.api.alunos.AlunoLoteService.Resultado;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/** Ações em lote da lista de alunos (até 100 por vez). Mesma permissão da ação individual (alterar o aluno ou convidar). */
@RestController
@RequestMapping("/alunos/lote")
public class AlunoLoteController {

    public record LoteRequest(@NotEmpty @Size(max = AlunoLoteService.LIMITE) List<@NotNull UUID> alunoIds) { }

    public record ResponsavelLoteRequest(@NotEmpty @Size(max = AlunoLoteService.LIMITE) List<@NotNull UUID> alunoIds,
                                         @NotNull UUID responsavelId) { }

    /** {@code questionarioId} nulo = padrão da consultoria. */
    public record QuestionarioLoteRequest(@NotEmpty @Size(max = AlunoLoteService.LIMITE) List<@NotNull UUID> alunoIds,
                                          UUID questionarioId) { }

    /** Sem anotações de validação: {@link ConvitesEmLote} confere (1 a 100, distintos, sem nulo) e dá sempre a mesma mensagem. */
    public record ConvitesLoteRequest(List<UUID> alunoIds) { }

    private final AlunoLoteService lote;
    private final ConvitesEmLote convites;

    public AlunoLoteController(AlunoLoteService lote, ConvitesEmLote convites) {
        this.lote = lote;
        this.convites = convites;
    }

    /** Gera ou renova o convite de cada aluno sem acesso; mesma permissão do convite individual. A resposta leva os links. */
    @PreAuthorize("hasAuthority('PERM_ALUNO_CONVITE')")
    @PostMapping("/convites")
    public ResponseEntity<ConvitesEmLote.Resultado> convites(@RequestBody ConvitesLoteRequest r) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(convites.gerar(r.alunoIds()));
    }

    @PreAuthorize("hasAuthority('PERM_ALUNO_ALTERAR')")
    @PostMapping("/responsavel")
    public Resultado responsavel(@RequestBody @Valid ResponsavelLoteRequest r) {
        return lote.trocarResponsavel(r.alunoIds(), r.responsavelId());
    }

    @PreAuthorize("hasAuthority('PERM_ALUNO_ALTERAR')")
    @PostMapping("/questionario")
    public Resultado questionario(@RequestBody @Valid QuestionarioLoteRequest r) {
        return lote.trocarQuestionario(r.alunoIds(), r.questionarioId());
    }

    @PreAuthorize("hasAuthority('PERM_ALUNO_ALTERAR')")
    @PostMapping("/desativar")
    public Resultado desativar(@RequestBody @Valid LoteRequest r) {
        return lote.desativar(r.alunoIds());
    }
}
