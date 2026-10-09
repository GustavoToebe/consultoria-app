package br.com.treinos.api.atualizacoes;

import br.com.treinos.api.execucao.ExecucaoSerie;
import br.com.treinos.api.execucao.ExecucaoSerieRepository;
import br.com.treinos.api.execucao.RegistroPesoRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

/** Só descreve os registros da própria consultoria e do aluno; não interpreta os números. */
@Service
public class ResumoPeriodoService {
    public record Resumo(long diasComTreino, Double mediaDiasPorSemana, BigDecimal pesoAnterior) { }
    private final ExecucaoSerieRepository execucoes;
    private final RegistroPesoRepository pesos;
    public ResumoPeriodoService(ExecucaoSerieRepository execucoes, RegistroPesoRepository pesos) {
        this.execucoes = execucoes;
        this.pesos = pesos;
    }
    @Transactional(readOnly = true)
    public Resumo calcular(UUID alunoId, LocalDate inicio, LocalDate fim) {
        long dias = inicio == null || fim == null ? 0 : execucoes.findByAlunoIdAndDataBetweenOrderByDataDesc(alunoId, inicio, fim)
                .stream().filter(ExecucaoSerie::isConcluida).map(ExecucaoSerie::getData).distinct().count();
        Double media = inicio == null || fim == null || fim.isBefore(inicio) ? null
                : dias * 7.0 / (ChronoUnit.DAYS.between(inicio, fim) + 1);
        BigDecimal peso = pesos.findByAlunoIdOrderByDataAsc(alunoId).stream()
                .filter(p -> fim != null && p.getData().isBefore(fim))
                .reduce((anterior, atual) -> atual).map(p -> p.getPesoKg()).orElse(null);
        return new Resumo(dias, media, peso);
    }
}
