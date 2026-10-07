package br.com.treinos.api.execucao;

import br.com.treinos.api.treino.ConteudoTreino;
import br.com.treinos.api.treino.ConteudoTreino.ExercicioPlano;
import br.com.treinos.api.treino.ConteudoTreino.Serie;
import br.com.treinos.api.treino.ConteudoTreino.Sessao;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Mapa dos uids de uma versão publicada do treino: onde está cada série (sessão e exercício), se é de trabalho, a
 * unidade e a posição no plano. Serve para conferir o registro do aluno e para mostrar o histórico com nomes.
 */
public final class IndiceVersao {

    public record LocalSerie(UUID sessaoUid, UUID exercicioUid, UUID exercicioId, boolean trabalho, String unidade,
                             String tipo, int ordem) {
    }

    private final UUID alunoId;
    private final Map<UUID, LocalSerie> series = new HashMap<>();
    private final Map<UUID, String> nomesSessao = new HashMap<>();
    private final Map<UUID, String> nomesExercicio = new HashMap<>();

    IndiceVersao(UUID alunoId, ConteudoTreino conteudo) {
        this.alunoId = alunoId;
        int ordem = 0;
        for (Sessao s : conteudo.sessoesOuVazio()) {
            if (s.uid() != null) {
                nomesSessao.put(s.uid(), s.nome());
            }
            for (ExercicioPlano e : s.exerciciosOuVazio()) {
                if (e.uid() != null) {
                    nomesExercicio.put(e.uid(), e.nome());
                }
                String unidade = "nenhuma".equals(e.unidade()) ? "nenhuma" : "kg";
                for (Serie x : e.seriesOuVazio()) {
                    if (x.uid() != null) {
                        series.put(x.uid(), new LocalSerie(s.uid(), e.uid(), e.exercicioId(), x.deTrabalho(), unidade,
                                x.tipo(), ordem++));
                    }
                }
            }
        }
    }

    /** Aluno dono do plano desta versão: registro de outro aluno nesta versão é recusado. */
    public UUID alunoId() {
        return alunoId;
    }

    public Optional<LocalSerie> serie(UUID serieUid) {
        return Optional.ofNullable(series.get(serieUid));
    }

    public String nomeSessao(UUID sessaoUid) {
        return nomesSessao.getOrDefault(sessaoUid, "Sessão");
    }

    public String nomeExercicio(UUID exercicioUid) {
        return nomesExercicio.getOrDefault(exercicioUid, "Exercício");
    }
}
