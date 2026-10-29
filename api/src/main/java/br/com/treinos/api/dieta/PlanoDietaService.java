package br.com.treinos.api.dieta;

import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.biblioteca.Alimento;
import br.com.treinos.api.biblioteca.AlimentoRepository;
import br.com.treinos.api.equipe.AcessoAtual;
import br.com.treinos.api.pastas.PastaRepository;
import br.com.treinos.api.planos.PlanoServiceBase;
import br.com.treinos.api.planos.ResultadoValidacao;
import br.com.treinos.api.receitas.ReceitaService;
import org.springframework.stereotype.Service;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class PlanoDietaService extends PlanoServiceBase<PlanoDieta, PlanoDietaVersao, ConteudoDieta> {

    private final ReceitaService receitas;
    private final ValidadorDieta validador;
    private final AlimentoRepository alimentos;

    public PlanoDietaService(PlanoDietaRepository planos, PlanoDietaVersaoRepository versoes, AlunoRepository alunos, PastaRepository pastas, JsonMapper json, ReceitaService receitas, ValidadorDieta validador, AlimentoRepository alimentos) {
        super(planos, versoes, alunos, pastas, json, ConteudoDieta.class, "Plano de dieta");
        this.receitas = receitas;
        this.validador = validador;
        this.alimentos = alimentos;
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

    /**
     * Lista de compras do aluno (reunião de 17/10, R13/R14/R32): cada item que veio da biblioteca recebe o fator de
     * correção e o de cocção que o alimento tem <b>agora</b>, e a versão publicada (imutável) passa a levá-los. Assim o
     * app do aluno calcula a lista sem internet e sem rota nova, e mudar o fator na biblioteca depois só vale na próxima
     * publicação, como os outros números do item. A busca passa pelo {@code @TenantId}: alimento de outra consultoria
     * (ou id que não existe) não é achado e o item fica sem fatores; item manual (sem {@code alimentoId}) também. O que o
     * cliente mandou nesses campos é sempre sobrescrito. Alimento inativado continua valendo: a dieta ainda o usa e os
     * fatores são os que o treinador digitou.
     *
     * <p>O grupo do alimento ({@code Alimento.grupo}, que agrupa a lista de compras, pedido do Gustavo em 28/10) segue
     * exatamente a mesma regra: o do momento, sobrescrevendo o que o cliente mandou; nulo no item manual ou sem alimento.
     */
    @Override
    protected ConteudoDieta paraPublicar(ConteudoDieta conteudo) {
        Set<UUID> ids = conteudo.refeicoesOuVazio().stream().flatMap(r -> r.opcoesOuVazio().stream())
                .flatMap(o -> o.itensOuVazio().stream()).map(ConteudoDieta.Item::alimentoId).filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Map<UUID, Alimento> porId = ids.isEmpty() ? Map.of()
                : alimentos.findAllById(ids).stream().collect(Collectors.toMap(Alimento::getId, Function.identity()));
        return conteudo.comItens(i -> {
            Alimento a = i.alimentoId() == null ? null : porId.get(i.alimentoId());
            return a == null ? i.comDadosDaBiblioteca(null, null, null)
                    : i.comDadosDaBiblioteca(a.getFatorCorrecao(), a.getFatorCoccao(), a.getGrupo());
        });
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
