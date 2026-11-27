package br.com.treinos.api.atencao;

import br.com.treinos.api.alunos.AlunoService;
import br.com.treinos.api.atualizacoes.AtualizacaoRepository;
import br.com.treinos.api.atualizacoes.LinhaEvolucao;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.LongSupplier;

/**
 * Pontos de atenção de uma atualização: avalia as regras vigentes no envio e grava o fato (R3), e lê os fatos para a lista e o
 * detalhe do treinador. Com a chave desligada nada é avaliado e as leituras devolvem nulo (nunca um 0 inventado), sem tocar no banco.
 */
@Service
public class AtencaoDaAtualizacao {

    private final RegrasAtencaoProperties propriedades;
    private final RegraDeAtencaoRepository regras;
    private final ExcecaoDoAlunoRepository excecoes;
    private final AtualizacaoAtencaoRepository fatos;
    private final AtualizacaoRepository atualizacoes;
    private final JsonMapper json;

    public AtencaoDaAtualizacao(RegrasAtencaoProperties propriedades, RegraDeAtencaoRepository regras, ExcecaoDoAlunoRepository excecoes,
            AtualizacaoAtencaoRepository fatos, AtualizacaoRepository atualizacoes, JsonMapper json) {
        this.propriedades = propriedades;
        this.regras = regras;
        this.excecoes = excecoes;
        this.fatos = fatos;
        this.atualizacoes = atualizacoes;
        this.json = json;
    }

    public boolean ligada() {
        return propriedades.habilitado();
    }

    /**
     * Na transação do envio, depois de gravar a atualização e o peso: avalia as regras ativas e grava os fatos. Nulo com a chave
     * desligada. A anterior e os dias com treino só são lidos se alguma regra precisa deles. Erro de banco sobe (a transação inteira
     * volta): nada é engolido aqui.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public List<AvaliadorDeAtencao.Fato> avaliarEGravar(UUID atualizacaoId, UUID alunoId, LocalDate data, JsonNode conteudo,
            JsonNode respostas, LongSupplier diasComTreino) {
        if (!ligada()) {
            return null;
        }
        List<RegraDeAtencao> ativas = regras.findByAtivaTrue();
        if (ativas.isEmpty()) {
            return List.of();
        }
        // Etapa 2: a exceção do aluno desliga a regra só para ele ou troca o número (o fato congela o número usado aqui).
        Map<UUID, ExcecaoDoAluno> doAluno = new HashMap<>();
        excecoes.findByAlunoId(alunoId).forEach(e -> doAluno.put(e.getRegraId(), e));
        List<AvaliadorDeAtencao.Regra> vigentes = new ArrayList<>();
        for (RegraDeAtencao r : ativas) {
            ExcecaoDoAluno e = doAluno.get(r.getId());
            if (e == null || e.isAtiva()) {
                vigentes.add(new AvaliadorDeAtencao.Regra(r.getTipo(), r.getPerguntaId(), e == null ? r.getLimite() : e.getLimite()));
            }
        }
        if (vigentes.isEmpty()) {
            return List.of();
        }
        boolean precisaAnterior = vigentes.stream().anyMatch(r -> r.tipo() == TipoDeRegra.NOTA_CAIU || r.tipo() == TipoDeRegra.PESO_MUDOU);
        boolean precisaDias = vigentes.stream().anyMatch(r -> r.tipo() == TipoDeRegra.POUCOS_TREINOS);
        AvaliadorDeAtencao.Anterior anterior = precisaAnterior ? anterior(alunoId, data) : null;
        Long dias = precisaDias ? diasComTreino.getAsLong() : null;
        List<AvaliadorDeAtencao.Fato> lista = AvaliadorDeAtencao.avaliar(conteudo, respostas, anterior, dias, vigentes);
        Instant agora = Instant.now().truncatedTo(ChronoUnit.MICROS);
        fatos.saveAll(lista.stream().map(f -> new AtualizacaoAtencao(atualizacaoId, f, agora)).toList());
        fatos.flush();
        return lista;
    }

    private AvaliadorDeAtencao.Anterior anterior(UUID alunoId, LocalDate data) {
        List<LinhaEvolucao> linhas = atualizacoes.anteriores(alunoId, data, PageRequest.of(0, 1));
        if (linhas.isEmpty()) {
            return null;
        }
        LinhaEvolucao l = linhas.get(0);
        return new AvaliadorDeAtencao.Anterior(json.readTree(l.conteudo()), json.readTree(l.respostas()));
    }

    /** Fatos de várias atualizações numa consulta por lote; nulo com a chave desligada; atualização sem fato fica com lista vazia. */
    @Transactional(readOnly = true)
    public Map<UUID, List<AvaliadorDeAtencao.Fato>> dasAtualizacoes(Collection<UUID> ids) {
        return ligada() ? lerFatos(ids) : null;
    }

    /** Exportação do aluno (LGPD): os fatos já gravados saem também com a chave desligada. */
    @Transactional(readOnly = true)
    public Map<UUID, List<AvaliadorDeAtencao.Fato>> paraExportar(Collection<UUID> ids) {
        return lerFatos(ids);
    }

    /** Uma exceção do aluno na exportação: só o que ele tem de dele (regra, ligada ou não, número); nunca texto livre. */
    public record ExcecaoExportada(UUID regraId, boolean ativa, BigDecimal limite) { }

    /** Exportação do aluno (LGPD): as exceções dele por regra, na ordem do id da regra; também com a chave desligada. */
    @Transactional(readOnly = true)
    public List<ExcecaoExportada> excecoesParaExportar(UUID alunoId) {
        return excecoes.findByAlunoId(alunoId).stream()
                .map(e -> new ExcecaoExportada(e.getRegraId(), e.isAtiva(), e.getLimite()))
                .sorted(java.util.Comparator.comparing(ExcecaoExportada::regraId)).toList();
    }

    /** Anonimizar e "Excluir minha conta": apaga os fatos de todas as atualizações do aluno e as exceções dele, com a chave ligada ou não. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void apagarDoAluno(UUID consultoriaId, UUID alunoId) {
        fatos.apagarDoAluno(consultoriaId, alunoId);
        excecoes.apagarDoAluno(consultoriaId, alunoId);
    }

    private Map<UUID, List<AvaliadorDeAtencao.Fato>> lerFatos(Collection<UUID> ids) {
        Map<UUID, List<AvaliadorDeAtencao.Fato>> porAtualizacao = new HashMap<>();
        for (UUID id : ids) {
            porAtualizacao.put(id, new ArrayList<>());
        }
        for (List<UUID> lote : AlunoService.lotesDeIds(new ArrayList<>(ids))) {
            for (AtualizacaoAtencao a : fatos.dasAtualizacoes(lote)) {
                porAtualizacao.get(a.getAtualizacaoId()).add(a.fato());
            }
        }
        return porAtualizacao;
    }

    /** Quantos pontos tem cada atualização (só as que têm algum); nulo com a chave desligada. */
    @Transactional(readOnly = true)
    public Map<UUID, Long> contagens(Collection<UUID> ids) {
        if (!ligada()) {
            return null;
        }
        Map<UUID, Long> total = new HashMap<>();
        for (List<UUID> lote : AlunoService.lotesDeIds(new ArrayList<>(ids))) {
            for (AtualizacaoAtencaoRepository.Contagem c : fatos.contagens(lote)) {
                total.put(c.getAtualizacaoId(), c.getPontos());
            }
        }
        return total;
    }
}
