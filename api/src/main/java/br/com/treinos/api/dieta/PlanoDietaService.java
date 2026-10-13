package br.com.treinos.api.dieta;

import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.equipe.AcessoAtual;
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

    /** Sem ERGOGENICO_LER a lista de medicação e ergogênicos sai nula (rascunho e versão publicada). */
    @Override
    protected ConteudoDieta paraLeitura(ConteudoDieta conteudo) {
        return AcessoAtual.pode("ERGOGENICO_LER") ? conteudo : conteudo.semErgogenicos();
    }

    /**
     * Sem ERGOGENICO_ALTERAR o que veio no corpo é ignorado e a lista que já está no rascunho fica como está (quem não
     * vê não apaga sem querer). Com a permissão, corpo sem a lista ({@code null}) também mantém a que está gravada: o
     * editor carregado antes de ganhar a permissão manda {@code null}; apagar tudo é mandar a lista vazia. Plano sem aluno (modelo) nunca guarda a lista.
     */
    @Override
    protected ConteudoDieta paraGravarRascunho(ConteudoDieta novo, ConteudoDieta atual, PlanoDieta plano) {
        if (plano.getAlunoId() == null) {
            return novo.semErgogenicos();
        }
        boolean manter = !AcessoAtual.pode("ERGOGENICO_ALTERAR") || novo.ergogenicos() == null;
        return manter ? novo.comErgogenicos(atual.ergogenicos()) : novo;
    }

    /** O que o aluno usa é pessoal: copiar a dieta de outro aluno leva só o plano alimentar. */
    @Override
    protected ConteudoDieta paraCopiaDeOutroAluno(ConteudoDieta conteudo) {
        return conteudo.semErgogenicos();
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
