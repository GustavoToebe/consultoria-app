package br.com.treinos.api.push;

import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.auth.Papel;
import br.com.treinos.api.auth.Usuario;
import br.com.treinos.api.auth.UsuarioRepository;
import br.com.treinos.api.equipe.PermissoesDoUsuario;
import br.com.treinos.api.push.PushDtos.PushExportado;
import br.com.treinos.api.tenant.TenantContext;
import br.com.treinos.api.web.NaoEncontradoException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * O token de push do aparelho (do aluno e do membro da equipe) e a fila dos avisos. Registrar e remover valem sempre para o
 * usuário da sessão (o controller o entrega). O valor do token nunca vai a log, auditoria nem exportação.
 */
@Service
public class PushService {

    /** Quantos aparelhos um usuário registra; o 6º troca o mais antigo. */
    static final int MAXIMO_DE_TOKENS = 5;

    /** R8: quem lê os pontos de atenção (o Administrador tem todas, por {@code PermissoesDoUsuario}). */
    static final Set<String> PERMISSOES_DA_ATENCAO = Set.of("ATUALIZACAO_LER", "ALUNO_SENSIVEL_LER");

    /** O membro, conferido de novo pelo job na hora do envio do push de atenção. */
    public enum Membro { RECEBE, NAO_RECEBE, INATIVO }

    private final PushRepositorio repositorio;
    private final PushTokenRepository tokens;
    private final PushProperties propriedades;
    private final UsuarioRepository usuarios;
    private final PermissoesDoUsuario permissoes;
    private final Auditoria auditoria;

    PushService(PushRepositorio repositorio, PushTokenRepository tokens, PushProperties propriedades, UsuarioRepository usuarios,
            PermissoesDoUsuario permissoes, Auditoria auditoria) {
        this.repositorio = repositorio;
        this.tokens = tokens;
        this.propriedades = propriedades;
        this.usuarios = usuarios;
        this.permissoes = permissoes;
        this.auditoria = auditoria;
    }

    @Transactional
    public void registrar(UUID usuarioId, String token, String plataforma) {
        repositorio.registrar(TenantContext.get(), usuarioId, token, plataforma, MAXIMO_DE_TOKENS);
    }

    /** Idempotente: token que não existe não é erro. */
    @Transactional
    public void remover(UUID usuarioId, String token) {
        repositorio.removerToken(TenantContext.get(), usuarioId, token);
    }

    /** Sem informar o token (o aparelho não o devolveu): apaga todos os do próprio usuário da sessão. */
    @Transactional
    public void removerTodos(UUID usuarioId) {
        repositorio.apagarDoUsuario(TenantContext.get(), usuarioId);
    }

    /**
     * Apaga todos os tokens do usuário. Chamado onde as sessões dele são encerradas (inativar, senha provisória, troca de
     * senha, "esqueci a senha", anonimização, "Excluir minha conta" e, na equipe, desativar, trocar o perfil ou tirar
     * permissões dele), com a consultoria dada, sem depender do {@code TenantContext}.
     */
    @Transactional
    public void apagarDoUsuario(UUID consultoriaId, UUID usuarioId) {
        if (consultoriaId != null && usuarioId != null) {
            repositorio.apagarDoUsuario(consultoriaId, usuarioId);
        }
    }

    /**
     * Gancho do aviso de compromisso: na MESMA transação que grava o aviso interno, deixa um envio na fila para cada aluno
     * avisado que tem token. Com a chave desligada não faz nada.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public void enfileirarParaAlunos(UUID consultoriaId, Collection<UUID> alunoIds) {
        if (propriedades.habilitado() && !alunoIds.isEmpty()) {
            repositorio.enfileirar(consultoriaId, alunoIds, TipoDePush.COMPROMISSO);
        }
    }

    /**
     * Gancho do plano liberado: na MESMA transação que o libera, deixa um envio {@code PLANO_LIBERADO} na fila (texto fixo, sem
     * dado pessoal) se o aluno tem token. Chave desligada: não faz nada (fica só o aviso dentro do app).
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public void enfileirarPlanoLiberado(UUID consultoriaId, UUID alunoId) {
        if (propriedades.habilitado()) {
            repositorio.enfileirar(consultoriaId, List.of(alunoId), TipoDePush.PLANO_LIBERADO);
        }
    }

    /**
     * Gancho das regras de atenção (R7, R8): na MESMA transação do envio da atualização que teve pontos de atenção (depois de os
     * fatos serem gravados), deixa um {@code ATUALIZACAO_ATENCAO} para o responsável do aluno, se ele é membro ativo, tem
     * {@link #PERMISSOES_DA_ATENCAO}, a preferência ligada e token. Sem responsável, ninguém; nenhum outro membro da equipe. O corpo
     * (primeiro nome do aluno, sem quantos nem o que bateu) é montado pelo job na hora do envio. Chave do push desligada: nada.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public void enfileirarAtencaoAoResponsavel(UUID consultoriaId, UUID alunoId) {
        if (!propriedades.habilitado()) {
            return;
        }
        UUID responsavel = repositorio.responsavelDoAluno(consultoriaId, alunoId);
        if (responsavel == null) {
            return;
        }
        usuarios.findById(responsavel).filter(u -> consultoriaId.equals(u.getConsultoriaId())).filter(this::recebeAtencao)
                .ifPresent(u -> repositorio.enfileirarAtencao(consultoriaId, u.getId(), alunoId));
    }

    /**
     * O job confere de novo o membro de um {@code ATUALIZACAO_ATENCAO} (a fila não guarda o aluno: "ainda responsável" é conferido
     * ao enfileirar e, para pôr o nome no corpo, em {@code PushRepositorio.nomesDaAtencao}). Quem chama já está em {@code TenantContext.executarComo(consultoriaId)}, com a transação aberta
     * aqui dentro: o perfil tem {@code @TenantId} e, sem o contexto, ninguém teria permissão.
     */
    @Transactional(readOnly = true)
    public Membro situacaoDoMembro(UUID consultoriaId, UUID usuarioId) {
        Usuario u = usuarios.findById(usuarioId).filter(x -> consultoriaId.equals(x.getConsultoriaId())).orElse(null);
        if (u == null || !u.isAtivo()) {
            return Membro.INATIVO;
        }
        return recebeAtencao(u) ? Membro.RECEBE : Membro.NAO_RECEBE;
    }

    private boolean recebeAtencao(Usuario u) {
        return u.isAtivo() && u.getPapel() == Papel.TREINADOR && u.isPushAtencao()
                && permissoes.codigos(u).containsAll(PERMISSOES_DA_ATENCAO);
    }

    /** {@code GET /eu/preferencias-de-push}: a preferência da conta do membro da sessão. */
    @Transactional(readOnly = true)
    public boolean preferenciaDeAtencao(UUID usuarioId) {
        return daSessao(usuarios.findById(usuarioId)).isPushAtencao();
    }

    /** {@code PUT /eu/preferencias-de-push}: mesmo valor não grava nem audita; quando muda, auditoria de resumo fixo. */
    @Transactional
    public boolean alterarPreferenciaDeAtencao(UUID usuarioId, boolean ligado) {
        Usuario u = daSessao(usuarios.buscarParaAlterar(usuarioId));
        if (u.isPushAtencao() != ligado) {
            u.alterarPushAtencao(ligado);
            auditoria.registrarEvento("PUSH_ATENCAO_ALTERADO", "USUARIO", u.getId(), "Alterou o aviso no celular de pontos de atenção.");
        }
        return ligado;
    }

    private static Usuario daSessao(Optional<Usuario> u) {
        return u.filter(x -> x.getConsultoriaId().equals(TenantContext.get()))
                .orElseThrow(() -> new NaoEncontradoException("Usuário não encontrado."));
    }

    /** Exportação do aluno (LGPD): plataforma e data de cada aparelho; nunca o valor do token. */
    @Transactional(readOnly = true)
    public List<PushExportado> exportarDoAluno(UUID alunoId) {
        return tokens.doAluno(TenantContext.get(), alunoId).stream()
                .map(t -> new PushExportado(t.getPlataforma(), t.getCriadoEm())).toList();
    }
}
