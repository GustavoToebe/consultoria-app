package br.com.treinos.api.agenda;

import br.com.treinos.api.agenda.AgendaDtos.AvisoDeCompromisso;
import br.com.treinos.api.agenda.AgendaDtos.AvisoExportado;
import br.com.treinos.api.tenant.TenantContext;
import br.com.treinos.api.web.NaoEncontradoException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * O que o aluno faz com os avisos de compromisso (D12): ler os não vistos e marcar como visto. Sempre o aluno da sessão
 * (o controller o entrega); a geração está em {@link AgendaService} e a limpeza em {@link AvisosDeCompromissoRetencao}.
 */
@Service
public class AvisosDeCompromissoService {

    /** Quantos avisos não vistos a lista devolve (o repositório pede os 20 mais novos). */
    static final int NAO_VISTOS_MAXIMO = 20;

    private final AvisoCompromissoRepository avisos;

    public AvisosDeCompromissoService(AvisoCompromissoRepository avisos) {
        this.avisos = avisos;
    }

    /** Os não vistos do aluno, mais novos primeiro, até {@value #NAO_VISTOS_MAXIMO}. */
    @Transactional(readOnly = true)
    public List<AvisoDeCompromisso> naoVistos(UUID alunoId) {
        return avisos.findTop20ByConsultoriaIdAndAlunoIdAndVistoEmIsNullOrderByCriadoEmDescIdDesc(TenantContext.get(), alunoId)
                .stream().map(a -> new AvisoDeCompromisso(a.getId(), a.getTipo(), a.getInicio(), a.getResponsavelNome()))
                .toList();
    }

    /**
     * Marca como visto. Idempotente: o aviso já visto não muda o {@code visto_em}. Aviso de outro aluno, de outra
     * consultoria ou que não existe = 404 (o mesmo para os três).
     */
    @Transactional
    public void marcarVisto(UUID alunoId, UUID avisoId) {
        UUID consultoriaId = TenantContext.get();
        int marcados = avisos.marcarVisto(consultoriaId, alunoId, avisoId, Instant.now());
        if (marcados == 0 && !avisos.existsByConsultoriaIdAndAlunoIdAndId(consultoriaId, alunoId, avisoId)) {
            throw new NaoEncontradoException("Aviso não encontrado.");
        }
    }

    /** Exportação do aluno (LGPD): só tipo, data do compromisso e datas de criação e de visto. */
    @Transactional(readOnly = true)
    public List<AvisoExportado> exportar(UUID alunoId) {
        return avisos.findByConsultoriaIdAndAlunoIdOrderByCriadoEmAscIdAsc(TenantContext.get(), alunoId).stream()
                .map(a -> new AvisoExportado(a.getTipo(), a.getInicio(), a.getCriadoEm(), a.getVistoEm())).toList();
    }
}
