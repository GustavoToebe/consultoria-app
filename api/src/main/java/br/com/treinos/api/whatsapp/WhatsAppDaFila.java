package br.com.treinos.api.whatsapp;

import br.com.treinos.api.tenant.TenantContext;
import br.com.treinos.api.web.Fuso;
import br.com.treinos.api.whatsapp.MetaCliente.FalhaNaMeta;
import br.com.treinos.api.whatsapp.PreparoDoAviso.Preparo;
import br.com.treinos.api.whatsapp.WhatsAppRepositorio.Reservado;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * O job dos avisos pelo WhatsApp (lembrete de cobrança e compromisso), no desenho do {@code PushDoExpo}. Cada rodada, só com
 * {@code TREINOS_WHATSAPP_HABILITADO}:
 * <ol>
 * <li><b>limpa</b> a fila (pendente com mais de {@value #HORAS_DE_VALIDADE} h vira CANCELADO; o histórico some em
 * {@value #DIAS_DE_HISTORICO} dias);</li>
 * <li><b>reserva</b> lotes de pendentes ({@code skip locked}, lease de {@value #RESERVA_EM_SEGUNDOS} s);</li>
 * <li><b>confere</b> cada um de novo, numa transação curta somente leitura dentro da consultoria dele ({@link PreparoDoAviso}:
 * aluno ativo, opt-in, telefone, conexão, modelo e, no lembrete, a cobrança); senão CANCELADO com o motivo;</li>
 * <li><b>envia fora de qualquer transação</b> ({@link MetaCliente}: 5 s, sem redirecionamento) e conclui numa transação curta
 * conferindo a posse da reserva, guardando o id da mensagem na Meta.</li>
 * </ol>
 * Falha que pode passar (rede, tempo, 5xx, limite de taxa da Meta) conta uma tentativa e volta à fila; na
 * {@value #MAXIMO_DE_TENTATIVAS}ª vira FALHOU. Erro permanente (token inválido, modelo inexistente ou não aprovado, número sem
 * WhatsApp...) é FALHOU na hora, com o código da Meta. Nunca desfaz nada: o fato (cobrança, compromisso) já foi gravado quando a
 * linha nasceu. Nada de telefone, nome, texto ou token em log, na fila ou na exceção: só contagens e o código do erro. Se a Meta
 * aceitou e a conclusão não gravou, o id da mensagem fica em memória e a nova tentativa só conclui, sem mandar de novo (a API
 * reiniciada nesse intervalo esquece e pode mandar uma segunda vez).
 */
@Component
public class WhatsAppDaFila {

    private static final Logger LOG = LoggerFactory.getLogger(WhatsAppDaFila.class);

    static final int MAXIMO_DE_TENTATIVAS = 3;
    static final long ESPERA_ENTRE_TENTATIVAS_EM_SEGUNDOS = 60;
    static final int RESERVA_EM_SEGUNDOS = 300;
    static final int TAMANHO_DO_LOTE = 50;
    static final int LOTES_POR_RODADA = 5;
    static final int HORAS_DE_VALIDADE = 24;
    static final int DIAS_DE_HISTORICO = 180;

    /** O que uma rodada fez (só contagens). {@code executou} falso = chave desligada, nada foi feito. */
    public record Resultado(boolean executou, int enviados, int cancelados, int falhas, Map<String, Integer> falhasPorCodigo) {

        static final Resultado NADA = new Resultado(false, 0, 0, 0, Map.of());
    }

    private enum Fim { ENVIADO, CANCELADO, FALHOU }

    private final WhatsAppRepositorio fila;
    private final PreparoDoAviso preparo;
    private final MetaCliente meta;
    private final WhatsAppProperties propriedades;
    private final TransactionTemplate transacao;
    /** Mensagens que a Meta aceitou mas cuja conclusão não gravou: envio → id da mensagem. Só em memória. */
    private final Map<UUID, String> aceitasSemConclusao = new ConcurrentHashMap<>();

    WhatsAppDaFila(WhatsAppRepositorio fila, PreparoDoAviso preparo, MetaCliente meta, WhatsAppProperties propriedades,
                   PlatformTransactionManager transacoes) {
        this.fila = fila;
        this.preparo = preparo;
        this.meta = meta;
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
            if (r.enviados() + r.cancelados() + r.falhas() > 0) {
                LOG.info("WhatsApp: {} enviados, {} cancelados, {} falhas {}.", r.enviados(), r.cancelados(), r.falhas(),
                        r.falhasPorCodigo());
            }
        } catch (RuntimeException e) {
            LOG.warn("WhatsApp falhou ({}).", e.getClass().getSimpleName());
        }
    }

    /** Uma rodada. Chave desligada = não faz nada. Os testes a chamam à mão. */
    public Resultado rodar() {
        if (!propriedades.habilitado()) {
            return Resultado.NADA;
        }
        transacao.executeWithoutResult(s -> fila.limpar(HORAS_DE_VALIDADE, DIAS_DE_HISTORICO));
        LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
        UUID dono = UUID.randomUUID();
        int enviados = 0;
        int cancelados = 0;
        Map<String, Integer> porCodigo = new TreeMap<>();
        for (int volta = 0; volta < LOTES_POR_RODADA; volta++) {
            List<Reservado> lote = transacao.execute(s -> fila.reservar(dono, TAMANHO_DO_LOTE, RESERVA_EM_SEGUNDOS));
            if (lote == null || lote.isEmpty()) {
                break;
            }
            for (Reservado envio : lote) {
                switch (processar(envio, dono, hoje, porCodigo)) {
                    case ENVIADO -> enviados++;
                    case CANCELADO -> cancelados++;
                    case FALHOU -> { }
                }
            }
        }
        int falhas = porCodigo.values().stream().mapToInt(Integer::intValue).sum();
        return new Resultado(true, enviados, cancelados, falhas, porCodigo);
    }

    private Fim processar(Reservado envio, UUID dono, LocalDate hoje, Map<String, Integer> porCodigo) {
        // A Meta já aceitou numa tentativa anterior e a conclusão não gravou: só conclui, sem mandar de novo.
        String jaAceita = aceitasSemConclusao.get(envio.id());
        if (jaAceita != null) {
            return concluir(envio, dono, jaAceita) ? Fim.ENVIADO : Fim.FALHOU;
        }
        Preparo pronto;
        try {
            // O Hibernate lê o tenant ao abrir a sessão: a consultoria entra antes da transação do preparo.
            pronto = TenantContext.executarComo(envio.consultoriaId(), () -> preparo.preparar(envio, hoje));
        } catch (RuntimeException e) {
            return falhou(envio, dono, e.getClass().getSimpleName(), false, porCodigo);
        }
        if (!pronto.enviar()) {
            transacao.executeWithoutResult(s -> fila.cancelar(envio.consultoriaId(), envio.id(), dono, pronto.motivo()));
            return Fim.CANCELADO;
        }
        String idExterno;
        try {
            idExterno = meta.enviarModelo(pronto.token(), pronto.phoneNumberId(), pronto.para(), pronto.modelo(), pronto.idioma(),
                    pronto.variaveis());
        } catch (FalhaNaMeta e) {
            return falhou(envio, dono, e.codigo(), e.definitiva(), porCodigo);
        } catch (RuntimeException e) {
            return falhou(envio, dono, e.getClass().getSimpleName(), false, porCodigo);
        }
        aceitasSemConclusao.put(envio.id(), idExterno);
        return concluir(envio, dono, idExterno) ? Fim.ENVIADO : Fim.FALHOU;
    }

    /**
     * Marca ENVIADO com o id da mensagem. Se nem isso grava, a reserva vence sozinha e o envio volta à fila; o id fica lembrado e
     * a nova tentativa só conclui.
     */
    private boolean concluir(Reservado envio, UUID dono, String idExterno) {
        try {
            transacao.executeWithoutResult(s -> fila.enviado(envio.consultoriaId(), envio.id(), dono, idExterno));
            aceitasSemConclusao.remove(envio.id());
            return true;
        } catch (RuntimeException e) {
            LOG.warn("WhatsApp segue reservado ({}).", e.getClass().getSimpleName());
            return false;
        }
    }

    /**
     * Só o código do erro vai ao banco e ao log. {@code definitiva}: não adianta tentar de novo, vira FALHOU na hora. Soma a
     * falha por código para o resumo da rodada.
     */
    private Fim falhou(Reservado envio, UUID dono, String codigo, boolean definitiva, Map<String, Integer> porCodigo) {
        String curto = codigo.length() > 40 ? codigo.substring(0, 40) : codigo;
        porCodigo.merge(curto, 1, Integer::sum);
        LOG.warn("WhatsApp não enviado ({}).", curto);
        try {
            transacao.executeWithoutResult(s -> fila.falhou(envio.consultoriaId(), envio.id(), dono, curto,
                    definitiva ? 1 : MAXIMO_DE_TENTATIVAS, ESPERA_ENTRE_TENTATIVAS_EM_SEGUNDOS));
        } catch (RuntimeException outra) {
            // Se nem isso grava, a reserva vence sozinha e o aviso volta à fila.
            LOG.warn("WhatsApp segue reservado ({}).", outra.getClass().getSimpleName());
        }
        return Fim.FALHOU;
    }
}
