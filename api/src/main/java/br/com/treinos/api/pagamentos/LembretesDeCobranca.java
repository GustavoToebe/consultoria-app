package br.com.treinos.api.pagamentos;

import br.com.plataforma.comum.auth.EnviadorDeEmail;
import br.com.treinos.api.pagamentos.LembretesRepositorio.Candidata;
import br.com.treinos.api.pagamentos.LembretesRepositorio.Novo;
import br.com.treinos.api.pagamentos.LembretesRepositorio.Reservado;
import br.com.treinos.api.pagamentos.PreparoDoLembrete.Preparo;
import br.com.treinos.api.tenant.TenantContext;
import br.com.treinos.api.web.Fuso;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * O job dos lembretes de cobrança por e-mail. Roda de hora em hora das 9h às 20h de Brasília, só com o financeiro ligado.
 * Cada rodada:
 * <ol>
 * <li><b>planeja</b>: lê as cobranças abertas das consultorias com os lembretes ligados e grava, pela regra pura
 * {@link RegraDosLembretes}, o lembrete devido hoje. A chave única (cobrança, tipo) faz a repetição não criar outro: rodar de
 * novo na mesma hora, no dia seguinte da folga ou em duas instâncias nunca manda o mesmo lembrete duas vezes;</li>
 * <li><b>envia</b>: reserva lotes de pendentes ({@code skip locked}, lease de {@value #RESERVA_EM_SEGUNDOS} s), confere cada
 * um de novo logo antes do envio ({@link PreparoDoLembrete}: cobrança ainda ABERTA etc.; senão CANCELADO), manda o e-mail
 * <b>fora de qualquer transação</b> e conclui numa transação curta, conferindo a posse da reserva.</li>
 * </ol>
 * Falha de envio conta uma tentativa e guarda só a classe do erro; na {@value #MAXIMO_DE_TENTATIVAS}ª vira FALHOU, antes
 * volta à fila na rodada seguinte. Sem o e-mail do app ligado (não existe o {@link EnviadorDeEmail}) nada é planejado e os
 * pendentes viram CANCELADO ({@code EMAIL_DESLIGADO}): nada fica preso. Nada de endereço, nome, valor ou texto em log: só
 * contagens e a classe do erro.
 */
@Component
public class LembretesDeCobranca {

    private static final Logger LOG = LoggerFactory.getLogger(LembretesDeCobranca.class);

    static final int MAXIMO_DE_TENTATIVAS = 3;
    /** Um pouco menos de uma hora: a nova tentativa cabe na rodada seguinte. */
    static final long ESPERA_ENTRE_TENTATIVAS_EM_SEGUNDOS = 50 * 60L;
    static final int RESERVA_EM_SEGUNDOS = 300;
    static final int TAMANHO_DO_LOTE = 50;
    /** Teto de lotes por rodada; o que sobrar sai na seguinte. */
    static final int LOTES_POR_RODADA = 20;
    static final String EMAIL_DESLIGADO = "EMAIL_DESLIGADO";

    /** O que uma rodada fez (só contagens). {@code executou} falso = financeiro desligado, nada foi feito. */
    public record Resultado(boolean executou, int planejados, int enviados, int cancelados, int falhas) {

        static final Resultado NADA = new Resultado(false, 0, 0, 0, 0);
    }

    private final LembretesRepositorio fila;
    private final PreparoDoLembrete preparo;
    private final ObjectProvider<EnviadorDeEmail> emails;
    private final PagamentosProperties pagamentos;
    private final LembretesProperties propriedades;
    private final TransactionTemplate transacao;

    LembretesDeCobranca(LembretesRepositorio fila, PreparoDoLembrete preparo, ObjectProvider<EnviadorDeEmail> emails,
                        PagamentosProperties pagamentos, LembretesProperties propriedades,
                        PlatformTransactionManager transacoes) {
        this.fila = fila;
        this.preparo = preparo;
        this.emails = emails;
        this.pagamentos = pagamentos;
        this.propriedades = propriedades;
        this.transacao = new TransactionTemplate(transacoes);
    }

    @Scheduled(cron = "0 7 9-20 * * *", zone = Fuso.ID)
    void rodarAgendado() {
        if (!Boolean.TRUE.equals(propriedades.agendados())) {
            return;
        }
        try {
            Resultado r = rodarSeLigado(LocalDate.now(Fuso.BRASILIA));
            if (r.planejados() + r.enviados() + r.cancelados() + r.falhas() > 0) {
                LOG.info("Lembretes de cobrança: {} planejados, {} enviados, {} cancelados, {} falhas.", r.planejados(),
                        r.enviados(), r.cancelados(), r.falhas());
            }
        } catch (RuntimeException e) {
            LOG.warn("Lembretes de cobrança falharam ({}).", e.getClass().getSimpleName());
        }
    }

    /** Com o financeiro desligado não faz nada (nem cancela). Senão, uma rodada com o e-mail do app, se ligado. */
    public Resultado rodarSeLigado(LocalDate hoje) {
        if (!pagamentos.habilitado()) {
            return Resultado.NADA;
        }
        return rodar(hoje, emails.getIfAvailable());
    }

    /** Uma rodada com {@code hoje} (Brasília) e o envio dado; {@code enviador} nulo = e-mail do app desligado. */
    public Resultado rodar(LocalDate hoje, EnviadorDeEmail enviador) {
        if (enviador == null) {
            Integer cancelados = transacao.execute(s -> fila.cancelarPendentes(EMAIL_DESLIGADO));
            return new Resultado(true, 0, 0, cancelados == null ? 0 : cancelados, 0);
        }
        Integer planejados = transacao.execute(s -> planejar(hoje));
        int enviados = 0;
        int cancelados = 0;
        int falhas = 0;
        UUID dono = UUID.randomUUID();
        for (int volta = 0; volta < LOTES_POR_RODADA; volta++) {
            List<Reservado> lote = transacao.execute(s -> fila.reservar(dono, TAMANHO_DO_LOTE, RESERVA_EM_SEGUNDOS));
            if (lote == null || lote.isEmpty()) {
                break;
            }
            for (Reservado lembrete : lote) {
                switch (processar(lembrete, dono, hoje, enviador)) {
                    case ENVIADO -> enviados++;
                    case CANCELADO -> cancelados++;
                    case FALHOU -> falhas++;
                }
            }
        }
        return new Resultado(true, planejados == null ? 0 : planejados, enviados, cancelados, falhas);
    }

    private int planejar(LocalDate hoje) {
        List<Novo> novos = new ArrayList<>();
        for (Candidata c : fila.candidatas(RegraDosLembretes.menorVencimento(hoje), RegraDosLembretes.maiorVencimento(hoje))) {
            RegraDosLembretes.devido(hoje, c.vencimento(), c.configuracao())
                    .ifPresent(tipo -> novos.add(new Novo(c.consultoriaId(), c.cobrancaId(), tipo, hoje)));
        }
        return fila.planejar(novos);
    }

    private enum Fim { ENVIADO, CANCELADO, FALHOU }

    private Fim processar(Reservado lembrete, UUID dono, LocalDate hoje, EnviadorDeEmail enviador) {
        Preparo pronto;
        try {
            // O Hibernate lê o tenant ao abrir a sessão: a consultoria entra antes da transação do preparo.
            pronto = TenantContext.executarComo(lembrete.consultoriaId(), () -> preparo.preparar(lembrete, hoje));
        } catch (RuntimeException e) {
            return falhou(lembrete, dono, e);
        }
        if (!pronto.enviar()) {
            transacao.executeWithoutResult(s -> fila.cancelar(lembrete.consultoriaId(), lembrete.id(), dono, pronto.motivo()));
            return Fim.CANCELADO;
        }
        try {
            enviador.enviar(new EnviadorDeEmail.Mensagem(pronto.para(), pronto.mensagem().assunto(), pronto.mensagem().texto(),
                    pronto.mensagem().html()));
        } catch (RuntimeException e) {
            return falhou(lembrete, dono, e);
        }
        transacao.executeWithoutResult(s -> fila.enviado(lembrete.consultoriaId(), lembrete.id(), dono));
        return Fim.ENVIADO;
    }

    /** Só a classe do erro vai ao banco e ao log: a mensagem do provedor pode repetir o endereço. */
    private Fim falhou(Reservado lembrete, UUID dono, RuntimeException e) {
        String classe = e.getClass().getSimpleName();
        String curta = classe.length() > 80 ? classe.substring(0, 80) : classe;
        LOG.warn("Lembrete de cobrança não enviado ({}).", curta);
        try {
            transacao.executeWithoutResult(s -> fila.falhou(lembrete.consultoriaId(), lembrete.id(), dono, curta,
                    MAXIMO_DE_TENTATIVAS, ESPERA_ENTRE_TENTATIVAS_EM_SEGUNDOS));
        } catch (RuntimeException outra) {
            // Se nem isso grava, a reserva vence sozinha e o lembrete volta à fila.
            LOG.warn("Lembrete de cobrança segue reservado ({}).", outra.getClass().getSimpleName());
        }
        return Fim.FALHOU;
    }
}
