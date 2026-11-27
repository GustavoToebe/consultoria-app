package br.com.treinos.api.contratos;

import br.com.treinos.api.tenant.TenantContext;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.UUID;

/**
 * A trava por contrato (D3, D5, D20): o aluno com ao menos um contrato {@code PENDENTE} dele e {@code prazo_ate} já passado (de
 * qualquer signatário) fica restrito à lista fechada do {@code AcessoPausadoInterceptor}. Calculada a cada chamada, sem gravar
 * nada: assinar, cancelar ou prorrogar libera na hora. Com {@code TREINOS_CONTRATOS_HABILITADO} desligado não consulta o banco
 * (nada trava). Erro na consulta sobe como 5xx: a trava nunca libera por falha. Esta é a exceção D20 à regra de que nada bloqueia o
 * aluno sozinho; cobrança vencida continua sem bloquear.
 */
@Component
public class TravaPorContrato {

    private final ContratosProperties propriedades;
    private final ContratoPendenteRepository contratos;

    public TravaPorContrato(ContratosProperties propriedades, ContratoPendenteRepository contratos) {
        this.propriedades = propriedades;
        this.contratos = contratos;
    }

    /**
     * A consultoria vem da sessão do aluno (nunca do cliente) e é posta no contexto por garantia: o filtro JWT já a pôs, mas assim a
     * consulta nunca depende de um contexto vazio (que leria a consultoria "zero" e liberaria por engano).
     */
    public boolean contratoPendenteVencido(UUID consultoriaId, UUID alunoId) {
        if (!propriedades.habilitado()) {
            return false;
        }
        return TenantContext.executarComo(consultoriaId, () -> contratos.existsByAlunoIdAndSituacaoAndPrazoAteBefore(
                alunoId, ContratoAluno.Situacao.PENDENTE, Instant.now()));
    }
}
