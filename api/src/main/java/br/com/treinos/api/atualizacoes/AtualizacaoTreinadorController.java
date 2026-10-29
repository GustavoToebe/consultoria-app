package br.com.treinos.api.atualizacoes;

import br.com.treinos.api.security.UsuarioAutenticado;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import br.com.plataforma.comum.web.BadRequestException;
import org.springframework.format.annotation.DateTimeFormat;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
public class AtualizacaoTreinadorController {
    private final AtualizacaoService atualizacoes;
    private final EvolucaoRespostasService evolucao;
    public AtualizacaoTreinadorController(AtualizacaoService atualizacoes, EvolucaoRespostasService evolucao) {
        this.atualizacoes = atualizacoes; this.evolucao = evolucao;
    }

    /**
     * {@code de}/{@code ate} (dias de Brasília, os dois ou nenhum, até 366 dias) recortam por período; {@code responsavel}
     * filtra pelo responsável do aluno (um membro desta consultoria, senão 404) como o "Meus" ({@code meus=true} equivale
     * ao próprio usuário). Os dois juntos = 400 {@code FILTRO_INVALIDO}.
     */
    @PreAuthorize("hasAuthority('PERM_ATUALIZACAO_LER') and hasAuthority('PERM_ALUNO_SENSIVEL_LER')") @GetMapping("/atualizacoes")
    public List<AtualizacaoService.ItemDaLista> listar(@RequestParam(defaultValue = "PARA_REVISAR") String situacao,
            @RequestParam(defaultValue = "false") boolean meus, @RequestParam(required = false) UUID responsavel,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate de,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate ate,
            @AuthenticationPrincipal UsuarioAutenticado eu) {
        if (meus && responsavel != null)
            throw new BadRequestException("Use meus ou responsavel, não os dois.", "FILTRO_INVALIDO");
        UUID quem = meus ? eu.usuarioId() : responsavel != null ? atualizacoes.exigirResponsavel(responsavel) : null;
        return atualizacoes.listar(situacao, quem, de, ate);
    }
    @PreAuthorize("hasAuthority('PERM_ATUALIZACAO_LER') and hasAuthority('PERM_ALUNO_SENSIVEL_LER')") @GetMapping("/alunos/{alunoId}/atualizacoes")
    public List<AtualizacaoService.Detalhe> doAluno(@PathVariable UUID alunoId) { return atualizacoes.doAluno(alunoId); }

    /** Respostas numéricas (NOTA e NUMERO) das últimas atualizações enviadas, por pergunta; mesma permissão do detalhe. */
    @PreAuthorize("hasAuthority('PERM_ATUALIZACAO_LER') and hasAuthority('PERM_ALUNO_SENSIVEL_LER')") @GetMapping("/alunos/{alunoId}/atualizacoes/evolucao")
    public EvolucaoRespostasService.Evolucao evolucao(@PathVariable UUID alunoId) { return evolucao.doAluno(alunoId); }

    @PreAuthorize("hasAuthority('PERM_ATUALIZACAO_LER') and hasAuthority('PERM_ALUNO_SENSIVEL_LER')") @GetMapping("/alunos/{alunoId}/atualizacao")
    public AtualizacaoService.Detalhe atualDoAluno(@PathVariable UUID alunoId) { return atualizacoes.atualDoAluno(alunoId); }

    @PreAuthorize("hasAuthority('PERM_ATUALIZACAO_LER') and hasAuthority('PERM_ALUNO_SENSIVEL_LER')") @GetMapping("/atualizacoes/{id}")
    public AtualizacaoService.Detalhe detalhe(@PathVariable UUID id) { return atualizacoes.detalheTreinador(id); }

    @PreAuthorize("hasAuthority('PERM_ATUALIZACAO_LER') and hasAuthority('PERM_ALUNO_SENSIVEL_LER') and hasAuthority('PERM_ATUALIZACAO_RESPONDER')") @PutMapping("/atualizacoes/{id}/feedback")
    public AtualizacaoService.Detalhe responder(@PathVariable UUID id,
            @Valid @RequestBody AtualizacaoService.FeedbackRequest r,
            @AuthenticationPrincipal UsuarioAutenticado eu) {
        return atualizacoes.responder(id,r,eu.usuarioId());
    }
}
