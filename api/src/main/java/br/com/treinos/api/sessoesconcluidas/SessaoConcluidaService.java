package br.com.treinos.api.sessoesconcluidas;

import br.com.plataforma.comum.web.BadRequestException;
import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.equipe.AcessoAtual;
import br.com.treinos.api.execucao.IndiceVersao;
import br.com.treinos.api.execucao.IndicesDeVersao;
import br.com.treinos.api.execucao.dto.ExecucaoDtos.LoteResponse;
import br.com.treinos.api.execucao.dto.ExecucaoDtos.ResultadoRegistro;
import br.com.treinos.api.execucao.dto.ExecucaoDtos.Situacao;
import br.com.treinos.api.sessoesconcluidas.SessaoConcluidaDtos.RegistroSessaoConcluida;
import br.com.treinos.api.sessoesconcluidas.SessaoConcluidaDtos.SessaoConcluidaLinha;
import br.com.treinos.api.sessoesconcluidas.SessaoConcluidaDtos.SessoesConcluidasResponse;
import br.com.treinos.api.web.Exigir;
import br.com.treinos.api.web.Fuso;
import br.com.treinos.api.web.NaoEncontradoException;
import org.springframework.stereotype.Service;
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
 * Recebe o lote de sessões concluídas no aparelho (a mesma fila das séries e da mobilidade). Cada registro é conferido
 * contra a versão publicada de TREINO que o aluno via e gravado de forma idempotente. Um registro ruim vira
 * {@code RECUSADO} com motivo, sem derrubar o lote. A consultoria e o aluno vêm sempre da sessão; do cliente, só os uids,
 * o dia e o que o aluno disse da sessão.
 *
 * <p>Só a sessão que não existe na versão fica gravada como {@code RECUSADO} (sem resultado, duração nem comentário): a
 * versão é imutável, então é permanente e a chave não colide com um registro aceito. As demais recusas só saem na
 * resposta, para nunca sobrescrever um registro aceito. Leituras devolvem apenas o que foi aceito.</p>
 *
 * <p>O comentário é dado sensível: nunca em log, auditoria nem mensagem de erro. Os motivos são textos fixos e não citam
 * o comentário nem a duração.</p>
 */
@Service
public class SessaoConcluidaService {

    static final int DIAS_PARA_TRAS = 60;
    static final long DURACAO_MINIMA_SEGUNDOS = 60;
    static final long DURACAO_MAXIMA_SEGUNDOS = 21_600;
    static final int COMENTARIO_MAXIMO = 300;
    private static final int PERIODO_PADRAO_DIAS = 13;
    private static final int PERIODO_MAXIMO_DIAS = 366;
    private static final String ACEITO = "ACEITO";
    private static final String RECUSADO = "RECUSADO";
    private static final String COMPLETA = "COMPLETA";
    private static final String PARCIAL = "PARCIAL";
    private static final String SESSAO_FORA_DA_VERSAO = "Sessão não existe nesta versão do treino.";

    private final SessaoConcluidaUpsert upsert;
    private final SessaoConcluidaRepository registros;
    private final IndicesDeVersao indicesDeVersao;
    private final AlunoRepository alunos;
    private final SessaoConcluidaVistoRepository vistos;

    public SessaoConcluidaService(SessaoConcluidaUpsert upsert, SessaoConcluidaRepository registros,
                                  IndicesDeVersao indicesDeVersao, AlunoRepository alunos, SessaoConcluidaVistoRepository vistos) {
        this.vistos = vistos;
        this.upsert = upsert;
        this.registros = registros;
        this.indicesDeVersao = indicesDeVersao;
        this.alunos = alunos;
    }

    @Transactional
    public LoteResponse receber(UUID consultoriaId, UUID alunoId, List<RegistroSessaoConcluida> lote) {
        Map<UUID, IndiceVersao> indices = indicesDeVersao.carregar(lote.stream()
                .map(RegistroSessaoConcluida::planoVersaoId).filter(Objects::nonNull).distinct().toList());
        Map<UUID, SessaoConcluidaUpsert.Chave> existentes = upsert.existentes(lote.stream()
                .map(RegistroSessaoConcluida::id).filter(Objects::nonNull).distinct().toList());
        LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
        Instant limiteFuturo = Instant.now().plus(Duration.ofDays(2));
        List<ResultadoRegistro> resultados = new ArrayList<>();
        for (RegistroSessaoConcluida r : lote) {
            String motivo = motivoParaRecusar(r, alunoId, indices, existentes, hoje, limiteFuturo);
            if (motivo != null) {
                // Só a sessão inexistente na versão é guardada; é a única cuja chave nunca colide com um registro aceito.
                if (motivo.equals(SESSAO_FORA_DA_VERSAO)
                        && motivoDosCamposDataEId(r, alunoId, existentes, hoje, limiteFuturo) == null) {
                    upsert.gravar(new SessaoConcluidaUpsert.Linha(r.id(), consultoriaId, alunoId, r.planoVersaoId(),
                            r.sessaoUid(), r.data(), false, null, null, null, RECUSADO, motivo, r.alteradoNoAparelhoEm()));
                    existentes.putIfAbsent(r.id(), chaveDe(alunoId, r));
                }
                resultados.add(new ResultadoRegistro(r.id(), Situacao.RECUSADO, motivo));
                continue;
            }
            boolean gravou = upsert.gravar(new SessaoConcluidaUpsert.Linha(r.id(), consultoriaId, alunoId,
                    r.planoVersaoId(), r.sessaoUid(), r.data(), r.concluida(), r.resultado(),
                    r.duracaoSegundos() == null ? null : r.duracaoSegundos().intValue(), comentarioNormalizado(r),
                    ACEITO, null, r.alteradoNoAparelhoEm()));
            existentes.putIfAbsent(r.id(), chaveDe(alunoId, r));
            resultados.add(new ResultadoRegistro(r.id(), gravou ? Situacao.ACEITO : Situacao.IGNORADO_ANTIGO, null));
        }
        return new LoteResponse(resultados);
    }

    /** Sessões aceitas do próprio aluno (da sessão do app) no período, com o comentário dele. */
    @Transactional(readOnly = true)
    public SessoesConcluidasResponse doAlunoDaSessao(UUID alunoId, LocalDate de, LocalDate ate) {
        return montar(alunoId, de, ate, true);
    }

    /**
     * Sessões aceitas de um aluno, vistas pelo treinador. Aluno de outra consultoria = 404. O comentário sai nulo sem
     * {@code ALUNO_SENSIVEL_LER}.
     */
    @Transactional(readOnly = true)
    public SessoesConcluidasResponse doAluno(UUID alunoId, LocalDate de, LocalDate ate) {
        exigirAluno(alunoId);
        return montar(alunoId, de, ate, AcessoAtual.pode("ALUNO_SENSIVEL_LER"));
    }

    /**
     * Exportação de dados: todos os registros aceitos, sem o limite de período das telas. Quem chama confere
     * {@code REGISTRO_LER}; o comentário só sai com {@code ALUNO_SENSIVEL_LER}.
     */
    @Transactional(readOnly = true)
    public List<SessaoConcluidaLinha> completoDoAluno(UUID alunoId) {
        exigirAluno(alunoId);
        return carregar(alunoId, LocalDate.of(2000, 1, 1), LocalDate.now(Fuso.BRASILIA).plusDays(366),
                AcessoAtual.pode("ALUNO_SENSIVEL_LER"));
    }

    private SessoesConcluidasResponse montar(UUID alunoId, LocalDate de, LocalDate ate, boolean comComentario) {
        LocalDate fim = ate == null ? LocalDate.now(Fuso.BRASILIA) : ate;
        LocalDate inicio = de == null ? fim.minusDays(PERIODO_PADRAO_DIAS) : de;
        if (inicio.isAfter(fim) || ChronoUnit.DAYS.between(inicio, fim) > PERIODO_MAXIMO_DIAS) {
            throw new BadRequestException("Período inválido (até 1 ano).");
        }
        return new SessoesConcluidasResponse(registros.countByAlunoIdAndSituacaoAndConcluidaTrue(alunoId, ACEITO),
                carregar(alunoId, inicio, fim, comComentario));
    }

    private List<SessaoConcluidaLinha> carregar(UUID alunoId, LocalDate inicio, LocalDate fim, boolean comComentario) {
        List<SessaoConcluida> lista = registros.findByAlunoIdAndSituacaoAndDataBetweenOrderByDataDescIdAsc(alunoId, ACEITO, inicio, fim);
        Map<UUID, IndiceVersao> indices = indicesDeVersao.carregar(lista.stream().map(SessaoConcluida::getPlanoVersaoId).distinct().toList());
        Map<UUID, Instant> vistoEm = new java.util.HashMap<>();
        if (!lista.isEmpty()) {
            vistos.findBySessaoConcluidaIdIn(lista.stream().map(SessaoConcluida::getId).toList())
                    .forEach(v -> vistoEm.put(v.getSessaoConcluidaId(), v.getVistoEm()));
        }
        return lista.stream()
                .map(r -> new SessaoConcluidaLinha(r.getId(), r.getPlanoVersaoId(), r.getSessaoUid(),
                        indices.containsKey(r.getPlanoVersaoId()) ? indices.get(r.getPlanoVersaoId()).nomeSessao(r.getSessaoUid()) : null,
                        r.getData(), r.isConcluida(), r.getResultado(), r.getDuracaoSegundos(),
                        comComentario ? r.getComentario() : null, vistoEm.get(r.getId())))
                .toList();
    }

    /**
     * Marca o "Visto" do treinador (Engajamento 0.5, P4). Idempotente: marcar de novo devolve o que já estava. Sessão de
     * outro aluno ou consultoria = 404; reaberta = 409 {@code TREINO_NAO_CONCLUIDO}. A sessão fica travada até o fim,
     * então duas marcações ao mesmo tempo não duplicam.
     */
    @Transactional
    public SessaoConcluidaDtos.Visto marcarVisto(UUID alunoId, UUID sessaoConcluidaId, UUID usuarioId) {
        SessaoConcluida s = sessaoDoAluno(alunoId, sessaoConcluidaId, true);
        if (!s.isConcluida()) {
            throw new ConflictException("Este treino foi reaberto pelo aluno.", "TREINO_NAO_CONCLUIDO");
        }
        SessaoConcluidaVisto visto = vistos.findById(s.getId())
                .orElseGet(() -> vistos.save(new SessaoConcluidaVisto(s.getId(), alunoId, usuarioId, Instant.now())));
        return new SessaoConcluidaDtos.Visto(visto.getVistoEm());
    }

    /** Desfaz o "Visto" (toque errado). Sem marca, nada muda; sessão de outro aluno ou consultoria = 404. */
    @Transactional
    public void desmarcarVisto(UUID alunoId, UUID sessaoConcluidaId) {
        SessaoConcluida s = sessaoDoAluno(alunoId, sessaoConcluidaId, true);
        vistos.findById(s.getId()).ifPresent(vistos::delete);
    }

    private SessaoConcluida sessaoDoAluno(UUID alunoId, UUID sessaoConcluidaId, boolean travar) {
        exigirAluno(alunoId);
        return (travar ? registros.travar(sessaoConcluidaId) : registros.findById(sessaoConcluidaId))
                .filter(s -> s.getAlunoId().equals(alunoId) && ACEITO.equals(s.getSituacao()))
                .orElseThrow(() -> new NaoEncontradoException("Treino concluído não encontrado."));
    }

    private void exigirAluno(UUID alunoId) {
        Exigir.existe(alunos.findById(alunoId), () -> new NaoEncontradoException("Aluno não encontrado."));
    }

    private static SessaoConcluidaUpsert.Chave chaveDe(UUID alunoId, RegistroSessaoConcluida r) {
        return new SessaoConcluidaUpsert.Chave(alunoId, r.planoVersaoId(), r.sessaoUid(), r.data());
    }

    /** Comentário depois do strip; em branco vira nulo. Só chamar com o registro já validado. */
    private static String comentarioNormalizado(RegistroSessaoConcluida r) {
        if (r.comentario() == null) {
            return null;
        }
        String limpo = r.comentario().strip();
        return limpo.isEmpty() ? null : limpo;
    }

    private static String motivoParaRecusar(RegistroSessaoConcluida r, UUID alunoId, Map<UUID, IndiceVersao> indices,
                                            Map<UUID, SessaoConcluidaUpsert.Chave> existentes, LocalDate hoje,
                                            Instant limiteFuturo) {
        if (r.id() == null || r.planoVersaoId() == null || r.sessaoUid() == null || r.data() == null
                || r.concluida() == null || r.alteradoNoAparelhoEm() == null) {
            return "Registro incompleto.";
        }
        IndiceVersao versao = indices.get(r.planoVersaoId());
        if (versao == null || !alunoId.equals(versao.alunoId())) {
            return "Treino não encontrado para este aluno.";
        }
        if (!versao.temSessao(r.sessaoUid())) {
            return SESSAO_FORA_DA_VERSAO;
        }
        return motivoDosCamposDataEId(r, alunoId, existentes, hoje, limiteFuturo);
    }

    /** Tudo o que não depende da versão: resultado, duração, comentário, data, horário e id. Os motivos são textos fixos. */
    private static String motivoDosCamposDataEId(RegistroSessaoConcluida r, UUID alunoId,
                                                 Map<UUID, SessaoConcluidaUpsert.Chave> existentes, LocalDate hoje,
                                                 Instant limiteFuturo) {
        String incoerente = motivoDeResultadoEDuracao(r);
        if (incoerente != null) {
            return incoerente;
        }
        if (r.comentario() != null) {
            // O Postgres não guarda o caractere nulo em texto: sem esta recusa o insert falharia e derrubaria o lote inteiro.
            if (r.comentario().indexOf('\u0000') >= 0) {
                return "Comentário com caractere inválido.";
            }
            String limpo = r.comentario().strip();
            if (limpo.codePointCount(0, limpo.length()) > COMENTARIO_MAXIMO) {
                return "Comentário longo demais (até " + COMENTARIO_MAXIMO + " caracteres).";
            }
        }
        if (r.data().isAfter(hoje)) {
            return "Data no futuro.";
        }
        if (r.data().isBefore(hoje.minusDays(DIAS_PARA_TRAS))) {
            return "Data fora do período aceito (até " + DIAS_PARA_TRAS + " dias para trás).";
        }
        if (r.alteradoNoAparelhoEm().isAfter(limiteFuturo)) {
            return "Horário do aparelho inválido.";
        }
        SessaoConcluidaUpsert.Chave existente = existentes.get(r.id());
        if (existente != null && !existente.equals(chaveDe(alunoId, r))) {
            return "Identificador já usado por outro registro.";
        }
        return null;
    }

    /**
     * Única combinação válida: concluída com resultado {@code COMPLETA} ou {@code PARCIAL} (duração opcional, 60 a 21.600
     * s); reaberta sem resultado e sem duração.
     */
    private static String motivoDeResultadoEDuracao(RegistroSessaoConcluida r) {
        if (r.concluida()) {
            if (!COMPLETA.equals(r.resultado()) && !PARCIAL.equals(r.resultado())) {
                return "Resultado da sessão inválido.";
            }
            Long duracao = r.duracaoSegundos();
            if (duracao != null && (duracao < DURACAO_MINIMA_SEGUNDOS || duracao > DURACAO_MAXIMA_SEGUNDOS)) {
                return "Duração da sessão fora do intervalo aceito.";
            }
            return null;
        }
        if (r.resultado() != null || r.duracaoSegundos() != null) {
            return "Sessão não concluída não leva resultado nem duração.";
        }
        return null;
    }
}
