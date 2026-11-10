package br.com.treinos.api.atividade;

import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.atividade.AtividadeRecenteRepository.Fato;
import br.com.treinos.api.atividade.AtividadeRecenteRepository.FatoDePlano;
import br.com.treinos.api.equipe.AcessoAtual;
import br.com.treinos.api.retorno.RetornoProperties;
import br.com.treinos.api.web.Exigir;
import br.com.treinos.api.web.NaoEncontradoException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

/**
 * "Atividade recente" da ficha do aluno (etapa simples): os últimos fatos que os registros atuais comprovam, do mais novo ao
 * mais antigo. Só entra evento com data gravada; o título é fixo e o feed nunca carrega valor de peso, resposta, comentário,
 * lesão nem nome de exercício, só o fato de ter acontecido.
 *
 * <p>Cada tipo só entra se quem pede tem a permissão que já o mostra na ficha. Uma consulta limitada por tipo (no máximo
 * seis, sem N+1); a junção e o corte no limite são em memória. O peso e as fotos enviados numa atualização não têm item
 * próprio: fazem parte do item {@code ATUALIZACAO_ENVIADA}.</p>
 */
@Service
public class AtividadeRecenteService {
    public static final int LIMITE_PADRAO = 5;
    public static final int LIMITE_MAXIMO = 20;

    /** Tipos de evento (a ordem desempata instantes iguais). */
    public enum Tipo { ATUALIZACAO_ENVIADA, TREINO_CONCLUIDO, PLANO_PUBLICADO, PESO_REGISTRADO }
    /** Onde o app abre o detalhe: a atualização ({@code treinador/atualizacoes/[id]}) ou a pasta da ficha ({@code ?pastaId=}). */
    public enum TipoDeDestino { ATUALIZACAO, PASTA }

    public record Destino(TipoDeDestino tipo, UUID id) { }
    public record Item(Tipo tipo, String titulo, Instant quando, Destino destino) { }
    public record Resposta(List<Item> itens) { }

    private final AtividadeRecenteRepository fatos;
    private final AlunoRepository alunos;
    private final RetornoProperties retorno;

    public AtividadeRecenteService(AtividadeRecenteRepository fatos, AlunoRepository alunos, RetornoProperties retorno) {
        this.fatos = fatos;
        this.alunos = alunos;
        this.retorno = retorno;
    }

    /** Aluno de outra consultoria (ou inexistente) = 404 (a consulta já filtra pelo {@code @TenantId}). Limite nulo = 5; fora de 1 a 20 é cortado. */
    @Transactional(readOnly = true)
    public Resposta doAluno(UUID alunoId, Integer limiteInformado) {
        Exigir.existe(alunos.findById(alunoId), () -> new NaoEncontradoException("Aluno não encontrado."));
        int limite = limiteInformado == null ? LIMITE_PADRAO : Math.min(Math.max(limiteInformado, 1), LIMITE_MAXIMO);
        Pageable pagina = PageRequest.of(0, limite);
        List<Item> itens = new ArrayList<>();
        if (AcessoAtual.pode("ATUALIZACAO_LER") && AcessoAtual.pode("ALUNO_SENSIVEL_LER")) {
            for (Fato f : fatos.atualizacoesEnviadas(alunoId, pagina))
                itens.add(new Item(Tipo.ATUALIZACAO_ENVIADA, "Atualização enviada", f.quando(), new Destino(TipoDeDestino.ATUALIZACAO, f.id())));
        }
        if (retorno.habilitado() && AcessoAtual.pode("REGISTRO_LER")) {
            for (Fato f : fatos.treinosConcluidos(alunoId, pagina))
                itens.add(new Item(Tipo.TREINO_CONCLUIDO, "Treino concluído", f.quando(), null));
        }
        if (AcessoAtual.pode("TREINO_LER")) {
            publicados(itens, "Treino publicado", fatos.treinosPublicados(alunoId, pagina));
            publicados(itens, "Mobilidade publicada", fatos.mobilidadesPublicadas(alunoId, pagina));
        }
        if (AcessoAtual.pode("DIETA_LER")) publicados(itens, "Dieta publicada", fatos.dietasPublicadas(alunoId, pagina));
        if (AcessoAtual.pode("ALUNO_SENSIVEL_LER")) {
            for (Fato f : fatos.pesosDaEquipe(alunoId, pagina))
                itens.add(new Item(Tipo.PESO_REGISTRADO, "Peso registrado", f.quando(), null));
        }
        itens.sort(Comparator.comparing(Item::quando).reversed().thenComparing(Item::tipo));
        return new Resposta(itens.size() > limite ? List.copyOf(itens.subList(0, limite)) : List.copyOf(itens));
    }

    private static void publicados(List<Item> itens, String titulo, List<FatoDePlano> versoes) {
        for (FatoDePlano v : versoes)
            itens.add(new Item(Tipo.PLANO_PUBLICADO, titulo, v.quando(), v.pastaId() == null ? null : new Destino(TipoDeDestino.PASTA, v.pastaId())));
    }
}
