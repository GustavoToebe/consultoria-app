package br.com.treinos.api.treino;

import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.planos.PlanoServiceBase;
import br.com.treinos.api.planos.ResultadoValidacao;
import br.com.treinos.api.receitas.ReceitaService;
import org.springframework.stereotype.Service;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Service
public class PlanoTreinoService extends PlanoServiceBase<PlanoTreino, PlanoTreinoVersao, ConteudoTreino> {

    private final ReceitaService receitas;
    private final ValidadorTreino validador;

    public PlanoTreinoService(PlanoTreinoRepository planos, PlanoTreinoVersaoRepository versoes,
                              AlunoRepository alunos, JsonMapper json, ReceitaService receitas,
                              ValidadorTreino validador) {
        super(planos, versoes, alunos, json, ConteudoTreino.class, "Plano de treino");
        this.receitas = receitas;
        this.validador = validador;
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
    protected ResultadoValidacao validar(ConteudoTreino conteudo, LocalDate inicio, LocalDate fim) {
        return validador.validar(conteudo, inicio, fim);
    }
}
