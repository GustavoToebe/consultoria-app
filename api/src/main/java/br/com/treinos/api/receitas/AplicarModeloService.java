package br.com.treinos.api.receitas;

import br.com.treinos.api.dieta.*;
import br.com.treinos.api.equipe.AcessoAtual;
import br.com.treinos.api.mobilidade.*;
import br.com.treinos.api.treino.*;
import br.com.treinos.api.pastas.*;
import br.com.treinos.api.planos.dto.PlanoDtos.*;
import br.com.treinos.api.web.BadRequestException;
import br.com.treinos.api.web.NaoEncontradoException;
import br.com.treinos.api.web.Exigir;
import jakarta.validation.constraints.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.UUID;

/** Aplicação transacional: só cria rascunhos independentes; nunca publica ou modifica o modelo. */
@Service
public class AplicarModeloService {
    public record Request(@NotNull UUID alunoId, UUID pastaId, @NotBlank @Size(max = 120) String titulo,
                          LocalDate inicio, LocalDate fim) { }
    public record Response(UUID pastaId, UUID planoId, String tipo) { }
    private final ReceitaService receitas;
    private final PastaService pastas;
    private final PastaRepository repositorioPastas;
    private final PlanoTreinoService treinos;
    private final PlanoDietaService dietas;
    private final PlanoMobilidadeService mobilidades;
    private final PlanoTreinoRepository repositorioTreinos;
    private final PlanoDietaRepository repositorioDietas;
    private final PlanoMobilidadeRepository repositorioMobilidades;
    private final JsonMapper json;
    public AplicarModeloService(ReceitaService receitas, PastaService pastas, PastaRepository repositorioPastas,
            PlanoTreinoService treinos, PlanoDietaService dietas, PlanoMobilidadeService mobilidades,
            PlanoTreinoRepository repositorioTreinos, PlanoDietaRepository repositorioDietas,
            PlanoMobilidadeRepository repositorioMobilidades, JsonMapper json) {
        this.receitas=receitas; this.pastas=pastas; this.repositorioPastas=repositorioPastas;
        this.treinos=treinos; this.dietas=dietas; this.repositorioTreinos=repositorioTreinos;
        this.repositorioDietas=repositorioDietas; this.json=json;
        this.mobilidades=mobilidades; this.repositorioMobilidades=repositorioMobilidades;
    }
    @Transactional
    public Response aplicar(UUID id, Request r) {
        var modelo=receitas.detalhe(id);
        var tipo=Receita.Tipo.valueOf(modelo.tipo());
        if (tipo != Receita.Tipo.PLANO_TREINO && tipo != Receita.Tipo.SESSAO_TREINO
                && tipo != Receita.Tipo.PLANO_DIETA && tipo != Receita.Tipo.REFEICAO && tipo != Receita.Tipo.PASTA_PLANO
                && tipo != Receita.Tipo.MOBILIDADE)
            throw new BadRequestException("Este modelo é aplicado dentro do editor.");
        // Antes de qualquer efeito: o modelo cria treino, dieta ou mobilidade, então exige a permissão de alterar o que cria.
        ConteudoPastaModelo pacote=tipo == Receita.Tipo.PASTA_PLANO ? json.treeToValue(modelo.conteudo(), ConteudoPastaModelo.class) : null;
        exigirPermissoes(tipo, pacote);
        if (r.pastaId() == null) AcessoAtual.exigir("PASTA_ALTERAR"); // vai criar uma pasta nova
        UUID pastaId=r.pastaId();
        if (pastaId == null) pastaId=pastas.criar(r.alunoId(), new PastaDtos.PastaRequest(r.titulo(),r.inicio(),r.fim())).id();
        else Exigir.existe(repositorioPastas.findById(pastaId).filter(p -> !p.isArquivado() && p.getAlunoId().equals(r.alunoId())),
                () -> new NaoEncontradoException("Pasta não encontrada."));
        if (tipo == Receita.Tipo.PASTA_PLANO) {
            for (var p:pacote.planos()) {
                var pedido=new CriarPlanoRequest(p.titulo(),r.inicio(),r.fim(),null,null,pastaId);
                if (p.treino()!=null) {
                    var novo=treinos.criar(r.alunoId(),pedido);
                    treinos.salvarRascunho(novo.plano().id(),new SalvarRascunhoRequest<>(p.titulo(),novo.plano().inicio(),
                            novo.plano().fim(),p.treino().comUidsNovos(),novo.plano().versao()));
                } else if (p.dieta()!=null) {
                    var novo=dietas.criar(r.alunoId(),pedido);
                    dietas.salvarRascunho(novo.plano().id(),new SalvarRascunhoRequest<>(p.titulo(),novo.plano().inicio(),
                            novo.plano().fim(),p.dieta().semErgogenicos().comUidsNovos(),novo.plano().versao()));
                } else {
                    var novo=mobilidades.criar(r.alunoId(),pedido);
                    mobilidades.salvarRascunho(novo.plano().id(),new SalvarRascunhoRequest<>(p.titulo(),novo.plano().inicio(),
                            novo.plano().fim(),p.mobilidade().comUidsNovos(),novo.plano().versao()));
                }
            }
            return new Response(pastaId,null,"pasta");
        }
        var pedido=new CriarPlanoRequest(r.titulo(),r.inicio(),r.fim(),id,null,pastaId);
        if (tipo==Receita.Tipo.PLANO_TREINO || tipo==Receita.Tipo.SESSAO_TREINO) {
            var novo=treinos.criar(r.alunoId(),pedido);
            return new Response(pastaId,novo.plano().id(),"treino");
        }
        if (tipo==Receita.Tipo.MOBILIDADE) {
            var novo=mobilidades.criar(r.alunoId(),pedido);
            return new Response(pastaId,novo.plano().id(),"mobilidade");
        }
        var novo=dietas.criar(r.alunoId(),pedido);
        return new Response(pastaId,novo.plano().id(),"dieta");
    }
    /** Treino e mobilidade usam as permissões do treino; a dieta, as da dieta. O pacote exige o que seus planos trazem. */
    private static void exigirPermissoes(Receita.Tipo tipo, ConteudoPastaModelo pacote) {
        switch (tipo) {
            case PLANO_TREINO, SESSAO_TREINO, MOBILIDADE -> AcessoAtual.exigir("TREINO_ALTERAR");
            case PLANO_DIETA, REFEICAO -> AcessoAtual.exigir("DIETA_ALTERAR");
            case PASTA_PLANO -> {
                for (var p:pacote.planos()) AcessoAtual.exigir(p.dieta()!=null ? "DIETA_ALTERAR" : "TREINO_ALTERAR");
            }
            default -> { }
        }
    }
    @Transactional
    public ReceitaService.ReceitaResponse salvarPasta(UUID id, SalvarComoReceitaRequest r) {
        Exigir.existe(repositorioPastas.findById(id).filter(p -> !p.isArquivado()),
                () -> new NaoEncontradoException("Pasta não encontrada."));
        var conteudos=new ArrayList<ConteudoPastaModelo.Plano>();
        for(var p:repositorioTreinos.findByPastaId(id)) if(!p.isArquivado())
            conteudos.add(new ConteudoPastaModelo.Plano(p.getTitulo(),treinos.rascunho(p.getId()),null,null));
        for(var p:repositorioDietas.findByPastaId(id)) if(!p.isArquivado())
            conteudos.add(new ConteudoPastaModelo.Plano(p.getTitulo(),null,dietas.rascunho(p.getId()),null));
        for(var p:repositorioMobilidades.findByPastaId(id)) if(!p.isArquivado())
            conteudos.add(new ConteudoPastaModelo.Plano(p.getTitulo(),null,null,mobilidades.rascunho(p.getId())));
        return receitas.salvarConteudo(Receita.Tipo.PASTA_PLANO,r.nome(),r.descricao(),new ConteudoPastaModelo(conteudos));
    }
}
