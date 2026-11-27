package br.com.treinos.api.atualizacoes;

import br.com.treinos.api.dieta.ConteudoDieta;
import br.com.treinos.api.security.UsuarioAutenticado;
import br.com.treinos.api.treino.ConteudoTreino;
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
    private final PrescricaoDaEpocaService prescricoes;
    public AtualizacaoTreinadorController(AtualizacaoService atualizacoes, EvolucaoRespostasService evolucao, PrescricaoDaEpocaService prescricoes) {
        this.atualizacoes = atualizacoes; this.evolucao = evolucao; this.prescricoes = prescricoes;
    }

    /**
     * {@code de}/{@code ate} (dias de Brasília, os dois ou nenhum, até 366 dias) recortam por período; {@code responsavel}
     * (repetível: ids de membros desta consultoria, senão 404, e/ou {@code nenhum}) filtra pelo responsável do aluno como o
     * "Meus" ({@code meus=true} equivale ao próprio usuário; os dois juntos = 400 {@code FILTRO_INVALIDO}); {@code busca}
     * procura no nome do aluno, sem acento; {@code comAtencao=true} deixa só as enviadas com pontos de atenção (o mesmo filtro em
     * {@code /pagina} e {@code /contagens}; ignorado com as regras de atenção desligadas). Cada item traz {@code pontosDeAtencao}.
     */
    @PreAuthorize("hasAuthority('PERM_ATUALIZACAO_LER') and hasAuthority('PERM_ALUNO_SENSIVEL_LER')") @GetMapping("/atualizacoes")
    public List<AtualizacaoService.ItemDaLista> listar(@RequestParam(defaultValue = "PARA_REVISAR") String situacao,
            @RequestParam(defaultValue = "false") boolean meus, @RequestParam(required = false) List<String> responsavel,
            @RequestParam(required = false) String busca,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate de,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate ate,
            @RequestParam(defaultValue = "false") boolean comAtencao,
            @AuthenticationPrincipal UsuarioAutenticado eu) {
        return atualizacoes.listar(situacao, atualizacoes.lerFiltro(meus, eu.usuarioId(), responsavel, busca, de, ate, comAtencao));
    }

    /** Uma página de {@code /atualizacoes} (30 por padrão, até 100): mesmos filtros, na ordem da tela, com o total da situação. */
    @PreAuthorize("hasAuthority('PERM_ATUALIZACAO_LER') and hasAuthority('PERM_ALUNO_SENSIVEL_LER')") @GetMapping("/atualizacoes/pagina")
    public AtualizacaoService.PaginaDeAtualizacoes pagina(@RequestParam(defaultValue = "PARA_REVISAR") String situacao,
            @RequestParam(defaultValue = "false") boolean meus, @RequestParam(required = false) List<String> responsavel,
            @RequestParam(required = false) String busca,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate de,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate ate,
            @RequestParam(required = false) Integer pagina, @RequestParam(required = false) Integer tamanho,
            @RequestParam(defaultValue = "false") boolean comAtencao, @AuthenticationPrincipal UsuarioAutenticado eu) {
        return atualizacoes.pagina(situacao, atualizacoes.lerFiltro(meus, eu.usuarioId(), responsavel, busca, de, ate, comAtencao), pagina, tamanho);
    }

    /** Quantas há em cada situação (o número das abas) com os mesmos filtros da lista, sem a situação. */
    @PreAuthorize("hasAuthority('PERM_ATUALIZACAO_LER') and hasAuthority('PERM_ALUNO_SENSIVEL_LER')") @GetMapping("/atualizacoes/contagens")
    public Map<String, Long> contagens(@RequestParam(defaultValue = "false") boolean meus,
            @RequestParam(required = false) List<String> responsavel, @RequestParam(required = false) String busca,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate de,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate ate,
            @RequestParam(defaultValue = "false") boolean comAtencao,
            @AuthenticationPrincipal UsuarioAutenticado eu) {
        return atualizacoes.contar(atualizacoes.lerFiltro(meus, eu.usuarioId(), responsavel, busca, de, ate, comAtencao));
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

    /** O treino da pasta que o aluno via quando enviou esta atualização (sem envio, o de agora); {@code versao} nula = nenhum publicado até lá. */
    @PreAuthorize("hasAuthority('PERM_ATUALIZACAO_LER') and hasAuthority('PERM_ALUNO_SENSIVEL_LER') and hasAuthority('PERM_TREINO_LER')") @GetMapping("/atualizacoes/{id}/prescricao/treino")
    public PrescricaoDaEpocaService.Prescricao<ConteudoTreino> prescricaoDoTreino(@PathVariable UUID id) { return prescricoes.treino(id); }

    /** A dieta da pasta que o aluno via quando enviou esta atualização; ergogênicos só com {@code ERGOGENICO_LER}, como na versão do plano. */
    @PreAuthorize("hasAuthority('PERM_ATUALIZACAO_LER') and hasAuthority('PERM_ALUNO_SENSIVEL_LER') and hasAuthority('PERM_DIETA_LER')") @GetMapping("/atualizacoes/{id}/prescricao/dieta")
    public PrescricaoDaEpocaService.Prescricao<ConteudoDieta> prescricaoDaDieta(@PathVariable UUID id) { return prescricoes.dieta(id); }

    @PreAuthorize("hasAuthority('PERM_ATUALIZACAO_LER') and hasAuthority('PERM_ALUNO_SENSIVEL_LER') and hasAuthority('PERM_ATUALIZACAO_RESPONDER')") @PutMapping("/atualizacoes/{id}/feedback")
    public AtualizacaoService.Detalhe responder(@PathVariable UUID id,
            @Valid @RequestBody AtualizacaoService.FeedbackRequest r,
            @AuthenticationPrincipal UsuarioAutenticado eu) {
        return atualizacoes.responder(id,r,eu.usuarioId());
    }
}
