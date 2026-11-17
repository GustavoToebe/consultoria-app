package br.com.treinos.api.execucao;

import br.com.plataforma.comum.web.BadRequestException;
import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.execucao.dto.ExecucaoDtos.ExercicioDaTroca;
import br.com.treinos.api.execucao.dto.ExecucaoDtos.TrocaDeExercicio;
import br.com.treinos.api.execucao.dto.ExecucaoDtos.TrocasDeExercicio;
import br.com.treinos.api.web.Exigir;
import br.com.treinos.api.web.Fuso;
import br.com.treinos.api.web.NaoEncontradoException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/**
 * Trocas "só hoje" que um aluno fez, para o treinador (plano {@code docs/planos/trocar-exercicio.md} e
 * {@code alertas-de-troca.md}). Não há tabela de troca: ela é lida das séries concluídas, quando o
 * {@code execucao_serie.exercicio_id} é o de uma alternativa e não o do exercício na versão que o aluno executou. Só
 * leitura e só nomes de exercício, nunca carga, repetições nem observação. Janela padrão de 7 dias, no máximo 31.
 */
@Service
public class TrocasDeExercicioService {

    static final int JANELA_PADRAO_DIAS = 7;
    static final int JANELA_MAXIMA_DIAS = 31;

    private final ExecucaoSerieRepository execucoes;
    private final IndicesDeVersao indices;
    private final AlunoRepository alunos;

    public TrocasDeExercicioService(ExecucaoSerieRepository execucoes, IndicesDeVersao indices, AlunoRepository alunos) {
        this.execucoes = execucoes;
        this.indices = indices;
        this.alunos = alunos;
    }

    /** Aluno de outra consultoria = 404. Do mais recente ao mais antigo. */
    @Transactional(readOnly = true)
    public TrocasDeExercicio doAluno(UUID alunoId, LocalDate de, LocalDate ate) {
        Exigir.existe(alunos.findById(alunoId), () -> new NaoEncontradoException("Aluno não encontrado."));
        LocalDate fim = ate == null ? LocalDate.now(Fuso.BRASILIA) : ate;
        LocalDate inicio = de == null ? fim.minusDays(JANELA_PADRAO_DIAS - 1L) : de;
        if (inicio.isAfter(fim)) {
            throw new BadRequestException("A data final vem antes da inicial.", "PERIODO_INVALIDO");
        }
        if (ChronoUnit.DAYS.between(inicio, fim) >= JANELA_MAXIMA_DIAS) {
            throw new BadRequestException("Escolha um período de até " + JANELA_MAXIMA_DIAS + " dias.", "PERIODO_INVALIDO");
        }
        List<ExecucaoSerie> feitas = execucoes
                .findByAlunoIdAndConcluidaTrueAndExercicioIdIsNotNullAndDataBetweenOrderByDataDescIdAsc(alunoId, inicio, fim);
        Map<UUID, IndiceVersao> porVersao = indices.carregar(feitas.stream().map(ExecucaoSerie::getPlanoVersaoId).distinct().toList());
        Map<String, TrocaDeExercicio> trocas = new LinkedHashMap<>();
        for (ExecucaoSerie e : feitas) {
            IndiceVersao indice = porVersao.get(e.getPlanoVersaoId());
            IndiceVersao.LocalSerie local = indice == null ? null : indice.serie(e.getSerieUid()).orElse(null);
            if (local == null || Objects.equals(local.exercicioId(), e.getExercicioId())) {
                continue;
            }
            String chave = e.getData() + "|" + e.getPlanoVersaoId() + "|" + e.getExercicioUid() + "|" + e.getExercicioId();
            TrocaDeExercicio atual = trocas.get(chave);
            trocas.put(chave, new TrocaDeExercicio(e.getData(), e.getPlanoVersaoId(), e.getSessaoUid(),
                    indice.nomeSessao(e.getSessaoUid()), e.getExercicioUid(),
                    new ExercicioDaTroca(local.exercicioId(), indice.nomeExercicio(e.getExercicioUid())),
                    new ExercicioDaTroca(e.getExercicioId(), indice.nomeExercicio(e.getExercicioUid(), e.getExercicioId())),
                    atual == null ? 1 : atual.series() + 1));
        }
        return new TrocasDeExercicio(inicio, fim, List.copyOf(trocas.values()));
    }
}
