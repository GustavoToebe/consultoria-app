package br.com.treinos.api.alunos;

import br.com.treinos.api.alunos.dto.AlunoDtos.AlunoDetalhe;
import br.com.treinos.api.alunos.dto.AlunoDtos.AlunoRequest;
import br.com.treinos.api.alunos.dto.AlunoDtos.AlunoResumo;
import br.com.treinos.api.alunos.dto.AlunoDtos.PaginaAlunos;
import br.com.treinos.api.alunos.dto.AlunoDtos.PlanoAtivoResumo;
import br.com.treinos.api.alunos.dto.AlunoDtos.SituacaoAtualizacao;
import br.com.treinos.api.atualizacoes.AtualizacaoRepository;
import br.com.treinos.api.atualizacoes.RegrasAtualizacao;
import br.com.treinos.api.auth.RefreshTokenService;
import br.com.treinos.api.auth.UsuarioRepository;
import br.com.treinos.api.execucao.ExecucaoSerieRepository;
import br.com.treinos.api.treino.PlanoTreino;
import br.com.treinos.api.treino.PlanoTreinoRepository;
import br.com.plataforma.comum.web.BadRequestException;
import br.com.treinos.api.web.Buscas;
import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.web.Fuso;
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

/** Alunos da consultoria do treinador. Aluno de outra consultoria não é encontrado (404). */
@Service
public class AlunoService {

    private static final Set<String> SITUACOES = Set.of("ATIVO", "INATIVO", "TODOS");

    private final AlunoRepository alunos;
    private final UsuarioRepository usuarios;
    private final RefreshTokenService refreshTokens;
    private final PlanoTreinoRepository planos;
    private final ExecucaoSerieRepository execucoes;
    private final br.com.treinos.api.auditoria.Auditoria auditoria;
    private final AtualizacaoRepository atualizacoes;

    public AlunoService(AlunoRepository alunos, UsuarioRepository usuarios, RefreshTokenService refreshTokens,
                        PlanoTreinoRepository planos, ExecucaoSerieRepository execucoes,br.com.treinos.api.auditoria.Auditoria auditoria,
                        AtualizacaoRepository atualizacoes) {
        this.alunos = alunos;
        this.usuarios = usuarios;
        this.refreshTokens = refreshTokens;
        this.planos = planos;
        this.execucoes = execucoes;
        this.auditoria = auditoria;
        this.atualizacoes = atualizacoes;
    }

    @Transactional(readOnly = true)
    public PaginaAlunos listar(String busca, String situacao, int pagina, int tamanho) {
        return listar(busca,situacao,pagina,tamanho,false);
    }

    @Transactional(readOnly = true)
    public PaginaAlunos listar(String busca, String situacao, int pagina, int tamanho, boolean meus) {
        String filtro = situacao == null ? "ATIVO" : situacao.toUpperCase(Locale.ROOT);
        if (!SITUACOES.contains(filtro)) {
            throw new BadRequestException("Situação precisa ser ATIVO, INATIVO ou TODOS.");
        }
        UUID responsavelId = meus ? ((br.com.treinos.api.security.UsuarioAutenticado)
                org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getPrincipal()).usuarioId() : null;
        Page<Aluno> page = alunos.buscar(Buscas.padrao(busca), filtro, responsavelId,
                PageRequest.of(Math.max(0, pagina), Math.clamp(tamanho, 1, 100)));
        List<UUID> ids = page.getContent().stream().map(Aluno::getId).toList();
        Map<UUID, PlanoTreino> planoAtivo = ids.isEmpty() ? Map.of() : planos.findByAlunoIdInAndAtivoTrue(ids).stream()
                .collect(Collectors.toMap(PlanoTreino::getAlunoId, p -> p));
        Map<UUID, LocalDate> ultimo = new HashMap<>();
        if (!ids.isEmpty()) {
            execucoes.ultimoRegistro(ids).forEach(u -> ultimo.put(u.alunoId(), u.data()));
        }
        Map<UUID, SituacaoAtualizacao> situacoes = situacoesDasAtualizacoes(ids);
        List<AlunoResumo> itens = page.getContent().stream().map(a -> {
            PlanoTreino p = planoAtivo.get(a.getId());
            return new AlunoResumo(a.getId(), a.getNome(), a.isAtivo(), a.getUsuarioId() != null,
                    (p == null || !br.com.treinos.api.equipe.AcessoAtual.pode("TREINO_LER")) ? null : new PlanoAtivoResumo(p.getId(), p.getTitulo()), br.com.treinos.api.equipe.AcessoAtual.pode("REGISTRO_LER") ? ultimo.get(a.getId()) : null,a.getResponsavelId(),
                    situacoes.get(a.getId()));
        }).toList();
        return new PaginaAlunos(itens, page.getTotalElements());
    }

    /** Mesma exigência dos painéis de atualização: ler atualizações e dados sensíveis (as respostas são de saúde). */
    private Map<UUID, SituacaoAtualizacao> situacoesDasAtualizacoes(List<UUID> ids) {
        if (ids.isEmpty() || !br.com.treinos.api.equipe.AcessoAtual.pode("ATUALIZACAO_LER")
                || !br.com.treinos.api.equipe.AcessoAtual.pode("ALUNO_SENSIVEL_LER")) {
            return Map.of();
        }
        LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
        Map<UUID, SituacaoAtualizacao> situacoes = new HashMap<>();
        atualizacoes.linhasDosAlunos(ids).forEach(l -> {
            var r = RegrasAtualizacao.calcular(hoje, l.data(), l.atrasoAte(), l.estado());
            situacoes.put(l.alunoId(), new SituacaoAtualizacao(l.atualizacaoId(), r.fase(), l.data(), r.diasParaData(),
                    r.diasDeAtraso(), l.atrasoAte()));
        });
        return situacoes;
    }

    @Transactional
    @br.com.treinos.api.auditoria.Auditar(acao="ALUNO_CRIADO",entidade="ALUNO",resumo="Cadastrou um aluno.")
    public AlunoDetalhe criar(AlunoRequest r) {
        exigirEscritaSensivel(r);
        Aluno aluno = new Aluno(r.nome().trim(), email(r.email()), Buscas.opcional(r.objetivo()),
                Buscas.opcional(r.observacoes()), r.diasAtualizacao());
        var auth=org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if(auth!=null && auth.getPrincipal() instanceof br.com.treinos.api.security.UsuarioAutenticado eu) aluno.alterarResponsavel(eu.usuarioId());
        else usuarios.findByConsultoriaIdAndPapelOrderByNomeAsc(br.com.treinos.api.tenant.TenantContext.get(),br.com.treinos.api.auth.Papel.TREINADOR).stream().findFirst().ifPresent(u -> aluno.alterarResponsavel(u.getId()));
        definirResponsavel(aluno,r.responsavelId());
        return AlunoDetalhe.de(alunos.saveAndFlush(aluno));
    }

    @Transactional(readOnly = true)
    public AlunoDetalhe detalhe(UUID id) {
        return AlunoDetalhe.de(buscar(id));
    }

    @Transactional
    @br.com.treinos.api.auditoria.Auditar(acao="ALUNO_ALTERADO",entidade="ALUNO",resumo="Editou o cadastro do aluno.")
    public AlunoDetalhe alterar(UUID id, AlunoRequest r) {
        Aluno aluno = buscar(id);
        exigirNaoAnonimizado(aluno);
        if (r.versao() == null || !r.versao().equals(aluno.getVersao())) {
            throw new ConflictException("Outra pessoa ou aba alterou este aluno. Recarregue para ver a versão atual.",
                    "CONFLITO_EDICAO");
        }
        exigirEscritaSensivel(r);
        boolean sensivel = br.com.treinos.api.equipe.AcessoAtual.pode("ALUNO_SENSIVEL_ALTERAR");
        aluno.alterarDados(r.nome().trim(), email(r.email()), sensivel ? Buscas.opcional(r.objetivo()) : aluno.getObjetivo(),
                sensivel ? Buscas.opcional(r.observacoes()) : aluno.getObservacoes(), r.diasAtualizacao());
        UUID anterior=aluno.getResponsavelId();
        definirResponsavel(aluno,r.responsavelId());
        if(!java.util.Objects.equals(anterior,aluno.getResponsavelId()))
            auditoria.registrarEvento("ALUNO_RESPONSAVEL_ALTERADO","ALUNO",aluno.getId(),"Alterou o responsável do aluno.");
        return AlunoDetalhe.de(alunos.saveAndFlush(aluno));
    }

    /**
     * Ativar/inativar (decisão do treinador; "sem registro" nunca inativa ninguém). Inativar derruba as sessões do
     * aluno na hora (versão das credenciais nova, refresh apagados) e bloqueia o login até reativar.
     */
    @Transactional
    @br.com.treinos.api.auditoria.Auditar(acao="ALUNO_SITUACAO",entidade="ALUNO",resumo="Alterou a situação do aluno.")
    public AlunoDetalhe alterarSituacao(UUID id, boolean ativo) {
        Aluno aluno = alunos.buscarParaAlterar(id).orElseThrow(AlunoService::naoEncontrado);
        if (ativo) exigirNaoAnonimizado(aluno);
        aplicarSituacao(aluno, ativo);
        return AlunoDetalhe.de(alunos.saveAndFlush(aluno));
    }

    /** Muda a situação do aluno e do acesso dele; inativar encerra as sessões. Usado também pelo lote. */
    void aplicarSituacao(Aluno aluno, boolean ativo) {
        aluno.alterarSituacao(ativo, Instant.now());
        if (aluno.getUsuarioId() != null) {
            usuarios.buscarParaAlterar(aluno.getUsuarioId()).ifPresent(u -> u.alterarAtivo(ativo));
            if (!ativo) {
                refreshTokens.encerrarTodas(aluno.getUsuarioId());
            }
        }
    }

    /** Cadastro anonimizado não é editado nem reativado: os dados pessoais não podem voltar. */
    public static void exigirNaoAnonimizado(Aluno aluno) {
        if (aluno.isAnonimizado())
            throw new ConflictException("Este aluno foi anonimizado e não pode mais ser alterado.", "ALUNO_ANONIMIZADO");
    }

    /** Responsável tem de ser treinador ativo da mesma consultoria; sem id, não muda nada. Usado também pelo lote. */
    void definirResponsavel(Aluno aluno,UUID id) {
        if(id==null) return;
        var u=usuarios.findById(id).filter(v -> v.getConsultoriaId().equals(br.com.treinos.api.tenant.TenantContext.get())
                && v.isAtivo() && v.getPapel()==br.com.treinos.api.auth.Papel.TREINADOR)
                .orElseThrow(() -> new NaoEncontradoException("Responsável não encontrado."));
        aluno.alterarResponsavel(u.getId());
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
