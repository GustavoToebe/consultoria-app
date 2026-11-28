package br.com.treinos.api.alunos;

import br.com.plataforma.comum.web.BadRequestException;
import br.com.treinos.api.alunos.dto.AlunoDtos.ConviteResponse;
import br.com.treinos.api.auditoria.Auditoria;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Convite de acesso em lote (sem e-mail: o treinador manda os links pelo WhatsApp). Mesma regra do convite individual
 * ({@link ConviteService#impedimento} e {@link ConviteService#emitir}); cada recusa vira a situação do item, sem derrubar os
 * outros. Uma transação só, com os alunos travados em ordem de id: um erro inesperado de banco desfaz a chamada inteira, sem
 * convite parcial nem duplicado. Um evento de auditoria por chamada, com resumo fixo, só quando gerou algum convite. O link
 * leva o código: nunca em log, auditoria nem mensagem de erro.
 */
@Service
public class ConvitesEmLote {

    public enum Situacao { GERADO, JA_TEM_ACESSO, INATIVO, ANONIMIZADO, NAO_ENCONTRADO }

    /** {@code nome} nulo em {@code NAO_ENCONTRADO}; {@code telefone} é o guardado de quem ainda não tem acesso. */
    public record ItemDoConvite(UUID alunoId, String nome, String telefone, Situacao situacao, String link, Instant validoAte) { }

    public record Resultado(List<ItemDoConvite> resultados) { }

    private final AlunoRepository alunos;
    private final ConviteService convites;
    private final Auditoria auditoria;

    ConvitesEmLote(AlunoRepository alunos, ConviteService convites, Auditoria auditoria) {
        this.alunos = alunos;
        this.convites = convites;
        this.auditoria = auditoria;
    }

    @Transactional
    public Resultado gerar(List<UUID> ids) {
        if (ids == null || ids.isEmpty() || ids.size() > AlunoLoteService.LIMITE || ids.contains(null)
                || new HashSet<>(ids).size() != ids.size()) {
            throw new BadRequestException("Escolha de 1 a " + AlunoLoteService.LIMITE + " alunos.");
        }
        // Outra consultoria não volta da consulta (@TenantId) e fica igual a id inexistente.
        Map<UUID, Aluno> achados = alunos.buscarParaAlterarVarios(ids).stream()
                .collect(Collectors.toMap(Aluno::getId, Function.identity()));
        List<ItemDoConvite> resultados = new ArrayList<>(ids.size());
        int gerados = 0;
        for (UUID id : ids) {
            Aluno aluno = achados.get(id);
            if (aluno == null) {
                resultados.add(new ItemDoConvite(id, null, null, Situacao.NAO_ENCONTRADO, null, null));
                continue;
            }
            ConviteService.Impedimento impedimento = ConviteService.impedimento(aluno);
            if (impedimento != null) {
                resultados.add(new ItemDoConvite(id, aluno.getNome(), aluno.getTelefoneSemAcesso(),
                        Situacao.valueOf(impedimento.name()), null, null));
                continue;
            }
            ConviteResponse convite = convites.emitir(aluno);
            resultados.add(new ItemDoConvite(id, aluno.getNome(), aluno.getTelefoneSemAcesso(), Situacao.GERADO,
                    convite.link(), convite.expiraEm()));
            gerados++;
        }
        if (gerados > 0) {
            auditoria.registrarEvento("ALUNOS_CONVITES_GERADOS", "ALUNO", null, "Gerou convites de acesso de alunos em lote.");
        }
        return new Resultado(List.copyOf(resultados));
    }
}
