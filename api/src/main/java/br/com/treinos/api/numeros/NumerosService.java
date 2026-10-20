package br.com.treinos.api.numeros;

import br.com.treinos.api.atualizacoes.RegrasAtualizacao;
import br.com.treinos.api.consultoria.ConsultoriaRepository;
import br.com.treinos.api.equipe.AcessoAtual;
import br.com.treinos.api.tenant.TenantContext;
import br.com.treinos.api.web.Fuso;
import br.com.treinos.api.web.NaoEncontradoException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Relatório "Números" da consultoria: seis meses (cinco fechados e o corrente, parcial, "até hoje") só com contagens,
 * sem nome nem id de pessoa. {@code null} é "sem dado" e nunca vira zero; zero só quando a contagem real é zero.
 *
 * <p><b>Lacuna conhecida, a decidir:</b> a linha de {@code atualizacao} só nasce no primeiro envio ou aviso de atraso;
 * uma atualização vencida que ninguém tocou não tem linha e, portanto, não é contada como atrasada aqui (o painel a
 * calcula pela pasta vigente, que só existe para o ciclo atual). Contar só linhas é o que o pedido descreve; contar também
 * pastas sem linha de meses passados seria regra nova.
 *
 * <p><b>Alunos ativos no fim do mês</b> = criados até o fim do mês, sem {@code inativado_em} (ou inativados depois) e sem
 * {@code anonimizado_em} (ou anonimizados depois). <b>Aproximação:</b> não existe histórico de ativação. Reativar
 * ({@code Aluno.alterarSituacao(true, ...)}) zera {@code inativado_em}; por isso um aluno inativado em março e reativado em
 * junho conta como ativo desde {@code criado_em}, inclusive em abril e maio. Um aluno inativado e ainda inativo conta como
 * ativo nos meses anteriores à inativação. Mês que termina antes de a consultoria existir ({@code consultoria.criado_em})
 * é {@code null}. No mês corrente vale também a situação de hoje ({@code ativo}), a mesma do painel.
 *
 * <p><b>Atualizações</b> entram pelo mês do prazo ({@code RegrasAtualizacao.prazo}). Enviada (data de Brasília de
 * {@code enviada_em}) até o prazo = no prazo; depois do prazo = atrasada; não enviada com prazo anterior a hoje = atrasada;
 * aberta com prazo de hoje em diante não entra. Mês sem nenhuma atualização contável = os dois campos {@code null}.
 *
 * <p>Os dois campos de atualização seguem o painel: sem {@code ATUALIZACAO_LER} e {@code ALUNO_SENSIVEL_LER} saem
 * {@code null} (o painel também não mostra esses contadores a quem não tem as duas).
 */
@Service
public class NumerosService {

    public static final int MESES = 6;

    public record MesNumeros(String mes, boolean parcial, Long alunosAtivos, Long atualizacoesNoPrazo,
                             Long atualizacoesAtrasadas) {
    }

    public record Numeros(List<MesNumeros> meses) {
    }

    private final NumerosRepository repositorio;
    private final ConsultoriaRepository consultorias;

    public NumerosService(NumerosRepository repositorio, ConsultoriaRepository consultorias) {
        this.repositorio = repositorio;
        this.consultorias = consultorias;
    }

    @Transactional(readOnly = true)
    public Numeros numeros() {
        var consultoriaId = TenantContext.get();
        if (consultoriaId == null) {
            throw new NaoEncontradoException("Consultoria não encontrada.");
        }
        Instant criadaEm = consultorias.findById(consultoriaId)
                .orElseThrow(() -> new NaoEncontradoException("Consultoria não encontrada.")).getCriadoEm();
        Instant agora = Instant.now();
        LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
        YearMonth corrente = YearMonth.from(hoje);
        YearMonth primeiro = corrente.minusMonths(MESES - 1L);
        boolean veAtualizacoes = AcessoAtual.pode("ATUALIZACAO_LER") && AcessoAtual.pode("ALUNO_SENSIVEL_LER");

        Map<YearMonth, long[]> porMes = veAtualizacoes ? contarAtualizacoes(primeiro, corrente, hoje) : Map.of();

        List<MesNumeros> meses = new ArrayList<>();
        for (YearMonth mes = primeiro; !mes.isAfter(corrente); mes = mes.plusMonths(1)) {
            boolean parcial = mes.equals(corrente);
            Instant limite = parcial ? agora : mes.plusMonths(1).atDay(1).atStartOfDay(Fuso.BRASILIA).toInstant();
            Long ativos = null;
            if (!criadaEm.isAfter(limite)) {
                ativos = parcial ? repositorio.ativosAgora(limite) : repositorio.ativosEm(limite);
            }
            long[] atualizacoes = porMes.get(mes);
            meses.add(new MesNumeros(mes.toString(), parcial, ativos,
                    atualizacoes == null ? null : atualizacoes[0], atualizacoes == null ? null : atualizacoes[1]));
        }
        return new Numeros(List.copyOf(meses));
    }

    /** {@code [noPrazo, atrasadas]} por mês do prazo; mês sem atualização contável não aparece no mapa. */
    private Map<YearMonth, long[]> contarAtualizacoes(YearMonth primeiro, YearMonth corrente, LocalDate hoje) {
        Map<YearMonth, long[]> porMes = new HashMap<>();
        List<LinhaPrazo> linhas = repositorio.prazosNaJanela(primeiro.atDay(1), corrente.atEndOfMonth());
        for (LinhaPrazo linha : linhas) {
            LocalDate prazo = RegrasAtualizacao.prazo(linha.dataAtualizacao(), linha.atrasoAte());
            YearMonth mes = YearMonth.from(prazo);
            if (mes.isBefore(primeiro) || mes.isAfter(corrente)) {
                continue;
            }
            int indice;
            if (linha.enviadaEm() != null) {
                LocalDate enviada = linha.enviadaEm().atZone(Fuso.BRASILIA).toLocalDate();
                indice = enviada.isAfter(prazo) ? 1 : 0;
            } else if (prazo.isBefore(hoje)) {
                indice = 1;
            } else {
                continue;
            }
            porMes.computeIfAbsent(mes, m -> new long[2])[indice]++;
        }
        return porMes;
    }
}
