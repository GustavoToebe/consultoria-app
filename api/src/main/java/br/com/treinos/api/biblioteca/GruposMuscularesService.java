package br.com.treinos.api.biblioteca;

import br.com.plataforma.comum.web.ApiError;
import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.biblioteca.dto.BibliotecaDtos.UnirGruposRequest;
import br.com.treinos.api.biblioteca.dto.BibliotecaDtos.UnirGruposResultado;
import br.com.treinos.api.web.ValidacaoException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Unir grupos musculares parecidos num nome só, nos exercícios da biblioteca da consultoria (ativos e arquivados; o
 * {@code @TenantId} isola); o catálogo público não muda. O plano publicado não guarda o grupo
 * ({@code ConteudoTreino.ExercicioPlano} não tem o campo), então a versão imutável não é tocada. O histórico de treinos
 * ({@code HistoricoService}) lê o grupo ao vivo da biblioteca, inclusive de arquivados: depois de unir, os dias passados
 * também mostram o nome novo (retroativo, de propósito: o objetivo é deduplicar).
 * A comparação é exata, como o filtro de grupo da Biblioteca (sem caixa nem acento ignorados).
 */
@Service
public class GruposMuscularesService {

    private static final String CODIGO = "GRUPOS_INVALIDOS";
    private static final String MENSAGEM = "Confira os grupos musculares.";
    private static final int MAXIMO_DE_GRUPOS = 50;
    /** {@code exercicio.grupo_muscular varchar(60)} (V001). */
    private static final int TAMANHO_DO_GRUPO = 60;

    private final ExercicioRepository exercicios;
    private final Auditoria auditoria;

    public GruposMuscularesService(ExercicioRepository exercicios, Auditoria auditoria) {
        this.exercicios = exercicios;
        this.auditoria = auditoria;
    }

    /** Só leitura: quantos exercícios o {@link #unir} alteraria agora (a mesma consulta). */
    @Transactional(readOnly = true)
    public UnirGruposResultado previa(UnirGruposRequest r) {
        Pedido p = validar(r);
        return new UnirGruposResultado(exercicios.comGrupoParaUnir(p.origem(), p.destino()).size());
    }

    /** Idempotente: sem nada a alterar não grava nem audita. Exercício alterado no meio (lock otimista) = 409. */
    @Transactional
    public UnirGruposResultado unir(UnirGruposRequest r) {
        Pedido p = validar(r);
        List<Exercicio> alterar = exercicios.comGrupoParaUnir(p.origem(), p.destino());
        if (alterar.isEmpty()) {
            return new UnirGruposResultado(0);
        }
        alterar.forEach(e -> e.renomearGrupo(p.destino()));
        try {
            exercicios.flush();
        } catch (ObjectOptimisticLockingFailureException e) {
            throw new ConflictException("A biblioteca mudou. Confira e tente de novo.", "CONFLITO_EDICAO");
        }
        auditoria.registrarEvento("GRUPOS_MUSCULARES_UNIDOS", "EXERCICIO", null, "Grupos musculares unidos");
        return new UnirGruposResultado(alterar.size());
    }

    private record Pedido(Set<String> origem, String destino) {
    }

    /** Mensagens fixas: o nome do grupo nunca volta no erro. */
    static Pedido validar(UnirGruposRequest r) {
        List<ApiError.FieldError> erros = new ArrayList<>();
        Set<String> origem = new LinkedHashSet<>();
        List<String> pedida = r == null ? null : r.origem();
        if (pedida == null || pedida.isEmpty() || pedida.size() > MAXIMO_DE_GRUPOS) {
            erros.add(new ApiError.FieldError("origem", "Escolha de 1 a " + MAXIMO_DE_GRUPOS + " grupos para unir."));
        } else {
            for (int i = 0; i < pedida.size(); i++) {
                String nome = pedida.get(i) == null ? "" : pedida.get(i).strip();
                if (nome.isEmpty()) {
                    erros.add(new ApiError.FieldError("origem[" + i + "]", "Informe o nome do grupo."));
                } else if (nome.length() > TAMANHO_DO_GRUPO) {
                    erros.add(new ApiError.FieldError("origem[" + i + "]", "Use até " + TAMANHO_DO_GRUPO + " caracteres no nome do grupo."));
                } else {
                    origem.add(nome);
                }
            }
        }
        String destino = r == null || r.destino() == null ? "" : r.destino().strip();
        if (destino.isEmpty() || destino.length() > TAMANHO_DO_GRUPO) {
            erros.add(new ApiError.FieldError("destino", "Informe o novo nome do grupo, com até " + TAMANHO_DO_GRUPO + " caracteres."));
        }
        if (!erros.isEmpty()) {
            throw new ValidacaoException(MENSAGEM, CODIGO, erros);
        }
        return new Pedido(origem, destino);
    }
}
