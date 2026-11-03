package br.com.treinos.api.numeros;

import br.com.treinos.api.atualizacoes.RegrasAtualizacao;
import br.com.treinos.api.auth.Papel;
import br.com.treinos.api.auth.Usuario;
import br.com.treinos.api.auth.UsuarioRepository;
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
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Relatório "Números" da consultoria: seis meses (cinco fechados e o corrente, parcial, "até hoje") só com contagens,
 * sem nome nem id de pessoa. {@code null} é "sem dado" e nunca vira zero; zero só quando a contagem real é zero.
 *
 * <p><b>Alunos ativos no fim do mês</b> = criados até o fim do mês, sem {@code inativado_em} (ou inativados depois) e sem
 * {@code anonimizado_em} (ou anonimizados depois). <b>Aproximação:</b> não existe histórico de ativação. Reativar
 * ({@code Aluno.alterarSituacao(true, ...)}) zera {@code inativado_em}; por isso um aluno inativado em março e reativado em
 * junho conta como ativo desde {@code criado_em}, inclusive em abril e maio. Um aluno inativado e ainda inativo conta como
 * ativo nos meses anteriores à inativação. Mês que termina antes de a consultoria existir ({@code consultoria.criado_em})
 * é {@code null}. No mês corrente vale também a situação de hoje ({@code ativo}), a mesma do painel, e o limite é o fim do
 * mês (não o instante da chamada).
 *
 * <p><b>Atualizações</b> entram pelo mês do prazo ({@code RegrasAtualizacao.prazo}). Enviada (data de Brasília de
 * {@code enviada_em}) até o prazo = no prazo; depois do prazo = atrasada; não enviada com prazo anterior a hoje = atrasada;
 * aberta com prazo de hoje em diante não entra. Mês sem nenhuma atualização contável = os dois campos {@code null}.
 * Cada pasta tem no máximo uma atualização e conta uma vez.
 *
 * <p><b>Pasta vigente no prazo.</b> Atrasada sem envio só conta a pasta que era a <i>vigente do aluno na data do prazo</i>,
 * como o painel, que só olha a vigente. Renovar antes do fim não deve inflar "atrasadas": a pasta substituída não conta. Vigente
 * na data D = entre as pastas do aluno não arquivadas, com {@code inicio} e {@code fim} e com treino ou dieta publicado e não
 * arquivado, a de maior {@code inicio} menor ou igual a D; empate de {@code inicio}, a de {@code criado_em} mais recente
 * ({@link VigenciaNaData}). Pasta que começa depois de D não tira a anterior. D é sempre o {@code fim} da pasta (o prazo
 * original), mesmo quando o aluno avisou atraso: o {@code atrasoAte} adia o prazo, mas a pasta seguinte (que começa no dia
 * seguinte ao fim) não pode tirar a vigência da anterior só por isso.
 *
 * <p><b>Pasta vencida sem linha</b> (ninguém enviou nem avisou atraso) também é atrasada, como no painel: o prazo é o
 * {@code fim} da pasta, vale o mesmo "prazo antes de hoje e sem envio" e a pasta tem de ser a vigente nesse prazo. Entram as
 * pastas que o painel trata como "tem atualização" (não arquivada, com {@code fim}, de aluno ativo, com plano publicado).
 * "Aluno ativo" vira o mesmo critério dos alunos ativos aplicado à data do prazo: criado até o fim do dia do prazo, sem
 * inativação nem anonimização até lá (a situação de hoje não entra, para o número de um mês não mudar quando ele fecha).
 * Plano de mobilidade não conta (o painel também ignora). Pasta com linha enviada segue só a linha, como antes; pasta com
 * linha não enviada (aviso de atraso) segue a linha e também tem de ser a vigente no prazo, então a que foi arquivada ou
 * não tem plano publicado deixa de contar.
 *
 * <p><b>Continua aproximado:</b> não existe histórico de "plano ativo". A vigência no passado é deduzida só das datas
 * ({@code inicio}, {@code criado_em}) e de "tem plano publicado e não arquivado hoje"; a data de publicação não é comparada ao
 * prazo e pasta sem {@code inicio} nunca é vigente. Alunos ativos no prazo e reativação seguem como descrito acima.
 *
 * <p>Os dois campos de atualização seguem o painel: sem {@code ATUALIZACAO_LER} e {@code ALUNO_SENSIVEL_LER} saem
 * {@code null} (o painel também não mostra esses contadores a quem não tem as duas).
 *
 * <p><b>Equipe (supervisão, D1 e D16).</b> Uma linha por membro <i>ativo</i> da equipe (o desativado some), com os alunos ativos que
 * ele tem como responsável (a mesma contagem do limite de alunos, D6), o limite dele (nulo = sem limite) e duas contagens de
 * atualização de alunos ativos de hoje: <i>atrasadas</i> = ainda não enviadas, com o prazo vencido, da pasta vigente no prazo, dentro
 * dos seis meses da janela (a mesma regra do "atrasada" dos meses, sem as já enviadas fora do prazo); <i>para revisar</i> = enviadas
 * e ainda não revisadas, de qualquer data. Mais a linha "Sem responsável": alunos sem responsável ou cujo responsável não é mais
 * membro ativo (ninguém está supervisionando). Nenhum nome nem id de aluno sai; os dois campos de atualização seguem a mesma
 * permissão do resto ({@code null} sem as duas). <b>A tabela inteira ({@code equipe} e {@code semResponsavel}) só sai com
 * {@code EQUIPE_LER}</b> (D17): sem ela os dois campos são {@code null}, não listas vazias, e o resto de Números segue com {@code PAINEL_VER}.
 */
@Service
public class NumerosService {

    public static final int MESES = 6;

    public record MesNumeros(String mes, boolean parcial, Long alunosAtivos, Long atualizacoesNoPrazo,
                             Long atualizacoesAtrasadas) {
    }

    /** Uma linha da tabela da equipe: o membro, os alunos ativos dele e o limite ao lado (D16). */
    public record LinhaDaEquipe(UUID usuarioId, String nome, long alunosAtivos, Integer limiteDeAlunos,
                                Long atualizacoesAtrasadas, Long atualizacoesParaRevisar) {
    }

    /** A linha "Sem responsável" da tabela da equipe. */
    public record SemResponsavel(long alunosAtivos, Long atualizacoesAtrasadas, Long atualizacoesParaRevisar) {
    }

    public record Numeros(List<MesNumeros> meses, List<LinhaDaEquipe> equipe, SemResponsavel semResponsavel) {
    }

    private final NumerosRepository repositorio;
    private final ConsultoriaRepository consultorias;
    private final UsuarioRepository usuarios;

    public NumerosService(NumerosRepository repositorio, ConsultoriaRepository consultorias, UsuarioRepository usuarios) {
        this.repositorio = repositorio;
        this.consultorias = consultorias;
        this.usuarios = usuarios;
    }

    @Transactional(readOnly = true)
    public Numeros numeros() {
        var consultoriaId = TenantContext.get();
        if (consultoriaId == null) {
            throw new NaoEncontradoException("Consultoria não encontrada.");
        }
        Instant criadaEm = consultorias.findById(consultoriaId)
                .orElseThrow(() -> new NaoEncontradoException("Consultoria não encontrada.")).getCriadoEm();
        LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
        YearMonth corrente = YearMonth.from(hoje);
        YearMonth primeiro = corrente.minusMonths(MESES - 1L);
        boolean veAtualizacoes = AcessoAtual.pode("ATUALIZACAO_LER") && AcessoAtual.pode("ALUNO_SENSIVEL_LER");

        Map<UUID, Long> atrasadasPorAluno = new HashMap<>();
        Map<YearMonth, long[]> porMes = veAtualizacoes ? contarAtualizacoes(primeiro, corrente, hoje, atrasadasPorAluno) : Map.of();

        List<MesNumeros> meses = new ArrayList<>();
        for (YearMonth mes = primeiro; !mes.isAfter(corrente); mes = mes.plusMonths(1)) {
            boolean parcial = mes.equals(corrente);
            // O mês corrente também vai até o fim do mês, nunca até o "agora" da JVM: criado_em vem do relógio do banco, e
            // comparar os dois relógios derrubaria da contagem quem acabou de ser criado se o do banco estiver adiantado.
            Instant limite = mes.plusMonths(1).atDay(1).atStartOfDay(Fuso.BRASILIA).toInstant();
            Long ativos = null;
            if (!criadaEm.isAfter(limite)) {
                ativos = parcial ? repositorio.ativosAgora(limite) : repositorio.ativosEm(limite);
            }
            long[] atualizacoes = porMes.get(mes);
            meses.add(new MesNumeros(mes.toString(), parcial, ativos,
                    atualizacoes == null ? null : atualizacoes[0], atualizacoes == null ? null : atualizacoes[1]));
        }
        // Supervisão da equipe é do dono (Gustavo, 03/11): sem EQUIPE_LER os dois campos saem nulos, não listas vazias.
        EquipeDosNumeros equipe = AcessoAtual.pode("EQUIPE_LER")
                ? equipe(consultoriaId, veAtualizacoes ? atrasadasPorAluno : null) : new EquipeDosNumeros(null, null);
        return new Numeros(List.copyOf(meses), equipe.linhas(), equipe.semResponsavel());
    }

    private record EquipeDosNumeros(List<LinhaDaEquipe> linhas, SemResponsavel semResponsavel) {
    }

    /** A tabela da equipe (D16). {@code atrasadasPorAluno} nulo = sem permissão para as contagens de atualização. */
    private EquipeDosNumeros equipe(UUID consultoriaId, Map<UUID, Long> atrasadasPorAluno) {
        List<Usuario> membros = usuarios.findByConsultoriaIdAndPapelOrderByNomeAsc(consultoriaId, Papel.TREINADOR).stream()
                .filter(Usuario::isAtivo).toList();
        Set<UUID> idsDosMembros = new HashSet<>();
        membros.forEach(m -> idsDosMembros.add(m.getId()));

        // Quem responde por cada aluno ativo; responsável que não é mais membro ativo conta como "sem responsável".
        Map<UUID, UUID> donos = new HashMap<>();
        Map<UUID, long[]> porDono = new HashMap<>(); // [alunosAtivos, atrasadas, paraRevisar]; chave nula = sem responsável
        for (ResponsavelDoAluno a : repositorio.responsaveisDosAlunosAtivos()) {
            UUID dono = idsDosMembros.contains(a.responsavelId()) ? a.responsavelId() : null;
            donos.put(a.alunoId(), dono);
            porDono.computeIfAbsent(dono, d -> new long[3])[0]++;
        }
        if (atrasadasPorAluno != null) {
            atrasadasPorAluno.forEach((aluno, n) -> {
                if (donos.containsKey(aluno)) {
                    porDono.get(donos.get(aluno))[1] += n;
                }
            });
            for (UUID aluno : repositorio.alunosComAtualizacaoParaRevisar()) {
                if (donos.containsKey(aluno)) {
                    porDono.get(donos.get(aluno))[2]++;
                }
            }
        }
        boolean com = atrasadasPorAluno != null;
        List<LinhaDaEquipe> linhas = new ArrayList<>();
        for (Usuario m : membros) {
            long[] c = porDono.getOrDefault(m.getId(), new long[3]);
            linhas.add(new LinhaDaEquipe(m.getId(), m.getNome(), c[0], m.getLimiteDeAlunos(),
                    com ? c[1] : null, com ? c[2] : null));
        }
        long[] sem = porDono.getOrDefault(null, new long[3]);
        return new EquipeDosNumeros(List.copyOf(linhas), new SemResponsavel(sem[0], com ? sem[1] : null, com ? sem[2] : null));
    }

    /** {@code [noPrazo, atrasadas]} por mês do prazo; mês sem atualização contável não aparece no mapa. */
    private Map<YearMonth, long[]> contarAtualizacoes(YearMonth primeiro, YearMonth corrente, LocalDate hoje,
                                                      Map<UUID, Long> atrasadasPorAluno) {
        Map<YearMonth, long[]> porMes = new HashMap<>();
        VigenciaNaData vigencia = new VigenciaNaData(repositorio.pastasCandidatasAVigente(corrente.atEndOfMonth()));
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
            } else if (prazo.isBefore(hoje)
                    && eVigenteNoPrazo(vigencia, linha.alunoId(), linha.pastaId(),
                            linha.pastaFim() != null ? linha.pastaFim() : linha.dataAtualizacao())) {
                indice = 1;
                atrasadasPorAluno.merge(linha.alunoId(), 1L, Long::sum); // ainda sem envio: é o que a tabela da equipe mostra
            } else {
                continue;
            }
            porMes.computeIfAbsent(mes, m -> new long[2])[indice]++;
        }
        for (PastaSemLinha pasta : repositorio.pastasSemLinhaNaJanela(primeiro.atDay(1), corrente.atEndOfMonth())) {
            LocalDate prazo = pasta.fim();
            if (!prazo.isBefore(hoje) || !alunoAtivoNoPrazo(pasta, prazo)
                    || !eVigenteNoPrazo(vigencia, pasta.alunoId(), pasta.pastaId(), prazo)) {
                continue;
            }
            porMes.computeIfAbsent(YearMonth.from(prazo), m -> new long[2])[1]++;
            atrasadasPorAluno.merge(pasta.alunoId(), 1L, Long::sum);
        }
        return porMes;
    }

    /** A pasta era a vigente do aluno em {@code data}? Ver {@link VigenciaNaData}. */
    private static boolean eVigenteNoPrazo(VigenciaNaData vigencia, UUID alunoId, UUID pastaId, LocalDate data) {
        return vigencia.vigente(alunoId, data).filter(pastaId::equals).isPresent();
    }

    /** Mesma regra dos alunos ativos, na data do prazo (fim do dia de Brasília). */
    private static boolean alunoAtivoNoPrazo(PastaSemLinha pasta, LocalDate prazo) {
        Instant limite = prazo.plusDays(1).atStartOfDay(Fuso.BRASILIA).toInstant();
        return pasta.alunoCriadoEm().isBefore(limite)
                && (pasta.alunoInativadoEm() == null || !pasta.alunoInativadoEm().isBefore(limite))
                && (pasta.alunoAnonimizadoEm() == null || !pasta.alunoAnonimizadoEm().isBefore(limite));
    }
}
