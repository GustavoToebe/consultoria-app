package br.com.treinos.api.mobilidade;

import br.com.plataforma.comum.web.BadRequestException;
import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.execucao.dto.ExecucaoDtos.LoteResponse;
import br.com.treinos.api.execucao.dto.ExecucaoDtos.ResultadoRegistro;
import br.com.treinos.api.execucao.dto.ExecucaoDtos.Situacao;
import br.com.treinos.api.mobilidade.MobilidadeRegistroDtos.RegistroMobilidade;
import br.com.treinos.api.mobilidade.MobilidadeRegistroDtos.RegistroMobilidadeFeito;
import br.com.treinos.api.receitas.ConteudoMobilidade;
import br.com.treinos.api.web.Exigir;
import br.com.treinos.api.web.Fuso;
import br.com.treinos.api.web.NaoEncontradoException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/**
 * Recebe o lote de itens de mobilidade marcados no aparelho (a mesma fila das séries do treino). Cada registro é conferido
 * contra a versão publicada que o aluno via e gravado de forma idempotente. Um registro ruim vira {@code RECUSADO} com
 * motivo, sem derrubar o lote. A consultoria e o aluno vêm sempre da sessão; do cliente, só os uids e se está feito.
 *
 * <p>Só o item que não existe na versão fica gravado como {@code RECUSADO}: a versão é imutável, então é permanente e a
 * chave não colide com um registro aceito. As demais recusas (data, id repetido, versão alheia) só saem na resposta, para
 * nunca sobrescrever um registro aceito. Leituras devolvem apenas o que foi aceito.</p>
 */
@Service
public class MobilidadeRegistroService {

    private static final int DIAS_PARA_TRAS = 60;
    private static final int PERIODO_MAXIMO_DIAS = 366;
    private static final String ACEITO = "ACEITO";
    private static final String RECUSADO = "RECUSADO";
    private static final String ITEM_FORA_DA_VERSAO = "Item não existe nesta versão da mobilidade.";

    private final MobilidadeRegistroUpsert upsert;
    private final MobilidadeRegistroRepository registros;
    private final PlanoMobilidadeVersaoRepository versoes;
    private final PlanoMobilidadeRepository planos;
    private final AlunoRepository alunos;
    private final JsonMapper json;

    public MobilidadeRegistroService(MobilidadeRegistroUpsert upsert, MobilidadeRegistroRepository registros,
                                     PlanoMobilidadeVersaoRepository versoes, PlanoMobilidadeRepository planos,
                                     AlunoRepository alunos, JsonMapper json) {
        this.upsert = upsert;
        this.registros = registros;
        this.versoes = versoes;
        this.planos = planos;
        this.alunos = alunos;
        this.json = json;
    }

    /** Versão publicada de mobilidade: de quem é e a seção de cada item. */
    private record IndiceVersao(UUID alunoId, Map<UUID, UUID> secaoDoItem) {
    }

    @Transactional
    public LoteResponse receber(UUID consultoriaId, UUID alunoId, List<RegistroMobilidade> lote) {
        Map<UUID, IndiceVersao> indices = carregarIndices(lote.stream()
                .map(RegistroMobilidade::planoVersaoId).filter(Objects::nonNull).distinct().toList());
        Map<UUID, MobilidadeRegistroUpsert.Chave> existentes = upsert.existentes(lote.stream()
                .map(RegistroMobilidade::id).filter(Objects::nonNull).distinct().toList());
        LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
        Instant limiteFuturo = Instant.now().plus(Duration.ofDays(2));
        List<ResultadoRegistro> resultados = new ArrayList<>();
        for (RegistroMobilidade r : lote) {
            String motivo = motivoParaRecusar(r, alunoId, indices, existentes, hoje, limiteFuturo);
            if (motivo != null) {
                // Só o item inexistente na versão é guardado; é o único cuja chave nunca colide com um registro aceito.
                if (motivo.equals(ITEM_FORA_DA_VERSAO) && podeGuardarRecusado(r, alunoId, existentes, hoje, limiteFuturo)) {
                    upsert.gravar(new MobilidadeRegistroUpsert.Linha(r.id(), consultoriaId, alunoId, r.planoVersaoId(),
                            r.secaoUid(), r.itemUid(), r.data(), false, RECUSADO, motivo, r.alteradoNoAparelhoEm()));
                    existentes.putIfAbsent(r.id(), chaveDe(alunoId, r));
                }
                resultados.add(new ResultadoRegistro(r.id(), Situacao.RECUSADO, motivo));
                continue;
            }
            boolean gravou = upsert.gravar(new MobilidadeRegistroUpsert.Linha(r.id(), consultoriaId, alunoId,
                    r.planoVersaoId(), r.secaoUid(), r.itemUid(), r.data(), r.feito(), ACEITO, null,
                    r.alteradoNoAparelhoEm()));
            existentes.putIfAbsent(r.id(), chaveDe(alunoId, r));
            resultados.add(new ResultadoRegistro(r.id(), gravou ? Situacao.ACEITO : Situacao.IGNORADO_ANTIGO, null));
        }
        return new LoteResponse(resultados);
    }

    /** Registros aceitos do próprio aluno (da sessão) no período. */
    @Transactional(readOnly = true)
    public List<RegistroMobilidadeFeito> doAlunoDaSessao(UUID alunoId, LocalDate de, LocalDate ate) {
        return montar(alunoId, de, ate);
    }

    /** Registros aceitos de um aluno, vistos pelo treinador. Aluno de outra consultoria = 404. */
    @Transactional(readOnly = true)
    public List<RegistroMobilidadeFeito> doAluno(UUID alunoId, LocalDate de, LocalDate ate) {
        exigirAluno(alunoId);
        return montar(alunoId, de, ate);
    }

    /** Exportação de dados: todos os registros aceitos, sem o limite de período das telas. Quem chama confere as permissões. */
    @Transactional(readOnly = true)
    public List<RegistroMobilidadeFeito> completoDoAluno(UUID alunoId) {
        exigirAluno(alunoId);
        return carregar(alunoId, LocalDate.of(2000, 1, 1), LocalDate.now(Fuso.BRASILIA).plusDays(366));
    }

    private List<RegistroMobilidadeFeito> montar(UUID alunoId, LocalDate de, LocalDate ate) {
        LocalDate fim = ate == null ? LocalDate.now(Fuso.BRASILIA) : ate;
        LocalDate inicio = de == null ? fim.minusDays(13) : de;
        if (inicio.isAfter(fim) || ChronoUnit.DAYS.between(inicio, fim) > PERIODO_MAXIMO_DIAS) {
            throw new BadRequestException("Período inválido (até 1 ano).");
        }
        return carregar(alunoId, inicio, fim);
    }

    private List<RegistroMobilidadeFeito> carregar(UUID alunoId, LocalDate inicio, LocalDate fim) {
        return registros.findByAlunoIdAndSituacaoAndDataBetweenOrderByDataDescIdAsc(alunoId, ACEITO, inicio, fim).stream()
                .map(r -> new RegistroMobilidadeFeito(r.getPlanoVersaoId(), r.getSecaoUid(), r.getItemUid(), r.getData(),
                        r.isFeito()))
                .toList();
    }

    private void exigirAluno(UUID alunoId) {
        Exigir.existe(alunos.findById(alunoId), () -> new NaoEncontradoException("Aluno não encontrado."));
    }

    /** Índice das versões do lote (já filtradas pela consultoria). Versão que não existe aqui não aparece no mapa. */
    private Map<UUID, IndiceVersao> carregarIndices(List<UUID> versaoIds) {
        Map<UUID, IndiceVersao> indices = new HashMap<>();
        if (versaoIds.isEmpty()) {
            return indices;
        }
        var lista = versoes.findByIdIn(new HashSet<>(versaoIds));
        Map<UUID, UUID> alunoDoPlano = new HashMap<>();
        planos.findAllById(lista.stream().map(PlanoMobilidadeVersao::getPlanoId).distinct().toList())
                .forEach(p -> alunoDoPlano.put(p.getId(), p.getAlunoId()));
        for (PlanoMobilidadeVersao v : lista) {
            Map<UUID, UUID> secaoDoItem = new HashMap<>();
            ConteudoMobilidade conteudo = json.readValue(v.getConteudo(), ConteudoMobilidade.class);
            for (ConteudoMobilidade.Secao secao : conteudo.secoes()) {
                for (ConteudoMobilidade.Item item : secao.itens()) {
                    if (item.uid() != null && secao.uid() != null) {
                        secaoDoItem.put(item.uid(), secao.uid());
                    }
                }
            }
            indices.put(v.getId(), new IndiceVersao(alunoDoPlano.get(v.getPlanoId()), secaoDoItem));
        }
        return indices;
    }

    private static MobilidadeRegistroUpsert.Chave chaveDe(UUID alunoId, RegistroMobilidade r) {
        return new MobilidadeRegistroUpsert.Chave(alunoId, r.planoVersaoId(), r.itemUid(), r.data());
    }

    private static String motivoParaRecusar(RegistroMobilidade r, UUID alunoId, Map<UUID, IndiceVersao> indices,
                                            Map<UUID, MobilidadeRegistroUpsert.Chave> existentes, LocalDate hoje,
                                            Instant limiteFuturo) {
        if (r.id() == null || r.planoVersaoId() == null || r.secaoUid() == null || r.itemUid() == null
                || r.data() == null || r.feito() == null || r.alteradoNoAparelhoEm() == null) {
            return "Registro incompleto.";
        }
        IndiceVersao versao = indices.get(r.planoVersaoId());
        if (versao == null || !alunoId.equals(versao.alunoId())) {
            return "Mobilidade não encontrada para este aluno.";
        }
        UUID secaoDoItem = versao.secaoDoItem().get(r.itemUid());
        if (secaoDoItem == null) {
            return ITEM_FORA_DA_VERSAO;
        }
        if (!secaoDoItem.equals(r.secaoUid())) {
            return "Item não existe nesta seção da mobilidade.";
        }
        return motivoDeDataOuId(r, alunoId, existentes, hoje, limiteFuturo);
    }

    /** Pode guardar o recusado por item inexistente: tudo o mais no registro estaria válido. */
    private static boolean podeGuardarRecusado(RegistroMobilidade r, UUID alunoId,
                                               Map<UUID, MobilidadeRegistroUpsert.Chave> existentes, LocalDate hoje,
                                               Instant limiteFuturo) {
        return motivoDeDataOuId(r, alunoId, existentes, hoje, limiteFuturo) == null;
    }

    private static String motivoDeDataOuId(RegistroMobilidade r, UUID alunoId,
                                           Map<UUID, MobilidadeRegistroUpsert.Chave> existentes, LocalDate hoje,
                                           Instant limiteFuturo) {
        if (r.data().isBefore(hoje.minusDays(DIAS_PARA_TRAS)) || r.data().isAfter(hoje.plusDays(DIAS_PARA_TRAS))) {
            return "Data fora do período aceito (60 dias para trás ou para frente).";
        }
        if (r.alteradoNoAparelhoEm().isAfter(limiteFuturo)) {
            return "Horário do aparelho inválido.";
        }
        MobilidadeRegistroUpsert.Chave existente = existentes.get(r.id());
        if (existente != null && !existente.equals(chaveDe(alunoId, r))) {
            return "Identificador já usado por outro registro.";
        }
        return null;
    }
}
