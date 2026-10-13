package br.com.treinos.api.integracao;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.locks.ReentrantLock;

/**
 * Sincronização de direitos (contrato 6.1): lê todas as contratações do produto na Central, aplica as de versão maior e
 * confirma as presentes. Roda na subida (em outra thread, para a Central lenta não segurar o boot), a cada 8 h e, se a
 * última rodada falhou, de novo a cada 30 min. Uma rodada que falha não altera nada além do relógio da tolerância: o
 * acesso só cai quando a confirmação passa do limite (padrão 72 h).
 */
@Component
@ConditionalOnProperty(name = "treinos.integracao.ativa", havingValue = "true")
public class SincronizacaoDireitosService {

    private static final Logger LOG = LoggerFactory.getLogger(SincronizacaoDireitosService.class);
    private static final int TAMANHO_PAGINA = 100;
    /** Trava de segurança contra uma paginação que nunca termina. */
    private static final int MAXIMO_PAGINAS = 1000;

    public record Resumo(boolean completa, int itens, int aplicados, int confirmados, int ignorados) { }

    private final CentralClient central;
    private final DireitosService direitos;
    private final IntegracaoProperties propriedades;
    private final JsonMapper json;
    private final AtomicBoolean pendente = new AtomicBoolean(false);
    private final ReentrantLock rodando = new ReentrantLock();

    public SincronizacaoDireitosService(CentralClient central, DireitosService direitos,
                                        IntegracaoProperties propriedades, JsonMapper json) {
        this.central = central;
        this.direitos = direitos;
        this.propriedades = propriedades;
        this.json = json;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void naSubida() {
        Thread.ofVirtual().name("sincronizacao-direitos").start(this::executar);
    }

    @Scheduled(cron = "0 0 */8 * * *")
    public void periodica() {
        executar();
    }

    @Scheduled(fixedDelay = 30 * 60 * 1000L, initialDelay = 30 * 60 * 1000L)
    public void retentar() {
        if (pendente.get()) {
            executar();
        }
    }

    public boolean pendente() {
        return pendente.get();
    }

    /** Uma rodada completa. Nunca lança: falha deixa {@code pendente=true} e o retry de 30 min cuida. */
    public Resumo executar() {
        if (!rodando.tryLock()) {
            return new Resumo(false, 0, 0, 0, 0);
        }
        int itens = 0;
        int aplicados = 0;
        int confirmados = 0;
        int ignorados = 0;
        try {
            for (int pagina = 0; pagina < MAXIMO_PAGINAS; pagina++) {
                String caminho = "/integracao/v1/produtos/" + propriedades.produto() + "/direitos?pagina=" + pagina
                        + "&tamanho=" + TAMANHO_PAGINA;
                CentralClient.Resposta resposta = central.get(caminho);
                if (!resposta.sucesso()) {
                    throw new IOException("A central respondeu " + resposta.status());
                }
                JsonNode corpo = json.readTree(resposta.corpo());
                JsonNode lista = corpo.path("itens");
                if (!lista.isArray() || !corpo.path("total").isNumber()) {
                    // Resposta fora do contrato (ex.: outro nome de campo) não pode passar por "lista vazia, tudo certo".
                    throw new IOException("Resposta da central sem itens/total.");
                }
                for (JsonNode item : lista) {
                    itens++;
                    switch (aplicar(item)) {
                        case APLICADO -> aplicados++;
                        case CONFIRMADO -> confirmados++;
                        case IGNORADO -> ignorados++;
                    }
                }
                long total = corpo.path("total").asLong(0);
                if (lista.isEmpty() || (long) (pagina + 1) * TAMANHO_PAGINA >= total) {
                    break;
                }
            }
            pendente.set(false);
            LOG.info("Sincronização de direitos: {} item(ns), {} aplicado(s), {} confirmado(s), {} ignorado(s).",
                    itens, aplicados, confirmados, ignorados);
            return new Resumo(true, itens, aplicados, confirmados, ignorados);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            pendente.set(true);
            return new Resumo(false, itens, aplicados, confirmados, ignorados);
        } catch (Exception e) {
            pendente.set(true);
            LOG.warn("Sincronização de direitos falhou ({}); nova tentativa em 30 minutos.", e.getClass().getSimpleName());
            return new Resumo(false, itens, aplicados, confirmados, ignorados);
        } finally {
            rodando.unlock();
        }
    }

    private DireitosService.Efeito aplicar(JsonNode item) {
        try {
            return direitos.sincronizar(json.treeToValue(item, DireitosInstancia.class));
        } catch (RuntimeException e) {
            LOG.warn("Sincronização: item recusado ({}).", e.getClass().getSimpleName());
            return DireitosService.Efeito.IGNORADO;
        }
    }
}
