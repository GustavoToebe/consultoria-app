package br.com.treinos.api.pagamentos;

import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.pagamentos.PagamentosDtos.ConferenciaDePagamento;
import br.com.treinos.api.pagamentos.PagamentosDtos.Conferencias;
import br.com.treinos.api.tenant.TenantContext;
import br.com.treinos.api.web.NaoEncontradoException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Objects;
import java.util.UUID;

/**
 * "Pagamentos para conferir": pagamentos que a InfinitePay confirmou e que o sistema não aplicou sozinho (cobrança
 * cancelada, já paga, valor ou link diferente, forma desconhecida, cobrança que não é desta consultoria...). O treinador
 * resolve por fora e marca como conferido. Marcar nunca dá baixa; se quiser, ele registra o pagamento à mão.
 */
@Service
public class ConferenciaService {

    /** Teto da lista: a fila é de exceções; passando disso, o treinador resolve as mais recentes primeiro. */
    static final int MAXIMO_DA_LISTA = 200;

    private final AvisoDePagamentoRepositorio avisos;
    private final Auditoria auditoria;

    public ConferenciaService(AvisoDePagamentoRepositorio avisos, Auditoria auditoria) {
        this.avisos = avisos;
        this.auditoria = auditoria;
    }

    /** Só os avisos CONFERIR da consultoria atual. O nome do aluno é de quem tem {@code ALUNO_LER} (a rota exige). */
    @Transactional(readOnly = true)
    public Conferencias listar() {
        return new Conferencias(avisos.conferencias(consultoria(), MAXIMO_DA_LISTA).stream()
                .map(c -> new ConferenciaDePagamento(c.id(), c.alunoId(), c.alunoNome(), c.cobrancaId(), c.competencia(),
                        c.valorCobrancaCentavos(), c.valorPagoCentavos(), c.motivo(), c.recebidoEm())).toList());
    }

    /**
     * CONFERIR vira CONFERIDO. Já conferido: nada muda e não audita de novo. Aviso de outra consultoria ou inexistente é
     * 404; aviso que não está para conferir é 409. A linha é travada: o conciliador não a toca em CONFERIR/CONFERIDO.
     */
    @Transactional
    public void conferido(UUID id, UUID usuarioId) {
        UUID consultoria = consultoria();
        String situacao = avisos.situacaoTravada(consultoria, id)
                .orElseThrow(() -> new NaoEncontradoException("Pagamento não encontrado."));
        if ("CONFERIDO".equals(situacao)) {
            return;
        }
        if (!"CONFERIR".equals(situacao)) {
            throw new ConflictException("Este pagamento não está na lista para conferir.", "AVISO_NAO_CONFERIVEL");
        }
        avisos.marcarConferido(consultoria, id, usuarioId);
        auditoria.registrarEvento("PAGAMENTO_CONFERIDO", "AVISO_DE_PAGAMENTO", id, "Marcou um pagamento online como conferido.");
    }

    private static UUID consultoria() {
        return Objects.requireNonNull(TenantContext.get());
    }
}
