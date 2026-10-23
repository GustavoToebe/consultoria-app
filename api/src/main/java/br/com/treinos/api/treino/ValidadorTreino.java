package br.com.treinos.api.treino;

import br.com.treinos.api.consultoria.ConfiguracaoConsultoria;
import br.com.treinos.api.consultoria.ConfiguracaoConsultoria.Papel;
import br.com.treinos.api.planos.ResultadoValidacao;
import br.com.treinos.api.treino.ConteudoTreino.ExercicioPlano;
import br.com.treinos.api.treino.ConteudoTreino.Grupo;
import br.com.treinos.api.treino.ConteudoTreino.Serie;
import br.com.treinos.api.treino.ConteudoTreino.Sessao;
import br.com.treinos.api.web.VideoUrls;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Regras de publicação do treino. O app mostra o mesmo resultado antes de publicar. Não opina sobre
 * carga nem volume: só confere que o plano é executável e coerente. O tipo da série é o código de um tipo da metodologia
 * copiada no plano: um código fora dela vira aviso, nunca erro. As faixas de carga, esforço, técnica e cardio ficam nos
 * próprios records ({@code Carga.problemas}, {@code Esforco.problemas}, {@code Tecnica.problemas},
 * {@code Cardio.problemas}); aqui entram as regras que dependem da série inteira (tipo, repetições, cardio), da posição
 * dela no exercício (mesma carga da WS, acima da anterior, referência do back off) e dos grupos da sessão.
 */
@Component
public class ValidadorTreino {

    /** Cadência em 4 partes (descida-pausa embaixo-subida-pausa em cima), cada uma 0 a 9 segundos ou X (explosivo). */
    private static final Pattern CADENCIA = Pattern.compile("[0-9X](-[0-9X]){3}");
    /** Superset, tri-set, giant set ou circuito: até 6 exercícios feitos em sequência. */
    static final int MAXIMO_POR_GRUPO = 6;
    /** Mínimo de exercícios de cada técnica de grupo (pré e pós-exaustão: exatamente 2). */
    private static final Map<String, Integer> MINIMO_POR_GRUPO = Map.of(
            ConteudoTreino.SUPERSET, 2,
            ConteudoTreino.AGONISTA_ANTAGONISTA, 2,
            ConteudoTreino.TRI_SET, 3,
            ConteudoTreino.GIANT_SET, 4,
            ConteudoTreino.CIRCUITO, 3,
            ConteudoTreino.PRE_EXAUSTAO, 2,
            ConteudoTreino.POS_EXAUSTAO, 2);
    private static final int MAXIMO_DE_VOLTAS = 20;

    private final VideoUrls videoUrls;

    public ValidadorTreino(VideoUrls videoUrls) {
        this.videoUrls = videoUrls;
    }

    public ResultadoValidacao validar(ConteudoTreino conteudo, LocalDate inicio, LocalDate fim) {
        ResultadoValidacao.Coletor c = new ResultadoValidacao.Coletor();
        Set<UUID> uids = new HashSet<>();
        Map<Integer, Integer> sessoesPorDia = new HashMap<>();
        boolean temDescanso = false;
        ConfiguracaoConsultoria metodologia = conteudo.metodologia() == null ? null : conteudo.metodologia().configuracao();
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
                exercicio(c, uids, exercicios.get(j), cs + ".exercicios[" + j + "]", metodologia);
            }
            grupos(c, uids, s, cs, metodologia);
        }
        if (!sessoes.isEmpty() && !temDescanso) {
            c.aviso("sessoes", "O plano não tem dia de descanso.");
        }
        if (inicio != null && fim != null && fim.isBefore(inicio)) {
            c.aviso("fim", "O fim do período é antes do início.");
        }
        return c.resultado();
    }

    private void exercicio(ResultadoValidacao.Coletor c, Set<UUID> uids, ExercicioPlano e, String ce,
                           ConfiguracaoConsultoria metodologia) {
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
        if (e.cadencia() != null && !e.cadencia().isBlank() && !CADENCIA.matcher(e.cadencia()).matches()) {
            c.erro(ce + ".cadencia", "Cadência em 4 partes separadas por hífen, cada uma de 0 a 9 ou X (ex.: 3-1-1-0).");
        }
        if (e.isometriaSegundos() != null && (e.isometriaSegundos() < 1 || e.isometriaSegundos() > 120)) {
            c.erro(ce + ".isometriaSegundos", "Isometria de 1 a 120 segundos.");
        }
        List<Serie> series = e.seriesOuVazio();
        if (series.isEmpty()) {
            c.erro(ce + ".series", "Exercício sem série.");
        }
        boolean cardio = e.deCardio();
        boolean temTrabalho = series.stream().anyMatch(Serie::deTrabalho);
        boolean temPercentual = false;
        boolean trabalhoAntes = false;
        Set<String> tiposAvisados = new HashSet<>();
        Set<String> tecnicasAvisadas = new HashSet<>();
        Set<UUID> anteriores = new HashSet<>();
        for (int k = 0; k < series.size(); k++) {
            Serie x = series.get(k);
            String cx = ce + ".series[" + k + "]";
            uid(c, uids, x.uid(), cx);
            problemasDaSerie(x, cardio).forEach((campo, mensagem) -> c.erro(cx + "." + campo, mensagem));
            if (!cardio) {
                tipoDaSerie(c, x, cx, metodologia, tiposAvisados);
                String modo = x.modo();
                temPercentual |= ConteudoTreino.PERCENTUAL_WS.equals(modo);
                if (ConteudoTreino.MESMA_CARGA.equals(modo) && !trabalhoAntes) {
                    c.erro(cx + ".carga.modo",
                            "Mesma carga da WS: precisa de uma série de trabalho antes, no mesmo exercício.");
                }
                if (ConteudoTreino.ACIMA_DA_ANTERIOR.equals(modo) && k == 0) {
                    c.aviso(cx + ".carga.modo",
                            "Acima da anterior na primeira série do exercício: o aluno não terá carga anterior de referência.");
                }
                if (ConteudoTreino.ABAIXO_DA_REFERENCIA.equals(modo) && x.carga().referenciaUid() != null
                        && !anteriores.contains(x.carga().referenciaUid())) {
                    c.erro(cx + ".carga.referenciaUid",
                            "A referência precisa ser uma série anterior, no mesmo exercício.");
                }
                if (x.tecnica() != null && ConteudoTreino.FORCED_REPS.equals(x.tecnica().tipo())) {
                    c.aviso(cx + ".tecnica", "Forced reps precisa de um parceiro para ajudar nas repetições.");
                }
                tecnicaDaSerie(c, x, cx, metodologia, tecnicasAvisadas);
            }
            trabalhoAntes |= x.deTrabalho();
            if (x.uid() != null) {
                anteriores.add(x.uid());
            }
        }
        if (temPercentual && !temTrabalho) {
            c.aviso(ce + ".series", "Há série em % da WS sem série de trabalho: a referência será a carga de trabalho "
                    + "que o aluno digitar.");
        }
        if (Boolean.FALSE.equals(e.progressao()) && temTrabalho) {
            c.aviso(ce + ".progressao", "Exercício sem progressão de carga, mas com série de trabalho.");
        }
    }

    /**
     * Grupos da sessão: cada exercício aponta o grupo em {@code grupoUid}; os membros de um grupo ficam um ao lado do
     * outro, na quantidade mínima da técnica (pré e pós-exaustão: exatamente 2) e até {@link #MAXIMO_POR_GRUPO}. O
     * descanso depois do grupo não vale em pré e pós-exaustão e as voltas só contam no circuito.
     */
    private static void grupos(ResultadoValidacao.Coletor c, Set<UUID> uids, Sessao s, String cs,
                               ConfiguracaoConsultoria metodologia) {
        Map<UUID, Integer> posicaoDoGrupo = new LinkedHashMap<>();
        List<Grupo> grupos = s.gruposOuVazio();
        for (int g = 0; g < grupos.size(); g++) {
            Grupo grupo = grupos.get(g);
            String cg = cs + ".grupos[" + g + "]";
            uid(c, uids, grupo.uid(), cg);
            if (grupo.uid() != null) {
                posicaoDoGrupo.putIfAbsent(grupo.uid(), g);
            }
            if (grupo.tecnica() == null || !ConteudoTreino.TECNICAS_DE_GRUPO.contains(grupo.tecnica())) {
                c.erro(cg + ".tecnica", "Técnica de grupo inválida: use superset, agonista-antagonista, tri-set, giant "
                        + "set, circuito, pré-exaustão ou pós-exaustão.");
            } else if (metodologia != null && metodologia.combinacao(grupo.tecnica()) == null) {
                c.aviso(cg + ".tecnica", "A combinação \"" + grupo.tecnica() + "\" não está na metodologia do plano ("
                        + metodologia.combinacoes().stream().map(k -> k.tipo()).collect(Collectors.joining(", "))
                        + "). O grupo continua válido.");
            }
            boolean semDescansoDoGrupo = ConteudoTreino.PRE_EXAUSTAO.equals(grupo.tecnica())
                    || ConteudoTreino.POS_EXAUSTAO.equals(grupo.tecnica());
            if (grupo.descansoAposSegundos() != null) {
                if (semDescansoDoGrupo) {
                    c.erro(cg + ".descansoAposSegundos",
                            "Pré e pós-exaustão não têm descanso depois do grupo: cada série mantém o próprio.");
                } else if (grupo.descansoAposSegundos() < 0 || grupo.descansoAposSegundos() > 3600) {
                    c.erro(cg + ".descansoAposSegundos", "Descanso depois do grupo entre 0 e 3600 segundos.");
                }
            }
            if (ConteudoTreino.CIRCUITO.equals(grupo.tecnica())
                    && (grupo.voltas() == null || grupo.voltas() < 1 || grupo.voltas() > MAXIMO_DE_VOLTAS)) {
                c.erro(cg + ".voltas", "Circuito: de 1 a " + MAXIMO_DE_VOLTAS + " voltas.");
            }
        }
        List<List<Integer>> membros = new ArrayList<>();
        for (int g = 0; g < grupos.size(); g++) {
            membros.add(new ArrayList<>());
        }
        List<ExercicioPlano> exercicios = s.exerciciosOuVazio();
        for (int j = 0; j < exercicios.size(); j++) {
            UUID grupoUid = exercicios.get(j).grupoUid();
            if (grupoUid == null) {
                continue;
            }
            Integer posicao = posicaoDoGrupo.get(grupoUid);
            if (posicao == null) {
                c.erro(cs + ".exercicios[" + j + "].grupoUid", "O grupo do exercício não existe na sessão.");
            } else {
                membros.get(posicao).add(j);
            }
        }
        for (int g = 0; g < grupos.size(); g++) {
            Grupo grupo = grupos.get(g);
            List<Integer> indices = membros.get(g);
            String cg = cs + ".grupos[" + g + "]";
            if (indices.isEmpty()) {
                c.erro(cg, "Grupo sem exercícios.");
                continue;
            }
            int primeiro = indices.get(0);
            int ultimo = indices.get(indices.size() - 1);
            if (ultimo - primeiro + 1 != indices.size()) {
                c.erro(cg, "Os exercícios de um grupo precisam ficar um ao lado do outro na sessão.");
            }
            if (ConteudoTreino.CIRCUITO.equals(grupo.tecnica()) && grupo.voltas() != null && grupo.voltas() >= 1) {
                int voltas = grupo.voltas();
                indices.stream().map(exercicios::get).filter(e -> e.seriesOuVazio().size() != voltas).findFirst()
                        .ifPresent(e -> c.aviso(cg + ".voltas", "Circuito de " + voltas + (voltas == 1 ? " volta" : " voltas")
                                + ": o aluno registra uma série por volta, então cada exercício precisa de " + voltas
                                + (voltas == 1 ? " série" : " séries") + " ("
                                + (e.nome() == null || e.nome().isBlank() ? "um exercício" : e.nome().trim()) + " tem "
                                + e.seriesOuVazio().size() + ")."));
            }
            Integer minimo = grupo.tecnica() == null ? null : MINIMO_POR_GRUPO.get(grupo.tecnica());
            if (minimo == null) {
                continue;
            }
            boolean exato = ConteudoTreino.PRE_EXAUSTAO.equals(grupo.tecnica())
                    || ConteudoTreino.POS_EXAUSTAO.equals(grupo.tecnica());
            if (exato && indices.size() != 2) {
                c.erro(cg, "Pré e pós-exaustão têm exatamente 2 exercícios.");
            } else if (!exato && indices.size() < minimo) {
                c.erro(cg, "Esse grupo precisa de pelo menos " + minimo + " exercícios.");
            } else if (indices.size() > MAXIMO_POR_GRUPO) {
                c.erro(cg, "Um grupo de exercícios feitos juntos vai até " + MAXIMO_POR_GRUPO + " exercícios.");
            }
        }
    }

    /** Aviso, um por técnica no exercício: a série usa uma técnica que a metodologia do plano não tem. Plano sem metodologia não avisa. */
    private static void tecnicaDaSerie(ResultadoValidacao.Coletor c, Serie x, String cx, ConfiguracaoConsultoria metodologia,
                                       Set<String> tecnicasAvisadas) {
        if (metodologia == null || x.tecnica() == null || x.tecnica().tipo() == null) {
            return;
        }
        String tipo = x.tecnica().tipo();
        if (metodologia.tecnica(tipo) != null || !tecnicasAvisadas.add(tipo)) {
            return;
        }
        c.aviso(cx + ".tecnica", "A técnica \"" + tipo + "\" não está na metodologia do plano ("
                + metodologia.tecnicas().stream().map(t -> t.tipo()).collect(Collectors.joining(", "))
                + "). A série continua válida.");
    }

    /** Avisos que dependem da metodologia do plano: tipo fora dela (um por tipo, no exercício) e RIR 0 em aquecimento. */
    private static void tipoDaSerie(ResultadoValidacao.Coletor c, Serie x, String cx, ConfiguracaoConsultoria metodologia,
                                    Set<String> tiposAvisados) {
        if (metodologia == null || x.semTipo()) {
            return;
        }
        String tipo = x.tipo().trim();
        ConfiguracaoConsultoria.TipoDeSerie definicao = metodologia.tipoPorCodigo(tipo);
        if (definicao == null) {
            if (tiposAvisados.add(tipo)) {
                c.aviso(cx + ".tipo", "O tipo \"" + tipo + "\" não está na metodologia do plano ("
                        + metodologia.tipos().stream().map(t -> t.codigo()).collect(Collectors.joining(", "))
                        + "). A série continua válida.");
            }
            return;
        }
        if (x.esforco() != null && Integer.valueOf(0).equals(x.esforco().rir())
                && (definicao.papel() == Papel.AQUECIMENTO || definicao.papel() == Papel.PREPARACAO)) {
            c.aviso(cx + ".esforco.rir", "RIR 0 (até a falha técnica) em série de aquecimento ou preparação: confira se é isso mesmo.");
        }
    }

    /**
     * Problemas de uma série sozinha, por campo (caminho a partir da série, como {@code carga.percentualMin}; vazio =
     * válida). {@code exercicioCardio}: a série leva {@code cardio} e não tem tipo, carga, esforço, repetições nem técnica;
     * fora do cardio o tipo é obrigatório e {@code cardio} não existe. Repetições mínima e máxima juntas (ou nenhuma, série
     * por tempo ou {@code amrap}); no cluster são a soma dos blocos. Usado também pelas receitas de séries.
     */
    public static Map<String, String> problemasDaSerie(Serie x, boolean exercicioCardio) {
        Map<String, String> p = new LinkedHashMap<>();
        if (x.descansoSegundos() != null && (x.descansoSegundos() < 0 || x.descansoSegundos() > 3600)) {
            p.put("descansoSegundos", "Descanso precisa ficar entre 0 e 3600 segundos.");
        }
        if (x.alvoExtra() != null && x.alvoExtra().length() > 120) {
            p.put("alvoExtra", "Alvo extra com no máximo 120 caracteres.");
        }
        if (exercicioCardio) {
            cardio(p, x);
            return p;
        }
        if (x.cardio() != null) {
            p.put("cardio", "A prescrição de cardio só vale em exercício de cardio.");
        }
        if (x.semTipo()) {
            p.put("tipo", "Série sem tipo.");
        }
        reps(p, x);
        if (x.tecnica() != null) {
            x.tecnica().problemas().forEach((campo, mensagem) -> p.put("tecnica." + campo, mensagem));
            Integer soma = x.tecnica().somaDosBlocos();
            if (soma != null && (!soma.equals(x.repsMin()) || !soma.equals(x.repsMax()))) {
                p.putIfAbsent("repsMin", "Cluster: as repetições são a soma dos blocos (" + soma + ").");
            }
        }
        if (x.carga() != null) {
            x.carga().problemas().forEach((campo, mensagem) -> p.put("carga." + campo, mensagem));
        }
        if (x.esforco() != null) {
            x.esforco().problemas().forEach((campo, mensagem) -> p.put("esforco." + campo, mensagem));
        }
        return p;
    }

    private static void reps(Map<String, String> p, Serie x) {
        boolean temReps = x.repsMin() != null || x.repsMax() != null;
        if (x.amrapExplicito() && temReps) {
            p.put("amrap", "AMRAP é o máximo de repetições: tire as repetições mínima e máxima.");
        } else if ((x.repsMin() == null) != (x.repsMax() == null)) {
            p.put("repsMax", "Informe repetições mínima e máxima, ou nenhuma (série por tempo).");
        } else if (x.repsMin() != null) {
            if (x.repsMin() < 0 || x.repsMax() > 500) {
                p.put("repsMin", "Repetições precisam ficar entre 0 e 500.");
            } else if (x.repsMax() < x.repsMin()) {
                p.put("repsMax", "Repetição máxima menor que a mínima.");
            }
        }
    }

    /** Série de exercício de cardio: só {@code cardio}; tipo, carga, esforço, repetições e técnica não existem. */
    private static void cardio(Map<String, String> p, Serie x) {
        if (x.cardio() == null) {
            p.put("cardio", "Série de cardio sem prescrição (duração, distância ou intervalos).");
        } else {
            x.cardio().problemas().forEach((campo, mensagem) -> p.put("cardio." + campo, mensagem));
        }
        if (!x.semTipo()) {
            p.put("tipo", "Série de cardio não tem tipo.");
        }
        if (x.carga() != null && !ConteudoTreino.NENHUMA.equals(x.modo())) {
            p.put("carga", "Série de cardio não tem carga.");
        }
        if (x.esforco() != null && !x.esforco().vazio()) {
            p.put("esforco", "Série de cardio não tem esforço (RIR ou RPE).");
        }
        if (x.repsMin() != null || x.repsMax() != null || x.amrapExplicito()) {
            p.put("repsMin", "Série de cardio não tem repetições.");
        }
        if (x.tecnica() != null) {
            p.put("tecnica", "Série de cardio não tem técnica.");
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
