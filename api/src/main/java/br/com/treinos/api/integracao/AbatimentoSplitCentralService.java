package br.com.treinos.api.integracao;

import br.com.treinos.api.conta.ContaLocalRepositorio;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.time.Instant;
import java.util.UUID;

/**
 * Notifica a Central quando uma cobrança de aluno liquidada com {@code ABATER_MENSALIDADE} abateu parte da
 * mensalidade da consultoria na Central, e atualiza atomicamente o saldo local em {@code direitos_locais}.
 * Deve ser chamado fora de transação (faz chamada HTTP). Quando {@code treinos.integracao.ativa=false}, é no-op seguro.
 */
@Service
public class AbatimentoSplitCentralService {

    private static final Logger LOG = LoggerFactory.getLogger(AbatimentoSplitCentralService.class);

    public record AbatimentoSplitPayload(
            String asaasPaymentId,
            UUID cobrancaAlunoId,
            long valorAbatidoCentavos,
            Instant liquidadoEm) { }

    private final ObjectProvider<CentralClient> centralProvider;
    private final IntegracaoProperties propriedades;
    private final ContaLocalRepositorio contas;
    private final JsonMapper json;

    public AbatimentoSplitCentralService(ObjectProvider<CentralClient> centralProvider,
                                         IntegracaoProperties propriedades,
                                         ContaLocalRepositorio contas,
                                         JsonMapper json) {
        this.centralProvider = centralProvider;
        this.propriedades = propriedades;
        this.contas = contas;
        this.json = json;
    }

    /**
     * Envia o abatimento à Central e reduz {@code saldo_abater_centavos} localmente quando confirmado.
     *
     * @return {@code true} se a Central aceitou e o saldo local foi atualizado; {@code false} se integração desligada,
     *         dados inválidos ou falha transitória de comunicação.
     */
    public boolean registrarAbatimento(UUID consultoriaId, String asaasPaymentId, UUID cobrancaAlunoId,
                                       long valorAbatidoCentavos, Instant liquidadoEm) {
        if (!propriedades.ativa()) {
            return false;
        }
        CentralClient central = centralProvider.getIfAvailable();
        if (central == null) {
            return false;
        }
        if (consultoriaId == null || valorAbatidoCentavos <= 0 || asaasPaymentId == null || asaasPaymentId.isBlank()) {
            return false;
        }

        String caminho = "/integracao/v1/produtos/" + propriedades.produto()
                + "/instancias/" + consultoriaId + "/abatimentos-split";
        AbatimentoSplitPayload payload = new AbatimentoSplitPayload(
                asaasPaymentId, cobrancaAlunoId, valorAbatidoCentavos, liquidadoEm);

        try {
            byte[] corpo = json.writeValueAsBytes(payload);
            CentralClient.Resposta resposta = central.postJson(caminho, corpo);
            if (!resposta.sucesso()) {
                LOG.warn("Abatimento por split: a central respondeu {} para consultoria {}.",
                        resposta.status(), consultoriaId);
                return false;
            }
            contas.reduzirSaldoAbater(consultoriaId, valorAbatidoCentavos);
            return true;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            LOG.warn("Abatimento por split: chamada interrompida para consultoria {}.", consultoriaId);
            return false;
        } catch (IOException e) {
            LOG.warn("Abatimento por split: a central não respondeu para consultoria {} ({}).",
                    consultoriaId, e.getClass().getSimpleName());
            return false;
        }
    }
}
