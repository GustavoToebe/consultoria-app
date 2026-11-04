package br.com.treinos.api.push;

import br.com.treinos.api.push.ExpoCliente.FalhaNoEnvio;
import br.com.treinos.api.push.PushRepositorio.Reservado;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Clock;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
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
 * Falha do Expo que pode passar (rede, tempo, status, resposta inválida, {@code MessageRateExceeded}) só conta uma tentativa e
 * guarda a classe ou o código do erro; na {@value #MAXIMO_DE_TENTATIVAS}ª vira FALHOU. Qualquer outro código do ticket
 * ({@code InvalidCredentials}, {@code MessageTooBig}, ...) é falha definitiva: FALHOU na hora, com o código do Expo (um enum,
 * não dado pessoal) em {@code erro}. Nunca desfaz nada: o compromisso já foi gravado quando a linha da fila nasceu.
 * {@code DeviceNotRegistered} apaga o token. Nada de token, usuário ou texto em log: só contagens e o código ou a classe do erro.
 * Envio que falhou só em parte (um aparelho com {@code MessageRateExceeded}, ou a conclusão que não gravou depois de o Expo
 * aceitar) tenta de novo só com os aparelhos que ainda não receberam ({@link EntreguesNoEnvio}, em memória).
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

    /**
     * O que uma rodada fez (só contagens). {@code executou} falso = chave desligada, nada foi feito. {@code falhasPorCodigo} soma
     * as falhas pelo código do Expo ou pela classe do erro (nunca token nem usuário).
     */
    public record Resultado(boolean executou, int enviados, int cancelados, int falhas, int tokensApagados,
                            Map<String, Integer> falhasPorCodigo) {

        static final Resultado NADA = new Resultado(false, 0, 0, 0, 0, Map.of());
    }

    record Mensagem(Reservado envio, String token) { }

    record Grupo(Reservado envio, List<String> tokens) { }

    private final PushRepositorio fila;
    private final ExpoCliente expo;
    private final PushProperties propriedades;
    private final TransactionTemplate transacao;
    private final EntreguesNoEnvio entregues = new EntreguesNoEnvio(Clock.systemUTC());

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
                LOG.info("Push: {} enviados, {} cancelados, {} falhas {}, {} tokens apagados.", r.enviados(), r.cancelados(),
                        r.falhas(), r.falhasPorCodigo(), r.tokensApagados());
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
        entregues.esquecerAntigos(Duration.ofHours(HORAS_DE_VALIDADE));
        UUID dono = UUID.randomUUID();
        int enviados = 0;
        int cancelados = 0;
        int falhas = 0;
        int apagados = 0;
        Map<String, Integer> porCodigo = new TreeMap<>();
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
            parcial.falhasPorCodigo().forEach((codigo, n) -> porCodigo.merge(codigo, n, Integer::sum));
        }
        return new Resultado(true, enviados, cancelados, falhas, apagados, porCodigo);
    }

    private Resultado processar(List<Reservado> lote, UUID dono) {
        int enviadosSemChamar = 0;
        int cancelados = 0;
        int apagados = 0;
        Map<String, Integer> porCodigo = new TreeMap<>();
        List<Grupo> grupos = new ArrayList<>();
        for (Reservado envio : lote) {
            try {
                if (!fila.elegivel(envio.consultoriaId(), envio.usuarioId())) {
                    transacao.executeWithoutResult(s -> {
                        fila.apagarDoUsuario(envio.consultoriaId(), envio.usuarioId());
                        fila.cancelar(envio.consultoriaId(), envio.id(), dono, "USUARIO_INATIVO");
                    });
                    entregues.esquecer(envio.id());
                    cancelados++;
                    continue;
                }
                List<String> tokens = fila.tokens(envio.consultoriaId(), envio.usuarioId());
                if (tokens.isEmpty()) {
                    transacao.executeWithoutResult(s -> fila.cancelar(envio.consultoriaId(), envio.id(), dono, "SEM_TOKEN"));
                    entregues.esquecer(envio.id());
                    cancelados++;
                    continue;
                }
                // Nova tentativa de um envio que já chegou a parte dos aparelhos: vai só aos que ainda não receberam.
                List<String> faltam = entregues.semReceber(envio.id(), tokens);
                if (faltam.isEmpty()) {
                    // Todos já receberam (a conclusão da tentativa anterior não gravou): só conclui, sem avisar de novo.
                    if (concluirEnviado(envio, dono)) {
                        enviadosSemChamar++;
                    }
                    continue;
                }
                // Um usuário tem no máximo 5 aparelhos; o corte é só para um envio nunca estourar sozinho o limite do Expo.
                grupos.add(new Grupo(envio, faltam.subList(0, Math.min(faltam.size(), ExpoCliente.MAXIMO_POR_CHAMADA))));
            } catch (RuntimeException e) {
                falhou(envio, dono, e.getClass().getSimpleName(), false, porCodigo);
            }
        }
        Map<UUID, String> falhados = new HashMap<>();
        Map<UUID, String> definitivos = new HashMap<>();
        for (List<Mensagem> parte : emChamadas(grupos)) {
            try {
                List<String> erros = expo.enviar(parte.stream().map(Mensagem::token).toList());
                for (int i = 0; i < parte.size(); i++) {
                    String erro = erros.get(i);
                    Mensagem m = parte.get(i);
                    if (erro == null) {
                        entregues.recebeu(m.envio().id(), m.token());
                        continue;
                    }
                    if (DEVICE_NOT_REGISTERED.equals(erro)) {
                        transacao.executeWithoutResult(s -> fila.apagarTokenInvalido(m.envio().consultoriaId(), m.token()));
                        apagados++;
                    } else if (LIMITE_DO_EXPO.equals(erro)) {
                        falhados.put(m.envio().id(), LIMITE_DO_EXPO);
                    } else {
                        definitivos.put(m.envio().id(), erro);
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
        int enviados = enviadosSemChamar;
        for (Grupo g : grupos) {
            Reservado envio = g.envio();
            if (falhados.containsKey(envio.id())) {
                boolean ultima = envio.tentativas() + 1 >= MAXIMO_DE_TENTATIVAS;
                if (falhou(envio, dono, falhados.get(envio.id()), false, porCodigo) && ultima) {
                    entregues.esquecer(envio.id());
                }
            } else if (definitivos.containsKey(envio.id())) {
                if (falhou(envio, dono, definitivos.get(envio.id()), true, porCodigo)) {
                    entregues.esquecer(envio.id());
                }
            } else if (concluirEnviado(envio, dono)) {
                enviados++;
            }
        }
        int falhas = porCodigo.values().stream().mapToInt(Integer::intValue).sum();
        return new Resultado(true, enviados, cancelados, falhas, apagados, porCodigo);
    }

    /**
     * Marca ENVIADO e esquece quem já recebeu. Se nem isso grava, a reserva vence sozinha e o envio volta à fila; quem já
     * recebeu fica lembrado, e a nova tentativa só conclui, sem avisar os aparelhos de novo.
     */
    private boolean concluirEnviado(Reservado envio, UUID dono) {
        try {
            transacao.executeWithoutResult(s -> fila.enviado(envio.consultoriaId(), envio.id(), dono));
            entregues.esquecer(envio.id());
            return true;
        } catch (RuntimeException e) {
            LOG.warn("Push segue reservado ({}).", e.getClass().getSimpleName());
            return false;
        }
    }

    /** Junta as mensagens em chamadas de até 100 sem separar as de um mesmo envio: se não cabe inteiro, começa outra chamada. */
    static List<List<Mensagem>> emChamadas(List<Grupo> grupos) {
        List<List<Mensagem>> chamadas = new ArrayList<>();
        List<Mensagem> atual = new ArrayList<>();
        for (Grupo g : grupos) {
            if (!atual.isEmpty() && atual.size() + g.tokens().size() > ExpoCliente.MAXIMO_POR_CHAMADA) {
                chamadas.add(atual);
                atual = new ArrayList<>();
            }
            for (String token : g.tokens()) {
                atual.add(new Mensagem(g.envio(), token));
            }
        }
        if (!atual.isEmpty()) {
            chamadas.add(atual);
        }
        return chamadas;
    }

    /**
     * Só o código ou a classe do erro vai ao banco e ao log. {@code definitiva}: não adianta tentar de novo, vira FALHOU na hora
     * (máximo de uma tentativa). Soma a falha por código para o resumo da rodada. Devolve se a falha foi gravada.
     */
    private boolean falhou(Reservado envio, UUID dono, String codigo, boolean definitiva, Map<String, Integer> porCodigo) {
        porCodigo.merge(codigo, 1, Integer::sum);
        try {
            transacao.executeWithoutResult(s -> fila.falhou(envio.consultoriaId(), envio.id(), dono, codigo,
                    definitiva ? 1 : MAXIMO_DE_TENTATIVAS, ESPERA_ENTRE_TENTATIVAS_EM_SEGUNDOS));
            return true;
        } catch (RuntimeException outra) {
            LOG.warn("Push segue reservado ({}).", outra.getClass().getSimpleName());
            return false;
        }
    }
}
