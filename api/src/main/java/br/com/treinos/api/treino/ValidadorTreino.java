package br.com.treinos.api.treino;

import br.com.treinos.api.planos.ResultadoValidacao;
import br.com.treinos.api.treino.ConteudoTreino.ExercicioPlano;
import br.com.treinos.api.treino.ConteudoTreino.Intensidade;
import br.com.treinos.api.treino.ConteudoTreino.Serie;
import br.com.treinos.api.treino.ConteudoTreino.Sessao;
import br.com.treinos.api.web.VideoUrls;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Regras de publicação do treino (seção 9.3). O app mostra o mesmo resultado antes de publicar. Não opina sobre
 * carga nem volume: só confere que o plano é executável e coerente.
 */
@Component
public class ValidadorTreino {

    private static final BigDecimal MEIO = new BigDecimal("0.5");

    private final VideoUrls videoUrls;

    public ValidadorTreino(VideoUrls videoUrls) {
        this.videoUrls = videoUrls;
    }

    public ResultadoValidacao validar(ConteudoTreino conteudo, LocalDate inicio, LocalDate fim) {
        ResultadoValidacao.Coletor c = new ResultadoValidacao.Coletor();
        Set<UUID> uids = new HashSet<>();
        Map<Integer, Integer> sessoesPorDia = new HashMap<>();
        boolean temDescanso = false;
        List<Sessao> sessoes = conteudo.sessoesOuVazio();
        if (sessoes.isEmpty()) {
            c.erro("sessoes", "O plano não tem nenhuma sessão.");
        }
        for (int i = 0; i < sessoes.size(); i++) {
            Sessao s = sessoes.get(i);
            String cs = "sessoes[" + i + "]";
            uid(c, uids, s.uid(), cs);
            if (vazio(s.nome())) {
                c.erro(cs + ".nome", "Sessão sem nome.");
            }
            if (!ConteudoTreino.TIPOS_SESSAO.contains(s.tipo())) {
                c.erro(cs + ".tipo", "Tipo de sessão inválido.");
            }
            if (ConteudoTreino.DESCANSO.equals(s.tipo()) || ConteudoTreino.DESCANSO_ATIVO.equals(s.tipo())) {
                temDescanso = true;
            }
            if (s.diaSemana() != null) {
                if (s.diaSemana() < 1 || s.diaSemana() > 7) {
                    c.erro(cs + ".diaSemana", "Dia da semana precisa ser de 1 (segunda) a 7 (domingo).");
                } else if (sessoesPorDia.merge(s.diaSemana(), 1, Integer::sum) == 2) {
                    c.aviso(cs + ".diaSemana", "Duas sessões no mesmo dia da semana.");
                }
            }
            if (s.frequenciaSemanal() != null && (s.frequenciaSemanal() < 1 || s.frequenciaSemanal() > 7)) {
                c.erro(cs + ".frequenciaSemanal", "Frequência semanal precisa ser de 1 a 7.");
            }
            if (ConteudoTreino.TREINO.equals(s.tipo()) && s.exerciciosOuVazio().isEmpty()) {
                c.erro(cs + ".exercicios", "Sessão de treino sem exercício.");
            }
            List<ExercicioPlano> exercicios = s.exerciciosOuVazio();
            for (int j = 0; j < exercicios.size(); j++) {
                exercicio(c, uids, exercicios.get(j), cs + ".exercicios[" + j + "]");
            }
        }
        if (!sessoes.isEmpty() && !temDescanso) {
            c.aviso("sessoes", "O plano não tem dia de descanso.");
        }
        if (inicio != null && fim != null && fim.isBefore(inicio)) {
            c.aviso("fim", "O fim do período é antes do início.");
        }
        return c.resultado();
    }

    private void exercicio(ResultadoValidacao.Coletor c, Set<UUID> uids, ExercicioPlano e, String ce) {
        uid(c, uids, e.uid(), ce);
        if (vazio(e.nome())) {
            c.erro(ce + ".nome", "Exercício sem nome.");
        }
        if (e.videoUrl() != null && !e.videoUrl().isBlank() && !videoUrls.valida(e.videoUrl())) {
            c.erro(ce + ".videoUrl", "Link de vídeo não aceito (só https do YouTube).");
        }
        if (e.unidade() != null && !"kg".equals(e.unidade()) && !"nenhuma".equals(e.unidade())) {
            c.erro(ce + ".unidade", "Unidade precisa ser kg ou nenhuma.");
        }
        List<Serie> series = e.seriesOuVazio();
        if (series.isEmpty()) {
            c.erro(ce + ".series", "Exercício sem série.");
        }
        boolean temTrabalho = series.stream().anyMatch(Serie::deTrabalho);
        boolean temPercentual = false;
        for (int k = 0; k < series.size(); k++) {
            Serie x = series.get(k);
            String cx = ce + ".series[" + k + "]";
            uid(c, uids, x.uid(), cx);
            serie(c, x, cx);
            temPercentual |= ConteudoTreino.PERCENTUAL_WS.equals(x.modo());
        }
        if (temPercentual && !temTrabalho) {
            c.aviso(ce + ".series", "Há série em % da WS sem série de trabalho: a referência será a carga de trabalho "
                    + "que o aluno digitar.");
        }
        if (Boolean.FALSE.equals(e.progressao()) && temTrabalho) {
            c.aviso(ce + ".progressao", "Exercício sem progressão de carga, mas com série de trabalho.");
        }
    }

    private static void serie(ResultadoValidacao.Coletor c, Serie x, String cx) {
        if (vazio(x.tipo())) {
            c.erro(cx + ".tipo", "Série sem tipo.");
        }
        if ((x.repsMin() == null) != (x.repsMax() == null)) {
            c.erro(cx + ".repsMax", "Informe repetições mínima e máxima, ou nenhuma (série por tempo).");
        } else if (x.repsMin() != null) {
            if (x.repsMin() < 0 || x.repsMax() > 500) {
                c.erro(cx + ".repsMin", "Repetições precisam ficar entre 0 e 500.");
            } else if (x.repsMax() < x.repsMin()) {
                c.erro(cx + ".repsMax", "Repetição máxima menor que a mínima.");
            }
        }
        if (x.descansoSegundos() != null && (x.descansoSegundos() < 0 || x.descansoSegundos() > 3600)) {
            c.erro(cx + ".descansoSegundos", "Descanso precisa ficar entre 0 e 3600 segundos.");
        }
        Intensidade i = x.intensidade();
        String modo = x.modo();
        if (!ConteudoTreino.MODOS.contains(modo)) {
            c.erro(cx + ".intensidade.modo", "Forma de intensidade inválida.");
            return;
        }
        switch (modo) {
            case ConteudoTreino.PERCENTUAL_WS -> {
                if (i.percentual() == null || i.percentual().compareTo(BigDecimal.ONE) < 0
                        || i.percentual().compareTo(new BigDecimal("200")) > 0) {
                    c.erro(cx + ".intensidade.percentual", "Percentual precisa ficar entre 1 e 200.");
                }
            }
            case "RIR" -> {
                if (i.rir() == null || i.rir() < 0 || i.rir() > 10) {
                    c.erro(cx + ".intensidade.rir", "RIR precisa ficar entre 0 e 10.");
                }
            }
            case "RPE" -> {
                if (i.rpe() == null || i.rpe().compareTo(BigDecimal.ONE) < 0
                        || i.rpe().compareTo(BigDecimal.TEN) > 0
                        || i.rpe().remainder(MEIO).signum() != 0) {
                    c.erro(cx + ".intensidade.rpe", "RPE precisa ficar entre 1 e 10, de meio em meio.");
                }
            }
            case "LIVRE" -> {
                if (vazio(i.texto())) {
                    c.erro(cx + ".intensidade.texto", "Escreva a intensidade.");
                }
            }
            default -> {
                // CARGA_TRABALHO e NENHUMA não têm parâmetro.
            }
        }
    }

    private static void uid(ResultadoValidacao.Coletor c, Set<UUID> uids, UUID uid, String caminho) {
        if (uid == null) {
            c.erro(caminho + ".uid", "Item sem identificador.");
        } else if (!uids.add(uid)) {
            c.erro(caminho + ".uid", "Identificador repetido.");
        }
    }

    private static boolean vazio(String texto) {
        return texto == null || texto.isBlank();
    }
}
