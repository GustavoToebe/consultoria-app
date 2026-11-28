package br.com.treinos.api.importacao.assistida;

import br.com.plataforma.comum.web.BadRequestException;
import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.auth.Usuario;
import br.com.treinos.api.auth.UsuarioRepository;
import br.com.treinos.api.equipe.PermissoesDoUsuario;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.SessaoDetalhe;
import br.com.treinos.api.importacao.assistida.ia.RoteadorInterpretadorIa;
import br.com.treinos.api.tenant.TenantContext;
import br.com.treinos.api.web.NaoEncontradoException;
import jakarta.annotation.PreDestroy;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CancellationException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

/**
 * Processamento assíncrono leve das sessões de importação assistida:
 * - {@link #iniciar(UUID, UUID)} valida permissões/estado, marca {@code PROCESSANDO} com uma marca de leitura nova
 *   ({@link SessaoJson#marcarNovaLeitura}) em transação curta e põe a leitura na fila após o commit.
 * - Fila: no máximo {@link #LEITURAS_POR_CONSULTORIA} leituras da mesma consultoria ao mesmo tempo; as outras esperam
 *   na ordem de chegada (semáforo justo por consultoria, numa thread virtual, sem ocupar o pool, que é de todas as
 *   consultorias). Escolhida no lugar de um 409 para a segunda sessão em leitura: as duas regras se sobreporiam, e a
 *   fila não recusa o treinador.
 * - A tarefa em segundo plano captura {@code consultoriaId} e {@code usuarioId}, revalida as permissões atuais no
 *   banco ({@link PermissoesDoUsuario}), roda extração + interpretação fora de transação (com corte) e persiste o
 *   resultado sob trava só se a sessão continuar {@code PROCESSANDO} com a mesma marca de leitura: a leitura velha
 *   (cortada e lida de novo) não grava por cima da nova.
 */
@Component
public class ProcessamentoAssincronoImportacao {

    /**
     * O que fica fora do orçamento da IA em cada rodada: extrair o texto antes, as regras das partes que não couberam e
     * as dúvidas depois, o contador da tela.
     */
    private static final long FOLGA_DA_RODADA_SEGUNDOS = 30;
    /** Folga do corte da sessão, além das rodadas: preparar a leitura e gravar o resultado. */
    private static final long FOLGA_DA_SESSAO_SEGUNDOS = 120;
    /** Leituras da mesma consultoria ao mesmo tempo no pool (4 threads para todas). */
    static final int LEITURAS_POR_CONSULTORIA = 2;

    private final ImportacaoSessaoRepository sessoes;
    private final ImportacaoArquivoRepository arquivos;
    private final UsuarioRepository usuarios;
    private final PermissoesDoUsuario permissoes;
    private final ImportacaoAssistidaService service;
    private final tools.jackson.databind.json.JsonMapper json;
    private final TransactionTemplate transacao;
    private final TransactionTemplate transacaoLeitura;
    private final ExecutorService executor;
    // Um semáforo por consultoria que já leu algo desde a subida: cresce só com o número de consultorias.
    private final Map<UUID, Semaphore> filaPorConsultoria = new ConcurrentHashMap<>();

    public ProcessamentoAssincronoImportacao(ImportacaoSessaoRepository sessoes,
                                             ImportacaoArquivoRepository arquivos,
                                             UsuarioRepository usuarios,
                                             PermissoesDoUsuario permissoes,
                                             ImportacaoAssistidaService service,
                                             tools.jackson.databind.json.JsonMapper json,
                                             PlatformTransactionManager txManager) {
        this.sessoes = sessoes;
        this.arquivos = arquivos;
        this.usuarios = usuarios;
        this.permissoes = permissoes;
        this.service = service;
        this.json = json;
        this.transacao = new TransactionTemplate(txManager);
        this.transacaoLeitura = new TransactionTemplate(txManager);
        this.transacaoLeitura.setReadOnly(true);
        this.executor = Executors.newFixedThreadPool(4);
    }

    public SessaoDetalhe iniciar(UUID sessaoId, UUID usuarioId) {
        service.exigirPermissoesSessaoMista();
        UUID consultoriaId = TenantContext.get();

        InicioResultado inicio = transacao.execute(status -> {
            ImportacaoSessao sessao = sessoes.buscarParaAlterar(sessaoId, consultoriaId)
                    .orElseThrow(() -> new NaoEncontradoException("Sessão de importação não encontrada."));
            String estadoAtual = SessaoJson.estadoEfetivo(json, sessao);
            if ("CANCELADA".equals(estadoAtual)) {
                throw new ConflictException("A importação foi cancelada.", "SESSAO_CANCELADA");
            }
            if ("CONCLUIDA".equals(estadoAtual)) {
                throw new ConflictException("A importação já foi concluída.", "SESSAO_CONCLUIDA");
            }
            if ("EXPIRADA".equals(estadoAtual) || sessao.getExpiraEm().isBefore(Instant.now())) {
                throw new ConflictException("A importação expirou.", "SESSAO_EXPIRADA");
            }
            if ("PROCESSANDO".equals(estadoAtual)) {
                return new InicioResultado(service.detalheDaSessao(sessao), false, 0, null);
            }
            List<ImportacaoArquivo> todos = arquivos.findBySessaoIdOrderByCriadoEmAsc(sessaoId);
            if (todos.isEmpty()) {
                throw new BadRequestException("Adicione ao menos um arquivo ou texto para processar.", "SEM_ARQUIVOS");
            }
            int pendentes = (int) todos.stream().filter(a -> "RECEBIDO".equals(a.getEstado())).count();
            if (pendentes == 0) {
                return new InicioResultado(service.detalheDaSessao(sessao), false, 0, null);
            }
            UUID leituraId = UUID.randomUUID();
            SessaoJson.marcarNovaLeitura(json, sessao, leituraId, pendentes);
            sessao.atualizarEstado("PROCESSANDO");
            return new InicioResultado(service.detalheDaSessao(sessao), true, pendentes, leituraId);
        });

        if (inicio != null && inicio.disparar()) {
            dispararAposCommit(consultoriaId, sessaoId, usuarioId, inicio.pendentes(), inicio.leituraId());
        }
        return inicio != null ? inicio.detalhe() : null;
    }

    private record InicioResultado(SessaoDetalhe detalhe, boolean disparar, int pendentes, UUID leituraId) {
    }

    private void dispararAposCommit(UUID consultoriaId, UUID sessaoId, UUID usuarioId, int pendentes, UUID leituraId) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    agendar(consultoriaId, sessaoId, usuarioId, pendentes, leituraId);
                }
            });
        } else {
            agendar(consultoriaId, sessaoId, usuarioId, pendentes, leituraId);
        }
    }

    /**
     * Corte da sessão de {@code pendentes} arquivos: rodadas × (o orçamento de um arquivo,
     * {@link RoteadorInterpretadorIa#ORCAMENTO_POR_ARQUIVO}, que toda chamada ao provedor respeita, + a folga da rodada)
     * + a folga da sessão. O vigia e {@link SessaoJson#estadoEfetivo} usam este. Um arquivo dá 17,5 min; 20 arquivos
     * (8 rodadas), 126 min.
     */
    static long limiteDaSessaoEmSegundos(int pendentes) {
        return rodadas(pendentes) * (RoteadorInterpretadorIa.ORCAMENTO_POR_ARQUIVO.toSeconds() + FOLGA_DA_RODADA_SEGUNDOS)
                + FOLGA_DA_SESSAO_SEGUNDOS;
    }

    /** O primeiro arquivo sozinho (grava o cache do provedor), os demais de {@code ARQUIVOS_EM_PARALELO} em paralelo. */
    static long rodadas(int pendentes) {
        int p = ImportacaoAssistidaService.ARQUIVOS_EM_PARALELO;
        return pendentes <= 1 ? 1 : 1 + (pendentes - 1 + p - 1) / p;
    }

    /**
     * Entra na fila da consultoria numa thread virtual (esperar não ocupa o pool) e, na vez dela, roda e vigia. A sessão
     * na fila fica {@code aguardando} no progresso e sem {@code processandoDesde}: o corte só conta depois da vaga. A fila
     * anda porque cada leitura da frente tem corte; se a API cair, a subida solta a sessão (está {@code PROCESSANDO}).
     */
    void agendar(UUID consultoriaId, UUID sessaoId, UUID usuarioId, int pendentes, UUID leituraId) {
        Semaphore vez = filaPorConsultoria.computeIfAbsent(consultoriaId,
                c -> new Semaphore(LEITURAS_POR_CONSULTORIA, true));
        Thread.startVirtualThread(() -> {
            try {
                vez.acquire();
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            }
            try {
                rodarEVigiar(consultoriaId, sessaoId, usuarioId, pendentes, leituraId);
            } finally {
                vez.release();
            }
        });
    }

    /**
     * Passou do corte, a tarefa é cancelada (interrompe as leituras em curso, sem chamada órfã ao provedor) e a sessão
     * volta com erro. O relógio corre desde o INÍCIO da execução, não do agendamento: a tarefa pode esperar uma thread
     * do pool, que é de todas as consultorias.
     */
    private void rodarEVigiar(UUID consultoriaId, UUID sessaoId, UUID usuarioId, int pendentes, UUID leituraId) {
        CountDownLatch comecou = new CountDownLatch(1);
        Future<?> tarefa;
        try {
            tarefa = executor.submit(() -> {
                comecou.countDown();
                executarEmSegundoPlano(consultoriaId, sessaoId, usuarioId, leituraId);
            });
        } catch (RejectedExecutionException e) {
            tratarFalhaAssincrona(consultoriaId, sessaoId, leituraId); // API desligando
            return;
        }
        try {
            comecou.await();
            tarefa.get(limiteDaSessaoEmSegundos(pendentes), TimeUnit.SECONDS);
        } catch (TimeoutException e) {
            tarefa.cancel(true);
            tratarFalhaAssincrona(consultoriaId, sessaoId, leituraId);
        } catch (ExecutionException | CancellationException e) {
            tratarFalhaAssincrona(consultoriaId, sessaoId, leituraId);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    void executarEmSegundoPlano(UUID consultoriaId, UUID sessaoId, UUID usuarioId, UUID leituraId) {
        try {
            TenantContext.executarComo(consultoriaId, () -> {
                Boolean comecou = transacao.execute(status -> comecarLeitura(consultoriaId, sessaoId, leituraId));
                if (!Boolean.TRUE.equals(comecou)) {
                    return null; // cancelada, já lida ou leitura velha: nada a fazer
                }
                Boolean autorizado = transacaoLeitura.execute(status -> atorAutorizado(consultoriaId, usuarioId));
                if (!Boolean.TRUE.equals(autorizado)) {
                    transacao.executeWithoutResult(status -> marcarErroSeProcessando(consultoriaId, sessaoId, leituraId));
                    return null;
                }
                ImportacaoAssistidaService.PreparoProcessamento preparo = transacaoLeitura.execute(
                        status -> service.prepararProcessamentoForaDeTransacao(sessaoId));
                if (preparo == null) {
                    return null;
                }
                ImportacaoAssistidaService.ResultadoProcessamentoLote resultado = service.executarProcessamentoSemTransacao(
                        preparo, () -> contarArquivoLido(consultoriaId, sessaoId, leituraId));
                transacao.executeWithoutResult(
                        status -> concluirSeMesmaLeitura(consultoriaId, sessaoId, leituraId, resultado));
                return null;
            });
        } catch (RuntimeException e) {
            tratarFalhaAssincrona(consultoriaId, sessaoId, leituraId);
        } finally {
            SecurityContextHolder.clearContext();
            TenantContext.clear();
        }
    }

    /** Saiu da fila: grava {@code processandoDesde} (o corte conta daqui) se a sessão ainda espera esta leitura. */
    private boolean comecarLeitura(UUID consultoriaId, UUID sessaoId, UUID leituraId) {
        ImportacaoSessao s = sessoes.buscarParaAlterar(sessaoId, consultoriaId).orElse(null);
        if (s == null || !"PROCESSANDO".equals(s.getEstado()) || !SessaoJson.mesmaLeitura(json, s, leituraId)) {
            return false;
        }
        SessaoJson.leituraComecou(json, s);
        return true;
    }

    /**
     * Grava o resultado só se a sessão ainda é desta leitura. Roda dentro da transação: a trava da sessão é a mesma que
     * {@code concluirProcessamentoEmTransacao} pega em seguida, então a marca não muda entre conferir e gravar.
     */
    void concluirSeMesmaLeitura(UUID consultoriaId, UUID sessaoId, UUID leituraId,
                                ImportacaoAssistidaService.ResultadoProcessamentoLote resultado) {
        ImportacaoSessao s = sessoes.buscarParaAlterar(sessaoId, consultoriaId).orElse(null);
        if (s != null && SessaoJson.mesmaLeitura(json, s, leituraId)) {
            service.concluirProcessamentoEmTransacao(sessaoId, resultado);
        }
    }

    /** Soma um arquivo lido ao progresso da tela; falha aqui nunca derruba a leitura. */
    private void contarArquivoLido(UUID consultoriaId, UUID sessaoId, UUID leituraId) {
        try {
            transacao.executeWithoutResult(status -> sessoes.buscarParaAlterar(sessaoId, consultoriaId).ifPresent(s -> {
                if ("PROCESSANDO".equals(s.getEstado()) && SessaoJson.mesmaLeitura(json, s, leituraId)) {
                    SessaoJson.somarNoProgresso(json, s, "lidos");
                }
            }));
        } catch (RuntimeException ignored) {
            // só o contador da tela
        }
    }

    private boolean atorAutorizado(UUID consultoriaId, UUID usuarioId) {
        Usuario u = usuarios.findById(usuarioId).orElse(null);
        if (u == null || !u.isAtivo() || !consultoriaId.equals(u.getConsultoriaId())) {
            return false;
        }
        Set<String> cods = permissoes.codigos(u);
        return cods.contains("ALUNO_ALTERAR")
                && cods.contains("ALUNO_SENSIVEL_LER")
                && cods.contains("TREINO_LER")
                && cods.contains("DIETA_LER");
    }

    private void tratarFalhaAssincrona(UUID consultoriaId, UUID sessaoId, UUID leituraId) {
        try {
            TenantContext.executarComo(consultoriaId, () -> {
                transacao.executeWithoutResult(status -> marcarErroSeProcessando(consultoriaId, sessaoId, leituraId));
                return null;
            });
        } catch (RuntimeException ignored) {
            // Melhor esforço para não deixar sessão presa em PROCESSANDO
        } finally {
            SecurityContextHolder.clearContext();
            TenantContext.clear();
        }
    }

    /** Só a leitura dona da sessão a derruba: o vigia de uma leitura velha não mexe na nova. */
    private void marcarErroSeProcessando(UUID consultoriaId, UUID sessaoId, UUID leituraId) {
        sessoes.buscarParaAlterar(sessaoId, consultoriaId).ifPresent(s -> {
            if ("PROCESSANDO".equals(s.getEstado()) && SessaoJson.mesmaLeitura(json, s, leituraId)) {
                SessaoJson.marcarFlagProgresso(json, s, "erroProcessamento", true);
                s.atualizarEstado("RECEBENDO");
            }
        });
    }

    @PreDestroy
    public void encerrar() {
        executor.shutdownNow();
    }
}
