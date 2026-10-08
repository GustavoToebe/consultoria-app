package br.com.treinos.api.dieta;

import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.pastas.PastaRepository;
import br.com.treinos.api.planos.PlanoServiceBase;
import br.com.treinos.api.planos.ResultadoValidacao;
import br.com.treinos.api.receitas.ReceitaService;
import org.springframework.stereotype.Service;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Service
public class PlanoDietaService extends PlanoServiceBase<PlanoDieta, PlanoDietaVersao, ConteudoDieta> {

    private final ReceitaService receitas;
    private final ValidadorDieta validador;

    public PlanoDietaService(PlanoDietaRepository planos, PlanoDietaVersaoRepository versoes, AlunoRepository alunos, PastaRepository pastas, JsonMapper json, ReceitaService receitas, ValidadorDieta validador) {
        super(planos, versoes, alunos, pastas, json, ConteudoDieta.class, "Plano de dieta");
        this.receitas = receitas;
        this.validador = validador;
    }

    @Override
    protected PlanoDieta novoPlano(UUID alunoId, String titulo, LocalDate inicio, LocalDate fim, String rascunho) {
        return new PlanoDieta(alunoId, titulo, inicio, fim, rascunho);
    }

    @Override
    protected PlanoDietaVersao novaVersao(PlanoDieta plano, int numero, String conteudo, UUID publicadoPor,
                                          Instant quando) {
        return new PlanoDietaVersao(plano, numero, conteudo, publicadoPor, quando);
    }

    @Override
    protected ConteudoDieta vazio() {
        return ConteudoDieta.vazio();
    }

    @Override
    protected ConteudoDieta comUidsNovos(ConteudoDieta conteudo) {
        return conteudo.comUidsNovos();
    }

    @Override
    protected ConteudoDieta daReceita(UUID receitaId) {
        return receitas.conteudoDieta(receitaId);
    }

    @Override
    protected ResultadoValidacao validar(ConteudoDieta conteudo, LocalDate inicio, LocalDate fim) {
        return validador.validar(conteudo, inicio, fim);
    }
}
