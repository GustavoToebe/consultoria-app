package br.com.treinos.api.integracao;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;

/**
 * Anti-repetição das chamadas assinadas (contrato 2.4). O nonce é gravado em transação própria, antes do controller: se
 * o controller falhar o nonce continua gravado, e a repetição da mesma chamada é recusada (a Central usa nonce novo a
 * cada tentativa).
 */
@Service
public class IntegracaoNonceService {

    /** O dobro da janela de horário (5 min): depois disso o timestamp já seria recusado de qualquer forma. */
    static final Duration RETENCAO = Duration.ofMinutes(10);

    private final IntegracaoRepositorio repositorio;

    public IntegracaoNonceService(IntegracaoRepositorio repositorio) {
        this.repositorio = repositorio;
    }

    /** {@code false} = nonce repetido. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean registrar(String chaveId, String nonce) {
        return repositorio.registrarNonce(chaveId, nonce);
    }

    @Scheduled(fixedDelay = 600_000, initialDelay = 60_000)
    @Transactional
    public void limpar() {
        repositorio.limparNonces(Instant.now().minus(RETENCAO));
    }
}
