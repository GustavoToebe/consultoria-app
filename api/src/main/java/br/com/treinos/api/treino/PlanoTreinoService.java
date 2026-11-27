package br.com.treinos.api.treino;

import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.biblioteca.Exercicio;
import br.com.treinos.api.biblioteca.ExercicioRepository;
import br.com.treinos.api.pastas.PastaRepository;
import br.com.treinos.api.planos.PlanoServiceBase;
import br.com.treinos.api.planos.ResultadoValidacao;
import br.com.treinos.api.receitas.ReceitaService;
import org.springframework.stereotype.Service;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

@Service
public class PlanoTreinoService extends PlanoServiceBase<PlanoTreino, PlanoTreinoVersao, ConteudoTreino> {

    private final ReceitaService receitas;
    private final ValidadorTreino validador;
    private final ExercicioRepository exercicios;

    public PlanoTreinoService(PlanoTreinoRepository planos, PlanoTreinoVersaoRepository versoes,
                              AlunoRepository alunos, PastaRepository pastas, JsonMapper json, ReceitaService receitas,
                              ValidadorTreino validador, ExercicioRepository exercicios) {
        super(planos, versoes, alunos, pastas, json, ConteudoTreino.class, "Plano de treino");
        this.receitas = receitas;
        this.validador = validador;
        this.exercicios = exercicios;
    }

    @Override
    protected PlanoTreino novoPlano(UUID alunoId, String titulo, LocalDate inicio, LocalDate fim, String rascunho) {
        return new PlanoTreino(alunoId, titulo, inicio, fim, rascunho);
    }

    @Override
    protected String tipoDoTitulo() {
        return "Treino";
    }

    @Override
    protected PlanoTreinoVersao novaVersao(PlanoTreino plano, int numero, String conteudo, UUID publicadoPor,
                                           Instant quando) {
        return new PlanoTreinoVersao(plano, numero, conteudo, publicadoPor, quando);
    }

    @Override
    protected ConteudoTreino vazio() {
        return ConteudoTreino.vazio();
    }

    @Override
    protected ConteudoTreino comUidsNovos(ConteudoTreino conteudo) {
        return conteudo.comUidsNovos();
    }

    @Override
    protected ConteudoTreino daReceita(UUID receitaId) {
        return receitas.conteudoTreino(receitaId);
    }

    @Override
    protected String escrever(ConteudoTreino conteudo) {
        ReceitaService.validarMetodologia(conteudo);
        // Todo plano tem metodologia: o que chega sem uma recebe a padrão da consultoria (criar, aplicar modelo e salvar).
        if (conteudo.metodologia() == null) {
            conteudo = receitas.metodologiaPadrao().map(conteudo::comMetodologia).orElse(conteudo);
        }
        return super.escrever(conteudo);
    }

    /**
     * O equipamento do exercício publicado é o da biblioteca <b>agora</b> (strip; vazio vira nulo), copiado na versão
     * imutável como os fatores da dieta, para o app do aluno listar "Equipamentos para hoje" sem internet. A busca passa
     * pelo {@code @TenantId}: a publicação já recusa id inexistente ou de outra consultoria (pendência 213); só uma corrida rara chega aqui com id sem linha, que fica sem equipamento, e o que o cliente mandou no
     * campo é sempre sobrescrito. Versões antigas não têm o campo; o rascunho não muda.
     */
    @Override
    protected ConteudoTreino paraPublicar(ConteudoTreino conteudo) {
        Set<UUID> ids = idsDosExercicios(conteudo);
        Map<UUID, Exercicio> porId = new HashMap<>();
        if (!ids.isEmpty()) {
            exercicios.findByIdIn(ids).forEach(e -> porId.put(e.getId(), e));
        }
        return conteudo.comExercicios(x -> x
                .comEquipamento(x.exercicioId() == null ? null : equipamentoDe(porId.get(x.exercicioId())))
                .comAlternativas(alternativasDaBiblioteca(x, porId)));
    }

    /**
     * Cardio com tipo: o rótulo da máquina (Esteira, Bike...), ou nada (corrida ao ar livre, natação, outro), sem chave
     * nova no plano (o APK instalado recusaria o pacote; D14 do plano do cardio). Sem tipo, o equipamento gravado.
     */
    private static String equipamentoDe(Exercicio e) {
        if (e != null && e.getTipoDeCardio() != null) {
            return e.getTipoDeCardio().rotuloDeEquipamento();
        }
        String equipamento = e == null || e.getEquipamento() == null ? "" : e.getEquipamento().strip();
        return equipamento.isEmpty() ? null : equipamento;
    }

    /**
     * As alternativas publicadas levam o nome e o vídeo da biblioteca <b>agora</b>, nunca o que o cliente mandou (o aluno lê
     * a cópia offline). Alternativa que a biblioteca não tem (a validação já a recusou; só uma corrida a deixaria chegar
     * aqui) não entra na versão.
     */
    private static List<ConteudoTreino.Alternativa> alternativasDaBiblioteca(ConteudoTreino.ExercicioPlano x,
                                                                             Map<UUID, Exercicio> porId) {
        return x.alternativas().stream()
                .filter(a -> a.exercicioId() != null && porId.containsKey(a.exercicioId()))
                .map(a -> {
                    Exercicio e = porId.get(a.exercicioId());
                    String video = e.getVideoUrl() == null || e.getVideoUrl().isBlank() ? null : e.getVideoUrl().strip();
                    return new ConteudoTreino.Alternativa(e.getId(), e.getNome(), video);
                }).toList();
    }

    /** Ids da biblioteca do plano: os exercícios e as alternativas deles. */
    private static Set<UUID> idsDosExercicios(ConteudoTreino conteudo) {
        Set<UUID> ids = new HashSet<>();
        conteudo.sessoesOuVazio().stream().flatMap(s -> s.exerciciosOuVazio().stream()).forEach(x -> {
            if (x.exercicioId() != null) {
                ids.add(x.exercicioId());
            }
            x.alternativas().stream().map(ConteudoTreino.Alternativa::exercicioId).filter(Objects::nonNull).forEach(ids::add);
        });
        return ids;
    }

    /**
     * O exercício principal e as alternativas são conferidos contra a biblioteca da consultoria numa consulta só (JPA com
     * tenant: id de outra consultoria não aparece e conta como inexistente).
     */
    @Override
    protected ResultadoValidacao validar(ConteudoTreino conteudo, LocalDate inicio, LocalDate fim) {
        Set<UUID> ids = idsDosExercicios(conteudo);
        Map<UUID, Exercicio.Modalidade> ativos = new HashMap<>();
        Set<UUID> arquivados = new HashSet<>();
        if (!ids.isEmpty()) {
            exercicios.findByIdIn(ids).forEach(e -> {
                if (e.isAtivo()) {
                    ativos.put(e.getId(), e.getModalidade());
                } else {
                    arquivados.add(e.getId());
                }
            });
        }
        return validador.validar(conteudo, inicio, fim, ativos, arquivados);
    }
}
