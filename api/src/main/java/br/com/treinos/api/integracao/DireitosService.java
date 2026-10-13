package br.com.treinos.api.integracao;

import br.com.treinos.api.conta.ContaLocalRepositorio;
import br.com.treinos.api.conta.DireitosLocais;
import br.com.treinos.api.web.BadRequestException;
import br.com.treinos.api.web.ConflitoException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

/**
 * Aplica os direitos que a Central manda (webhook, contrato 5.3) ou lista na sincronização (6.1). Regra única: só versão
 * maior que a gravada altera o snapshot; versão igual ou menor só atualiza {@code confirmado_em}, que é o que mantém o
 * acesso liberado dentro da tolerância. A consultoria precisa ter sido provisionada antes (tem linha em
 * {@code direitos_locais}): a Central não adota uma consultoria só por conhecer o UUID dela.
 */
@Service
public class DireitosService {

    private static final Logger LOG = LoggerFactory.getLogger(DireitosService.class);

    public enum Efeito { APLICADO, CONFIRMADO, IGNORADO }

    public record Resultado(boolean aplicado, long versaoAtual) { }

    private final ContaLocalRepositorio contas;
    private final IntegracaoProperties propriedades;

    public DireitosService(ContaLocalRepositorio contas, IntegracaoProperties propriedades) {
        this.contas = contas;
        this.propriedades = propriedades;
    }

    /** Webhook: consultoria da URL; erro de contrato vira 4xx para a Central ver no painel dela. */
    @Transactional
    public Resultado aplicar(UUID consultoriaId, DireitosInstancia d) {
        if (d.tenantId() != null && !d.tenantId().equals(consultoriaId)) {
            throw new BadRequestException("O tenantId do corpo não é o da URL.");
        }
        if (!propriedades.produto().equalsIgnoreCase(d.produto())) {
            throw new BadRequestException("Direitos de outro produto.");
        }
        DireitosLocais existente = contas.direitos(consultoriaId).orElseThrow(IntegracaoException::instanciaNaoEncontrada);
        if (!existente.contratacaoId().equals(d.contratacaoId())) {
            throw new ConflitoException("A contratação dos direitos não é a vinculada a esta instância.",
                    "IDEMPOTENCY_KEY_CONFLITO");
        }
        boolean aplicado = gravar(consultoriaId, d);
        return new Resultado(aplicado, contas.direitos(consultoriaId).map(DireitosLocais::versao).orElse(d.versao()));
    }

    /** Sincronização: item que não bate com o que existe aqui é ignorado e registrado, nunca derruba a rodada. */
    @Transactional
    public Efeito sincronizar(DireitosInstancia d) {
        if (d.tenantId() == null || !propriedades.produto().equalsIgnoreCase(d.produto())) {
            LOG.warn("Sincronização: item sem tenantId ou de outro produto ({}); ignorado.", d.produto());
            return Efeito.IGNORADO;
        }
        DireitosLocais existente = contas.direitos(d.tenantId()).orElse(null);
        if (existente == null) {
            LOG.warn("Sincronização: a central lista a instância {} que não foi provisionada aqui; ignorada.", d.tenantId());
            return Efeito.IGNORADO;
        }
        if (!existente.contratacaoId().equals(d.contratacaoId())) {
            LOG.warn("Sincronização: a instância {} está vinculada a outra contratação; ignorada.", d.tenantId());
            return Efeito.IGNORADO;
        }
        return gravar(d.tenantId(), d) ? Efeito.APLICADO : Efeito.CONFIRMADO;
    }

    private boolean gravar(UUID consultoriaId, DireitosInstancia d) {
        Instant agora = Instant.now();
        boolean aplicado = contas.aplicarSeMaisNova(d.paraLocal(consultoriaId, agora));
        if (!aplicado) {
            contas.confirmar(consultoriaId, agora);
        }
        return aplicado;
    }
}
