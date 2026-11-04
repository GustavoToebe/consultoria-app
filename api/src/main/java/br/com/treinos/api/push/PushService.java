package br.com.treinos.api.push;

import br.com.treinos.api.push.PushDtos.PushExportado;
import br.com.treinos.api.tenant.TenantContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

/**
 * O token de push do aparelho do aluno e a fila dos avisos. Registrar e remover valem sempre para o usuário da sessão (o
 * controller o entrega). O valor do token nunca vai a log, auditoria nem exportação.
 */
@Service
public class PushService {

    /** Quantos aparelhos um usuário registra; o 6º troca o mais antigo. */
    static final int MAXIMO_DE_TOKENS = 5;

    private final PushRepositorio repositorio;
    private final PushTokenRepository tokens;
    private final PushProperties propriedades;

    PushService(PushRepositorio repositorio, PushTokenRepository tokens, PushProperties propriedades) {
        this.repositorio = repositorio;
        this.tokens = tokens;
        this.propriedades = propriedades;
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

    /**
     * Apaga todos os tokens do usuário. Chamado onde as sessões dele são encerradas (inativar, senha provisória, troca de
     * senha, anonimização e "Excluir minha conta"), com a consultoria dada, sem depender do {@code TenantContext}.
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
            repositorio.enfileirar(consultoriaId, alunoIds);
        }
    }

    /** Exportação do aluno (LGPD): plataforma e data de cada aparelho; nunca o valor do token. */
    @Transactional(readOnly = true)
    public List<PushExportado> exportarDoAluno(UUID alunoId) {
        return tokens.doAluno(TenantContext.get(), alunoId).stream()
                .map(t -> new PushExportado(t.getPlataforma(), t.getCriadoEm())).toList();
    }
}
