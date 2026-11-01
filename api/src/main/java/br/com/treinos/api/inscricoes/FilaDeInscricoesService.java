package br.com.treinos.api.inscricoes;

import br.com.treinos.api.equipe.MembrosDoFiltro;
import br.com.treinos.api.inscricoes.InscricaoDtos.Contagens;
import br.com.treinos.api.inscricoes.InscricaoDtos.PaginaInscricoes;
import br.com.treinos.api.web.Fuso;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * A fila de interessados vista pela equipe: a lista paginada e as contagens por situação, com os mesmos filtros
 * ({@link FiltrosDaFila}). Fica fora do {@link InscricaoService} (que cuida do atendimento e do envio público) para os
 * filtros mudarem sem mexer no resto. Só lê.
 */
@Service
public class FilaDeInscricoesService {

    private final InscricaoRepository inscricoes;
    private final InscricaoRetornoRepository retornos;
    private final DetalheDaInscricao detalhes;
    private final MembrosDoFiltro membros;

    FilaDeInscricoesService(InscricaoRepository inscricoes, InscricaoRetornoRepository retornos,
                            DetalheDaInscricao detalhes, MembrosDoFiltro membros) {
        this.inscricoes = inscricoes;
        this.retornos = retornos;
        this.detalhes = detalhes;
        this.membros = membros;
    }

    /**
     * Filtros da fila, crus como vieram da rota (lidos e conferidos por {@link FiltrosDaFila#ler}). {@code situacao}:
     * {@code ABERTAS} (padrão: nova, em contato, em negociação), {@code TODAS} ou uma situação. {@code meus} = as
     * inscrições com quem pede; {@code responsavel} = ids de membros e/ou {@code nenhum} (não junto de {@code meus});
     * {@code origem} = origens e/ou {@code NAO_INFORMADA}; {@code busca} = nome (sem acento), e-mail ou dígitos do WhatsApp
     * (4 ou mais); {@code de}/{@code ate} = entrada e {@code atividadeDe}/{@code atividadeAte} = última atividade (dias
     * de Brasília, cada ponta opcional). As contagens usam todos menos a situação.
     */
    public record Filtro(String situacao, UUID meus, List<String> responsavel, List<String> origem, String busca,
                         LocalDate de, LocalDate ate, LocalDate atividadeDe, LocalDate atividadeAte) {
    }

    /** Mais novas primeiro (ordem fixa), em páginas de até 100. */
    @Transactional(readOnly = true)
    public PaginaInscricoes listar(Filtro f, int pagina, int tamanho) {
        FiltrosDaFila filtros = ler(f);
        Page<Inscricao> page = inscricoes.findAll(filtros.especificacao(FiltrosDaFila.situacoes(f.situacao())),
                PageRequest.of(Math.max(0, pagina), Math.clamp(tamanho, 1, 100),
                        Sort.by(Sort.Order.desc("criadaEm"), Sort.Order.asc("id"))));
        return new PaginaInscricoes(detalhes.resumos(page.getContent()), page.getTotalElements());
    }

    /**
     * Quantas há em cada situação com os mesmos filtros (sem a situação) e os retornos pendentes das abertas: atrasados
     * (antes de hoje) e de hoje, de Brasília ({@code meus} = os retornos com quem pede).
     */
    @Transactional(readOnly = true)
    public Contagens contar(Filtro f) {
        FiltrosDaFila filtros = ler(f);
        Map<SituacaoInscricao, Long> por = new EnumMap<>(SituacaoInscricao.class);
        // Uma contagem por situação (são seis): a Specification não agrupa, e a consulta continua filtrada pelo tenant.
        for (SituacaoInscricao s : SituacaoInscricao.values()) {
            por.put(s, inscricoes.count(filtros.especificacao(EnumSet.of(s))));
        }
        long abertas = SituacaoInscricao.ABERTAS.stream().mapToLong(por::get).sum();
        long todas = por.values().stream().mapToLong(Long::longValue).sum();
        LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
        long atrasados = retornos.contarPendentes(SituacaoInscricao.ABERTAS, f.meus(), LocalDate.of(1900, 1, 1),
                hoje.minusDays(1));
        long deHoje = retornos.contarPendentes(SituacaoInscricao.ABERTAS, f.meus(), hoje, hoje);
        return new Contagens(por, abertas, todas, atrasados, deHoje);
    }

    /** Lê o filtro e confere os responsáveis escolhidos (membros desta consultoria, senão 404). */
    private FiltrosDaFila ler(Filtro f) {
        FiltrosDaFila filtros = FiltrosDaFila.ler(f.meus(), f.responsavel(), f.origem(), f.busca(), f.de(), f.ate(),
                f.atividadeDe(), f.atividadeAte());
        if (f.meus() == null) membros.exigir(filtros.responsaveis());
        return filtros;
    }
}
