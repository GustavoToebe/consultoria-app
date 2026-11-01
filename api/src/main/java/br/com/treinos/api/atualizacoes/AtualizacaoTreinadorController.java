package br.com.treinos.api.atualizacoes;

import br.com.treinos.api.security.UsuarioAutenticado;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.format.annotation.DateTimeFormat;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
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
     * (repetível: ids de membros desta consultoria, senão 404, e/ou {@code nenhum}) filtra pelo responsável do aluno como o
     * "Meus" ({@code meus=true} equivale ao próprio usuário; os dois juntos = 400 {@code FILTRO_INVALIDO}); {@code busca}
     * procura no nome do aluno, sem acento.
     */
    @PreAuthorize("hasAuthority('PERM_ATUALIZACAO_LER') and hasAuthority('PERM_ALUNO_SENSIVEL_LER')") @GetMapping("/atualizacoes")
    public List<AtualizacaoService.ItemDaLista> listar(@RequestParam(defaultValue = "PARA_REVISAR") String situacao,
            @RequestParam(defaultValue = "false") boolean meus, @RequestParam(required = false) List<String> responsavel,
            @RequestParam(required = false) String busca,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate de,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate ate,
            @AuthenticationPrincipal UsuarioAutenticado eu) {
        return atualizacoes.listar(situacao, atualizacoes.lerFiltro(meus, eu.usuarioId(), responsavel, busca, de, ate));
    }

    /** Quantas há em cada situação (o número das abas) com os mesmos filtros da lista, sem a situação. */
    @PreAuthorize("hasAuthority('PERM_ATUALIZACAO_LER') and hasAuthority('PERM_ALUNO_SENSIVEL_LER')") @GetMapping("/atualizacoes/contagens")
    public Map<String, Long> contagens(@RequestParam(defaultValue = "false") boolean meus,
            @RequestParam(required = false) List<String> responsavel, @RequestParam(required = false) String busca,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate de,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate ate,
            @AuthenticationPrincipal UsuarioAutenticado eu) {
        return atualizacoes.contar(atualizacoes.lerFiltro(meus, eu.usuarioId(), responsavel, busca, de, ate));
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
