package br.com.treinos.api.inscricoes;

import br.com.plataforma.comum.web.BadRequestException;
import br.com.treinos.api.inscricoes.Crm.MotivoEncerramento;
import br.com.treinos.api.inscricoes.Crm.TipoEvento;
import br.com.treinos.api.inscricoes.InscricaoDtos.DiasAteAceite;
import br.com.treinos.api.inscricoes.InscricaoDtos.Indicadores;
import br.com.treinos.api.inscricoes.InscricaoDtos.PorMotivo;
import br.com.treinos.api.inscricoes.InscricaoDtos.PorOrigem;
import br.com.treinos.api.web.Fuso;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Indicadores de conversão do período (dias de Brasília, até 366), só contagens, em JPQL (sem SQL nativo), da consultoria
 * da sessão. Definições (também no cartão "Como contamos" do app):
 * <ul>
 *   <li>entradas = inscrições criadas no período; pessoas = WhatsApps diferentes entre elas;</li>
 *   <li>aceites = inscrições aceitas no período (de qualquer entrada); aceites das entradas e conversão = das entradas do
 *       período, quantas já viraram aluno (conversão nula sem entradas);</li>
 *   <li>recusadas, desistências e motivos = encerramentos do período (eventos; uma inscrição reaberta e encerrada de novo
 *       conta duas vezes); reaberturas à parte;</li>
 *   <li>dias até o aceite = da entrada ao aceite, dos aceites do período (mediana e média; nulos sem aceite).</li>
 * </ul>
 * Recusadas e desistentes paradas há mais de 180 dias saem pela retenção, e com elas os eventos: períodos antigos ficam
 * com menos encerramentos do que houve.
 */
@Service
public class IndicadoresDeInscricoes {

    static final int DIAS_MAXIMOS = 366;
    /** Teto de aceites lidos para a mediana (o período tem no máximo um ano). */
    static final int ACEITES_PARA_MEDIANA = 5000;

    private final InscricaoRepository inscricoes;
    private final InscricaoEventoRepository eventos;

    public IndicadoresDeInscricoes(InscricaoRepository inscricoes, InscricaoEventoRepository eventos) {
        this.inscricoes = inscricoes;
        this.eventos = eventos;
    }

    @Transactional(readOnly = true)
    public Indicadores calcular(LocalDate de, LocalDate ate) {
        LocalDate fimDia = ate == null ? LocalDate.now(Fuso.BRASILIA) : ate;
        LocalDate inicioDia = de == null ? fimDia.minusDays(29) : de;
        if (inicioDia.isAfter(fimDia) || ChronoUnit.DAYS.between(inicioDia, fimDia) >= DIAS_MAXIMOS) {
            throw new BadRequestException("Escolha um período de até " + DIAS_MAXIMOS + " dias, com o início antes do fim.",
                    "PERIODO_INVALIDO");
        }
        Instant inicio = inicioDia.atStartOfDay(Fuso.BRASILIA).toInstant();
        Instant fim = fimDia.plusDays(1).atStartOfDay(Fuso.BRASILIA).toInstant();

        long entradas = inscricoes.entradas(inicio, fim);
        long pessoas = inscricoes.pessoas(inicio, fim);
        long aceitesDasEntradas = inscricoes.aceitesDasEntradas(inicio, fim);
        long aceites = inscricoes.contarAceites(inicio, fim);

        long recusadas = 0;
        long desistencias = 0;
        Map<MotivoEncerramento, Long> porMotivo = new EnumMap<>(MotivoEncerramento.class);
        long semMotivo = 0;
        for (var linha : eventos.contarNoPeriodo(TipoEvento.ENCERRADA, inicio, fim)) {
            if (SituacaoInscricao.RECUSADA.name().equals(linha.para())) recusadas += linha.quantidade();
            if (SituacaoInscricao.DESISTIU.name().equals(linha.para())) desistencias += linha.quantidade();
            if (linha.motivo() == null) semMotivo += linha.quantidade();
            else porMotivo.merge(MotivoEncerramento.valueOf(linha.motivo()), linha.quantidade(), Long::sum);
        }
        long reaberturas = eventos.contarNoPeriodo(TipoEvento.REABERTA, inicio, fim).stream()
                .mapToLong(InscricaoEventoRepository.PorChave::quantidade).sum();

        List<PorMotivo> motivos = new ArrayList<>();
        porMotivo.forEach((m, q) -> motivos.add(new PorMotivo(m, q)));
        if (semMotivo > 0) motivos.add(new PorMotivo(null, semMotivo));
        motivos.sort(Comparator.comparingLong(PorMotivo::quantidade).reversed());

        Map<Crm.Origem, long[]> porOrigem = new HashMap<>();
        for (var linha : inscricoes.porOrigem(inicio, fim)) {
            porOrigem.merge(linha.origem(), new long[] {linha.entradas(), linha.aceites()},
                    (a, b) -> new long[] {a[0] + b[0], a[1] + b[1]});
        }
        List<PorOrigem> origens = new ArrayList<>();
        porOrigem.forEach((o, v) -> origens.add(new PorOrigem(o, v[0], v[1])));
        origens.sort(Comparator.comparingLong(PorOrigem::entradas).reversed());

        Double conversao = entradas == 0 ? null : (double) aceitesDasEntradas / entradas;
        return new Indicadores(inicioDia, fimDia, entradas, pessoas, aceites, recusadas, desistencias, reaberturas,
                aceitesDasEntradas, conversao, diasAteAceite(inicio, fim), motivos, origens);
    }

    private DiasAteAceite diasAteAceite(Instant inicio, Instant fim) {
        List<Double> dias = inscricoes.aceites(inicio, fim, PageRequest.of(0, ACEITES_PARA_MEDIANA)).stream()
                .map(a -> Duration.between(a.criadaEm(), a.aceitaEm()).toMinutes() / (60.0 * 24))
                .sorted().toList();
        if (dias.isEmpty()) return new DiasAteAceite(null, null);
        int n = dias.size();
        double mediana = n % 2 == 1 ? dias.get(n / 2) : (dias.get(n / 2 - 1) + dias.get(n / 2)) / 2;
        double media = dias.stream().mapToDouble(Double::doubleValue).sum() / n;
        return new DiasAteAceite(arredondar(mediana), arredondar(media));
    }

    private static double arredondar(double valor) {
        return Math.round(valor * 10) / 10.0;
    }
}
