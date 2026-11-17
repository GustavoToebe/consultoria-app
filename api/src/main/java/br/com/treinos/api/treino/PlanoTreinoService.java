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
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

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
     * pelo {@code @TenantId}: id de outra consultoria ou que não existe fica sem equipamento, e o que o cliente mandou no
     * campo é sempre sobrescrito. Versões antigas não têm o campo; o rascunho não muda.
     */
    @Override
    protected ConteudoTreino paraPublicar(ConteudoTreino conteudo) {
        Set<UUID> ids = conteudo.sessoesOuVazio().stream().flatMap(s -> s.exerciciosOuVazio().stream())
                .map(ConteudoTreino.ExercicioPlano::exercicioId).filter(Objects::nonNull).collect(Collectors.toSet());
        Map<UUID, String> equipamentoPorId = new HashMap<>();
        if (!ids.isEmpty()) {
            for (Exercicio e : exercicios.findByIdIn(ids)) {
                String equipamento = e.getEquipamento() == null ? "" : e.getEquipamento().strip();
                if (!equipamento.isEmpty()) {
                    equipamentoPorId.put(e.getId(), equipamento);
                }
            }
        }
        return conteudo.comExercicios(x -> x.comEquipamento(x.exercicioId() == null ? null : equipamentoPorId.get(x.exercicioId())));
    }

    @Override
    protected ResultadoValidacao validar(ConteudoTreino conteudo, LocalDate inicio, LocalDate fim) {
        return validador.validar(conteudo, inicio, fim);
    }
}
