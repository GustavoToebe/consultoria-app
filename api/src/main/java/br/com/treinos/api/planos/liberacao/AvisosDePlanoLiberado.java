package br.com.treinos.api.planos.liberacao;

import br.com.treinos.api.alunos.Aluno;
import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.push.PushService;
import br.com.treinos.api.tenant.TenantContext;
import br.com.treinos.api.web.NaoEncontradoException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * "Seu novo plano está disponível": o aviso dentro do app (lista dos não vistos, marcar como visto) e o gancho do push. Texto
 * sempre fixo no app e no Expo, sem dado pessoal. Criar o aviso é idempotente por aluno: se já há um não visto, não cria outro
 * (a frase é genérica, um basta) e o push, que também guarda um PENDENTE por usuário e tipo, segue a mesma ideia.
 */
@Service
public class AvisosDePlanoLiberado {

    /** O que o app recebe: só o id (para marcar como visto) e quando. O texto é do app. */
    public record AvisoDePlano(UUID id, Instant criadoEm) {
    }

    static final Duration PRAZO_DE_LIMPEZA = Duration.ofDays(30);

    private final AvisoPlanoLiberadoRepository avisos;
    private final AlunoRepository alunos;
    private final PushService push;

    AvisosDePlanoLiberado(AvisoPlanoLiberadoRepository avisos, AlunoRepository alunos, PushService push) {
        this.avisos = avisos;
        this.alunos = alunos;
        this.push = push;
    }

    /**
     * Na MESMA transação que liberou o plano: cria o aviso do app e deixa o push na fila (com a chave do push ligada). Só para
     * aluno ativo, não anonimizado e com acesso ao app; quem não tem acesso nunca abre o app, então nada é criado.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public void avisar(UUID alunoId) {
        UUID consultoriaId = TenantContext.get();
        Aluno aluno = alunos.findById(alunoId).orElse(null);
        if (aluno == null || !aluno.isAtivo() || aluno.isAnonimizado() || aluno.getUsuarioId() == null) {
            return;
        }
        if (!avisos.existsByConsultoriaIdAndAlunoIdAndVistoEmIsNull(consultoriaId, alunoId)) {
            avisos.save(new AvisoPlanoLiberado(alunoId));
        }
        push.enfileirarPlanoLiberado(consultoriaId, alunoId);
    }

    /** Os não vistos do aluno da sessão, mais novos primeiro (até 20). */
    @Transactional(readOnly = true)
    public List<AvisoDePlano> naoVistos(UUID alunoId) {
        return avisos.findTop20ByConsultoriaIdAndAlunoIdAndVistoEmIsNullOrderByCriadoEmDescIdDesc(TenantContext.get(), alunoId)
                .stream().map(a -> new AvisoDePlano(a.getId(), a.getCriadoEm())).toList();
    }

    /** Idempotente: o já visto não muda. Aviso de outro aluno, de outra consultoria ou inexistente = 404 (o mesmo para os três). */
    @Transactional
    public void marcarVisto(UUID alunoId, UUID avisoId) {
        UUID consultoriaId = TenantContext.get();
        int marcados = avisos.marcarVisto(consultoriaId, alunoId, avisoId, Instant.now());
        if (marcados == 0 && !avisos.existsByConsultoriaIdAndAlunoIdAndId(consultoriaId, alunoId, avisoId)) {
            throw new NaoEncontradoException("Aviso não encontrado.");
        }
    }

    /** Seção {@code avisosDePlanoLiberado} da exportação do aluno (LGPD): só as datas de criação e de visto, sem texto. */
    public record AvisoExportado(Instant criadoEm, Instant vistoEm) {
    }

    @Transactional(readOnly = true)
    public List<AvisoExportado> exportar(UUID alunoId) {
        return avisos.findByConsultoriaIdAndAlunoIdOrderByCriadoEmAscIdAsc(TenantContext.get(), alunoId).stream()
                .map(a -> new AvisoExportado(a.getCriadoEm(), a.getVistoEm())).toList();
    }

    /** Anonimização e "Excluir minha conta" (na transação de quem chama): saem os avisos do aluno. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void apagarDoAluno(UUID consultoriaId, UUID alunoId) {
        avisos.apagarDoAluno(consultoriaId, alunoId);
    }

    /** Limpeza diária da rotina de liberação, dentro da consultoria corrente. */
    @Transactional
    public int limpar(UUID consultoriaId, Instant agora) {
        return avisos.apagarAntesDe(consultoriaId, agora.minus(PRAZO_DE_LIMPEZA));
    }
}
