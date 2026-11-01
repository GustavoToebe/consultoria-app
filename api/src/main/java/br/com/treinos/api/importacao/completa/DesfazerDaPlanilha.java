package br.com.treinos.api.importacao.completa;

import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.alunos.Aluno;
import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.biblioteca.Exercicio;
import br.com.treinos.api.biblioteca.ExercicioRepository;
import br.com.treinos.api.dieta.PlanoDieta;
import br.com.treinos.api.dieta.PlanoDietaRepository;
import br.com.treinos.api.equipe.AcessoAtual;
import br.com.treinos.api.execucao.RegistroPeso;
import br.com.treinos.api.execucao.RegistroPesoRepository;
import br.com.treinos.api.importacao.Importacao;
import br.com.treinos.api.importacao.ImportacaoRepository;
import br.com.treinos.api.importacao.completa.PlanilhaCompletaDtos.Desfeita;
import br.com.treinos.api.importacao.completa.PlanilhaCompletaDtos.Ficou;
import br.com.treinos.api.importacao.completa.PlanilhaCompletaDtos.ParteDesfeita;
import br.com.treinos.api.pastas.PastaPlano;
import br.com.treinos.api.pastas.PastaRepository;
import br.com.treinos.api.planos.PlanoBase;
import br.com.treinos.api.treino.PlanoTreino;
import br.com.treinos.api.treino.PlanoTreinoRepository;
import br.com.treinos.api.web.NaoEncontradoException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * "Desfazer" de uma importação da planilha completa: apaga só o que ninguém mexeu de um jeito que importe e diz o que
 * ficou e por quê. Ordem: planos (só os nunca publicados), pastas (só sem plano nenhum), pesos, exercícios (só sem uso
 * em plano, versão publicada, modelo, registro ou imagem própria) e alunos (só sem acesso ao app, sem registro de
 * treino, sem compromisso e sem mais nada no cadastro). Cada item é apagado na sua própria transação curta: o que o
 * banco recusa (uma ligação criada depois, que as conferências não viram) volta atrás sozinho e fica como "em uso", sem
 * desfazer o resto. Repetir é seguro: o que já foi apagado não aparece mais e o que ficou é conferido de novo.
 *
 * <p>Cada tipo exige a permissão de quem apaga: planos e pastas {@code PASTA_ALTERAR} e {@code TREINO_ALTERAR} ou
 * {@code DIETA_ALTERAR}; pesos {@code ALUNO_SENSIVEL_ALTERAR}; exercícios {@code BIBLIOTECA_ALTERAR}; alunos
 * {@code ALUNO_ALTERAR} (a da rota). Sem ela, o item fica com o motivo {@code SEM_PERMISSAO}. Outra consultoria = 404
 * (o {@code @TenantId} esconde a importação); importação de uma aba = 409 {@code IMPORTACAO_NAO_DESFAZIVEL}. Um evento
 * {@code IMPORTACAO_DESFEITA} com resumo fixo, só quando algo foi apagado.
 */
@Service
public class DesfazerDaPlanilha {

    static final int ITENS_QUE_FICARAM = 500;
    private static final Pattern EXERCICIO_ID = Pattern.compile(
            "\"exercicioId\"\\s*:\\s*\"([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\"");

    private final ImportacaoRepository importacoes;
    private final LinhasDaImportacao linhas;
    private final AlunoRepository alunos;
    private final RegistroPesoRepository pesos;
    private final ExercicioRepository exercicios;
    private final PastaRepository pastas;
    private final PlanoTreinoRepository treinos;
    private final PlanoDietaRepository dietas;
    private final Auditoria auditoria;
    private final TransactionTemplate leitura;
    private final TransactionTemplate escrita;

    public DesfazerDaPlanilha(ImportacaoRepository importacoes, LinhasDaImportacao linhas, AlunoRepository alunos,
                              RegistroPesoRepository pesos, ExercicioRepository exercicios, PastaRepository pastas,
                              PlanoTreinoRepository treinos, PlanoDietaRepository dietas, Auditoria auditoria,
                              PlatformTransactionManager transacoes) {
        this.importacoes = importacoes;
        this.linhas = linhas;
        this.alunos = alunos;
        this.pesos = pesos;
        this.exercicios = exercicios;
        this.pastas = pastas;
        this.treinos = treinos;
        this.dietas = dietas;
        this.auditoria = auditoria;
        this.leitura = new TransactionTemplate(transacoes);
        this.leitura.setReadOnly(true);
        this.escrita = new TransactionTemplate(transacoes);
        this.escrita.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    public Desfeita desfazer(UUID importacaoId) {
        Importacao importacao = ler(() -> importacoes.findById(importacaoId))
                .orElseThrow(() -> new NaoEncontradoException("Importação não encontrada."));
        if (!GravacaoDaPlanilha.DESTINO.equals(importacao.getDestino())) {
            throw new ConflictException("Só a importação da planilha completa pode ser desfeita.",
                    "IMPORTACAO_NAO_DESFAZIVEL");
        }
        Relatorio r = new Relatorio();
        boolean pasta = AcessoAtual.pode("PASTA_ALTERAR");
        planos("PLANO_TREINO", ler(() -> linhas.treinos(importacaoId)), pasta && AcessoAtual.pode("TREINO_ALTERAR"),
                treinos::deleteById, r);
        planos("PLANO_DIETA", ler(() -> linhas.dietas(importacaoId)), pasta && AcessoAtual.pode("DIETA_ALTERAR"),
                dietas::deleteById, r);
        pastas(importacaoId, pasta, r);
        pesos(importacaoId, r);
        exercicios(importacaoId, r);
        alunos(importacaoId, r);
        if (r.apagadosNoTotal() > 0) {
            escrita.executeWithoutResult(s -> auditoria.registrarEvento("IMPORTACAO_DESFEITA", "IMPORTACAO", importacaoId,
                    "Desfez uma importação de planilha completa."));
        }
        return r.resposta(importacaoId);
    }

    private <P extends PlanoBase> void planos(String tipo, List<P> lista, boolean pode,
                                              java.util.function.Consumer<UUID> apagar, Relatorio r) {
        for (P p : lista) {
            if (!pode) {
                r.ficou(tipo, p.getId(), "SEM_PERMISSAO");
            } else if (p.getPublicadoEm() != null || p.getVersaoPublicada() > 0) {
                r.ficou(tipo, p.getId(), "PUBLICADO");
            } else {
                apagar(tipo, p.getId(), () -> apagar.accept(p.getId()), r);
            }
        }
    }

    private void pastas(UUID importacaoId, boolean pode, Relatorio r) {
        for (PastaPlano p : ler(() -> linhas.pastas(importacaoId))) {
            if (!pode) {
                r.ficou("PASTA", p.getId(), "SEM_PERMISSAO");
                continue;
            }
            long planos = ler(() -> linhas.treinosNaPasta(p.getId()) + linhas.dietasNaPasta(p.getId())
                    + linhas.mobilidadesNaPasta(p.getId()));
            if (planos > 0) {
                r.ficou("PASTA", p.getId(), "COM_PLANOS");
            } else {
                apagar("PASTA", p.getId(), () -> pastas.deleteById(p.getId()), r);
            }
        }
    }

    private void pesos(UUID importacaoId, Relatorio r) {
        boolean pode = AcessoAtual.pode("ALUNO_SENSIVEL_ALTERAR");
        for (RegistroPeso p : ler(() -> linhas.pesos(importacaoId))) {
            if (!pode) {
                r.ficou("PESO", p.getId(), "SEM_PERMISSAO");
            } else {
                apagar("PESO", p.getId(), () -> pesos.deleteById(p.getId()), r);
            }
        }
    }

    private void exercicios(UUID importacaoId, Relatorio r) {
        List<Exercicio> lista = ler(() -> linhas.exercicios(importacaoId));
        if (lista.isEmpty()) {
            return;
        }
        if (!AcessoAtual.pode("BIBLIOTECA_ALTERAR")) {
            lista.forEach(e -> r.ficou("EXERCICIO", e.getId(), "SEM_PERMISSAO"));
            return;
        }
        Set<UUID> ids = new HashSet<>();
        lista.forEach(e -> ids.add(e.getId()));
        Set<UUID> emUso = ler(() -> {
            Set<UUID> usados = new HashSet<>(linhas.exerciciosComExecucao(ids));
            usados.addAll(linhas.exerciciosComImagem(ids));
            citados(linhas.rascunhosDeTreino(), ids, usados);
            citados(linhas.versoesDeTreino(), ids, usados);
            citados(linhas.modelos(), ids, usados);
            return usados;
        });
        for (Exercicio e : lista) {
            if (emUso.contains(e.getId())) {
                r.ficou("EXERCICIO", e.getId(), "EM_USO");
            } else {
                apagar("EXERCICIO", e.getId(), () -> exercicios.deleteById(e.getId()), r);
            }
        }
    }

    /** Os ids de {@code candidatos} citados como {@code "exercicioId"} em algum dos JSONs. */
    static void citados(List<String> conteudos, Set<UUID> candidatos, Set<UUID> usados) {
        for (String c : conteudos) {
            if (c == null) {
                continue;
            }
            Matcher m = EXERCICIO_ID.matcher(c);
            while (m.find()) {
                UUID id = UUID.fromString(m.group(1));
                if (candidatos.contains(id)) {
                    usados.add(id);
                }
            }
        }
    }

    private void alunos(UUID importacaoId, Relatorio r) {
        boolean pode = AcessoAtual.pode("ALUNO_ALTERAR");
        for (Aluno a : ler(() -> linhas.alunos(importacaoId))) {
            String motivo = !pode ? "SEM_PERMISSAO" : ler(() -> motivoParaFicar(a));
            if (motivo != null) {
                r.ficou("ALUNO", a.getId(), motivo);
            } else {
                apagar("ALUNO", a.getId(), () -> alunos.deleteById(a.getId()), r);
            }
        }
    }

    private String motivoParaFicar(Aluno a) {
        UUID id = a.getId();
        if (a.getUsuarioId() != null) {
            return "COM_ACESSO";
        }
        if (linhas.alunoTemExecucao(id)) {
            return "COM_REGISTROS";
        }
        long resto = linhas.pastasDoAluno(id) + linhas.treinosDoAluno(id) + linhas.dietasDoAluno(id)
                + linhas.mobilidadesDoAluno(id) + linhas.pesosDoAluno(id);
        if (a.isAnonimizado() || linhas.alunoTemCompromisso(id) || resto > 0) {
            return "EM_USO";
        }
        return null;
    }

    /** Apaga numa transação própria; o que o banco recusar por ligação fica como "em uso" e o resto segue. */
    private void apagar(String tipo, UUID id, Runnable acao, Relatorio r) {
        try {
            escrita.executeWithoutResult(s -> acao.run());
            r.apagou(tipo);
        } catch (DataIntegrityViolationException e) {
            r.ficou(tipo, id, "EM_USO");
        }
    }

    private <T> T ler(Supplier<T> consulta) {
        return leitura.execute(s -> consulta.get());
    }

    private static final class Relatorio {
        private final Map<String, int[]> contas = new LinkedHashMap<>();
        private final Map<String, Map<String, Integer>> motivos = new LinkedHashMap<>();
        private final List<Ficou> ficaram = new ArrayList<>();
        private int ficaramAlem;

        Relatorio() {
            for (String t : List.of("PLANO_TREINO", "PLANO_DIETA", "PASTA", "PESO", "EXERCICIO", "ALUNO")) {
                contas.put(t, new int[2]);
                motivos.put(t, new LinkedHashMap<>());
            }
        }

        void apagou(String tipo) {
            contas.get(tipo)[0]++;
        }

        void ficou(String tipo, UUID id, String motivo) {
            contas.get(tipo)[1]++;
            motivos.get(tipo).merge(motivo, 1, Integer::sum);
            if (ficaram.size() < ITENS_QUE_FICARAM) {
                ficaram.add(new Ficou(tipo, id, motivo));
            } else {
                ficaramAlem++;
            }
        }

        int apagadosNoTotal() {
            return contas.values().stream().mapToInt(c -> c[0]).sum();
        }

        Desfeita resposta(UUID importacaoId) {
            List<ParteDesfeita> partes = new ArrayList<>();
            contas.forEach((t, c) -> partes.add(new ParteDesfeita(t, c[0], c[1], Map.copyOf(motivos.get(t)))));
            return new Desfeita(importacaoId, List.copyOf(partes), List.copyOf(ficaram), ficaramAlem);
        }
    }
}
