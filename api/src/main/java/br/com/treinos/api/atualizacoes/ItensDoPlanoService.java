package br.com.treinos.api.atualizacoes;

import br.com.treinos.api.dieta.ConteudoDieta;
import br.com.treinos.api.dieta.PlanoDietaService;
import br.com.treinos.api.execucao.ExecucaoSerie;
import br.com.treinos.api.execucao.ExecucaoSerieRepository;
import br.com.treinos.api.pastas.PastaPlano;
import br.com.treinos.api.treino.PlanoTreinoService;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;

/**
 * Monta, para o envio de uma atualização, a lista de itens que o aluno pode escolher ({@link ItensDoPlano}). Só lê, sempre
 * do próprio aluno e da pasta dele (o {@code @TenantId} já filtra a consultoria), e só quando uma pergunta visível e
 * respondida pede a fonte: o envio comum não ganha consulta nenhuma. Chamar dentro da transação do envio.
 *
 * <p>Lê a versão LIBERADA da pasta (a que o aluno vê, {@code versaoLiberadaDaPasta}): plano só agendado nunca entra na lista.
 */
@Service
public class ItensDoPlanoService {

    private static final int DIAS_DO_PERIODO_MAXIMO = 400;
    private static final String[] DIAS_ABREVIADOS = {"Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"};
    private static final String[] DIAS_POR_EXTENSO = {"Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"};

    private final PlanoDietaService dietas;
    private final PlanoTreinoService treinos;
    private final ExecucaoSerieRepository execucoes;

    public ItensDoPlanoService(PlanoDietaService dietas, PlanoTreinoService treinos, ExecucaoSerieRepository execucoes) {
        this.dietas = dietas;
        this.treinos = treinos;
        this.execucoes = execucoes;
    }

    /**
     * Itens do aluno na pasta. {@code fimDoPeriodo} é a data da atualização (o resumo do período vai do início da pasta até
     * ela); sem início ou com o período invertido, os dias treinados caem para a semana.
     */
    public ItensDoPlano da(UUID alunoId, PastaPlano pasta, LocalDate fimDoPeriodo) {
        Map<String, List<ItensDoPlano.Item>> lidos = new HashMap<>();
        return fonte -> lidos.computeIfAbsent(fonte, f -> switch (f) {
            case "ALIMENTOS_DA_DIETA" -> alimentos(alunoId, pasta);
            case "EXERCICIOS_DO_TREINO" -> exercicios(alunoId, pasta);
            case "DIAS_TREINADOS" -> diasTreinados(alunoId, pasta, fimDoPeriodo);
            default -> List.of();
        });
    }

    /** Todo item (uid e nome) das refeições da raiz e das variações, em todas as opções; sem uid ou sem nome fica de fora. */
    private List<ItensDoPlano.Item> alimentos(UUID alunoId, PastaPlano pasta) {
        List<ItensDoPlano.Item> lista = new ArrayList<>();
        dietas.versaoLiberadaDaPasta(alunoId, pasta.getId()).ifPresent(v -> {
            for (var refeicao : v.conteudo().todasAsRefeicoes()) {
                for (var opcao : refeicao.opcoesOuVazio()) {
                    for (ConteudoDieta.Item item : opcao.itensOuVazio()) {
                        adicionar(lista, item.uid(), item.nome());
                    }
                }
            }
        });
        return lista;
    }

    /** Exercícios principais do treino publicado (as alternativas não têm uid). */
    private List<ItensDoPlano.Item> exercicios(UUID alunoId, PastaPlano pasta) {
        List<ItensDoPlano.Item> lista = new ArrayList<>();
        treinos.versaoLiberadaDaPasta(alunoId, pasta.getId()).ifPresent(v -> {
            for (var sessao : v.conteudo().sessoesOuVazio()) {
                for (var exercicio : sessao.exerciciosOuVazio()) {
                    adicionar(lista, exercicio.uid(), exercicio.nome());
                }
            }
        });
        return lista;
    }

    private static void adicionar(List<ItensDoPlano.Item> lista, UUID uid, String nome) {
        if (uid != null && nome != null && !nome.isBlank()) {
            lista.add(new ItensDoPlano.Item(uid.toString(), nome.strip()));
        }
    }

    /**
     * Dias com série concluída entre o início da pasta e {@code fim} (id = data ISO; nome = "Seg 17/11" mais as sessões
     * do treino liberado que ele treinou, quando o uid da sessão ainda existe nele). Sem nenhum registro no período (o
     * check-in offline pode chegar antes das séries sincronizarem), vale a semana ("1" segunda a "7" domingo) OU qualquer
     * data entre o início da pasta e {@code fim} (nome "Seg 17/11"). shortcut: no máximo os últimos
     * {@link #DIAS_DO_PERIODO_MAXIMO} dias do período, trocar se pasta mais longa precisar de mais.
     */
    private List<ItensDoPlano.Item> diasTreinados(UUID alunoId, PastaPlano pasta, LocalDate fim) {
        LocalDate inicio = pasta.getInicio();
        boolean periodoValido = inicio != null && fim != null && !fim.isBefore(inicio);
        Map<LocalDate, Set<UUID>> sessoesPorDia = new TreeMap<>();
        if (periodoValido) {
            for (ExecucaoSerie s : execucoes.findByAlunoIdAndDataBetweenOrderByDataDesc(alunoId, inicio, fim)) {
                if (s.isConcluida()) {
                    sessoesPorDia.computeIfAbsent(s.getData(), d -> new LinkedHashSet<>()).add(s.getSessaoUid());
                }
            }
        }
        List<ItensDoPlano.Item> lista = new ArrayList<>();
        if (sessoesPorDia.isEmpty()) {
            for (int i = 0; i < DIAS_POR_EXTENSO.length; i++) {
                lista.add(new ItensDoPlano.Item(String.valueOf(i + 1), DIAS_POR_EXTENSO[i]));
            }
            if (periodoValido) {
                LocalDate primeiro = inicio.isBefore(fim.minusDays(DIAS_DO_PERIODO_MAXIMO - 1L)) ? fim.minusDays(DIAS_DO_PERIODO_MAXIMO - 1L) : inicio;
                for (LocalDate dia = primeiro; !dia.isAfter(fim); dia = dia.plusDays(1)) {
                    lista.add(new ItensDoPlano.Item(dia.toString(), rotuloDoDia(dia)));
                }
            }
            return lista;
        }
        Map<UUID, String> nomesDasSessoes = new HashMap<>();
        treinos.versaoLiberadaDaPasta(alunoId, pasta.getId()).ifPresent(v -> v.conteudo().sessoesOuVazio().forEach(sessao -> {
            if (sessao.uid() != null && sessao.nome() != null && !sessao.nome().isBlank()) {
                nomesDasSessoes.put(sessao.uid(), sessao.nome().strip());
            }
        }));
        sessoesPorDia.forEach((dia, sessoes) -> {
            List<String> nomes = sessoes.stream().map(nomesDasSessoes::get).filter(n -> n != null).distinct().toList();
            String rotulo = rotuloDoDia(dia);
            lista.add(new ItensDoPlano.Item(dia.toString(), nomes.isEmpty() ? rotulo : rotulo + " · " + String.join(", ", nomes)));
        });
        return lista;
    }

    private static String rotuloDoDia(LocalDate dia) {
        return "%s %02d/%02d".formatted(DIAS_ABREVIADOS[dia.getDayOfWeek().getValue() - 1], dia.getDayOfMonth(), dia.getMonthValue());
    }
}
