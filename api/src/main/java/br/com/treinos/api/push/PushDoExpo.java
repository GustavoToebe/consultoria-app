package br.com.treinos.api.push;

import br.com.treinos.api.push.ExpoCliente.FalhaNoEnvio;
import br.com.treinos.api.push.PushRepositorio.Reservado;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * O job do push do Expo (compromisso marcado, remarcado ou cancelado). Cada rodada, só com {@code TREINOS_PUSH_HABILITADO}:
 * <ol>
 * <li><b>limpa</b> a fila (pendente com mais de {@value #HORAS_DE_VALIDADE} h vira CANCELADO; concluído some em 7 dias);</li>
 * <li><b>reserva</b> lotes de pendentes ({@code skip locked}, lease de {@value #RESERVA_EM_SEGUNDOS} s);</li>
 * <li><b>confere</b> cada um de novo: usuário ainda ativo e aluno não anonimizado (senão apaga os tokens dele e CANCELA, para
 * nunca deixar token órfão) e com token (senão CANCELA);</li>
 * <li><b>envia fora de qualquer transação</b>, em chamadas de até 100 mensagens, e conclui numa transação curta conferindo a
 * posse da reserva.</li>
 * </ol>
 * Falha do Expo (rede, tempo, status) só conta uma tentativa e guarda a classe do erro; na {@value #MAXIMO_DE_TENTATIVAS}ª vira
 * FALHOU. Nunca desfaz nada: o compromisso já foi gravado quando a linha da fila nasceu. {@code DeviceNotRegistered} apaga o
 * token. Nada de token, usuário ou texto em log: só contagens e a classe do erro.
 */
@Component
public class PushDoExpo {

    private static final Logger LOG = LoggerFactory.getLogger(PushDoExpo.class);

    static final int MAXIMO_DE_TENTATIVAS = 3;
    static final long ESPERA_ENTRE_TENTATIVAS_EM_SEGUNDOS = 60;
    static final int RESERVA_EM_SEGUNDOS = 300;
    static final int TAMANHO_DO_LOTE = ExpoCliente.MAXIMO_POR_CHAMADA;
    static final int LOTES_POR_RODADA = 5;
    static final int HORAS_DE_VALIDADE = 6;
    static final String DEVICE_NOT_REGISTERED = "DeviceNotRegistered";
    private static final String LIMITE_DO_EXPO = "MessageRateExceeded";

    /** O que uma rodada fez (só contagens). {@code executou} falso = chave desligada, nada foi feito. */
    public record Resultado(boolean executou, int enviados, int cancelados, int falhas, int tokensApagados) {

        static final Resultado NADA = new Resultado(false, 0, 0, 0, 0);
    }

    private record Mensagem(Reservado envio, String token) { }

    private final PushRepositorio fila;
    private final ExpoCliente expo;
    private final PushProperties propriedades;
    private final TransactionTemplate transacao;

    PushDoExpo(PushRepositorio fila, ExpoCliente expo, PushProperties propriedades, PlatformTransactionManager transacoes) {
        this.fila = fila;
        this.expo = expo;
        this.propriedades = propriedades;
        this.transacao = new TransactionTemplate(transacoes);
    }

    @Scheduled(fixedDelay = 30_000, initialDelay = 30_000)
    void rodarAgendado() {
        if (!propriedades.envioAgendado()) {
            return;
        }
        try {
            Resultado r = rodar();
            if (r.enviados() + r.cancelados() + r.falhas() + r.tokensApagados() > 0) {
                LOG.info("Push: {} enviados, {} cancelados, {} falhas, {} tokens apagados.", r.enviados(), r.cancelados(),
                        r.falhas(), r.tokensApagados());
            }
        } catch (RuntimeException e) {
            LOG.warn("Push falhou ({}).", e.getClass().getSimpleName());
        }
    }

    /** Uma rodada. Chave desligada = não faz nada. Os testes a chamam à mão. */
    public Resultado rodar() {
        if (!propriedades.habilitado()) {
            return Resultado.NADA;
        }
        transacao.executeWithoutResult(s -> fila.limpar(HORAS_DE_VALIDADE));
        UUID dono = UUID.randomUUID();
        int enviados = 0;
        int cancelados = 0;
        int falhas = 0;
        int apagados = 0;
        for (int volta = 0; volta < LOTES_POR_RODADA; volta++) {
            List<Reservado> lote = transacao.execute(s -> fila.reservar(dono, TAMANHO_DO_LOTE, RESERVA_EM_SEGUNDOS));
            if (lote == null || lote.isEmpty()) {
                break;
            }
            Resultado parcial = processar(lote, dono);
            enviados += parcial.enviados();
            cancelados += parcial.cancelados();
            falhas += parcial.falhas();
            apagados += parcial.tokensApagados();
        }
        return new Resultado(true, enviados, cancelados, falhas, apagados);
    }

    private Resultado processar(List<Reservado> lote, UUID dono) {
        int cancelados = 0;
        int falhas = 0;
        int apagados = 0;
        List<Mensagem> mensagens = new ArrayList<>();
        Set<UUID> comMensagem = new HashSet<>();
        for (Reservado envio : lote) {
            try {
                if (!fila.elegivel(envio.consultoriaId(), envio.usuarioId())) {
                    transacao.executeWithoutResult(s -> {
                        fila.apagarDoUsuario(envio.consultoriaId(), envio.usuarioId());
                        fila.cancelar(envio.consultoriaId(), envio.id(), dono, "USUARIO_INATIVO");
                    });
                    cancelados++;
                    continue;
                }
                List<String> tokens = fila.tokens(envio.consultoriaId(), envio.usuarioId());
                if (tokens.isEmpty()) {
                    transacao.executeWithoutResult(s -> fila.cancelar(envio.consultoriaId(), envio.id(), dono, "SEM_TOKEN"));
                    cancelados++;
                    continue;
                }
                tokens.forEach(t -> mensagens.add(new Mensagem(envio, t)));
                comMensagem.add(envio.id());
            } catch (RuntimeException e) {
                falhas += falhou(envio, dono, e.getClass().getSimpleName());
            }
        }
        Map<UUID, String> falhados = new HashMap<>();
        for (int de = 0; de < mensagens.size(); de += ExpoCliente.MAXIMO_POR_CHAMADA) {
            List<Mensagem> parte = mensagens.subList(de, Math.min(de + ExpoCliente.MAXIMO_POR_CHAMADA, mensagens.size()));
            try {
                List<String> erros = expo.enviar(parte.stream().map(Mensagem::token).toList());
                for (int i = 0; i < parte.size(); i++) {
                    String erro = erros.get(i);
                    if (DEVICE_NOT_REGISTERED.equals(erro)) {
                        Mensagem m = parte.get(i);
                        transacao.executeWithoutResult(s -> fila.apagarTokenInvalido(m.envio().consultoriaId(), m.token()));
                        apagados++;
                    } else if (LIMITE_DO_EXPO.equals(erro)) {
                        falhados.put(parte.get(i).envio().id(), LIMITE_DO_EXPO);
                    }
                }
            } catch (FalhaNoEnvio e) {
                LOG.warn("Push não enviado ({}).", e.getMessage());
                parte.forEach(m -> falhados.put(m.envio().id(), e.getMessage()));
            } catch (RuntimeException e) {
                LOG.warn("Push não enviado ({}).", e.getClass().getSimpleName());
                parte.forEach(m -> falhados.put(m.envio().id(), e.getClass().getSimpleName()));
            }
        }
        int enviados = 0;
        for (Reservado envio : lote) {
            if (!comMensagem.contains(envio.id())) {
                continue;
            }
            if (falhados.containsKey(envio.id())) {
                falhas += falhou(envio, dono, falhados.get(envio.id()));
            } else {
                try {
                    transacao.executeWithoutResult(s -> fila.enviado(envio.consultoriaId(), envio.id(), dono));
                    enviados++;
                } catch (RuntimeException e) {
                    // Se nem isso grava, a reserva vence sozinha e volta à fila (pode repetir o aviso; o texto é o mesmo).
                    LOG.warn("Push segue reservado ({}).", e.getClass().getSimpleName());
                }
            }
        }
        return new Resultado(true, enviados, cancelados, falhas, apagados);
    }

    /** Só a classe do erro vai ao banco e ao log. Devolve 1 (para somar nas falhas). */
    private int falhou(Reservado envio, UUID dono, String classe) {
        try {
            transacao.executeWithoutResult(s -> fila.falhou(envio.consultoriaId(), envio.id(), dono, classe,
                    MAXIMO_DE_TENTATIVAS, ESPERA_ENTRE_TENTATIVAS_EM_SEGUNDOS));
        } catch (RuntimeException outra) {
            LOG.warn("Push segue reservado ({}).", outra.getClass().getSimpleName());
        }
        return 1;
    }
}
