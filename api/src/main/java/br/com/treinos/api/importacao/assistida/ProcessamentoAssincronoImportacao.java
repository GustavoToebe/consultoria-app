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
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

/**
 * Processamento assíncrono leve das sessões de importação assistida:
 * - {@link #iniciar(UUID, UUID)} valida permissões/estado, marca {@code PROCESSANDO} em transação curta e dispara a
 *   tarefa após o commit.
 * - A tarefa em segundo plano captura {@code consultoriaId} e {@code usuarioId}, revalida as permissões atuais no
 *   banco ({@link PermissoesDoUsuario}), roda extração + interpretação fora de transação (com timeout) e persiste o
 *   resultado sob trava apenas se a sessão continuar {@code PROCESSANDO}.
 */
@Component
public class ProcessamentoAssincronoImportacao {

    /** Folga do corte da sessão, além das rodadas de arquivos (gravar o resultado depois da leitura). */
    private static final long FOLGA_DA_SESSAO_SEGUNDOS = 60;

    private final ImportacaoSessaoRepository sessoes;
    private final ImportacaoArquivoRepository arquivos;
    private final UsuarioRepository usuarios;
    private final PermissoesDoUsuario permissoes;
    private final ImportacaoAssistidaService service;
    private final tools.jackson.databind.json.JsonMapper json;
    private final TransactionTemplate transacao;
    private final TransactionTemplate transacaoLeitura;
    private final ExecutorService executor;

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
                return new InicioResultado(service.detalheDaSessao(sessao), false, 0);
            }
            List<ImportacaoArquivo> todos = arquivos.findBySessaoIdOrderByCriadoEmAsc(sessaoId);
            if (todos.isEmpty()) {
                throw new BadRequestException("Adicione ao menos um arquivo ou texto para processar.", "SEM_ARQUIVOS");
            }
            boolean temPendentes = todos.stream().anyMatch(a -> "RECEBIDO".equals(a.getEstado()));
            if (!temPendentes) {
                return new InicioResultado(service.detalheDaSessao(sessao), false, 0);
            }
            long pendentes = todos.stream().filter(a -> "RECEBIDO".equals(a.getEstado())).count();
            SessaoJson.marcarFlagProgresso(json, sessao, "erroProcessamento", false);
            SessaoJson.numeroNoProgresso(json, sessao, "aLer", (int) pendentes);
            SessaoJson.numeroNoProgresso(json, sessao, "lidos", 0);
            sessao.atualizarEstado("PROCESSANDO");
            return new InicioResultado(service.detalheDaSessao(sessao), true, (int) pendentes);
        });

        if (inicio != null && inicio.disparar()) {
            dispararAposCommit(consultoriaId, sessaoId, usuarioId, inicio.pendentes());
        }
        return inicio != null ? inicio.detalhe() : null;
    }

    private record InicioResultado(SessaoDetalhe detalhe, boolean disparar, int pendentes) {
    }

    private void dispararAposCommit(UUID consultoriaId, UUID sessaoId, UUID usuarioId, int pendentes) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    agendar(consultoriaId, sessaoId, usuarioId, pendentes);
                }
            });
        } else {
            agendar(consultoriaId, sessaoId, usuarioId, pendentes);
        }
    }

    /** Corte da sessão: rodadas de {@code ARQUIVOS_EM_PARALELO} arquivos, cada uma até o teto de um arquivo, mais a folga. */
    static long limiteDaSessaoEmSegundos(int pendentes) {
        long rodadas = Math.max(1, (pendentes + ImportacaoAssistidaService.ARQUIVOS_EM_PARALELO - 1)
                / ImportacaoAssistidaService.ARQUIVOS_EM_PARALELO);
        return rodadas * RoteadorInterpretadorIa.TEMPO_MAXIMO_POR_ARQUIVO.toSeconds() + FOLGA_DA_SESSAO_SEGUNDOS;
    }

    /**
     * Roda a sessão e a vigia numa thread virtual: passou do limite, a tarefa é cancelada (interrompe as leituras em
     * curso, sem chamada órfã ao provedor) e a sessão volta com erro. O relógio corre desde o agendamento.
     */
    private void agendar(UUID consultoriaId, UUID sessaoId, UUID usuarioId, int pendentes) {
        Future<?> tarefa = executor.submit(() -> executarEmSegundoPlano(consultoriaId, sessaoId, usuarioId));
        long limite = limiteDaSessaoEmSegundos(pendentes);
        Thread.startVirtualThread(() -> {
            try {
                tarefa.get(limite, TimeUnit.SECONDS);
            } catch (TimeoutException e) {
                tarefa.cancel(true);
                tratarFalhaAssincrona(consultoriaId, sessaoId);
            } catch (ExecutionException e) {
                tratarFalhaAssincrona(consultoriaId, sessaoId);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        });
    }

    void executarEmSegundoPlano(UUID consultoriaId, UUID sessaoId, UUID usuarioId) {
        try {
            TenantContext.executarComo(consultoriaId, () -> {
                Boolean autorizado = transacaoLeitura.execute(status -> atorAutorizado(consultoriaId, usuarioId));
                if (!Boolean.TRUE.equals(autorizado)) {
                    transacao.executeWithoutResult(status -> marcarErroSeProcessando(consultoriaId, sessaoId));
                    return null;
                }
                ImportacaoAssistidaService.PreparoProcessamento preparo = transacaoLeitura.execute(
                        status -> service.prepararProcessamentoForaDeTransacao(sessaoId));
                if (preparo == null) {
                    return null;
                }
                ImportacaoAssistidaService.ResultadoProcessamentoLote resultado = service.executarProcessamentoSemTransacao(preparo,
                        () -> contarArquivoLido(consultoriaId, sessaoId));
                transacao.executeWithoutResult(status -> service.concluirProcessamentoEmTransacao(sessaoId, resultado));
                return null;
            });
        } catch (RuntimeException e) {
            tratarFalhaAssincrona(consultoriaId, sessaoId);
        } finally {
            SecurityContextHolder.clearContext();
            TenantContext.clear();
        }
    }

    /** Soma um arquivo lido ao progresso da tela; falha aqui nunca derruba a leitura. */
    private void contarArquivoLido(UUID consultoriaId, UUID sessaoId) {
        try {
            transacao.executeWithoutResult(status -> sessoes.buscarParaAlterar(sessaoId, consultoriaId).ifPresent(s -> {
                if ("PROCESSANDO".equals(s.getEstado())) {
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

    private void tratarFalhaAssincrona(UUID consultoriaId, UUID sessaoId) {
        try {
            TenantContext.executarComo(consultoriaId, () -> {
                transacao.executeWithoutResult(status -> marcarErroSeProcessando(consultoriaId, sessaoId));
                return null;
            });
        } catch (RuntimeException ignored) {
            // Melhor esforço para não deixar sessão presa em PROCESSANDO
        } finally {
            SecurityContextHolder.clearContext();
            TenantContext.clear();
        }
    }

    private void marcarErroSeProcessando(UUID consultoriaId, UUID sessaoId) {
        sessoes.buscarParaAlterar(sessaoId, consultoriaId).ifPresent(s -> {
            if ("PROCESSANDO".equals(s.getEstado())) {
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
