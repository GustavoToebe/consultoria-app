package br.com.treinos.api.alunos;

import br.com.treinos.api.alunos.dto.AlunoDtos.AlunoDetalhe;
import br.com.treinos.api.alunos.dto.AlunoDtos.AlunoRequest;
import br.com.treinos.api.alunos.dto.AlunoDtos.AlunoResumo;
import br.com.treinos.api.alunos.dto.AlunoDtos.PaginaAlunos;
import br.com.treinos.api.alunos.dto.AlunoDtos.PlanoAtivoResumo;
import br.com.treinos.api.auth.RefreshTokenService;
import br.com.treinos.api.auth.UsuarioRepository;
import br.com.treinos.api.execucao.ExecucaoSerieRepository;
import br.com.treinos.api.treino.PlanoTreino;
import br.com.treinos.api.treino.PlanoTreinoRepository;
import br.com.treinos.api.web.BadRequestException;
import br.com.treinos.api.web.Buscas;
import br.com.treinos.api.web.ConflitoException;
import br.com.treinos.api.web.NaoEncontradoException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/** Alunos da consultoria do treinador (seção 9.3). Aluno de outra consultoria não é encontrado (404). */
@Service
public class AlunoService {

    private static final Set<String> SITUACOES = Set.of("ATIVO", "INATIVO", "TODOS");

    private final AlunoRepository alunos;
    private final UsuarioRepository usuarios;
    private final RefreshTokenService refreshTokens;
    private final PlanoTreinoRepository planos;
    private final ExecucaoSerieRepository execucoes;

    public AlunoService(AlunoRepository alunos, UsuarioRepository usuarios, RefreshTokenService refreshTokens,
                        PlanoTreinoRepository planos, ExecucaoSerieRepository execucoes) {
        this.alunos = alunos;
        this.usuarios = usuarios;
        this.refreshTokens = refreshTokens;
        this.planos = planos;
        this.execucoes = execucoes;
    }

    @Transactional(readOnly = true)
    public PaginaAlunos listar(String busca, String situacao, int pagina, int tamanho) {
        String filtro = situacao == null ? "ATIVO" : situacao.toUpperCase(Locale.ROOT);
        if (!SITUACOES.contains(filtro)) {
            throw new BadRequestException("Situação precisa ser ATIVO, INATIVO ou TODOS.");
        }
        Page<Aluno> page = alunos.buscar(Buscas.padrao(busca), filtro,
                PageRequest.of(Math.max(0, pagina), Math.clamp(tamanho, 1, 100)));
        List<UUID> ids = page.getContent().stream().map(Aluno::getId).toList();
        Map<UUID, PlanoTreino> planoAtivo = ids.isEmpty() ? Map.of() : planos.findByAlunoIdInAndAtivoTrue(ids).stream()
                .collect(Collectors.toMap(PlanoTreino::getAlunoId, p -> p));
        Map<UUID, LocalDate> ultimo = new HashMap<>();
        if (!ids.isEmpty()) {
            execucoes.ultimoRegistro(ids).forEach(u -> ultimo.put(u.alunoId(), u.data()));
        }
        List<AlunoResumo> itens = page.getContent().stream().map(a -> {
            PlanoTreino p = planoAtivo.get(a.getId());
            return new AlunoResumo(a.getId(), a.getNome(), a.isAtivo(), a.getUsuarioId() != null,
                    (p == null || !br.com.treinos.api.equipe.AcessoAtual.pode("TREINO_LER")) ? null : new PlanoAtivoResumo(p.getId(), p.getTitulo()), br.com.treinos.api.equipe.AcessoAtual.pode("REGISTRO_LER") ? ultimo.get(a.getId()) : null,a.getResponsavelId());
        }).toList();
        return new PaginaAlunos(itens, page.getTotalElements());
    }

    @Transactional
    public AlunoDetalhe criar(AlunoRequest r) {
        exigirEscritaSensivel(r);
        Aluno aluno = new Aluno(r.nome().trim(), email(r.email()), Buscas.opcional(r.objetivo()),
                Buscas.opcional(r.observacoes()), r.diasAtualizacao());
        var auth=org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if(auth!=null && auth.getPrincipal() instanceof br.com.treinos.api.security.UsuarioAutenticado eu) aluno.alterarResponsavel(eu.usuarioId());
        else usuarios.findByConsultoriaIdAndPapelOrderByNomeAsc(br.com.treinos.api.tenant.TenantContext.get(),br.com.treinos.api.auth.Papel.TREINADOR).stream().findFirst().ifPresent(u -> aluno.alterarResponsavel(u.getId()));
        return AlunoDetalhe.de(alunos.saveAndFlush(aluno));
    }

    @Transactional(readOnly = true)
    public AlunoDetalhe detalhe(UUID id) {
        return AlunoDetalhe.de(buscar(id));
    }

    @Transactional
    public AlunoDetalhe alterar(UUID id, AlunoRequest r) {
        Aluno aluno = buscar(id);
        if (r.versao() == null || !r.versao().equals(aluno.getVersao())) {
            throw new ConflitoException("Outra pessoa ou aba alterou este aluno. Recarregue para ver a versão atual.",
                    "CONFLITO_EDICAO");
        }
        exigirEscritaSensivel(r);
        boolean sensivel = br.com.treinos.api.equipe.AcessoAtual.pode("ALUNO_SENSIVEL_ALTERAR");
        aluno.alterarDados(r.nome().trim(), email(r.email()), sensivel ? Buscas.opcional(r.objetivo()) : aluno.getObjetivo(),
                sensivel ? Buscas.opcional(r.observacoes()) : aluno.getObservacoes(), r.diasAtualizacao());
        return AlunoDetalhe.de(alunos.saveAndFlush(aluno));
    }

    /**
     * Ativar/inativar (decisão do treinador; "sem registro" nunca inativa ninguém). Inativar derruba as sessões do
     * aluno na hora (versão das credenciais nova, refresh apagados) e bloqueia o login até reativar.
     */
    @Transactional
    public AlunoDetalhe alterarSituacao(UUID id, boolean ativo) {
        Aluno aluno = alunos.buscarParaAlterar(id).orElseThrow(AlunoService::naoEncontrado);
        aluno.alterarSituacao(ativo, Instant.now());
        if (aluno.getUsuarioId() != null) {
            usuarios.buscarParaAlterar(aluno.getUsuarioId()).ifPresent(u -> u.alterarAtivo(ativo));
            if (!ativo) {
                refreshTokens.encerrarTodas(aluno.getUsuarioId());
            }
        }
        return AlunoDetalhe.de(alunos.saveAndFlush(aluno));
    }

    private static void exigirEscritaSensivel(AlunoRequest r) {
        if (r.objetivo() != null || r.observacoes() != null)
            br.com.treinos.api.equipe.AcessoAtual.exigir("ALUNO_SENSIVEL_ALTERAR");
    }

    private Aluno buscar(UUID id) {
        return alunos.findById(id).orElseThrow(AlunoService::naoEncontrado);
    }

    private static String email(String email) {
        return email == null || email.isBlank() ? null : email.trim();
    }

    private static NaoEncontradoException naoEncontrado() {
        return new NaoEncontradoException("Aluno não encontrado.");
    }
}
