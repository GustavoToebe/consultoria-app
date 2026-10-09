package br.com.treinos.api.mobilidade;

import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.pastas.PastaRepository;
import br.com.treinos.api.planos.PlanoServiceBase;
import br.com.treinos.api.planos.ResultadoValidacao;
import br.com.treinos.api.receitas.ConteudoMobilidade;
import br.com.treinos.api.receitas.ReceitaService;
import org.springframework.stereotype.Service;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Service
public class PlanoMobilidadeService
        extends PlanoServiceBase<PlanoMobilidade, PlanoMobilidadeVersao, ConteudoMobilidade> {

    private final ReceitaService receitas;
    private final ValidadorMobilidade validador;

    public PlanoMobilidadeService(PlanoMobilidadeRepository planos, PlanoMobilidadeVersaoRepository versoes,
                                  AlunoRepository alunos, PastaRepository pastas, JsonMapper json,
                                  ReceitaService receitas, ValidadorMobilidade validador) {
        super(planos, versoes, alunos, pastas, json, ConteudoMobilidade.class, "Plano de mobilidade");
        this.receitas = receitas;
        this.validador = validador;
    }

    @Override
    protected PlanoMobilidade novoPlano(UUID alunoId, String titulo, LocalDate inicio, LocalDate fim, String rascunho) {
        return new PlanoMobilidade(alunoId, titulo, inicio, fim, rascunho);
    }

    @Override
    protected PlanoMobilidadeVersao novaVersao(PlanoMobilidade plano, int numero, String conteudo, UUID publicadoPor,
                                               Instant quando) {
        return new PlanoMobilidadeVersao(plano, numero, conteudo, publicadoPor, quando);
    }

    @Override
    protected ConteudoMobilidade vazio() {
        return ConteudoMobilidade.vazio();
    }

    @Override
    protected ConteudoMobilidade comUidsNovos(ConteudoMobilidade conteudo) {
        return conteudo.comUidsNovos();
    }

    @Override
    protected ConteudoMobilidade daReceita(UUID receitaId) {
        return receitas.conteudoMobilidade(receitaId);
    }

    @Override
    protected ResultadoValidacao validar(ConteudoMobilidade conteudo, LocalDate inicio, LocalDate fim) {
        return validador.validar(conteudo, inicio, fim);
    }
}
