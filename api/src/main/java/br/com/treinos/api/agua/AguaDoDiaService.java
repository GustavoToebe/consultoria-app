package br.com.treinos.api.agua;

import br.com.plataforma.comum.web.BadRequestException;
import br.com.treinos.api.agua.AguaDoDiaDtos.AguaRegistrada;
import br.com.treinos.api.agua.AguaDoDiaDtos.RegistroAgua;
import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.execucao.dto.ExecucaoDtos.LoteResponse;
import br.com.treinos.api.execucao.dto.ExecucaoDtos.ResultadoRegistro;
import br.com.treinos.api.execucao.dto.ExecucaoDtos.Situacao;
import br.com.treinos.api.web.Exigir;
import br.com.treinos.api.web.Fuso;
import br.com.treinos.api.web.NaoEncontradoException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/**
 * Recebe o lote de água marcada no aparelho (a mesma fila das séries e da mobilidade) e o grava de forma idempotente. Um
 * registro ruim vira {@code RECUSADO} com motivo, sem derrubar o lote, e só sai na resposta (nada recusado é guardado). A
 * consultoria e o aluno vêm sempre da sessão; do cliente, só o id, o dia e os mililitros.
 *
 * <p>Não há meta aqui: a "Água por dia" é da dieta, e a tela compara. O servidor não calcula nada.</p>
 */
@Service
public class AguaDoDiaService {

    /** Fila offline atrasada: até 60 dias. A tela só oferece hoje e 6 dias para trás. */
    static final int DIAS_PARA_TRAS = 60;
    static final int AGUA_MAXIMA_ML = 20_000;
    private static final int PERIODO_MAXIMO_DIAS = 366;

    private final AguaDoDiaUpsert upsert;
    private final AguaDoDiaRepository registros;
    private final AlunoRepository alunos;

    public AguaDoDiaService(AguaDoDiaUpsert upsert, AguaDoDiaRepository registros, AlunoRepository alunos) {
        this.upsert = upsert;
        this.registros = registros;
        this.alunos = alunos;
    }

    @Transactional
    public LoteResponse receber(UUID consultoriaId, UUID alunoId, List<RegistroAgua> lote) {
        Map<UUID, AguaDoDiaUpsert.Chave> existentes = upsert.existentes(lote.stream()
                .map(RegistroAgua::id).filter(Objects::nonNull).distinct().toList());
        LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
        Instant limiteFuturo = Instant.now().plus(Duration.ofDays(2));
        List<ResultadoRegistro> resultados = new ArrayList<>();
        for (RegistroAgua r : lote) {
            String motivo = motivoParaRecusar(r, alunoId, existentes, hoje, limiteFuturo);
            if (motivo != null) {
                resultados.add(new ResultadoRegistro(r.id(), Situacao.RECUSADO, motivo));
                continue;
            }
            boolean gravou = upsert.gravar(r.id(), consultoriaId, alunoId, r.data(), r.aguaMl(), r.alteradoNoAparelhoEm());
            existentes.putIfAbsent(r.id(), new AguaDoDiaUpsert.Chave(alunoId, r.data()));
            resultados.add(new ResultadoRegistro(r.id(), gravou ? Situacao.ACEITO : Situacao.IGNORADO_ANTIGO, null));
        }
        return new LoteResponse(resultados);
    }

    /** A água do próprio aluno (da sessão) no período. */
    @Transactional(readOnly = true)
    public List<AguaRegistrada> doAlunoDaSessao(UUID alunoId, LocalDate de, LocalDate ate) {
        return montar(alunoId, de, ate);
    }

    /** A água de um aluno, vista pela equipe. Aluno de outra consultoria = 404. */
    @Transactional(readOnly = true)
    public List<AguaRegistrada> doAluno(UUID alunoId, LocalDate de, LocalDate ate) {
        exigirAluno(alunoId);
        return montar(alunoId, de, ate);
    }

    /** Exportação de dados: tudo, sem o limite de período das telas. Quem chama confere as permissões. */
    @Transactional(readOnly = true)
    public List<AguaRegistrada> completoDoAluno(UUID alunoId) {
        exigirAluno(alunoId);
        return carregar(alunoId, LocalDate.of(2000, 1, 1), LocalDate.now(Fuso.BRASILIA).plusDays(1));
    }

    /** Anonimização e "Excluir minha conta": roda dentro da transação de quem chama. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void apagarDoAluno(UUID consultoriaId, UUID alunoId) {
        upsert.apagarDoAluno(consultoriaId, alunoId);
    }

    private List<AguaRegistrada> montar(UUID alunoId, LocalDate de, LocalDate ate) {
        LocalDate fim = ate == null ? LocalDate.now(Fuso.BRASILIA) : ate;
        LocalDate inicio = de == null ? fim.minusDays(6) : de;
        if (inicio.isAfter(fim) || ChronoUnit.DAYS.between(inicio, fim) > PERIODO_MAXIMO_DIAS) {
            throw new BadRequestException("Período inválido (até 1 ano).");
        }
        return carregar(alunoId, inicio, fim);
    }

    private List<AguaRegistrada> carregar(UUID alunoId, LocalDate inicio, LocalDate fim) {
        return registros.findByAlunoIdAndDataBetweenOrderByDataDesc(alunoId, inicio, fim).stream()
                .map(r -> new AguaRegistrada(r.getData(), r.getAguaMl()))
                .toList();
    }

    private void exigirAluno(UUID alunoId) {
        Exigir.existe(alunos.findById(alunoId), () -> new NaoEncontradoException("Aluno não encontrado."));
    }

    private static String motivoParaRecusar(RegistroAgua r, UUID alunoId, Map<UUID, AguaDoDiaUpsert.Chave> existentes,
                                            LocalDate hoje, Instant limiteFuturo) {
        if (r.id() == null || r.data() == null || r.aguaMl() == null || r.alteradoNoAparelhoEm() == null) {
            return "Registro incompleto.";
        }
        if (r.aguaMl() < 0 || r.aguaMl() > AGUA_MAXIMA_ML) {
            return "Quantidade de água fora do aceito (0 a 20 L).";
        }
        if (r.data().isAfter(hoje)) {
            return "Dia que ainda não chegou.";
        }
        if (r.data().isBefore(hoje.minusDays(DIAS_PARA_TRAS))) {
            return "Data fora do período aceito (até 60 dias para trás).";
        }
        if (r.alteradoNoAparelhoEm().isAfter(limiteFuturo)) {
            return "Horário do aparelho inválido.";
        }
        AguaDoDiaUpsert.Chave existente = existentes.get(r.id());
        if (existente != null && !existente.equals(new AguaDoDiaUpsert.Chave(alunoId, r.data()))) {
            return "Identificador já usado por outro registro.";
        }
        return null;
    }
}
